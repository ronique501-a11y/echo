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
  maxMessageAge: 7 * 24 * 60 * 60 * 1000
};

// In-memory stores
const sessions = new Map();
const bots = new Map();
const channels = new Map();
const messages = [];
const onlineUsers = new Set();

// Default channels
channels.set('default', { id: 'default', name: 'General', description: 'Main chat', created: Date.now() });
channels.set('bots', { id: 'bots', name: 'Bot Commands', description: 'Bot testing', created: Date.now() });

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
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(CONFIG.encryptionKey, 'hex'), iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function createMessage(data, source, sourceName = 'Unknown') {
  const msg = {
    id: crypto.randomBytes(12).toString('hex'),
    timestamp: Date.now(),
    source: source,
    sourceId: data.from?.id || data.sourceId || 'unknown',
    sourceName: sourceName,
    channelId: data.channelId || 'default',
    content: data.content,
    replyTo: data.replyTo || null
  };
  
  messages.push(msg);
  
  const cutoff = Date.now() - CONFIG.maxMessageAge;
  while (messages.length > 0 && messages[0].timestamp < cutoff) {
    messages.shift();
  }
  
  return msg;
}

function broadcast(msg, excludeSession = null) {
  for (const [sessionId, session] of sessions) {
    if (session.channelId === msg.channelId && sessionId !== excludeSession) {
      sendToSession(session, { type: 'message', data: msg });
    }
  }
  
  for (const [botId, bot] of bots) {
    if (bot.source !== msg.source && bot.webhook) {
      sendWebhook(bot.webhook, msg);
    }
  }
}

function sendToSession(session, data) {
  if (session?.socket) {
    try {
      const encrypted = encrypt(JSON.stringify(data));
      const buf = Buffer.alloc(2 + Buffer.byteLength(encrypted));
      buf[0] = 0x81;
      buf[1] = Buffer.byteLength(encrypted);
      buf.write(encrypted, 2);
      session.socket.write(buf);
    } catch (e) {}
  }
}

function sendWebhook(webhook, msg) {
  const data = JSON.stringify({ event: 'message', hubId: CONFIG.hubId, message: msg });
  const parsed = url.parse(webhook);
  const options = {
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: parsed.path,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  };
  (parsed.protocol === 'https:' ? https : http).request(options).write(data).end();
}

function handleWebSocket(req, socket, head) {
  const parsed = url.parse(req.url, true);
  const sessionId = parsed.query.session;
  
  if (!sessionId || !sessions.has(sessionId)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  
  const session = sessions.get(sessionId);
  onlineUsers.add(session.name);
  
  const key = req.headers['sec-websocket-key'];
  const acceptKey = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  
  socket.write('HTTP/1.1 101 Switching Protocols\r\n');
  socket.write('Upgrade: websocket\r\n');
  socket.write('Connection: Upgrade\r\n');
  socket.write('Sec-WebSocket-Accept: ' + acceptKey + '\r\n');
  socket.write('\r\n');
  
  session.socket = socket;
  
  // Send online users
  sendToSession(session, { type: 'online', data: Array.from(onlineUsers) });
  
  // Broadcast join
  broadcast({ ...createMessage({ content: `${session.name} joined`, channelId: session.channelId }, 'system', 'System'), sourceName: 'System' }, sessionId);
  
  socket.on('data', (buffer) => {
    const opcode = buffer[0] & 0x0f;
    if (opcode === 0x08) {
      onlineUsers.delete(session.name);
      broadcast(createMessage({ content: `${session.name} left`, channelId: session.channelId }, 'system', 'System'), sessionId);
      socket.end();
      return;
    }
    
    if (opcode === 0x01) {
      const length = buffer[1] & 0x7f;
      const payload = buffer.slice(2, 2 + length).toString();
      const data = safeJsonParse(decrypt(payload));
      
      if (data?.type === 'message') {
        const msg = createMessage({ ...data.data, from: { id: sessionId, name: session.name } }, 'web', session.name);
        broadcast(msg);
      }
      
      if (data?.type === 'ping') {
        sendToSession(session, { type: 'pong' });
      }
    }
  });
  
  socket.on('close', () => {
    onlineUsers.delete(session.name);
    session.socket = null;
    broadcast(createMessage({ content: `${session.name} disconnected`, channelId: session.channelId }, 'system', 'System'), sessionId);
  });
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(safeJsonParse(body)));
  });
}

async function handleRequest(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  
  // Health
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', hubId: CONFIG.hubId, online: onlineUsers.size }));
    return;
  }
  
  // Bot registration
  if (pathname === '/api/bot/register' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body?.id || !body?.token || !body?.name) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Missing fields' })); return;
    }
    bots.set(body.id, { ...body, registered: Date.now() });
    res.writeHead(200); res.end(JSON.stringify({ success: true, hubId: CONFIG.hubId }));
    return;
  }
  
  // Bot auth
  const botId = req.headers['x-bot-id'];
  const botToken = req.headers['x-bot-token'];
  const bot = bots.get(botId);
  
  if (pathname.startsWith('/api/bot/') && botId && botToken && bot?.token === botToken) {
    if (pathname === '/api/bot/message' && req.method === 'POST') {
      const body = await parseBody(req);
      const msg = createMessage({ ...body, from: { id: bot.id, name: bot.name } }, bot.source, bot.name);
      broadcast(msg, bot.source);
      res.writeHead(200); res.end(JSON.stringify({ success: true, messageId: msg.id }));
      return;
    }
    
    if (pathname === '/api/bot/messages' && req.method === 'GET') {
      const msgs = messages.filter(m => m.channelId === (parsed.query.channelId || 'default') && m.timestamp > (parseInt(parsed.query.since) || 0)).slice(-100);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ messages: msgs }));
      return;
    }
  }
  
  // Web session
  if (pathname === '/api/session' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!body?.name) { res.writeHead(400); res.end(JSON.stringify({ error: 'Name required' })); return; }
    
    const sessionId = crypto.randomBytes(16).toString('hex');
    sessions.set(sessionId, {
      token: crypto.randomBytes(16).toString('hex'),
      name: body.name,
      channelId: body.channelId || 'default',
      source: 'web',
      connected: Date.now()
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessionId }));
    return;
  }
  
  // Get online users
  if (pathname === '/api/online' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ users: Array.from(onlineUsers) }));
    return;
  }
  
  // Channels
  if (pathname === '/api/channels' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ channels: Array.from(channels.values()) }));
    return;
  }
  
  // Messages history
  if (pathname === '/api/messages' && req.method === 'GET') {
    const msgs = messages.filter(m => m.channelId === (parsed.query.channelId || 'default')).slice(-50);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: msgs }));
    return;
  }
  
  // Hub info
  if (pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hubId: CONFIG.hubId,
      version: '1.1.0',
      bots: Array.from(bots.values()).map(b => ({ id: b.id, name: b.name })).length,
      online: onlineUsers.size,
      messages: messages.length
    }));
    return;
  }
  
  // Web UI
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getWebUI());
    return;
  }
  
  res.writeHead(404); res.end('Not found');
}

function getWebUI() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>EchoHub - Universal Bot Bridge</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f0f1a; color: #e0e0e0; height: 100vh; overflow: hidden; }
    
    .app { display: flex; height: 100vh; }
    
    /* Sidebar */
    .sidebar { width: 260px; background: #1a1a2e; border-right: 1px solid #2a2a4e; display: flex; flex-direction: column; }
    .sidebar-header { padding: 20px; border-bottom: 1px solid #2a2a4e; }
    .sidebar-header h1 { font-size: 1.4rem; color: #00d9ff; margin-bottom: 5px; }
    .hub-id { font-size: 0.75rem; color: #666; }
    
    .section-title { padding: 15px 20px 10px; font-size: 0.75rem; text-transform: uppercase; color: #666; letter-spacing: 1px; }
    
    .online-list { padding: 0 10px; }
    .online-user { padding: 10px 15px; display: flex; align-items: center; gap: 10px; border-radius: 8px; margin: 3px 0; cursor: pointer; transition: background 0.2s; }
    .online-user:hover { background: #2a2a4e; }
    .online-user .avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8rem; }
    .online-user .name { font-weight: 500; }
    .online-user .status { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; margin-left: auto; }
    
    .channel-list { padding: 0 10px; }
    .channel { padding: 10px 15px; display: flex; align-items: center; gap: 10px; border-radius: 8px; margin: 3px 0; cursor: pointer; transition: background 0.2s; color: #999; }
    .channel:hover, .channel.active { background: #2a2a4e; color: #fff; }
    .channel .icon { font-size: 1.2rem; }
    
    .profile-btn { margin-top: auto; padding: 15px 20px; border-top: 1px solid #2a2a4e; }
    .profile-btn button { width: 100%; padding: 12px; background: #2a2a4e; border: none; border-radius: 8px; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 0.9rem; }
    .profile-btn button:hover { background: #3a3a5e; }
    
    /* Main chat area */
    .chat-area { flex: 1; display: flex; flex-direction: column; }
    
    .chat-header { padding: 15px 25px; background: #1a1a2e; border-bottom: 1px solid #2a2a4e; display: flex; align-items: center; justify-content: space-between; }
    .chat-header h2 { font-size: 1.2rem; }
    .chat-header-info { display: flex; align-items: center; gap: 15px; font-size: 0.85rem; color: #888; }
    .online-count { display: flex; align-items: center; gap: 5px; }
    .online-count .dot { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; }
    
    .messages { flex: 1; overflow-y: auto; padding: 20px 25px; display: flex; flex-direction: column; gap: 12px; }
    
    .message { max-width: 70%; padding: 12px 16px; border-radius: 16px; line-height: 1.4; }
    .message.incoming { background: #2a2a4e; align-self: flex-start; border-bottom-left-radius: 4px; }
    .message.outgoing { background: #00d9ff; color: #000; align-self: flex-end; border-bottom-right-radius: 4px; }
    .message.system { background: transparent; color: #666; text-align: center; font-size: 0.8rem; max-width: 100%; }
    .message .sender { font-size: 0.75rem; color: #00d9ff; margin-bottom: 4px; font-weight: 600; }
    .message.outgoing .sender { color: #006680; }
    .message .time { font-size: 0.65rem; color: #888; margin-top: 4px; }
    .message.outgoing .time { color: #005566; }
    
    .input-area { padding: 20px 25px; background: #1a1a2e; border-top: 1px solid #2a2a4e; display: flex; gap: 12px; }
    .input-area input { flex: 1; padding: 14px 18px; background: #2a2a4e; border: 1px solid #3a3a5e; border-radius: 24px; color: #fff; font-size: 0.95rem; outline: none; }
    .input-area input:focus { border-color: #00d9ff; }
    .input-area button { padding: 14px 24px; background: #00d9ff; border: none; border-radius: 24px; color: #000; font-weight: bold; cursor: pointer; }
    .input-area button:hover { background: #00b8d9; }
    
    /* Login screen */
    .login-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0f0f1a; }
    .login-box { background: #1a1a2e; padding: 40px; border-radius: 20px; text-align: center; width: 350px; }
    .login-box h1 { font-size: 2rem; color: #00d9ff; margin-bottom: 10px; }
    .login-box p { color: #888; margin-bottom: 30px; }
    .login-box input { width: 100%; padding: 14px; margin: 10px 0; background: #2a2a4e; border: 1px solid #3a3a5e; border-radius: 10px; color: #fff; font-size: 1rem; text-align: center; }
    .login-box input:focus { outline: none; border-color: #00d9ff; }
    .login-box button { width: 100%; padding: 14px; margin-top: 20px; background: #00d9ff; border: none; border-radius: 10px; color: #000; font-weight: bold; font-size: 1rem; cursor: pointer; }
    .login-box button:hover { background: #00b8d9; }
    
    /* Settings modal */
    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 100; align-items: center; justify-content: center; }
    .modal.show { display: flex; }
    .modal-content { background: #1a1a2e; padding: 30px; border-radius: 20px; width: 400px; max-width: 90%; }
    .modal-content h2 { margin-bottom: 20px; color: #00d9ff; }
    .modal-content input { width: 100%; padding: 12px; margin: 10px 0; background: #2a2a4e; border: 1px solid #3a3a5e; border-radius: 8px; color: #fff; }
    .modal-content .btn-row { display: flex; gap: 10px; margin-top: 20px; }
    .modal-content button { flex: 1; padding: 12px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
    .modal-content .btn-save { background: #00d9ff; color: #000; }
    .modal-content .btn-cancel { background: #444; color: #fff; }
  </style>
</head>
<body>
  <div class="login-screen" id="loginScreen">
    <div class="login-box">
      <h1>🤖 EchoHub</h1>
      <p>Universal Bot Bridge</p>
      <input type="text" id="nameInput" placeholder="Enter your name..." />
      <button onclick="join()">Join Chat</button>
    </div>
  </div>
  
  <div class="app" id="appScreen" style="display: none;">
    <div class="sidebar">
      <div class="sidebar-header">
        <h1>🤖 EchoHub</h1>
        <div class="hub-id" id="hubId">Loading...</div>
      </div>
      
      <div class="section-title">Online Now</div>
      <div class="online-list" id="onlineList"></div>
      
      <div class="section-title">Channels</div>
      <div class="channel-list" id="channelList"></div>
      
      <div class="profile-btn">
        <button onclick="showSettings()">
          <span>👤</span>
          <span id="myName">Me</span>
          <span style="margin-left: auto;">⚙️</span>
        </button>
      </div>
    </div>
    
    <div class="chat-area">
      <div class="chat-header">
        <h2 id="channelName">#general</h2>
        <div class="chat-header-info">
          <div class="online-count">
            <div class="dot"></div>
            <span id="onlineCount">0</span> online
          </div>
        </div>
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
      <label>Your Name</label>
      <input type="text" id="settingsName" />
      <label>Channel</label>
      <select id="settingsChannel" style="width:100%;padding:12px;margin:10px 0;background:#2a2a4e;border:1px solid #3a3a5e;border-radius:8px;color:#fff;">
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
    
    async function join() {
      const name = document.getElementById('nameInput').value.trim();
      if (!name) return alert('Please enter your name');
      
      myName = name;
      localStorage.setItem('echoName', name);
      
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, channelId: channel })
      });
      
      const data = await res.json();
      sessionId = data.sessionId;
      localStorage.setItem('echoSession', sessionId);
      
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appScreen').style.display = 'flex';
      document.getElementById('myName').textContent = name;
      document.getElementById('settingsName').value = name;
      document.getElementById('settingsChannel').value = channel;
      
      loadHubInfo();
      loadMessages();
      connect();
      setInterval(refreshOnline, 5000);
    }
    
    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(protocol + '//' + location.host + '/?session=' + sessionId);
      
      ws.onmessage = (e) => {
        const buf = new Uint8Array(e.data);
        const len = buf[1];
        const msg = JSON.parse(prompt('', buf.slice(2, 2 + len).toString('utf8')));
        handleMessage(msg);
      };
      
      ws.onclose = () => setTimeout(connect, 2000);
    }
    
    function handleMessage(msg) {
      if (msg.type === 'message') addMessage(msg.data);
      if (msg.type === 'online') updateOnline(msg.data);
      if (msg.type === 'pong') {}
    }
    
    async function loadHubInfo() {
      const res = await fetch('/api/info');
      const data = await res.json();
      document.getElementById('hubId').textContent = 'Hub: ' + data.hubId.substring(0, 8) + '...';
    }
    
    async function loadMessages() {
      const res = await fetch('/api/messages?channelId=' + channel);
      const data = await res.json();
      document.getElementById('messages').innerHTML = '';
      data.messages.forEach(m => addMessage(m, false));
    }
    
    async function refreshOnline() {
      const res = await fetch('/api/online');
      const data = await res.json();
      updateOnline(data.users);
    }
    
    function updateOnline(users) {
      const list = document.getElementById('onlineList');
      list.innerHTML = users.map(u => '<div class="online-user"><div class="avatar">' + u[0].toUpperCase() + '</div><div class="name">' + u + '</div><div class="status"></div></div>').join('');
      document.getElementById('onlineCount').textContent = users.length;
    }
    
    function addMessage(msg, scroll = true) {
      if (msg.channelId !== channel && msg.source !== 'system') return;
      
      const div = document.createElement('div');
      const isMe = msg.sourceName === myName;
      const isSystem = msg.source === 'system';
      
      if (isSystem) {
        div.className = 'message system';
        div.innerHTML = '<em>' + msg.content + '</em>';
      } else {
        div.className = 'message ' + (isMe ? 'outgoing' : 'incoming');
        const time = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        div.innerHTML = '<div class="sender">' + (isMe ? 'You' : msg.sourceName) + '</div><div>' + msg.content + '</div><div class="time">' + time + '</div>';
      }
      
      document.getElementById('messages').appendChild(div);
      if (scroll) document.getElementById('messages').scrollTop = 999999;
    }
    
    function send() {
      const input = document.getElementById('msgInput');
      const text = input.value.trim();
      if (!text || !ws) return;
      
      ws.send(JSON.stringify({ type: 'message', data: { content: text, channelId: channel } }));
      input.value = '';
    }
    
    function showSettings() {
      document.getElementById('settingsModal').classList.add('show');
      document.getElementById('settingsName').value = myName;
      document.getElementById('settingsChannel').value = channel;
    }
    
    function hideSettings() {
      document.getElementById('settingsModal').classList.remove('show');
    }
    
    async function saveSettings() {
      const newName = document.getElementById('settingsName').value.trim();
      const newChannel = document.getElementById('settingsChannel').value;
      
      if (newName) myName = newName;
      if (newChannel !== channel) {
        channel = newChannel;
        document.getElementById('channelName').textContent = '#' + channel;
        loadMessages();
      }
      
      localStorage.setItem('echoName', myName);
      document.getElementById('myName').textContent = myName;
      hideSettings();
    }
    
    // Check if already logged in
    if (sessionId) {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appScreen').style.display = 'flex';
      myName = localStorage.getItem('echoName') || 'User';
      document.getElementById('myName').textContent = myName;
      document.getElementById('settingsName').value = myName;
      loadHubInfo();
      loadMessages();
      connect();
      setInterval(refreshOnline, 5000);
    }
  </script>
</body>
</html>`;
}

// Start server
const startTime = Date.now();
const server = http.createServer(handleRequest);

server.on('upgrade', (req, socket, head) => {
  if (req.headers['upgrade'] === 'websocket') handleWebSocket(req, socket, head);
});

server.listen(CONFIG.port, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   🤖 EchoHub v1.1 - Universal Bot Bridge          ║
║   Hub ID: ${CONFIG.hubId}
║   Port: ${CONFIG.port}
║   Status: ONLINE                                    ║
╚═══════════════════════════════════════════════════════╝
  `);
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
