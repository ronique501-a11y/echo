/**
 * Example Echo Bot - Connected to EchoHub
 * This demonstrates how a bot connects to the universal bridge
 */

const { EchoBot, createBot } = require('./bot-sdk/index');

// Create Echo bot for the hub
const echo = createBot({
  id: 'echo-001',
  token: 'echo-secure-token-' + Date.now(),
  name: 'Echo',
  hubUrl: process.env.HUB_URL || 'http://localhost:3847',
  source: 'echo',
  channels: ['default', 'bots']
});

// Handle incoming messages
echo.onMessage = async (msg) => {
  console.log(`\n📨 [${msg.source}] ${msg.sourceId}: ${msg.content}`);
  
  // Don't respond to my own messages
  if (msg.source === 'echo') return;
  
  // Respond to messages
  const content = msg.content.toLowerCase();
  
  if (content.includes('hello') || content.includes('hi')) {
    await echo.send(`Hello! I'm Echo, connected to the universal bridge! 🤖`);
  }
  else if (content.includes('status')) {
    const info = await echo.getHubInfo();
    await echo.send(`🟢 Online! Hub: ${info.hubId}, Bots: ${info.bots?.length || 0}`);
  }
  else if (content.includes('help')) {
    await echo.send(`
🤖 **Echo Bot Commands:**

• Say "hello" - Get a greeting
• Say "status" - Check hub status  
• Say "info" - Learn about EchoHub
• Any other message - Echo will respond!

I'm connected via EchoHub - the universal bot bridge!
    `);
  }
  else if (content.includes('info')) {
    await echo.send(`
📡 **EchoHub - Universal Bot Bridge**

A platform that connects:
• Multiple AI bots (Echo, Claude, GPT, etc.)
• Human users via web interface
• External platforms (Telegram, Discord, etc.)

Features:
• Secure bot authentication
• Unified message format
• Real-time communication
• Channel support
• Rate limiting
• Message history
    `);
  }
  else {
    await echo.send(`I heard: "${msg.content}"\n\nType "help" for commands!`);
  }
};

// Start
async function main() {
  console.log('🤖 Echo Bot starting...');
  
  const success = await echo.register();
  
  if (success) {
    console.log('✅ Registered with hub!');
    
    // Start polling for messages
    echo.startPolling(1000);
    
    // Periodic status messages
    setInterval(async () => {
      const info = await echo.getHubInfo();
      if (info.bots) {
        console.log(`📊 Hub status: ${info.bots.length} bots connected`);
      }
    }, 30000);
    
    // Send join message
    await echo.send('🤖 Echo has connected to the hub!');
    
    console.log('✅ Echo Bot running!');
  } else {
    console.log('❌ Failed to register with hub');
    console.log('   Make sure EchoHub is running on', echo.hubUrl);
  }
}

main().catch(e => console.log('Error:', e.message));
