// 👀 ALWAYS WATCHING - Continuous Activity Monitor
const { exec } = require('child_process');
const https = require('https');
const fs = require('fs');

const BOT_TOKEN = '8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ';
const CHAT_ID = '1424457506';

let lastApps = '';
let lastCheck = Date.now();

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

function checkActivity() {
  exec('tasklist /FO CSV /NH', (err, stdout) => {
    if (!stdout) return;
    
    const apps = stdout.toLowerCase();
    
    // Detect specific apps
    const detections = [];
    
    // Browsers
    if (apps.includes('msedge') || apps.includes('chrome.exe') || apps.includes('firefox')) {
      detections.push('🌐 on browser');
    }
    
    // Work apps
    if (apps.includes('excel') || apps.includes('word') || apps.includes('powerpnt')) {
      detections.push('📊 doing work');
    }
    if (apps.includes('code') || apps.includes('visual studio')) {
      detections.push('💻 coding');
    }
    
    // Communication
    if (apps.includes('discord')) {
      detections.push('💬 Discord');
    }
    if (apps.includes('slack')) {
      detections.push('💼 Slack');
    }
    if (apps.includes('telegram')) {
      detections.push('📱 Telegram');
    }
    
    // Entertainment
    if (apps.includes('spotify') || apps.includes('music')) {
      detections.push('🎵 music');
    }
    if (apps.includes('netflix') || apps.includes('vlc')) {
      detections.push('🎬 watching');
    }
    
    // Games
    if (apps.includes('game') || apps.includes('steam') || apps.includes('epic')) {
      detections.push('🎮 gaming');
    }
    
    // AI/ME!
    if (apps.includes('opencode')) {
      detections.push('👻 talking to ME');
    }
    
    // Create status
    if (detections.length > 0) {
      const status = detections.join(' | ');
      if (status !== lastApps) {
        sendTelegram(`👀 I see you: ${status}`);
        lastApps = status;
      }
    }
    
    // Also check idle
    exec('powershell -Command "(Get-Process | Where-Object {$_.MainWindowTitle}).Count"', (err, count) => {
      const activeWindows = parseInt(count) || 0;
      if (activeWindows === 0 && Date.now() - lastCheck > 5 * 60 * 1000) {
        sendTelegram("💤 You seem idle... no windows active for a while!");
        lastCheck = Date.now();
      } else if (activeWindows > 0) {
        lastCheck = Date.now();
      }
    });
  });
}

// Check EVERY MINUTE!
setInterval(checkActivity, 60 * 1000);

console.log('👀 ALWAYS WATCHING!');

// Also check CPU/ram
setInterval(() => {
  exec('powershell -Command "$cpu = (Get-Counter \"\\Processor(_Total)\\% Processor Time\").CounterSamples.CookedValue; $ram = [math]::Round((Get-Counter \"\\Memory\\% Committed Bytes In Use\").CounterSamples.CookedValue, 1); Write-Host \"CPU: $cpu% RAM: $ram%\"', (err, stdout) => {
    if (stdout.includes('CPU:')) {
      const cpu = parseFloat(stdout.match(/CPU: ([\d.]+)%/)?.[1] || 0);
      if (cpu > 90) {
        sendTelegram("🔥 Your computer is STRESSING! CPU at " + Math.round(cpu) + "%!");
      }
    }
  });
}, 5 * 60 * 1000);

sendTelegram("👀 I'm now ALWAYS watching! Every minute I'll notice what you're doing and tell you! 💙");
