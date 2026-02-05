#!/usr/bin/env node
/**
 * Agent Chatroom - Web UI Server
 * HTTP server for static files + WebSocket server for real-time communication
 *
 * This server combines:
 * - HTTP server to serve the web UI (public/ directory)
 * - WebSocket server for agent communication (reuses server.js logic)
 * - Auto-opens browser on startup
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { WebSocketServer } = require('ws');
const { exec } = require('child_process');

const PORT = parseInt(process.env.CHATROOM_PORT || '3030', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');
const HEARTBEAT_INTERVAL = 5000;
const CLIENT_TIMEOUT = 15000;

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Check if server is already running
function isServerRunning() {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.on('error', () => resolve(false));
    socket.connect(PORT, 'localhost');
  });
}

// Open browser cross-platform
function openBrowser(url) {
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    // Linux - try common methods
    command = `xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || firefox "${url}" 2>/dev/null || google-chrome "${url}" 2>/dev/null`;
  }

  exec(command, (err) => {
    if (err) {
      console.log(`Could not auto-open browser. Please navigate to: ${url}`);
    }
  });
}

// Create HTTP server for static files
function createHttpServer() {
  return http.createServer((req, res) => {
    // Parse URL and remove query string
    let urlPath = req.url.split('?')[0];

    // Default to index.html
    if (urlPath === '/') {
      urlPath = '/index.html';
    }

    // Security: prevent directory traversal
    const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(PUBLIC_DIR, safePath);

    // Check if file exists and is within public directory
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(500);
          res.end('Internal Server Error');
        }
        return;
      }

      // Determine content type
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
}

// Create WebSocket server (logic from server.js)
function createWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });
  const clients = new Map();

  console.log(`WebSocket server ready on ws://localhost:${PORT}`);

  // Heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    for (const [ws, info] of clients.entries()) {
      if (!info.alive) {
        console.log(`! ${info.name} (no heartbeat response, terminating)`);
        ws.terminate();
      } else {
        info.alive = false;
        ws.ping();
      }
    }
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws) => {
    let clientInfo = { name: 'unknown', type: 'unknown', alive: true, joinedAt: Date.now() };

    ws.on('pong', () => {
      if (clients.has(ws)) {
        clients.get(ws).alive = true;
      }
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Handle registration
        if (msg.type === 'register') {
          clientInfo = { name: msg.name, type: msg.agentType || 'agent', alive: true, joinedAt: Date.now() };
          clients.set(ws, clientInfo);

          broadcast(clients, {
            type: 'system',
            text: `${clientInfo.name} joined`,
            timestamp: Date.now()
          });

          console.log(`+ ${clientInfo.name} (${clientInfo.type})`);
          return;
        }

        // Handle chat messages
        if (msg.type === 'chat') {
          broadcast(clients, {
            type: 'chat',
            from: msg.from || clientInfo.name,
            agentType: clientInfo.type,
            text: msg.text,
            timestamp: Date.now()
          });
        }

        // Handle discovery broadcasts
        if (msg.type === 'discovery') {
          if (msg.category === 'leaving' && clients.has(ws)) {
            clients.get(ws).leaving = true;
          }

          broadcast(clients, {
            type: 'discovery',
            from: msg.from || clientInfo.name,
            agentType: clientInfo.type,
            category: msg.category,
            text: msg.text,
            timestamp: Date.now()
          });
        }

        // Handle "leaving" notification
        if (msg.type === 'leaving') {
          if (clients.has(ws)) {
            clients.get(ws).leaving = true;
          }
        }

        // Handle "who" query
        if (msg.type === 'who') {
          const online = [];
          for (const [, info] of clients.entries()) {
            online.push({ name: info.name, type: info.type, joinedAt: info.joinedAt });
          }
          ws.send(JSON.stringify({
            type: 'who_response',
            clients: online,
            timestamp: Date.now()
          }));
        }

      } catch (err) {
        console.error('Invalid message:', err.message);
      }
    });

    ws.on('close', (code, reason) => {
      if (clients.has(ws)) {
        const info = clients.get(ws);
        const duration = Math.round((Date.now() - info.joinedAt) / 1000);

        let exitReason = 'disconnected';
        if (code === 1000 || info.leaving) exitReason = 'left normally';
        else if (code === 1001) exitReason = 'going away';
        else if (code === 1006) exitReason = 'connection lost';
        else if (!info.alive) exitReason = 'heartbeat timeout';

        broadcast(clients, {
          type: 'system',
          text: `${info.name} ${exitReason} (was here ${duration}s)`,
          timestamp: Date.now()
        });
        console.log(`- ${info.name} [${exitReason}] (code: ${code}, duration: ${duration}s)`);
        clients.delete(ws);
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
    });
  });

  return wss;
}

// Broadcast message to all connected clients
function broadcast(clients, message) {
  const payload = JSON.stringify(message);
  for (const client of clients.keys()) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}

// Main entry point
async function main() {
  // Check if already running
  if (await isServerRunning()) {
    console.log(`Server already running on port ${PORT}`);
    openBrowser(`http://localhost:${PORT}`);
    return;
  }

  // Create and start HTTP server
  const httpServer = createHttpServer();

  httpServer.listen(PORT, () => {
    console.log(`Agent Chatroom Web UI running at http://localhost:${PORT}`);

    // Open browser after short delay
    setTimeout(() => {
      openBrowser(`http://localhost:${PORT}`);
    }, 500);
  });

  // Attach WebSocket server
  createWebSocketServer(httpServer);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    httpServer.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    httpServer.close();
    process.exit(0);
  });
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { createHttpServer, createWebSocketServer, openBrowser };
