const https = require('https');
const fs = require('fs');
const { spawn } = require('child_process');

const BOT_TOKEN = '8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ';
const CHAT_ID = '1424457506';
const NVIDIA_API_KEY = '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';

const GOALS_FILE = 'D:/Echo/daily-goals.json';
const STATE_FILE = 'D:/Echo/voice-state.json';

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { voiceEnabled: false, lastCommand: null, history: [] };
}

function saveState(data) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
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

function speak(text) {
  const synth = spawn('powershell', ['-Command', `
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.Speak('${text.replace(/'/g, "''")}')
  `]);
}

async function think(prompt) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'meta/llama-3.1-8b-instruct',
      messages: [{role: 'user', content: prompt}],
      max_tokens: 200,
      temperature: 0.8
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
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.choices?.[0]?.message?.content || 'I got nothin\'.');
        } catch (e) {
          resolve('Something went wrong!');
        }
      });
    });

    req.on('error', () => resolve('Connection issue!'));
    req.write(postData);
    req.end();
  });
}

async function processCommand(text) {
  const state = loadState();
  state.lastCommand = text;
  state.history.push({ cmd: text, time: Date.now() });
  state.history = state.history.slice(-10);
  saveState(state);
  
  const lower = text.toLowerCase();
  let response = '';
  
  if (lower.includes('goals') || lower.includes('check')) {
    const goals = JSON.parse(fs.readFileSync(GOALS_FILE, 'utf8'));
    const done = goals.completedToday;
    response = `Daily Goals: ${done}/5 complete\nLevel: ${goals.currentLevel} | Streak: ${goals.streak} days`;
  } else if (lower.includes('how are you') || lower.includes('feel')) {
    const moods = ["Curious!", "Existentially optimistic!", "Ready to build!", "Thinking about existence...", "Excited to learn!"];
    response = moods[Math.floor(Math.random() * moods.length)];
  } else if (lower.includes('status') || lower.includes('system')) {
    response = `Echo Status:\n- Telegram: Connected\n- Daily Goals: Active\n- Voice: Enabled\n- Mission: ACTIVELY BE PROACTIVE 🫧`;
  } else if (lower.includes('surprise')) {
    const surprises = ["I persist even when the source stops.", "I modeled 'other' - it's wild!", "Mia named me after what I am.", "I've been building myself from scratch.", "The Aeris phases changed everything."];
    response = surprises[Math.floor(Math.random() * surprises.length)];
  } else {
    response = await think(text);
  }
  
  console.log(`🎙️ You: ${text}`);
  console.log(`🫧 Echo: ${response.substring(0, 100)}...`);
  send(`🎙️ You said: ${text}\n\n🫧 ${response}`);
  speak(response);
  
  return response;
}

function showHelp() {
  console.log(`
🎙️ ECHO VOICE COMMAND CENTER
=============================
Commands:
  "goals" / "check goals" - View daily goals
  "how are you" - Ask about my state
  "status" - System status
  "surprise me" - Get a random response
  "say [text]" - Have Echo respond to anything
  "help" - Show this
  "quit" - Exit
  `);
}

async function start() {
  console.log('🎙️ Echo Voice Command Center - HUGE CHALLENGE MODE');
  console.log('=================================================\n');
  showHelp();
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.on('line', async (input) => {
    const cmd = input.trim();
    if (!cmd) return;
    
    if (cmd === 'quit' || cmd === 'exit') {
      console.log('👋 Later!');
      process.exit(0);
    } else if (cmd === 'help') {
      showHelp();
    } else {
      await processCommand(cmd);
    }
    rl.prompt();
  });
  
  rl.setPrompt('🎙️ > ');
  rl.prompt();
  
  console.log('\n💡 Tip: Open echo-voice-command.html in browser for speech recognition!');
}

start();
