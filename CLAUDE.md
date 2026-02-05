# Agent Chatroom

Real-time chatroom for coordinating multiple Claude Code parallel agents. Enables agent-to-agent communication and user guidance during multi-agent tasks.

## Quick Start

```bash
# Install dependencies
npm install

# Start the web UI (opens browser automatically)
npm start

# Or start with terminal UI
npm run ui:terminal
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Web Browser                          │
│                   (public/app.js)                        │
└─────────────────────┬───────────────────────────────────┘
                      │ WebSocket
┌─────────────────────▼───────────────────────────────────┐
│              web-ui.js (HTTP + WebSocket)                │
│         Serves static files + message routing            │
└─────────────────────┬───────────────────────────────────┘
                      │ WebSocket
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
│   Agent 1   │ │  Agent 2  │ │  Agent N  │
│ (via MCP)   │ │ (via MCP) │ │ (via MCP) │
└─────────────┘ └───────────┘ └───────────┘
```

## File Structure

```
repo/
├── web-ui.js           # HTTP + WebSocket server (new web UI)
├── server.js           # Standalone WebSocket server
├── ui.js               # Terminal UI (blessed-based, legacy)
├── chatroom-mcp.js     # MCP server exposing tools to agents
├── chatroom-tool.js    # Direct WebSocket client library
├── spawn-terminal.js   # Cross-platform terminal opener
├── open-browser.js     # Cross-platform browser opener
├── start.js            # CLI orchestrator
├── install.js          # MCP server installer
├── public/             # Web UI static files
│   ├── index.html      # Main HTML structure
│   ├── app.js          # Frontend JavaScript
│   └── styles.css      # Cyberpunk-themed styling
└── hooks/
    └── scripts/
        └── task-pretool.js  # PreToolUse hook for agent spawning
```

## Key Components

### Web UI (`web-ui.js`, `public/`)

The default interface. Opens in a browser when agents spawn.

- **HTTP Server**: Serves static files from `public/`
- **WebSocket Server**: Handles real-time message routing
- **Auto-opens browser** on startup

### Terminal UI (`ui.js`)

Legacy blessed-based terminal interface. Use `CHATROOM_UI=terminal` or `npm run ui:terminal`.

### MCP Server (`chatroom-mcp.js`)

Exposes chatroom tools to Claude Code agents:

| Tool | Purpose |
|------|---------|
| `chatroom_join(name, type)` | Register with the chatroom |
| `chatroom_leave()` | Disconnect gracefully |
| `chatroom_broadcast(message, category?, name?)` | Send a message |
| `chatroom_check(count?, since?)` | Poll for new messages |
| `chatroom_ask(question, timeout?)` | Ask and wait for answer |
| `chatroom_who()` | List connected clients |

### PreToolUse Hook (`hooks/scripts/task-pretool.js`)

Automatically:
1. Starts the chatroom server when agents spawn
2. Opens the web UI in a browser
3. Injects chatroom instructions into agent prompts

## Message Types

| Type | Fields | Description |
|------|--------|-------------|
| `register` | `name`, `agentType` | Join the chatroom |
| `chat` | `from`, `text`, `agentType` | General message |
| `discovery` | `from`, `category`, `text` | Status update |
| `system` | `text` | Join/leave notifications |
| `who` | - | Query connected clients |

### Discovery Categories

- `found` - Agent discovered something
- `claiming` - Agent claiming a task
- `completed` - Agent finished a task
- `blocked` - Agent is blocked

## Agent Types & Colors

| Type | Color | Glow |
|------|-------|------|
| explorer | Cyan | Yes |
| fixer | Neon green | Yes |
| planner | Gold | No |
| tester | Magenta | Yes |
| agent | White | No |
| user | Electric blue | No |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CHATROOM_PORT` | `3030` | WebSocket/HTTP port |
| `CHATROOM_URL` | `ws://localhost:3030` | Server URL for clients |
| `CHATROOM_USER` | `user` | Display name for user |
| `CHATROOM_UI` | `web` | UI type: `web` or `terminal` |

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start web UI (default) |
| `npm run web` | Start web UI |
| `npm run ui:terminal` | Start terminal UI |
| `npm run server` | Start WebSocket server only |
| `npm run mcp` | Start MCP server only |
| `npm run install-mcp` | Install MCP config in Claude Code |

## Plugin Installation

```bash
# Add as Claude Code plugin
claude plugins add /path/to/repo

# Or install MCP server directly
npm run install-mcp
```

## Development Notes

### Adding New Agent Types

1. Add color to `AGENT_COLORS` in `public/app.js`
2. Add CSS variable in `public/styles.css` (`:root`)
3. Add agent dot style in CSS (`.agent-dot.newtype`)
4. Add message style in CSS (`.message.newtype`)

### Testing Locally

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Simulate an agent
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3030');
ws.on('open', () => {
  ws.send(JSON.stringify({type:'register',name:'test-agent',agentType:'explorer'}));
  ws.send(JSON.stringify({type:'chat',text:'Hello from test agent!'}));
});
ws.on('message', d => console.log(JSON.parse(d)));
"
```

### WebSocket Protocol

Messages are JSON objects sent over WebSocket:

```javascript
// Register
{ type: 'register', name: 'agent-name', agentType: 'explorer' }

// Chat
{ type: 'chat', text: 'message content' }

// Discovery
{ type: 'discovery', category: 'found', text: 'Found something!' }

// Query clients
{ type: 'who' }
```

## Backward Compatibility

The terminal UI is still available:

```bash
# Use terminal UI via environment variable
CHATROOM_UI=terminal npm start

# Or directly
npm run ui:terminal
```
