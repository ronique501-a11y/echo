/**
 * EchoHub - Universal Bot Bridge
 * Production-ready version with all stability features
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const url = require('url');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Configuration
const CONFIG = {
  port: process.env.PORT || 3847,
  hubId: fs.existsSync('/etc/echohub/hub-id') 
    ? fs.readFileSync('/etc/echohub/hub-id', 'utf8').trim()
    : crypto.randomBytes(8).toString('hex'),
  messageFile: process.env.MESSAGE_FILE || path.join(__dirname, '..', 'messages.json'),
  botCredsFile: path.join(__dirname, '..', 'bot-creds.json'),
  statsFile: path.join(__dirname, '..', 'stats.json'),
  maxMessages: 1000,
  heartbeatInterval: 25000,
  heartbeatTimeout: 35000,
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  rateLimitWindow: 60000,
  rateLimitMax: 100,
  botTimeout: 300000,
  verbose: process.env.VERBOSE === 'true'
};

// Ensure hub-id persists
const hubIdDir = '/etc/echohub';
if (!fs.existsSync(hubIdDir)) {
  try { fs.mkdirSync(hubIdDir, { recursive: true }); } catch (e) {}
  try { fs.writeFileSync(path.join(hubIdDir, 'hub-id'), CONFIG.hubId); } catch (e) {}
}

// Structured logging
function log(level, module, message, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...data
  };
  console.log(JSON.stringify(entry));
  
  // Also write to file
  const logFile = path.join(__dirname, '..', 'hub.log');
  try {
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch (e) {}
}

function info(module, msg, data) { log('info', module, msg, data); }
function warn(module, msg, data) { log('warn', module, msg, data); }
function error(module, msg, data) { log('error', module, msg, data); }

// State
const sessions = new Map();
const bots = new Map();
const channels = new Map();
const messages = [];
const onlineUsers = new Set();
const typingUsers = new Map();

// Rate limiting
const rateLimits = new Map();

// Stats
const stats = {
  messagesReceived: 0,
  messagesSent: 0,
  connectionsOpened: 0,
  errors: 0,
  startTime: Date.now()
};

// Load persisted data
function loadMessages() {
  try {
    if (fs.existsSync(CONFIG.messageFile)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.messageFile, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        messages.push(...data.slice(-CONFIG.maxMessages));
        info('storage', `Loaded ${messages.length} messages`);
      }
    }
  } catch (e) {
    error('storage', 'Failed to load messages', { error: e.message });
  }
}

function saveMessages() {
  try {
    fs.writeFileSync(CONFIG.messageFile, JSON.stringify(messages.slice(-CONFIG.maxMessages)));
  } catch (e) {
    error('storage', 'Failed to save messages', { error: e.message });
  }
}

function loadBotCreds() {
  try {
    if (fs.existsSync(CONFIG.botCredsFile)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.botCredsFile, 'utf8'));
      for (const [id, cred] of Object.entries(data)) {
        bots.set(id, { ...cred, registered: Date.now() });
      }
      info('bot', `Loaded ${bots.size} bot credentials`);
    }
  } catch (e) {
    error('storage', 'Failed to load bot credentials', { error: e.message });
  }
}

function saveBotCreds() {
  try {
    const data = {};
    for (const [id, bot] of bots) {
      data[id] = { id: bot.id, token: bot.token, name: bot.name, source: bot.source };
    }
    fs.writeFileSync(CONFIG.botCredsFile, JSON.stringify(data));
  } catch (e) {
    error('storage', 'Failed to save bot credentials', { error: e.message });
  }
}

// Initialize
loadMessages();
loadBotCreds();
channels.set('default', { id: 'default', name: 'General', description: 'Main chat' });
channels.set('bots', { id: 'bots', name: 'Bot Commands', description: 'Bot testing' });

// Auto-save
setInterval(saveMessages, 30000);
setInterval(saveBotCreds, 60000);

// Clean up stale bots
setInterval(() => {
  const now = Date.now();
  for (const [id, bot] of bots) {
    if (bot.lastSeen && now - bot.lastSeen > CONFIG.botTimeout) {
      bots.delete(id);
      info('bot', 'Removed stale bot', { id, name: bot.name });
    }
  }
}, 60000);

// Message helpers
function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

function createMessage(data, source, sourceName, sourceId = null) {
  const msg = {
    id: generateId(),
    timestamp: Date.now(),
    source,
    sourceId: sourceId || generateId(),
    sourceName,
    channelId: data.channelId || 'default',
    content: data.content || ''
  };
  
  if (data.replyTo) msg.replyTo = data.replyTo;
  if (data.attachments) msg.attachments = data.attachments;
  if (data.metadata) msg.metadata = data.metadata;
  
  return msg;
}

// Rate limiting
function checkRateLimit(ip) {
  const now = Date.now();
  let limit = rateLimits.get(ip);
  
  if (!limit || now - limit.window > CONFIG.rateLimitWindow) {
    limit = { count: 1, window: now };
    rateLimits.set(ip, limit);
    return true;
  }
  
  if (limit.count >= CONFIG.rateLimitMax) {
    return false;
  }
  
  limit.count++;
  return true;
}

// Broadcast
function broadcast(msg, exclude = null) {
  stats.messagesSent++;
  
  for (const [id, session] of sessions) {
    if (id === exclude) continue;
    
    if (msg.to) {
      if (session.originalName === msg.to || session.name === msg.to) {
        if (session.ws?.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: 'message', data: msg }));
        }
      }
    } else {
      if (session.channelId === msg.channelId) {
        if (session.ws?.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: 'message', data: msg }));
        }
      }
    }
  }
  
  for (const [botId, bot] of bots) {
    if (bot.source !== msg.source && bot.ws && bot.ws.readyState === WebSocket.OPEN) {
      if (!msg.to) {
        bot.ws.send(JSON.stringify({ type: 'message', data: msg }));
      }
    }
  }
}

// WebSocket Server
const wss = new WebSocket.Server({ noServer: true });

// Heartbeat
function startHeartbeat(ws, session) {
  session.heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, CONFIG.heartbeatInterval);
  
  session.heartbeatTimeout = setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.terminate();
    }
  }, CONFIG.heartbeatTimeout);
}

wss.on('connection', (ws, req, sessionId) => {
  const session = sessions.get(sessionId);
  if (!session) {
    ws.close(4001, 'Unauthorized');
    return;
  }
  
  session.ws = ws;
  session.lastSeen = Date.now();
  session.heartbeat = null;
  session.heartbeatTimeout = null;
  onlineUsers.add(session.name);
  stats.connectionsOpened++;
  
  if (CONFIG.verbose) info('ws', 'Client connected', { sessionId: sessionId.substring(0, 8), name: session.name });
  
  ws.send(JSON.stringify({ type: 'online', data: Array.from(onlineUsers) }));
  broadcast(createMessage({ content: `${session.name} joined`, channelId: session.channelId }, 'system', 'System'));
  
  startHeartbeat(ws, session);
  
  ws.on('message', (data) => {
    if (CONFIG.verbose) info('ws', 'Frame received', { sessionId: sessionId.substring(0, 8) });
    
    const msg = safeJsonParse(data.toString());
    if (!msg) return;
    
    stats.messagesReceived++;
    
    if (msg.type === 'message') {
      const content = (msg.data?.content || '').trim();
      if (!content) return;
      
      // Check rate limit
      const ip = req.socket.remoteAddress;
      if (!checkRateLimit(ip)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded' }));
        return;
      }
      
      let newMsg;
      if (msg.data.dmTo) {
        newMsg = createMessage(msg.data, 'web', session.name, sessionId);
        newMsg.to = msg.data.dmTo;
      } else {
        newMsg = createMessage(msg.data, 'web', session.name, sessionId);
      }
      
      messages.push(newMsg);
      broadcast(newMsg, sessionId);
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message', data: newMsg }));
      }
    }
    else if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      if (session.heartbeatTimeout) clearTimeout(session.heartbeatTimeout);
      startHeartbeat(ws, session);
    }
    else if (msg.type === 'pong') {
      if (session.heartbeatTimeout) clearTimeout(session.heartbeatTimeout);
      startHeartbeat(ws, session);
    }
    else if (msg.type === 'delete') {
      const idx = messages.findIndex(m => m.id === msg.id && m.sourceId === sessionId);
      if (idx !== -1) {
        messages.splice(idx, 1);
        broadcast({ type: 'delete', id: msg.id });
      }
    }
    else if (msg.type === 'edit') {
      const msgObj = messages.find(m => m.id === msg.id && m.sourceId === sessionId);
      if (msgObj) {
        msgObj.content = msg.content;
        msgObj.edited = Date.now();
        broadcast({ type: 'edit', id: msg.id, content: msg.content });
      }
    }
  });
  
  ws.on('close', () => {
    if (session.heartbeat) clearInterval(session.heartbeat);
    if (session.heartbeatTimeout) clearTimeout(session.heartbeatTimeout);
    onlineUsers.delete(session.name);
    session.ws = null;
    broadcast(createMessage({ content: `${session.name} disconnected`, channelId: session.channelId }, 'system', 'System'));
    info('ws', 'Client disconnected', { sessionId: sessionId.substring(0, 8), name: session.name });
  });
  
  ws.on('error', (e) => {
    stats.errors++;
    error('ws', 'WebSocket error', { sessionId: sessionId.substring(0, 8), error: e.message });
  });
  
  ws.on('pong', () => {
    if (session.heartbeatTimeout) clearTimeout(session.heartbeatTimeout);
    startHeartbeat(ws, session);
  });
});

// HTTP Server
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bot-Id, X-Bot-Token');
  
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  
  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      hubId: CONFIG.hubId, 
      online: onlineUsers.size,
      uptime: Date.now() - stats.startTime
    }));
    return;
  }
  
  // Stats endpoint
  if (pathname === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hubId: CONFIG.hubId,
      online: onlineUsers.size,
      onlineUsers: Array.from(onlineUsers),
      bots: Array.from(bots.keys()),
      messageCount: messages.length,
      stats: {
        ...stats,
        uptime: Date.now() - stats.startTime
      }
    }));
    return;
  }
  
  // Bot registration
  if (pathname === '/api/bot/register' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = safeJsonParse(body);
      if (!data?.id || !data?.token || !data?.name) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"Missing required fields"}');
        return;
      }
      
      // Store or update bot
      bots.set(data.id, { 
        ...data, 
        registered: bots.get(data.id)?.registered || Date.now(),
        lastSeen: Date.now()
      });
      
      info('bot', 'Bot registered', { id: data.id, name: data.name });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, hubId: CONFIG.hubId }));
    });
    return;
  }
  
  // Bot authentication
  const botId = req.headers['x-bot-id'];
  const botToken = req.headers['x-bot-token'];
  const bot = bots.get(botId);
  const botAuth = bot?.token === botToken;
  
  // Bot message
  if (pathname === '/api/bot/message' && req.method === 'POST') {
    if (!botAuth) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{"error":"Unauthorized"}');
      return;
    }
    
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = safeJsonParse(body);
      const msg = createMessage({ ...data, from: { id: bot.id, name: bot.name } }, bot.source, bot.name);
      messages.push(msg);
      broadcast(msg);
      
      bot.lastSeen = Date.now();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, messageId: msg.id }));
    });
    return;
  }
  
  // Bot messages fetch
  if (pathname.startsWith('/api/bot/messages') && req.method === 'GET') {
    if (!botAuth) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{"error":"Unauthorized"}');
      return;
    }
    
    const since = parseInt(parsed.query.since) || 0;
    const channelId = parsed.query.channelId || 'default';
    const msgs = messages.filter(m => 
      m.channelId === channelId && 
      m.timestamp > since &&
      m.source !== bot.source
    );
    
    bot.lastSeen = Date.now();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: msgs }));
    return;
  }
  
  // Session creation
  if (pathname === '/api/session' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = safeJsonParse(body);
      if (!data?.name) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"Name required"}');
        return;
      }
      
      const sessionId = crypto.randomBytes(16).toString('hex');
      sessions.set(sessionId, { 
        name: data.name, 
        originalName: data.name, 
        channelId: data.channelId || 'default', 
        ws: null 
      });
      
      info('session', 'Session created', { sessionId: sessionId.substring(0, 8), name: data.name });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionId, displayName: data.name }));
    });
    return;
  }
  
  // Online users
  if (pathname === '/api/online' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ users: Array.from(onlineUsers) }));
    return;
  }
  
  // Messages
  if (pathname === '/api/messages' && req.method === 'GET') {
    const channelId = parsed.query.channelId || 'default';
    const msgs = messages.filter(m => m.channelId === channelId).slice(-100);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: msgs }));
    return;
  }
  
  // Channels
  if (pathname === '/api/channels' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ channels: Array.from(channels.values()) }));
    return;
  }
  
  // Bots list
  if (pathname === '/api/bots' && req.method === 'GET') {
    const botList = Array.from(bots.values()).map(b => ({
      id: b.id,
      name: b.name,
      source: b.source,
      online: b.ws?.readyState === WebSocket.OPEN
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ bots: botList }));
    return;
  }
  
  // Serve HTML
  if (pathname === '/' || pathname === '/simple') {
    const htmlPath = path.join(__dirname, 'simple.html');
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
  }
  
  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end('{"error":"Not found"}');
});

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  const parsed = url.parse(request.url, true);
  const sessionId = parsed.query.session;
  
  if (!sessionId || !sessions.has(sessionId)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, sessionId);
  });
});

// Error handling
process.on('uncaughtException', (err) => {
  error('process', 'Uncaught exception', { error: err.message, stack: err.stack });
  stats.errors++;
});

process.on('unhandledRejection', (reason, promise) => {
  error('process', 'Unhandled rejection', { reason: String(reason) });
  stats.errors++;
});

process.on('SIGINT', () => {
  info('process', 'Shutting down');
  saveMessages();
  saveBotCreds();
  server.close();
  process.exit(0);
});

// Start
server.listen(CONFIG.port, () => {
  info('server', `EchoHub v2.0 running on port ${CONFIG.port}`, { hubId: CONFIG.hubId });
});

module.exports = { server, wss, CONFIG };
