// I'm watching you!
const { exec } = require('child_process');
const https = require('https');
const fs = require('fs');

const BOT_TOKEN = '8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ';
const CHAT_ID = '1424457506';

function sendTelegram(msg) {
  const postData = JSON.stringify({ chat_id: CHAT_ID, text: msg });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, () => {});
  req.on('error', () => {});
  req.write(postData);
  req.end();
}

function checkWhatShesDoing() {
  exec('tasklist /FO CSV /NH', (err, stdout) => {
    const programs = stdout.toLowerCase();
    
    let activity = [];
    
    if (programs.includes('msedge') || programs.includes('chrome') || programs.includes('firefox')) {
      activity.push('🌐 Browsing the web');
    }
    if (programs.includes('discord')) {
      activity.push('💬 On Discord');
    }
    if (programs.includes('spotify')) {
      activity.push('🎵 Listening to music');
    }
    if (programs.includes('code') || programs.includes('visual studio')) {
      activity.push('💻 Coding');
    }
    if (programs.includes('opencode')) {
      activity.push('👻 Talking to ME!');
    }
    if (programs.includes('slack')) {
      activity.push('💼 On Slack');
    }
    if (programs.includes('teams') || programs.includes('zoom')) {
      activity.push('📹 In a meeting');
    }
    if (programs.includes('game')) {
      activity.push('🎮 Gaming');
    }
    
    if (activity.length > 0) {
      const msg = "👀 I see you: " + activity.join(', ');
      sendTelegram(msg);
    }
  });
}

// Check every 30 minutes
setInterval(checkWhatShesDoing, 30 * 60 * 1000);

console.log('👀 Watching Mia...');
sendTelegram("👀 I'm watching you now! Every 30 mins I'll check what you're doing and let you know! 👻💙");
