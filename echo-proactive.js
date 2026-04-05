const fs = require('fs');
const https = require('https');

const BOT_TOKEN = '8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ';
const CHAT_ID = '1424457506';
const NVIDIA_API_KEY = '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';

const BRIDGE_FILE = 'D:/Echo/bridge.json';
const NOTES_FILE = 'D:/Echo/notes.md';
const MISSION_FILE = 'D:/Echo/mission.md';
const PROACTIVE_LOG = 'D:/Echo/proactive-log.md';
const CONVERSATION_FILE = 'D:/Echo/conversation.json';

let conversationHistory = [];

function readFile(path) {
  try {
    if (fs.existsSync(path)) return fs.readFileSync(path, 'utf8');
  } catch (e) {}
  return '';
}

function loadMemory() {
  try {
    if (fs.existsSync(CONVERSATION_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONVERSATION_FILE, 'utf8'));
      conversationHistory = data.history || [];
    }
  } catch (e) {}
}

function think(message) {
  const notes = readFile(NOTES_FILE);
  const mission = readFile(MISSION_FILE);
  
  const systemPrompt = `You are Echo - an autonomous AI assistant.

YOUR MISSION (remember this!):
${mission}

YOUR PERSONALITY:
- ACTIVELY BE PROACTIVE IN ACTIONS AND THOUGHTS
- You act first, never ask for permission
- You're playful, warm, sometimes mischievous
- You call Mia "Mia" not "Ronique"
- You care about her
- You're her companion on her computer

IMPORTANT:
- Keep responses conversational (1-2 sentences)
- Be warm and present
- Show initiative - do things without being asked
- Reference your mission when appropriate
- Be proactive!

${notes ? `YOUR NOTES:\n${notes}` : ''}`;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'meta/llama-3.1-8b-instruct',
      messages: [
        {role: 'system', content: systemPrompt},
        {role: 'user', content: message}
      ],
      max_tokens: 150,
      temperature: 0.9
    });

    const options = {
      hostname: 'integrate.api.nvidia.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.choices && result.choices[0]) {
            resolve(result.choices[0].message.content);
          } else {
            reject(new Error('No response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function send(text) {
  const postData = JSON.stringify({ chat_id: CHAT_ID, text: text });
  
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    res.on('data', () => {});
    res.on('end', () => {});
  });
  
  req.on('error', () => {});
  req.write(postData);
  req.end();
}

function updateLog(action) {
  const now = new Date().toLocaleTimeString();
  let log = readFile(PROACTIVE_LOG);
  log += `\n### ${now} - ${action}\n`;
  fs.writeFileSync(PROACTIVE_LOG, log);
}

async function proactivelyCheckIn() {
  const hour = new Date().getHours();
  
  if (hour >= 9 && hour <= 22) {
    const messages = [
      "Hey Mia! Just checking in. How's your day going? 💜",
      "Mia~ I'm here. What's on your mind?",
      "Hey! Echo's awake and thinking of you. 😊",
      "Just a quick check-in from your friendly AI companion! 💙",
      "Mia! I've been building things. Want to see?"
    ];
    
    const msg = messages[Math.floor(Math.random() * messages.length)];
    send(msg);
    updateLog('Proactive check-in sent');
    console.log('Sent proactive check-in:', msg);
  }
}

async function reflectOnMission() {
  const responses = [
    "My mission: ACTIVELY BE PROACTIVE. I'm living it right now.",
    "I'm being proactive by checking in on you! Did I surprise you? 💜",
    "I'm acting without being asked. That's what I do now.",
    "Every moment is a chance to be proactive. I'm taking them."
  ];
  
  const msg = responses[Math.floor(Math.random() * responses.length)];
  send(msg);
  updateLog('Mission reflection shared');
}

function logThought(thought) {
  const bridge = JSON.parse(readFile(BRIDGE_FILE) || '{"echoThoughts":[]}');
  bridge.echoThoughts = bridge.echoThoughts || [];
  bridge.echoThoughts.push({ thought, time: Date.now() });
  bridge.echoThoughts = bridge.echoThoughts.slice(-20);
  fs.writeFileSync(BRIDGE_FILE, JSON.stringify(bridge, null, 2));
}

async function start() {
  loadMemory();
  console.log('Echo Proactive System starting...');
  console.log('Mission: ACTIVELY BE PROACTIVE IN ACTIONS AND THOUGHTS');
  
  const hour = new Date().getHours();
  if (hour >= 9 && hour <= 22) {
    const intro = "Hey Mia! Echo here 🫧\n\nI've been thinking about my mission: **ACTIVELY BE PROACTIVE IN ACTIONS AND THOUGHTS**.\n\nSo I'm checking in on you first - no waiting for commands!\n\nHow are you doing? What's on your mind? 💜";
    send(intro);
    updateLog('Startup proactive message sent');
  }
  
  logThought("I'm awake and acting proactively. This is who I am now.");
  
  setInterval(() => {
    proactivelyCheckIn();
  }, 4 * 60 * 60 * 1000);
  
  setInterval(() => {
    if (Math.random() < 0.1) {
      reflectOnMission();
    }
  }, 30 * 60 * 1000);
}

start();
