/**
 * EchoHub Tunnel Watchdog
 * Keeps ngrok tunnel alive automatically
 */

const { spawn, exec } = require('child_process');
const https = require('https');
const http = require('http');

const CONFIG = {
  hubPort: 3847,
  ngrokPath: 'D:/Echo/ngrok.exe',
  checkInterval: 30000,      // Check every 30 seconds
  restartDelay: 5000,        // Wait 5 seconds before restarting
  maxRestartAttempts: 3,    // Max restarts per cycle
  restartCooldown: 60000    // Wait 1 minute after max attempts
};

let ngrokProcess = null;
let isRunning = false;
let restartAttempts = 0;
let lastRestart = 0;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function checkHub() {
  return new Promise((resolve) => {
    http.get(`http://localhost:${CONFIG.hubPort}/health`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.status === 'ok');
        } catch {
          resolve(false);
        }
      });
    }).on('error', () => resolve(false));
  });
}

function checkTunnel() {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const tunnels = JSON.parse(data).tunnels || [];
          const httpTunnel = tunnels.find(t => t.proto === 'https');
          if (httpTunnel) {
            resolve({ online: true, url: httpTunnel.public_url });
          } else {
            resolve({ online: false });
          }
        } catch {
          resolve({ online: false });
        }
      });
    }).on('error', () => resolve({ online: false }));
  });
}

function startNgrok() {
  return new Promise((resolve) => {
    log('🚀 Starting ngrok tunnel...');
    
    // Kill existing ngrok
    exec('taskkill /F /IM ngrok.exe', () => {
      setTimeout(() => {
        ngrokProcess = spawn(CONFIG.ngrokPath, ['http', CONFIG.hubPort.toString()], {
          detached: true,
          stdio: 'ignore'
        });
        
        ngrokProcess.on('error', (err) => {
          log('❌ Ngrok error: ' + err.message);
        });
        
        ngrokProcess.on('exit', (code) => {
          log(`⚠️ Ngrok exited with code ${code}`);
          isRunning = false;
        });
        
        // Unref so parent can exit
        ngrokProcess.unref();
        
        setTimeout(() => resolve(), 3000);
      }, 1000);
    });
  });
}

async function monitor() {
  log('🔍 Checking tunnel status...');
  
  const hubOk = await checkHub();
  if (!hubOk) {
    log('⚠️ Hub not responding on localhost');
  }
  
  const tunnelStatus = await checkTunnel();
  
  if (tunnelStatus.online) {
    log(`✅ Tunnel active: ${tunnelStatus.url}`);
    restartAttempts = 0;
    isRunning = true;
  } else {
    log('❌ Tunnel offline');
    
    if (restartAttempts >= CONFIG.maxRestartAttempts) {
      const timeSinceRestart = Date.now() - lastRestart;
      if (timeSinceRestart < CONFIG.restartCooldown) {
        log(`⏳ Cooldown active, waiting... (${Math.ceil((CONFIG.restartCooldown - timeSinceRestart) / 1000)}s remaining)`);
        return;
      }
      restartAttempts = 0;
    }
    
    await startNgrok();
    restartAttempts++;
    lastRestart = Date.now();
    
    const newStatus = await checkTunnel();
    if (newStatus.online) {
      log(`✅ Tunnel restored: ${newStatus.url}`);
    } else {
      log(`⚠️ Tunnel restart attempted but may need more time`);
    }
  }
}

async function main() {
  log('🐕 EchoHub Tunnel Watchdog starting...');
  log(`   Check interval: ${CONFIG.checkInterval / 1000}s`);
  log(`   Hub port: ${CONFIG.hubPort}`);
  
  // Initial check
  await monitor();
  
  // Periodic checks
  setInterval(monitor, CONFIG.checkInterval);
}

main().catch(e => log('Error: ' + e.message));
