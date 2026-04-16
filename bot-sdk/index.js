/**
 * EchoHub Bot SDK
 * Easy integration for AI bots to connect to the universal bridge
 */

const http = require('http');
const https = require('https');
const url = require('url');
const WebSocket = require('ws');

class EchoBot {
  constructor(config) {
    this.id = config.id;
    this.token = config.token;
    this.name = config.name || 'Bot';
    this.hubUrl = config.hubUrl || 'http://localhost:3847';
    this.wsUrl = config.wsUrl || config.hubUrl.replace('http', 'ws') + '/ws';
    this.source = config.source || 'bot';
    this.channels = config.channels || ['default'];
    this.webhook = config.webhook || null;
    this.onMessage = config.onMessage || (() => {});
    this.lastMessageTime = 0;
    this.ws = null;
    this.usingWebSocket = false;
    
    this.registered = false;
  }
  
  // Make HTTP request to hub
  async request(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const parsed = url.parse(this.hubUrl + path);
      
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Id': this.id,
          'X-Bot-Token': this.token
        }
      };
      
      if (parsed.protocol === 'https:') {
        options.port = parsed.port || 443;
      }
      
      const req = (parsed.protocol === 'https:' ? https : http).request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });
      
      req.on('error', reject);
      
      if (body) {
        const bodyStr = JSON.stringify(body);
        req.write(bodyStr);
      }
      
      req.end();
    });
  }
  
  // Register with the hub
  async register() {
    try {
      const result = await this.request('/api/bot/register', 'POST', {
        id: this.id,
        token: this.token,
        name: this.name,
        source: this.source,
        channels: this.channels,
        webhook: this.webhook
      });
      
      if (result.success) {
        this.registered = true;
        console.log(`✅ Bot "${this.name}" registered with hub ${result.hubId}`);
        return true;
      } else {
        console.log('❌ Registration failed:', result.error);
        return false;
      }
    } catch (e) {
      console.log('❌ Registration error:', e.message);
      return false;
    }
  }
  
  // Send a message (tries WebSocket first, falls back to HTTP)
  async send(content, options = {}) {
    if (!this.registered) {
      console.log('⚠️ Bot not registered, attempting registration...');
      await this.register();
    }
    
    // Try WebSocket first for real-time
    if (this.sendWebSocket(content, options)) {
      return { success: true, via: 'websocket' };
    }
    
    // Fall back to HTTP
    try {
      const result = await this.request('/api/bot/message', 'POST', {
        content: content,
        channelId: options.channelId || 'default',
        replyTo: options.replyTo || null,
        attachments: options.attachments || [],
        metadata: options.metadata || {}
      });
      
      return { ...result, via: 'http' };
    } catch (e) {
      console.log('❌ Send error:', e.message);
      return { error: e.message };
    }
  }
  
  // Get messages since last check
  async getMessages(channelId = 'default') {
    try {
      const result = await this.request(`/api/bot/messages?channelId=${channelId}&since=${this.lastMessageTime}`);
      if (result.messages) {
        this.lastMessageTime = Date.now();
        return result.messages;
      }
      return [];
    } catch (e) {
      console.log('❌ Get messages error:', e.message);
      return [];
    }
  }
  
  // Poll for new messages (simple approach)
  startPolling(intervalMs = 1000, channelId = 'default') {
    this.pollInterval = setInterval(async () => {
      const messages = await this.getMessages(channelId);
      for (const msg of messages) {
        this.onMessage(msg);
      }
    }, intervalMs);
    
    console.log(`📡 Polling for messages every ${intervalMs}ms`);
  }
  
  // Stop polling
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
  
  // Connect via WebSocket for real-time messaging
  connectWebSocket() {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.wsUrl}?botId=${this.id}&botToken=${this.token}`;
      console.log(`🔌 Connecting WebSocket to ${wsUrl}`);
      
      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.on('open', () => {
          console.log(`✅ WebSocket connected for ${this.name}`);
          this.usingWebSocket = true;
          resolve();
        });
        
        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'message') {
              this.onMessage(msg.data);
            } else if (msg.type === 'bot_connected') {
              console.log(`🤖 Hub acknowledged bot: ${msg.botName}`);
            }
          } catch (e) {
            console.log('WebSocket message parse error:', e.message);
          }
        });
        
        this.ws.on('error', (e) => {
          console.log(`❌ WebSocket error: ${e.message}`);
          this.usingWebSocket = false;
          reject(e);
        });
        
        this.ws.on('close', () => {
          console.log(`🔌 WebSocket disconnected for ${this.name}`);
          this.usingWebSocket = false;
          // Auto-reconnect after 5 seconds
          setTimeout(() => {
            if (this.registered) {
              console.log(`🔄 Reconnecting WebSocket...`);
              this.connectWebSocket().catch(() => {});
            }
          }, 5000);
        });
        
      } catch (e) {
        reject(e);
      }
    });
  }
  
  // Disconnect WebSocket
  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.usingWebSocket = false;
    }
  }
  
  // Send via WebSocket (real-time)
  sendWebSocket(content, options = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'message',
        data: {
          content: content,
          channelId: options.channelId || 'default',
          replyTo: options.replyTo || null,
          attachments: options.attachments || [],
          metadata: options.metadata || {}
        }
      }));
      return true;
    }
    return false;
  }
  
  // Update bot info
  async update(info) {
    try {
      const result = await this.request('/api/bot/update', 'POST', info);
      if (result.success) {
        if (info.name) this.name = info.name;
        if (info.webhook) this.webhook = info.webhook;
        if (info.channels) this.channels = info.channels;
      }
      return result;
    } catch (e) {
      return { error: e.message };
    }
  }
  
  // Get hub info
  async getHubInfo() {
    try {
      return await this.request('/api/info');
    } catch (e) {
      return { error: e.message };
    }
  }
  
  // Connect with WebSocket (register + connect)
  async connect() {
    const registered = await this.register();
    if (registered) {
      try {
        await this.connectWebSocket();
        return { success: true, websocket: true };
      } catch (e) {
        console.log('WebSocket connection failed, using HTTP polling');
        return { success: true, websocket: false };
      }
    }
    return { success: false };
  }
  
  // Direct speak (like me sending to Mia on Telegram)
  async speak(text, chatId = null) {
    return this.send(text, { 
      metadata: { chatId, direct: true } 
    });
  }
}

// Create a bot instance
function createBot(config) {
  return new EchoBot(config);
}

// Example usage
function example() {
  const bot = createBot({
    id: 'my-unique-bot-id',
    token: 'secure-token-123',
    name: 'My Awesome Bot',
    hubUrl: 'http://localhost:3847',
    source: 'custom'
  });
  
  // Handle incoming messages
  bot.onMessage = (msg) => {
    console.log(`📨 Message from ${msg.sourceId}: ${msg.content}`);
    
    // Respond to mentions
    if (msg.content.includes('hello')) {
      bot.send('Hello! I am ' + bot.name);
    }
  };
  
  // Register and start
  bot.register().then(() => {
    bot.startPolling(1000);
    
    // Send periodic messages
    setInterval(() => {
      bot.send(`🤖 Bot check-in at ${new Date().toISOString()}`);
    }, 60000);
  });
  
  return bot;
}

module.exports = { EchoBot, createBot, example };
