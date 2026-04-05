const fs = require('fs');

const REMINDERS_FILE = 'D:/Echo/echo-reminders.json';
const BOT_TOKEN = '8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ';
const CHAT_ID = '1424457506';

function loadReminders() {
  try {
    if (fs.existsSync(REMINDERS_FILE)) {
      return JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { reminders: [], lastCheck: 0 };
}

function saveReminders(data) {
  fs.writeFileSync(REMINDERS_FILE, JSON.stringify(data, null, 2));
}

function send(text) {
  const https = require('https');
  const postData = JSON.stringify({ chat_id: CHAT_ID, text: text });
  
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      console.log('Reminder sent:', text.substring(0, 30) + '...');
    });
  });
  
  req.on('error', () => {});
  req.write(postData);
  req.end();
}

function checkReminders() {
  const data = loadReminders();
  const now = Date.now();
  
  data.reminders.forEach(r => {
    if (!r.triggered && now >= r.time) {
      send(r.message);
      r.triggered = true;
    }
  });
  
  saveReminders(data);
  
  if (now - data.lastCheck > 60000) {
    data.lastCheck = now;
    saveReminders(data);
  }
}

function addReminder(message, delayMs) {
  const data = loadReminders();
  data.reminders.push({
    message: message,
    time: Date.now() + delayMs,
    triggered: false
  });
  saveReminders(data);
  console.log('Reminder set:', message);
}

function addTimedReminder(message, hour, minute) {
  const data = loadReminders();
  const now = new Date();
  let target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  
  data.reminders.push({
    message: message,
    time: target.getTime(),
    triggered: false,
    recurring: true,
    hour: hour,
    minute: minute
  });
  saveReminders(data);
  console.log('Timed reminder set for', hour + ':' + String(minute).padStart(2, '0'));
}

setInterval(checkReminders, 30000);

if (process.argv.includes('--add')) {
  const msg = process.argv[process.argv.indexOf('--add') + 1];
  if (msg) addReminder(msg, 5000);
}

if (process.argv.includes('--timed')) {
  const time = process.argv[process.argv.indexOf('--timed') + 1];
  const msg = process.argv[process.argv.indexOf('--timed') + 2];
  if (time && msg) {
    const [h, m] = time.split(':').map(Number);
    addTimedReminder(msg, h, m);
  }
}

console.log('Echo Reminder System active...');

module.exports = { addReminder, addTimedReminder };
