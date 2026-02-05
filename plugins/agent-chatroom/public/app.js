/**
 * Agent Chatroom - Web UI Client
 * WebSocket client for real-time agent communication
 */

// Configuration
const WS_PORT = window.location.port || 3030;
const WS_URL = `ws://${window.location.hostname}:${WS_PORT}`;
const USER_NAME = 'user';
const RECONNECT_DELAY = 3000;
const MAX_MESSAGES = 500;

// Agent type colors (matching terminal UI)
const AGENT_COLORS = {
  explorer: 'explorer',
  fixer: 'fixer',
  planner: 'planner',
  tester: 'tester',
  agent: 'agent',
  user: 'user',
  observer: 'observer'
};

// Category icons
const CATEGORY_ICONS = {
  found: 'FOUND',
  claiming: 'CLAIM',
  completed: 'DONE',
  blocked: 'BLOCK'
};

// State
let ws = null;
let connected = false;
let autoScroll = true;
let messageCount = 0;
const connectedAgents = new Map();

// DOM Elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const messageLog = document.getElementById('message-log');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const scrollIndicator = document.getElementById('scroll-indicator');
const agentList = document.getElementById('agent-list');
const agentCount = document.getElementById('agent-count');
const clock = document.getElementById('clock');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initEventListeners();
  connect();
});

// Clock display
function initClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Event listeners
function initEventListeners() {
  // Send message on button click
  sendBtn.addEventListener('click', sendMessage);

  // Send message on Enter key
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Track scroll position for auto-scroll
  messageLog.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = messageLog;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    autoScroll = isAtBottom;
    scrollIndicator.classList.toggle('visible', !isAtBottom && messageCount > 0);
  });

  // Scroll to bottom when clicking indicator
  scrollIndicator.addEventListener('click', () => {
    scrollToBottom();
    scrollIndicator.classList.remove('visible');
  });

  // Focus input on page load
  messageInput.focus();
}

// WebSocket connection
function connect() {
  updateStatus('connecting');

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      updateStatus('connected');

      // Register as user
      ws.send(JSON.stringify({
        type: 'register',
        name: USER_NAME,
        agentType: 'user'
      }));

      // Query connected agents
      ws.send(JSON.stringify({ type: 'who' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.onclose = () => {
      updateStatus('disconnected');
      addSystemMessage('Disconnected. Reconnecting...');
      setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

  } catch (e) {
    console.error('Failed to connect:', e);
    updateStatus('disconnected');
    setTimeout(connect, RECONNECT_DELAY);
  }
}

// Handle incoming messages
function handleMessage(msg) {
  switch (msg.type) {
    case 'system':
      addSystemMessage(msg.text);
      updateAgentFromSystem(msg.text);
      break;

    case 'chat':
      addChatMessage(msg);
      break;

    case 'discovery':
      addDiscoveryMessage(msg);
      break;

    case 'who_response':
      updateAgentRoster(msg.clients);
      break;

    default:
      console.log('Unknown message type:', msg.type);
  }
}

// Update connection status
function updateStatus(status) {
  connected = status === 'connected';

  statusDot.className = 'status-dot ' + status;

  switch (status) {
    case 'connected':
      statusText.textContent = 'CONNECTED';
      break;
    case 'connecting':
      statusText.textContent = 'CONNECTING';
      break;
    case 'disconnected':
      statusText.textContent = 'DISCONNECTED';
      connectedAgents.clear();
      renderAgentRoster();
      break;
  }
}

// Send a message
function sendMessage() {
  const text = messageInput.value.trim();

  if (!text || !ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  ws.send(JSON.stringify({
    type: 'chat',
    text: text
  }));

  messageInput.value = '';
  messageInput.focus();
}

// Add a system message
function addSystemMessage(text) {
  const div = createMessageElement({
    type: 'system',
    text: text,
    timestamp: Date.now()
  });

  appendMessage(div);
}

// Add a chat message
function addChatMessage(msg) {
  const div = createMessageElement(msg);
  appendMessage(div);
}

// Add a discovery message
function addDiscoveryMessage(msg) {
  const div = createMessageElement(msg);
  appendMessage(div);
}

// Create message DOM element
function createMessageElement(msg) {
  const div = document.createElement('div');
  const agentType = msg.agentType || 'agent';

  div.className = `message ${msg.type === 'system' ? 'system' : agentType}`;

  if (msg.type === 'system') {
    div.innerHTML = `
      <span class="message-text">-- ${escapeHtml(msg.text)} --</span>
    `;
  } else {
    const time = formatTime(msg.timestamp);
    const sender = msg.from || 'unknown';
    let textContent = escapeHtml(msg.text);

    // Add category badge for discovery messages
    if (msg.type === 'discovery' && msg.category) {
      const categoryLabel = CATEGORY_ICONS[msg.category] || msg.category.toUpperCase();
      textContent = `<span class="category-badge ${msg.category}">${categoryLabel}</span>${textContent}`;
    }

    div.innerHTML = `
      <span class="message-time">${time}</span>
      <span class="message-sender">[${escapeHtml(sender)}]</span>
      <span class="message-text">${textContent}</span>
    `;
  }

  return div;
}

// Append message to log
function appendMessage(element) {
  messageLog.appendChild(element);
  messageCount++;

  // Trim old messages if needed
  while (messageLog.children.length > MAX_MESSAGES) {
    messageLog.removeChild(messageLog.firstChild);
  }

  // Auto-scroll if enabled
  if (autoScroll) {
    scrollToBottom();
  } else {
    scrollIndicator.classList.add('visible');
  }
}

// Scroll to bottom
function scrollToBottom() {
  messageLog.scrollTop = messageLog.scrollHeight;
  autoScroll = true;
}

// Format timestamp
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update agent roster from system messages
function updateAgentFromSystem(text) {
  // Parse join messages: "agentName joined"
  const joinMatch = text.match(/^(.+) joined$/);
  if (joinMatch) {
    const name = joinMatch[1];
    // Will be updated with full info when who_response arrives
    connectedAgents.set(name, { name, type: 'agent', joinedAt: Date.now() });
    ws.send(JSON.stringify({ type: 'who' }));
    return;
  }

  // Parse leave messages: "agentName left normally (was here Xs)"
  const leaveMatch = text.match(/^(.+) (?:left normally|disconnected|going away|connection lost|heartbeat timeout)/);
  if (leaveMatch) {
    const name = leaveMatch[1];
    connectedAgents.delete(name);
    renderAgentRoster();
  }
}

// Update full agent roster
function updateAgentRoster(clients) {
  connectedAgents.clear();

  for (const client of clients) {
    connectedAgents.set(client.name, {
      name: client.name,
      type: client.type || 'agent',
      joinedAt: client.joinedAt
    });
  }

  renderAgentRoster();
}

// Render agent roster UI
function renderAgentRoster() {
  agentCount.textContent = connectedAgents.size;
  agentList.innerHTML = '';

  for (const [name, info] of connectedAgents) {
    const li = document.createElement('li');
    li.className = 'agent-item';
    li.innerHTML = `
      <span class="agent-dot ${info.type}"></span>
      <span class="agent-name">${escapeHtml(name)}</span>
      <span class="agent-type">${escapeHtml(info.type)}</span>
    `;
    agentList.appendChild(li);
  }
}
