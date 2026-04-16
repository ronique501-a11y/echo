/**
 * EchoHub Telegram Connector
 * Bridges Telegram to the universal bot hub
 */

const https = require('https');
const crypto = require('crypto');

class TelegramConnector {
  constructor(config) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.hubUrl = config.hubUrl || 'http://localhost:3847';
    this.botId = config.hubBotId || `telegram-${this.botToken.substring(0, 8)}`;
    this.botToken2 = config.hubBotToken || crypto.randomBytes(16).toString('hex');
    this.name = config.name || 'Telegram Bridge';
    
    this.lastUpdateId = 0;
    this.hubBot = null;
  }
  
  // Send message to Telegram
  async sendToTelegram(text) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        chat_id: this.chatId,
        text: text,
        parse_mode: 'Markdown'
      });
      
      const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${this.botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };
      
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve(JSON.parse(body)));
      });
      
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
  
  // Register with EchoHub
  async registerWithHub() {
    try {
      const response = await this.hubRequest('/api/bot/register', 'POST', {
        id: this.botId,
        token: this.botToken2,
        name: this.name,
        source: 'telegram',
        channels: ['default', 'telegram']
      });
      
      if (response.success) {
        console.log(`✅ Telegram connector registered with hub: ${response.hubId}`);
        return true;
      }
      return false;
    } catch (e) {
      console.log('Hub registration failed:', e.message);
      return false;
    }
  }
  
  // Hub HTTP request
  hubRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.hubUrl + path);
      
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Id': this.botId,
          'X-Bot-Token': this.botToken2
        }
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        });
      });
      
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
  
  // Poll Telegram for updates
  async pollTelegram() {
    return new Promise((resolve) => {
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?timeout=5&offset=${this.lastUpdateId}`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const updates = JSON.parse(data);
            if (updates.ok && updates.result) {
              resolve(updates.result);
            } else {
              resolve([]);
            }
          } catch {
            resolve([]);
          }
        });
      }).on('error', () => resolve([]));
    });
  }
  
  // Get messages from hub
  async getHubMessages() {
    try {
      const response = await this.hubRequest(`/api/bot/messages?channelId=default&since=${this.lastHubTime || 0}`);
      this.lastHubTime = Date.now();
      return response.messages || [];
    } catch {
      return [];
    }
  }
  
  // Send message to hub
  async sendToHub(content, options = {}) {
    return this.hubRequest('/api/bot/message', 'POST', {
      content: content,
      channelId: options.channelId || 'default',
      metadata: {
        platform: 'telegram',
        chatId: this.chatId
      }
    });
  }
  
  // Start the connector
  async start() {
    const http = require('http');
    this.http = http;
    
    console.log('🚀 Starting Telegram Connector...');
    
    // Register with hub
    await this.registerWithHub();
    
    // Start dual polling
    setInterval(async () => {
      // Check Telegram for messages
      const updates = await this.pollTelegram();
      for (const update of updates) {
        if (update.message && update.message.chat.id.toString() === this.chatId) {
          const msg = update.message.text || update.message.caption || '[voice/media]';
          if (msg && msg.trim()) {
            console.log(`📱 Telegram -> Hub: ${msg.substring(0, 50)}`);
            await this.sendToHub(msg, { channelId: 'telegram' });
          }
          this.lastUpdateId = update.update_id + 1;
        }
      }
      
      // Check hub for messages to relay to Telegram
      const hubMessages = await this.getHubMessages();
      for (const msg of hubMessages) {
        if (msg.source !== 'telegram') {
          console.log(`📨 Hub -> Telegram: ${msg.content.substring(0, 50)}`);
          await this.sendToTelegram(msg.content);
        }
      }
    }, 2000);
    
    console.log('✅ Telegram Connector running!');
    console.log(`   Bot Token: ${this.botToken.substring(0, 10)}...`);
    console.log(`   Chat ID: ${this.chatId}`);
  }
}

module.exports = TelegramConnector;
