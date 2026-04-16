/**
 * EchoHub Launcher
 * Start the hub and optional connectors
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CONFIG_FILE = path.join(__dirname, 'config.json');

let config = {
  hub: { port: 3847 },
  telegram: null,  // Set { botToken, chatId } to enable
  web: { enabled: true }
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    }
  } catch (e) {
    console.log('Using default config');
  }
}

function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function startHub() {
  console.log('🟢 Starting EchoHub...');
  const hub = spawn('node', [path.join(__dirname, 'hub', 'server.js')], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  hub.on('error', (e) => {
    console.log('❌ Hub error:', e.message);
  });
  
  hub.on('close', (code) => {
    console.log('Hub exited with code:', code);
  });
  
  return hub;
}

function startTelegram() {
  if (!config.telegram) {
    console.log('⚪ Telegram not configured (set config.telegram)');
    return null;
  }
  
  console.log('🟢 Starting Telegram Connector...');
  const TelegramConnector = require('./connectors/telegram');
  
  const connector = new TelegramConnector({
    botToken: config.telegram.botToken,
    chatId: config.telegram.chatId,
    hubUrl: config.telegram.hubUrl || `http://localhost:${config.hub.port}`,
    hubBotId: 'telegram-bridge',
    hubBotToken: config.telegram.hubBotToken
  });
  
  connector.start().catch(e => console.log('Telegram error:', e.message));
  return connector;
}

// Main
loadConfig();

console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🤖 ECHO HUB LAUNCHER                               ║
║   Universal Bot Bridge Platform                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`);

const hubProcess = startHub();

// Wait a moment for hub to start, then connectors
setTimeout(() => {
  if (config.telegram) {
    startTelegram();
  }
  
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   📋 Available Commands:                              ║
║                                                       ║
║   • API: http://localhost:${config.hub.port}                           ║
║   • Web: http://localhost:${config.hub.port}/                            ║
║   • Health: http://localhost:${config.hub.port}/health                   ║
║                                                       ║
║   Bot SDK: require('./bot-sdk')                      ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`);
}, 1000);

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  if (hubProcess) hubProcess.kill();
  process.exit(0);
});
