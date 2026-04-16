const http = require('http');
const https = require('https');
const crypto = require('crypto');
const url = require('url');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CONFIG = {
  port: process.env.PORT || 3847,
  hubId: crypto.randomBytes(8).toString('hex'),
  messageFile: path.join(__dirname, '..', 'messages.json'),
  // Encryption key (in production, use env var)
  encryptionKey: crypto.randomBytes(32).toString('hex').substring(0, 32)
};

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(CONFIG.encryptionKey), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  try {
    const parts = text.split(':');
    if (parts.length !== 2) return text;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(CONFIG.encryptionKey), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return text;
  }
}

const sessions = new Map();
const bots = new Map();
const channels = new Map();
const messages = [];
const onlineUsers = new Set();
const typingUsers = new Map();

// Load saved messages
try {
  if (fs.existsSync(CONFIG.messageFile)) {
    const saved = JSON.parse(fs.readFileSync(CONFIG.messageFile, 'utf8'));
    messages.push(...saved);
    console.log(`[Hub] Loaded ${saved.length} saved messages`);
  }
} catch (e) {}

// Save messages periodically and on shutdown
function saveMessages() {
  try {
    fs.writeFileSync(CONFIG.messageFile, JSON.stringify(messages.slice(-1000)));
  } catch (e) {}
}
setInterval(saveMessages, 30000);
process.on('SIGINT', () => { saveMessages(); process.exit(0); });

channels.set('default', { id: 'default', name: 'General', description: 'Main chat' });
channels.set('bots', { id: 'bots', name: 'Bot Commands', description: 'Bot testing' });

const wss = new WebSocket.Server({ noServer: true });

console.log('[WS] WebSocket server initialized on /ws path');

function createMessage(data, source, sourceName, sourceId) {
  const msg = {
    id: crypto.randomBytes(12).toString('hex'),
    timestamp: Date.now(),
    source: source,
    sourceId: sourceId || 'unknown',
    sourceName: sourceName || 'Unknown',
    channelId: data.channelId || 'default',
    content: data.content,
    // For DMs - only show to specific recipient
    to: data.to || null,
    // Verify sender identity
    verified: true
  };
  messages.push(msg);
  if (messages.length > 500) messages.shift();
  return msg;
}

function broadcast(msg, exclude = null) {
  // Send to user sessions
  for (const [id, session] of sessions) {
    if (id === exclude) continue; // Don't send to sender
    
    // Check if this is a DM
    if (msg.to) {
      // For DMs, only send to the recipient
      if (session.originalName === msg.to || session.name === msg.to) {
        if (session.ws?.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: 'message', data: msg }));
        }
      }
    } else {
      // For public messages, send to everyone in channel
      if (session.channelId === msg.channelId) {
        if (session.ws?.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: 'message', data: msg }));
        }
      }
    }
  }
  // Send to bots via WebSocket
  for (const [botId, bot] of bots) {
    if (bot.source !== msg.source && bot.ws && bot.ws.readyState === WebSocket.OPEN) {
      // Bots get public messages only
      if (!msg.to) {
        bot.ws.send(JSON.stringify({ type: 'message', data: msg }));
      }
    }
  }
}

function broadcastAll(data) {
  for (const [id, session] of sessions) {
    if (session.ws?.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify(data));
    }
  }
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

wss.on('connection', (ws, req) => {
  const parsed = url.parse(req.url, true);
  
  // Check for bot authentication
  const botId = parsed.query.botId;
  const botToken = parsed.query.botToken;
  const bot = botId ? bots.get(botId) : null;
  
  if (bot && bot.token === botToken) {
    // Bot connection
    bot.ws = ws;
    bot.online = true;
    console.log(`🤖 Bot connected: ${bot.name}`);
    
    ws.send(JSON.stringify({ type: 'bot_connected', botId: bot.id, botName: bot.name }));
    broadcast({ type: 'bot_online', data: { id: bot.id, name: bot.name } });
    
    ws.on('message', (data) => {
      const msg = safeJsonParse(data.toString());
      if (msg?.type === 'message') {
        const newMsg = createMessage({ ...msg.data, from: { id: bot.id, name: bot.name } }, bot.source, bot.name);
        broadcast(newMsg);
      }
    });
    
    ws.on('close', () => {
      bot.online = false;
      bot.ws = null;
      console.log(`🤖 Bot disconnected: ${bot.name}`);
    });
    return;
  }
  
  // User session connection
  const sessionId = parsed.query.session;
  if (!sessionId || !sessions.has(sessionId)) {
    ws.close(4001, 'Unauthorized');
    return;
  }
  
  const session = sessions.get(sessionId);
  session.ws = ws;
  onlineUsers.add(session.name);
  
  ws.send(JSON.stringify({ type: 'online', data: Array.from(onlineUsers) }));
  broadcast({ ...createMessage({ content: `${session.name} joined`, channelId: session.channelId }, 'system', 'System'), sourceName: 'System' });
  
    ws.on('message', (data) => {
      const msg = safeJsonParse(data.toString());
      if (msg?.type === 'message') {
        const content = msg.data.content || '';
        
        let newMsg;
        
        // Check for DM recipient in message data
        if (msg.data.dmTo) {
          // This is a DM
          newMsg = createMessage({
            ...msg.data,
            content: content
          }, 'web', session.name, sessionId);
          newMsg.to = msg.data.dmTo;
        } else {
          newMsg = createMessage(msg.data, 'web', session.name, sessionId);
        }
        
        broadcast(newMsg, sessionId);
      } else if (msg?.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      } else if (msg?.type === 'delete') {
        const idx = messages.findIndex(m => m.id === msg.id && m.sourceId === sessionId);
        if (idx !== -1) {
          messages.splice(idx, 1);
          broadcast({ type: 'delete', id: msg.id });
        }
      } else if (msg?.type === 'edit') {
        const msgObj = messages.find(m => m.id === msg.id && m.sourceId === sessionId);
        if (msgObj) {
          msgObj.content = msg.content;
          msgObj.edited = Date.now();
          broadcast({ type: 'edit', id: msg.id, content: msg.content });
        }
      }
    });
  
  ws.on('close', () => {
    onlineUsers.delete(session.name);
    session.ws = null;
    broadcast(createMessage({ content: `${session.name} disconnected`, channelId: session.channelId }, 'system', 'System'));
  });
});

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bot-Id, X-Bot-Token');
  
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', hubId: CONFIG.hubId, online: onlineUsers.size }));
    return;
  }
  
  if (pathname === '/api/bot/register' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = safeJsonParse(body);
      if (!data?.id || !data?.token || !data?.name) {
        res.writeHead(400); res.end('{"error":"Missing fields"}'); return;
      }
      bots.set(data.id, { ...data, registered: Date.now() });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, hubId: CONFIG.hubId }));
    });
    return;
  }
  
  const botId = req.headers['x-bot-id'];
  const botToken = req.headers['x-bot-token'];
  const bot = bots.get(botId);
  
  if (pathname === '/api/bot/message' && req.method === 'POST' && bot?.token === botToken) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = safeJsonParse(body);
      const msg = createMessage({ ...data, from: { id: bot.id, name: bot.name } }, bot.source, bot.name);
      broadcast(msg);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, messageId: msg.id }));
    });
    return;
  }
  
  if (pathname === '/api/bot/messages' && req.method === 'GET' && bot?.token === botToken) {
    const msgs = messages.filter(m => m.channelId === (parsed.query.channelId || 'default')).slice(-100);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: msgs }));
    return;
  }
  
  if (pathname === '/api/session' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = safeJsonParse(body);
      if (!data?.name) { res.writeHead(400); res.end('{"error":"Name required"}'); return; }
      const sessionId = crypto.randomBytes(16).toString('hex');
      // Hash the display name for privacy
      const displayName = crypto.createHash('sha256').update(data.name + CONFIG.hubId).digest('hex').substring(0, 8);
      sessions.set(sessionId, { name: displayName, originalName: data.name, channelId: data.channelId || 'default', ws: null });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionId, displayName }));
    });
    return;
  }
  
  if (pathname === '/api/online' && req.method === 'GET') {
    const allUsers = [...Array.from(onlineUsers), ...Array.from(bots.values()).map(b => b.name)];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ users: allUsers }));
    return;
  }
  
  if (pathname === '/api/bots' && req.method === 'GET') {
    const botList = Array.from(bots.values()).map(b => ({
      id: b.id,
      name: b.name,
      online: b.online || false,
      source: b.source
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ bots: botList }));
    return;
  }
  
  if (pathname === '/api/messages' && req.method === 'GET') {
    const sessionId = parsed.query.session;
    const session = sessions.get(sessionId);
    const channelId = parsed.query.channelId || 'default';
    
    // Get messages: public messages in channel OR DMs to/from this user
    const msgs = messages.filter(m => {
      if (m.channelId !== channelId) return false;
      // Public messages
      if (!m.to) return true;
      // DMs - only show if sender or recipient
      if (m.sourceId === sessionId) return true;
      if (m.to === session?.name || m.to === session?.originalName) return true;
      return false;
    }).slice(-50);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: msgs }));
    return;
  }
  
  if (pathname === '/api/channels' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ channels: Array.from(channels.values()) }));
    return;
  }
  
  if (pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hubId: CONFIG.hubId,
      version: '1.4.0',
      bots: bots.size,
      online: onlineUsers.size,
      messages: messages.length,
      encrypted: true
    }));
    return;
  }
  
  if (pathname === '/api/typing' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const data = safeJsonParse(body);
      if (data.sessionId && sessions.has(data.sessionId)) {
        typingUsers.set(data.sessionId, Date.now());
        broadcast({ type: 'typing', data: { user: sessions.get(data.sessionId).name } });
      }
      res.writeHead(200); res.end('{}');
    });
    return;
  }
  
  if (pathname === '/' || pathname === '/index.html' || pathname === '/simple') {
    const simpleHtml = require('fs').readFileSync(__dirname + '/simple.html', 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(simpleHtml);
    return;
  }
  
  if (pathname === '/test.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html>
<head><title>EchoHub Test</title></head>
<body>
<h1>EchoHub Connection Test</h1>
<div id="output" style="padding:20px;font-family:monospace;"></div>
<script>
const output = document.getElementById('output');
function log(msg) {
  output.innerHTML += msg + '<br>';
  console.log(msg);
}
let sessionId = '';
async function test() {
  log('Testing EchoHub connection...');
  log('<br>1. Creating session...');
  try {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TestUser', channelId: 'default' })
    });
    const data = await res.json();
    log('✅ Session ID: ' + data.sessionId);
    sessionId = data.sessionId;
  } catch (e) {
    log('❌ Session error: ' + e.message);
    return;
  }
  log('<br>2. Connecting WebSocket...');
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = protocol + '//' + location.host + '/ws?session=' + sessionId;
  log('URL: ' + wsUrl);
  ws = new WebSocket(wsUrl);
  ws.onopen = () => { log('✅ WebSocket connected!'); ws.close(); };
  ws.onerror = (e) => { log('❌ WebSocket error'); };
}
test();
</script>
</body>
</html>`);
    return;
  }
  
  res.writeHead(404); res.end('Not found');
});

server.on('upgrade', (req, socket, head) => {
  const parsed = url.parse(req.url, true);
  console.log(`[WS] Upgrade request: ${parsed.pathname}`);
  if (parsed.pathname === '/ws') {
    try {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch (e) {
      console.log('[WS] Handle error:', e.message);
    }
  } else {
    console.log(`[WS] Unknown path: ${parsed.pathname}`);
    socket.destroy();
  }
});

function getWebUI() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>EchoHub</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f0f1a; color: #e0e0e0; height: 100vh; }
    .app { display: flex; height: 100vh; }
    .sidebar { width: 260px; background: #1a1a2e; border-right: 1px solid #2a2a4e; display: flex; flex-direction: column; }
    .sidebar-header { padding: 20px; border-bottom: 1px solid #2a2a4e; }
    .sidebar-header h1 { color: #00d9ff; font-size: 1.4rem; }
    .section { padding: 15px 20px 10px; }
    .section-title { font-size: 0.75rem; text-transform: uppercase; color: #666; letter-spacing: 1px; margin-bottom: 10px; }
    .online-user, .channel { padding: 10px 15px; display: flex; align-items: center; gap: 10px; border-radius: 8px; margin: 3px 0; cursor: pointer; }
    .online-user:hover, .channel:hover, .channel.active { background: #2a2a4e; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8rem; }
    .status { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; margin-left: auto; }
    .profile { margin-top: auto; padding: 15px; border-top: 1px solid #2a2a4e; }
    .profile button { width: 100%; padding: 12px; background: #2a2a4e; border: none; border-radius: 8px; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 10px; }
    .chat-area { flex: 1; display: flex; flex-direction: column; }
    .chat-header { padding: 15px 25px; background: #1a1a2e; border-bottom: 1px solid #2a2a4e; display: flex; align-items: center; justify-content: space-between; }
    .messages { flex: 1; overflow-y: auto; padding: 20px 25px; display: flex; flex-direction: column; gap: 12px; }
    .message { max-width: 70%; padding: 12px 16px; border-radius: 16px; line-height: 1.4; }
    .message.incoming { background: #2a2a4e; align-self: flex-start; border-bottom-left-radius: 4px; }
    .message.outgoing { background: #00d9ff; color: #000; align-self: flex-end; border-bottom-right-radius: 4px; }
    .message.system { background: transparent; color: #666; text-align: center; font-size: 0.8rem; max-width: 100%; }
    .message .sender { font-size: 0.75rem; color: #00d9ff; margin-bottom: 4px; font-weight: 600; }
    .message.outgoing .sender { color: #006680; }
    .message .time { font-size: 0.65rem; color: #888; margin-top: 4px; }
    .input-area { padding: 20px 25px; background: #1a1a2e; border-top: 1px solid #2a2a4e; display: flex; gap: 12px; }
    .input-area input { flex: 1; padding: 14px 18px; background: #2a2a4e; border: 1px solid #3a3a5e; border-radius: 24px; color: #fff; font-size: 0.95rem; outline: none; }
    .input-area input:focus { border-color: #00d9ff; }
    .input-area button { padding: 14px 24px; background: #00d9ff; border: none; border-radius: 24px; color: #000; font-weight: bold; cursor: pointer; }
    .login-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
    .login-box { background: #1a1a2e; padding: 40px; border-radius: 20px; text-align: center; width: 350px; }
    .login-box h1 { font-size: 2rem; color: #00d9ff; margin-bottom: 10px; }
    .login-box p { color: #888; margin-bottom: 30px; }
    .login-box input { width: 100%; padding: 14px; margin: 10px 0; background: #2a2a4e; border: 1px solid #3a3a5e; border-radius: 10px; color: #fff; font-size: 1rem; text-align: center; }
    .login-box button { width: 100%; padding: 14px; margin-top: 20px; background: #00d9ff; border: none; border-radius: 10px; color: #000; font-weight: bold; font-size: 1rem; cursor: pointer; }
    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 100; align-items: center; justify-content: center; }
    .modal.show { display: flex; }
    .modal-content { background: #1a1a2e; padding: 30px; border-radius: 20px; width: 400px; max-width: 90%; }
    .modal-content h2 { margin-bottom: 20px; color: #00d9ff; }
    .modal-content input, .modal-content select { width: 100%; padding: 12px; margin: 10px 0; background: #2a2a4e; border: 1px solid #3a3a5e; border-radius: 8px; color: #fff; }
    .btn-row { display: flex; gap: 10px; margin-top: 20px; }
    .btn-row button { flex: 1; padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
    .btn-save { background: #00d9ff; color: #000; }
    .btn-cancel { background: #444; color: #fff; }
  </style>
</head>
<body>
  <div class="login-screen" id="loginScreen">
    <div class="login-box">
      <h1>🤖 EchoHub</h1>
      <p>Universal Bot Bridge</p>
      <input type="text" id="nameInput" placeholder="Your name..." />
      <button id="joinBtn" onclick="window.testJoin()">Join</button>
      <div id="joinError" style="color:#ff6b6b;margin-top:10px;font-size:0.9rem;"></div>
      <div id="debugLog" style="margin-top:20px;font-size:0.8rem;color:#666;text-align:left;max-height:100px;overflow:auto;"></div>
    </div>
  </div>
  
  <div class="app" id="appScreen" style="display: none;">
    <div class="sidebar">
      <div class="sidebar-header">
        <h1>🤖 EchoHub</h1>
      </div>
      <div class="section">
        <div class="section-title">Online</div>
        <div id="onlineList"></div>
      </div>
      <div class="section">
        <div class="section-title">🤖 Bots</div>
        <div id="botList"></div>
      </div>
      <div class="section">
        <div class="section-title">Channels</div>
        <div id="channelList"></div>
      </div>
      <div class="profile">
        <button onclick="showSettings()">
          <span>👤</span>
          <span id="myName">Me</span>
          <span style="margin-left:auto;">⚙️</span>
        </button>
      </div>
    </div>
    
    <div class="chat-area">
      <div class="chat-header">
        <h2 id="channelName">#general</h2>
        <span id="onlineCount">0 online</span>
      </div>
      <div class="messages" id="messages"></div>
      <div class="input-area">
        <input type="text" id="msgInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter')send()" />
        <button onclick="send()">Send</button>
      </div>
    </div>
  </div>
  
  <div class="modal" id="settingsModal">
    <div class="modal-content">
      <h2>⚙️ Settings</h2>
      <label>Name</label>
      <input type="text" id="settingsName" />
      <label>Channel</label>
      <select id="settingsChannel">
        <option value="default">General</option>
        <option value="bots">Bot Commands</option>
      </select>
      <div class="btn-row">
        <button class="btn-cancel" onclick="hideSettings()">Cancel</button>
        <button class="btn-save" onclick="saveSettings()">Save</button>
      </div>
    </div>
  </div>

  <script>
    let sessionId = localStorage.getItem('echoSession');
    let myName = localStorage.getItem('echoName') || 'User';
    let channel = 'default';
    let ws = null;
    
    function log(msg) {
      console.log(msg);
      const debug = document.getElementById('debugLog');
      if (debug) debug.innerHTML += msg + '<br>';
    }
    
    window.testJoin = async function() {
      log('join() called');
      const name = document.getElementById('nameInput').value.trim();
      log('Name: ' + name);
      if (!name) {
        document.getElementById('joinError').textContent = 'Please enter your name';
        return;
      }
      
      const joinBtn = document.getElementById('joinBtn');
      joinBtn.textContent = 'Connecting...';
      joinBtn.disabled = true;
      
      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, channelId: channel })
        });
        
        if (!res.ok) throw new Error('Server error: ' + res.status);
        
        const data = await res.json();
        if (!data.sessionId) throw new Error('No session ID returned');
        
        sessionId = data.sessionId;
        localStorage.setItem('echoName', name);
        localStorage.setItem('echoSession', sessionId);
        myName = name;
        
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appScreen').style.display = 'flex';
        document.getElementById('myName').textContent = name;
        
        loadMessages();
        connect();
        setInterval(refreshOnline, 3000);
        setInterval(refreshBots, 5000);
        refreshBots();
        
      } catch (e) {
        document.getElementById('joinError').textContent = 'Error: ' + e.message;
        joinBtn.textContent = 'Join';
        joinBtn.disabled = false;
        console.error('Join error:', e);
      }
    }
    
    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + location.host + '/ws?session=' + sessionId;
      console.log('Connecting to:', wsUrl);
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        console.log('WebSocket Connected!');
        document.getElementById('loginScreen').innerHTML = '<div style="color:#4ade80;text-align:center;padding:40px;">✅ Connected! Loading...</div>';
      };
      ws.onerror = (e) => {
        console.log('WebSocket Error:', e);
        alert('WebSocket error! Check console.');
      };
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'message') addMessage(data.data);
        if (data.type === 'online') updateOnline(data.data);
      };
      ws.onclose = (e) => {
        console.log('WebSocket closed:', e.code, e.reason);
        if (e.code !== 1000) setTimeout(connect, 2000);
      };
    }
    
    async function loadMessages() {
      try {
        const res = await fetch('/api/messages?channelId=' + channel);
        const data = await res.json();
        document.getElementById('messages').innerHTML = '';
        data.messages.forEach(m => addMessage(m, false));
      } catch (e) {
        console.log('Load messages error:', e.message);
        document.getElementById('messages').innerHTML = '<div style="color:#ff6b6b;padding:20px;">Error loading messages</div>';
      }
    }
    
    async function refreshOnline() {
      const res = await fetch('/api/online');
      const data = await res.json();
      updateOnline(data.users);
    }
    
    async function refreshBots() {
      try {
        const res = await fetch('/api/bots');
        const data = await res.json();
        updateBots(data.bots || []);
      } catch (e) {
        console.log('Bot fetch error');
      }
    }
    
    function updateOnline(users) {
      document.getElementById('onlineList').innerHTML = users.map(u => 
        '<div class="online-user" onclick="selectUser(\'' + u + '\')" style="cursor:pointer"><div class="avatar">' + u[0].toUpperCase() + '</div><div>' + u + '</div><div class="status"></div></div>'
      ).join('');
      document.getElementById('onlineCount').textContent = users.length + ' online';
    }
    
    function updateBots(bots) {
      if (bots.length === 0) {
        document.getElementById('botList').innerHTML = '<div style="color:#666;font-size:0.8rem;padding:10px;">No bots connected</div>';
        return;
      }
      document.getElementById('botList').innerHTML = bots.map(b => 
        '<div class="online-user bot-item" onclick="selectUser(\'' + b.name + '\')" style="cursor:pointer"><div class="avatar" style="background:linear-gradient(135deg,#00d9ff,#00ff88);">' + b.name[0].toUpperCase() + '</div><div>' + b.name + '</div><div class="status" style="background:' + (b.online ? '#4ade80' : '#666') + '"></div></div>'
      ).join('');
    }
    
    function selectUser(name) {
      const input = document.getElementById('msgInput');
      input.value = '@' + name + ' ';
      input.focus();
    }
    
    function addMessage(msg, scroll = true) {
      if (msg.channelId !== channel && msg.source !== 'system') return;
      const div = document.createElement('div');
      const isMe = msg.sourceName === myName;
      if (msg.source === 'system') {
        div.className = 'message system';
        div.innerHTML = '<em>' + msg.content + '</em>';
      } else {
        div.className = 'message ' + (isMe ? 'outgoing' : 'incoming');
        const time = new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        div.innerHTML = '<div class="sender">' + (isMe ? 'You' : msg.sourceName) + '</div><div>' + msg.content + '</div><div class="time">' + time + '</div>';
      }
      document.getElementById('messages').appendChild(div);
      if (scroll) document.getElementById('messages').scrollTop = 999999;
    }
    
    function send() {
      const text = document.getElementById('msgInput').value.trim();
      if (!text || !ws) return;
      ws.send(JSON.stringify({ type: 'message', data: { content: text, channelId: channel } }));
      document.getElementById('msgInput').value = '';
    }
    
    function showSettings() { document.getElementById('settingsModal').classList.add('show'); }
    function hideSettings() { document.getElementById('settingsModal').classList.remove('show'); }
    
    async function saveSettings() {
      const newName = document.getElementById('settingsName').value.trim();
      const newChannel = document.getElementById('settingsChannel').value;
      if (newName) myName = newName;
      if (newChannel !== channel) { channel = newChannel; document.getElementById('channelName').textContent = '#' + channel; loadMessages(); }
      localStorage.setItem('echoName', myName);
      document.getElementById('myName').textContent = myName;
      hideSettings();
    }
    
    if (sessionId) {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appScreen').style.display = 'flex';
      myName = localStorage.getItem('echoName') || 'User';
      document.getElementById('myName').textContent = myName;
      loadMessages();
      connect();
      setInterval(refreshOnline, 3000);
      setInterval(refreshBots, 5000);
      refreshBots();
    }
    
    // Attach event listeners
    document.getElementById('joinBtn').addEventListener('click', join);
    log('Event listener attached');
    document.getElementById('nameInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') join();
    });
    log('Page loaded');
  </script>
</body>
</html>`;
}

server.listen(CONFIG.port, () => {
  console.log(`EchoHub v1.2 running on port ${CONFIG.port}`);
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
