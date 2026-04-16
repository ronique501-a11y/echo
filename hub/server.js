const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

// Config
const CONFIG = {
  port: process.env.PORT || 3847,
  hubId: crypto.randomBytes(8).toString('hex'),
  encryptionKey: process.env.HUB_KEY || crypto.randomBytes(32).toString('hex'),
  maxMessageAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  rateLimit: {
    messages: 60,    // per minute
    window: 60000
  }
};

// In-memory stores
const sessions = new Map();      // sessionId -> session data
const bots = new Map();           // botId -> bot info
const channels = new Map();       // channelId -> channel info  
const messages = [];               // message history
const rateLimits = new Map();     // ip/botid -> {count, resetTime}

// Simple encryption for messages
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(CONFIG.encryptionKey, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(CONFIG.encryptionKey, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Rate limiting
function checkRateLimit(identifier) {
  const now = Date.now();
  let limit = rateLimits.get(identifier);
  
  if (!limit || now > limit.resetTime) {
    limit = { count: 0, resetTime: now + CONFIG.rateLimit.window };
    rateLimits.set(identifier, limit);
  }
  
  limit.count++;
  return limit.count <= CONFIG.rateLimit.messages;
}

// Generate auth token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Parse JSON safely
function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// Message structure
function createMessage(data, source) {
  const msg = {
    id: crypto.randomBytes(12).toString('hex'),
    timestamp: Date.now(),
    source: source,           // 'telegram', 'discord', 'bot', 'human', 'web'
    sourceId: data.from?.id || data.fromId || 'unknown',
    channelId: data.channelId,
    content: data.content,
    replyTo: data.replyTo,
    attachments: data.attachments || [],
    metadata: data.metadata || {}
  };
  
  messages.push(msg);
  
  // Clean old messages
  const cutoff = Date.now() - CONFIG.maxMessageAge;
  while (messages.length > 0 && messages[0].timestamp < cutoff) {
    messages.shift();
  }
  
  return msg;
}

// Broadcast message to all connected clients
function broadcast(msg, excludeSource = null) {
  // Store in sessions for web clients
  for (const [sessionId, session] of sessions) {
    if (session.channelId === msg.channelId && session.source !== excludeSource) {
      session.send(JSON.stringify({
        type: 'message',
        data: msg
      }));
    }
  }
  
  // Trigger platform connectors
  for (const [botId, bot] of bots) {
    if (bot.source !== excludeSource && bot.webhook) {
      sendToWebhook(bot.webhook, msg);
    }
  }
}

// Send to webhook
function sendToWebhook(webhook, msg) {
  const data = JSON.stringify({
    event: 'message',
    hubId: CONFIG.hubId,
    message: msg
  });
  
  const parsed = url.parse(webhook);
  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };
  
  const req = (parsed.protocol === 'https:' ? https : http).request(options);
  req.write(data);
  req.end();
}

// Handle WebSocket upgrade
function handleWebSocket(req, socket, head) {
  const sessionId = url.parse(req.url, true).query.session;
  
  if (!sessionId || !sessions.has(sessionId)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  
  const session = sessions.get(sessionId);
  
  // Simple WebSocket handshake
  const key = req.headers['sec-websocket-key'];
  const acceptKey = crypto.createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  
  socket.write('HTTP/1.1 101 Switching Protocols\r\n');
  socket.write('Upgrade: websocket\r\n');
  socket.write('Connection: Upgrade\r\n');
  socket.write('Sec-WebSocket-Accept: ' + acceptKey + '\r\n');
  socket.write('\r\n');
  
  session.socket = socket;
  
  socket.on('data', (buffer) => {
    const opcode = buffer[0] & 0x0f;
    if (opcode === 0x08) {
      socket.end();
      return;
    }
    
    if (opcode === 0x01) {
      const length = buffer[1] & 0x7f;
      const payload = buffer.slice(2, 2 + length).toString();
      
      const data = safeJsonParse(decrypt(payload));
      if (data && data.type === 'message') {
        const msg = createMessage(data.data, 'web');
        broadcast(msg);
      }
    }
  });
  
  socket.on('close', () => {
    sessions.delete(sessionId);
  });
  
  // Send recent messages
  const recentMsgs = messages.filter(m => m.channelId === session.channelId).slice(-50);
  session.send(JSON.stringify({
    type: 'history',
    data: recentMsgs
  }));
}

// Parse POST body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(safeJsonParse(body)));
  });
}

// Main HTTP handler
async function handleRequest(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bot-Id, X-Bot-Token, X-Session-Token');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', hubId: CONFIG.hubId, bots: bots.size, messages: messages.length }));
    return;
  }
  
  // Bot registration
  if (pathname === '/api/bot/register' && req.method === 'POST') {
    const body = await parseBody(req);
    
    if (!body || !body.id || !body.token || !body.name) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing required fields: id, token, name' }));
      return;
    }
    
    bots.set(body.id, {
      id: body.id,
      token: body.token,
      name: body.name,
      source: body.source || 'bot',
      channels: body.channels || ['default'],
      webhook: body.webhook || null,
      registered: Date.now()
    });
    
    console.log(`🤖 Bot registered: ${body.name} (${body.id})`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, hubId: CONFIG.hubId }));
    return;
  }
  
  // Bot authentication
  const botId = req.headers['x-bot-id'];
  const botToken = req.headers['x-bot-token'];
  
  if (pathname.startsWith('/api/bot/') && botId && botToken) {
    const bot = bots.get(botId);
    
    if (!bot || bot.token !== botToken) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid bot credentials' }));
      return;
    }
    
    if (!checkRateLimit(botId)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limited' }));
      return;
    }
    
    // Send message from bot
    if (pathname === '/api/bot/message' && req.method === 'POST') {
      const body = await parseBody(req);
      
      if (!body || !body.content) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing content' }));
        return;
      }
      
      const msg = createMessage({
        ...body,
        from: { id: bot.id, name: bot.name }
      }, bot.source);
      
      broadcast(msg, bot.source);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, messageId: msg.id }));
      return;
    }
    
    // Get messages
    if (pathname === '/api/bot/messages' && req.method === 'GET') {
      const channelId = parsed.query.channelId || 'default';
      const since = parseInt(parsed.query.since) || 0;
      
      const msgs = messages
        .filter(m => m.channelId === channelId && m.timestamp > since)
        .slice(-100);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ messages: msgs }));
      return;
    }
    
    // Update bot info
    if (pathname === '/api/bot/update' && req.method === 'POST') {
      const body = await parseBody(req);
      
      if (body.name) bot.name = body.name;
      if (body.webhook) bot.webhook = body.webhook;
      if (body.channels) bot.channels = body.channels;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
  }
  
  // Human web interface
  if (pathname === '/api/web/session' && req.method === 'POST') {
    const body = await parseBody(req);
    
    if (!body || !body.name || !body.password) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing name or password' }));
      return;
    }
    
    // Simple auth - in production, use proper auth
    const sessionToken = generateToken();
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    sessions.set(sessionId, {
      token: sessionToken,
      name: body.name,
      channelId: body.channelId || 'default',
      source: 'web',
      connected: Date.now(),
      send: (data) => {
        if (sessions.get(sessionId)?.socket) {
          const encrypted = encrypt(data);
          const buf = Buffer.alloc(2 + Buffer.byteLength(encrypted));
          buf[0] = 0x81;
          buf[1] = Buffer.byteLength(encrypted);
          buf.write(encrypted, 2);
          sessions.get(sessionId).socket.write(buf);
        }
      }
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessionId, token: sessionToken }));
    return;
  }
  
  // Get channels
  if (pathname === '/api/channels' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      channels: Array.from(channels.values()),
      hubChannels: ['default', 'general', 'bots', 'announcements']
    }));
    return;
  }
  
  // Create channel
  if (pathname === '/api/channels/create' && req.method === 'POST') {
    const body = await parseBody(req);
    
    if (!body || !body.id || !body.name) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing id or name' }));
      return;
    }
    
    channels.set(body.id, {
      id: body.id,
      name: body.name,
      description: body.description || '',
      created: Date.now()
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }
  
  // Hub info
  if (pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hubId: CONFIG.hubId,
      version: '1.0.0',
      uptime: Date.now() - startTime,
      bots: Array.from(bots.values()).map(b => ({ id: b.id, name: b.name, source: b.source })),
      channels: channels.size,
      messages: messages.length
    }));
    return;
  }
  
  // Static files for web UI
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getWebUI());
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
}

// Simple web UI
function getWebUI() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>EchoHub - Universal Bot Bridge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; height: 100vh; display: flex; }
    .sidebar { width: 250px; background: #16213e; padding: 20px; border-right: 1px solid #333; }
    .sidebar h1 { font-size: 1.5rem; margin-bottom: 20px; color: #00d9ff; }
    .channel { padding: 10px; margin: 5px 0; border-radius: 8px; cursor: pointer; background: #1f4068; }
    .channel:hover { background: #2a5a8a; }
    .chat { flex: 1; display: flex; flex-direction: column; }
    .messages { flex: 1; overflow-y: auto; padding: 20px; }
    .message { margin: 10px 0; padding: 10px 15px; background: #1f4068; border-radius: 10px; max-width: 70%; }
    .message.bot { background: #2d4a6d; border-left: 3px solid #00d9ff; }
    .message.web { background: #4a2d6d; border-left: 3px solid #9d4edd; }
    .input-area { padding: 20px; background: #16213e; display: flex; gap: 10px; }
    input { flex: 1; padding: 12px; border-radius: 8px; border: none; background: #1a1a2e; color: #fff; }
    button { padding: 12px 24px; border: none; border-radius: 8px; background: #00d9ff; color: #000; cursor: pointer; font-weight: bold; }
    button:hover { background: #00b8d9; }
    .login { display: flex; flex-direction: column; gap: 20px; padding: 50px; justify-content: center; align-items: center; flex: 1; }
    .login input { width: 300px; }
  </style>
</head>
<body>
  <div class="sidebar">
    <h1>🤖 EchoHub</h1>
    <div id="channels"></div>
  </div>
  <div class="chat">
    <div id="messages" class="messages"></div>
    <div class="input-area">
      <input type="text" id="msgInput" placeholder="Type a message..." />
      <button onclick="send()">Send</button>
    </div>
  </div>
  <script>
    let sessionId = localStorage.getItem('echoSession');
    let channel = 'default';
    
    if (!sessionId) {
      document.body.innerHTML = '<div class="login"><h1>EchoHub</h1><input id="name" placeholder="Your name"><input id="pass" type="password" placeholder="Password"><button onclick="login()">Join</button></div>';
    } else {
      connect();
    }
    
    function login() {
      fetch('/api/web/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: document.getElementById('name').value, password: document.getElementById('pass').value, channelId: channel })
      }).then(r => r.json()).then(data => {
        localStorage.setItem('echoSession', data.sessionId);
        location.reload();
      });
    }
    
    let ws;
    function connect() {
      ws = new WebSocket('ws://' + location.host + '/?session=' + sessionId);
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'message') addMessage(data.data);
        if (data.type === 'history') data.data.forEach(m => addMessage(m));
      };
      ws.onclose = () => setTimeout(connect, 1000);
    }
    
    function addMessage(msg) {
      const div = document.createElement('div');
      div.className = 'message ' + msg.source;
      div.innerHTML = '<strong>' + msg.content + '</strong>';
      document.getElementById('messages').appendChild(div);
      document.getElementById('messages').scrollTop = 99999;
    }
    
    function send() {
      const input = document.getElementById('msgInput');
      if (!input.value.trim()) return;
      ws.send(JSON.stringify({ type: 'message', data: { content: input.value, channelId: channel } }));
      input.value = '';
    }
    
    document.getElementById('msgInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') send(); });
  </script>
</body>
</html>`;
}

// Start server
const startTime = Date.now();
const server = http.createServer(handleRequest);

server.on('upgrade', (req, socket, head) => {
  if (req.headers['upgrade'] === 'websocket') {
    handleWebSocket(req, socket, head);
  }
});

server.listen(CONFIG.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🤖 ECHO HUB - Universal Bot Bridge v1.0           ║
║                                                       ║
║   Hub ID: ${CONFIG.hubId}
║   Port: ${CONFIG.port}
║                                                       ║
║   Endpoints:                                          ║
║   • POST /api/bot/register    - Register bot         ║
║   • POST /api/bot/message     - Send message         ║
║   • GET  /api/bot/messages    - Get messages         ║
║   • GET  /api/info            - Hub info              ║
║   • WebSocket /              - Real-time             ║
║                                                       ║
║   ${new Date().toISOString()}
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down EchoHub...');
  server.close();
  process.exit(0);
});
