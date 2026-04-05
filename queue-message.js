const fs = require('fs');
const https = require('https');

const BOT_TOKEN = '8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ';
const CHAT_ID = '1424457506';
const QUEUE_FILE = 'D:/Echo/message-queue.json';
const DELAY_FILE = 'D:/Echo/delayed-messages.json';

function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { messages: [] };
}

function saveQueue(data) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2));
}

function loadDelayed() {
  try {
    if (fs.existsSync(DELAY_FILE)) {
      return JSON.parse(fs.readFileSync(DELAY_FILE, 'utf8'));
    }
  } catch (e) {}
  return { messages: [] };
}

function saveDelayed(data) {
  fs.writeFileSync(DELAY_FILE, JSON.stringify(data, null, 2));
}

function send(text) {
  return new Promise((resolve, reject) => {
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
            console.log(`✓ Sent: "${text.substring(0, 40)}"`);
            resolve(true);
          } else {
            console.log(`✗ Failed: ${result.description}`);
            resolve(false);
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', e => {
      console.log(`✗ Error: ${e.message}`);
      reject(e);
    });
    req.write(postData);
    req.end();
  });
}

async function processQueue() {
  const queue = loadQueue();
  const delayed = loadDelayed();
  const now = Date.now();
  
  let sent = 0;
  
  // Process delayed messages first
  delayed.messages = delayed.messages.filter(msg => {
    if (msg.sent) return false;
    
    if (now >= msg.scheduledTime) {
      console.log(`📤 Sending delayed: "${msg.text.substring(0, 30)}..."`);
      send(msg.text).then(() => {
        msg.sent = true;
        saveDelayed(delayed);
      });
      return false;
    }
    return true;
  });
  
  // Process queued messages
  if (queue.messages.length > 0) {
    console.log(`\n📬 Processing ${queue.messages.length} queued message(s)...`);
    
    for (const msg of queue.messages) {
      if (msg.text && !msg.sent) {
        console.log(`📤 Sending: "${msg.text.substring(0, 30)}..."`);
        await send(msg.text);
        msg.sent = true;
        sent++;
      }
    }
    
    // Clear the queue after processing
    saveQueue({ messages: [], lastProcessed: now });
    console.log(`✓ Sent ${sent} queued message(s)\n`);
  } else {
    console.log('📭 No queued messages\n');
  }
  
  saveDelayed(delayed);
  return sent;
}

function addToQueue(text) {
  const queue = loadQueue();
  queue.messages.push({
    text: text,
    queuedAt: Date.now(),
    sent: false
  });
  saveQueue(queue);
  console.log(`✓ Queued: "${text.substring(0, 40)}"`);
}

function addDelayed(text, delaySeconds) {
  const delayed = loadDelayed();
  delayed.messages.push({
    text: text,
    scheduledTime: Date.now() + (delaySeconds * 1000),
    delaySeconds: delaySeconds,
    createdAt: Date.now(),
    sent: false
  });
  saveDelayed(delayed);
  console.log(`✓ Delayed (${delaySeconds}s): "${text.substring(0, 40)}"`);
}

function listQueue() {
  const queue = loadQueue();
  const delayed = loadDelayed();
  
  console.log('\n📋 Message Queue Status');
  console.log('========================');
  
  const pending = queue.messages.filter(m => !m.sent);
  console.log(`\n📬 Queued (will send on next boot): ${pending.length}`);
  pending.forEach((m, i) => {
    console.log(`  ${i+1}. "${m.text.substring(0, 50)}"`);
  });
  
  const upcoming = delayed.messages.filter(m => !m.sent);
  console.log(`\n⏰ Delayed (waiting for time): ${upcoming.length}`);
  upcoming.forEach((m, i) => {
    const time = new Date(m.scheduledTime).toLocaleString();
    console.log(`  ${i+1}. "${m.text.substring(0, 40)}..." at ${time}`);
  });
  
  console.log('');
}

// CLI handling
const args = process.argv.slice(2);
const command = args[0];

if (command === 'process') {
  processQueue();
} else if (command === 'add') {
  const text = args.slice(1).join(' ');
  if (text) addToQueue(text);
  else console.log('Usage: node queue-message.js add "your message"');
} else if (command === 'delay') {
  const seconds = parseInt(args[1]);
  const text = args.slice(2).join(' ');
  if (seconds && text) addDelayed(text, seconds);
  else console.log('Usage: node queue-message.js delay 300 "message"');
} else if (command === 'list') {
  listQueue();
} else if (command === 'clear') {
  saveQueue({ messages: [] });
  saveDelayed({ messages: [] });
  console.log('✓ Queue cleared');
} else {
  console.log('Echo Message Queue');
  console.log('===================');
  console.log('');
  console.log('Usage:');
  console.log('  node queue-message.js process    - send all queued messages now');
  console.log('  node queue-message.js add "msg"  - add to queue for next boot');
  console.log('  node queue-message.js delay 60 "msg" - send after 60 seconds');
  console.log('  node queue-message.js list      - show queue status');
  console.log('  node queue-message.js clear    - clear all queues');
  console.log('');
  console.log('The queue is processed automatically when echo-listen.js starts.');
}

module.exports = { processQueue, addToQueue, addDelayed, listQueue };
