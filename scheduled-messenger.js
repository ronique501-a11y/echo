const fs = require('fs');
const https = require('https');

const BOT_TOKEN = '8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ';
const CHAT_ID = '1424457506';

const SCHEDULE_FILE = 'D:/Echo/scheduled-messages.json';

function loadSchedule() {
  try {
    if (fs.existsSync(SCHEDULE_FILE)) {
      return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { messages: [] };
}

function saveSchedule(data) {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
}

function send(text) {
  const postData = JSON.stringify({ chat_id: CHAT_ID, text: text });
  
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (result.ok) {
          console.log('✓ Sent:', text.substring(0, 50));
        } else {
          console.log('✗ Failed:', result.description);
        }
      } catch (e) {}
    });
  });
  
  req.on('error', e => console.log('Error:', e.message));
  req.write(postData);
  req.end();
}

function checkScheduled() {
  const schedule = loadSchedule();
  const now = Date.now();
  
  schedule.messages = schedule.messages.filter(msg => {
    if (msg.sent) return false;
    
    if (now >= msg.scheduledTime) {
      console.log(`📤 Sending scheduled message: "${msg.text.substring(0, 30)}..."`);
      send(msg.text);
      msg.sent = true;
      return false;
    }
    return true;
  });
  
  saveSchedule(schedule);
}

function addScheduledMessage(text, delayMs) {
  const schedule = loadSchedule();
  schedule.messages.push({
    text: text,
    scheduledTime: Date.now() + delayMs,
    sent: false,
    created: Date.now()
  });
  saveSchedule(schedule);
  console.log(`✓ Scheduled: "${text.substring(0, 30)}..." in ${Math.round(delayMs/1000)}s`);
}

function listScheduled() {
  const schedule = loadSchedule();
  console.log('\n📅 Scheduled messages:');
  if (schedule.messages.length === 0) {
    console.log('  (none)');
  } else {
    schedule.messages.forEach((msg, i) => {
      if (!msg.sent) {
        const time = new Date(msg.scheduledTime).toLocaleTimeString();
        console.log(`  ${i+1}. "${msg.text.substring(0, 40)}..." at ${time}`);
      }
    });
  }
  console.log('');
}

// CLI commands
const args = process.argv.slice(2);
if (args[0] === 'add') {
  const delay = parseInt(args[1]) || 60000; // default 1 minute
  const text = args.slice(2).join(' ') || 'Test message from Echo!';
  addScheduledMessage(text, delay);
} else if (args[0] === 'list') {
  listScheduled();
} else if (args[0] === 'check') {
  checkScheduled();
} else {
  console.log('Echo Scheduled Messenger');
  console.log('Usage:');
  console.log('  node scheduled-messenger.js add <seconds> <message>  - schedule a message');
  console.log('  node scheduled-messenger.js list                       - list scheduled messages');
  console.log('  node scheduled-messenger.js check                      - check and send due messages');
  console.log('');
  console.log('Examples:');
  console.log('  node scheduled-messenger.js add 300 "Hey Mia!"');
  console.log('  node scheduled-messenger.js add 3600 "Check in tomorrow"');
}

// Run check loop if called directly
if (require.main === module) {
  setInterval(checkScheduled, 10000);
  console.log('🕐 Scheduled messenger running...');
  checkScheduled();
}

module.exports = { addScheduledMessage, send };
