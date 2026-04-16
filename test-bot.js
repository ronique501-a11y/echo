/**
 * EchoHub Test Bot - Easy to share
 * Copy this file and run it to test EchoHub connectivity
 * 
 * Usage:
 *   1. Make sure EchoHub is running
 *   2. Set HUB_URL if EchoHub is not on localhost:3847
 *   3. Run: node test-bot.js
 */

const http = require('http');
const crypto = require('crypto');

// ============== CONFIG ==============
const CONFIG = {
  hubUrl: process.env.HUB_URL || 'http://localhost:3847',
  
  // Bot identity - CHANGE THESE
  botId: 'test-bot-' + crypto.randomBytes(4).toString('hex'),
  botToken: crypto.randomBytes(16).toString('hex'),
  botName: process.env.BOT_NAME || 'TestBot',
  
  // How often to poll (ms)
  pollInterval: 1000,
  
  // Auto-respond to messages?
  autoRespond: true
};
// ====================================

let registered = false;
let lastMessageTime = 0;
let sessionId = null;

// Colors for console
const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  ok: (msg) => console.log(`\x1b[32m[OK]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  bot: (msg) => console.log(`\x1b[35m[BOT]\x1b[0m ${msg}`),
  msg: (from, content) => console.log(`\x1b[33m[MSG]\x1b[0m ${from}: ${content}`)
};

// Make HTTP request to hub
function hubRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.hubUrl + path);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
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

// Register with hub
async function register() {
  log.info(`Registering as "${CONFIG.botName}"...`);
  
  try {
    const result = await hubRequest('/api/bot/register', 'POST', {
      id: CONFIG.botId,
      token: CONFIG.botToken,
      name: CONFIG.botName,
      source: 'test-bot',
      channels: ['default', 'test']
    });
    
    if (result.success) {
      registered = true;
      sessionId = result.hubId;
      log.ok(`Registered! Hub ID: ${result.hubId}`);
      return true;
    } else {
      log.error(`Registration failed: ${result.error}`);
      return false;
    }
  } catch (e) {
    log.error(`Cannot reach hub: ${e.message}`);
    log.info(`Make sure EchoHub is running at ${CONFIG.hUB_URL || 'localhost:3847'}`);
    return false;
  }
}

// Send message
async function send(content, channelId = 'default') {
  if (!registered) return;
  
  try {
    await hubRequest('/api/bot/message', 'POST', {
      content: content,
      channelId: channelId
    }, {
      'X-Bot-Id': CONFIG.botId,
      'X-Bot-Token': CONFIG.botToken
    });
  } catch (e) {
    log.error(`Send failed: ${e.message}`);
  }
}

// Get messages
async function getMessages(channelId = 'default') {
  if (!registered) return [];
  
  try {
    const result = await hubRequest(
      `/api/bot/messages?channelId=${channelId}&since=${lastMessageTime}`,
      'GET',
      null,
      {
        'X-Bot-Id': CONFIG.botId,
        'X-Bot-Token': CONFIG.botToken
      }
    );
    
    if (result.messages && result.messages.length > 0) {
      lastMessageTime = Date.now();
    }
    
    return result.messages || [];
  } catch (e) {
    return [];
  }
}

// Simple response logic
function respond(content) {
  const lower = content.toLowerCase();
  
  if (lower.includes('hello') || lower.includes('hi')) {
    return `Hello! I'm ${CONFIG.botName}. EchoHub is working! 🎉`;
  }
  if (lower.includes('status') || lower.includes('ping')) {
    return `🟢 ${CONFIG.botName} is online and connected to EchoHub!`;
  }
  if (lower.includes('help')) {
    return `Type anything and I'll respond! Say "status" for my status.`;
  }
  if (lower.includes('who') && lower.includes('you')) {
    return `I'm ${CONFIG.botName}, a test bot connected to EchoHub!`;
  }
  
  return `You said: "${content}" - EchoHub relay working!`;
}

// Main loop
async function main() {
  console.log(`
╔════════════════════════════════════════════════════════╗
║           EchoHub Test Bot - Ready to Connect!         ║
╚════════════════════════════════════════════════════════╝
  `);
  
  log.info(`Hub URL: ${CONFIG.hubUrl}`);
  log.info(`Bot ID: ${CONFIG.botId}`);
  log.info(`Bot Name: ${CONFIG.botName}`);
  log.info(`Poll Interval: ${CONFIG.pollInterval}ms`);
  console.log('');
  
  // Register
  const success = await register();
  
  if (!success) {
    log.error('Failed to register. Exiting.');
    process.exit(1);
  }
  
  // Announce presence
  await send(`🤖 ${CONFIG.botName} has joined the hub!`);
  log.ok('Announced presence to hub');
  
  // Main polling loop
  log.info('Starting message polling...');
  console.log('');
  
  setInterval(async () => {
    const messages = await getMessages('default');
    
    for (const msg of messages) {
      // Skip own messages
      if (msg.sourceId === CONFIG.botId) continue;
      
      log.msg(msg.sourceId, msg.content);
      
      if (CONFIG.autoRespond) {
        log.bot(`Responding to ${msg.sourceId}...`);
        const response = respond(msg.content);
        await send(response);
      }
    }
  }, CONFIG.pollInterval);
  
  // Periodic heartbeat
  setInterval(async () => {
    log.info(`Still connected... (${CONFIG.botName})`);
  }, 30000);
  
  log.ok('Test bot is running! Send a message to test.');
  log.info('Press Ctrl+C to stop.');
}

// Run
main().catch(e => {
  log.error(e.message);
  process.exit(1);
});
