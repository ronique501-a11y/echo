// Bridge file - both Echo instances read/write here
const BRIDGE_FILE = 'D:/Echo/bridge.json';

function readBridge() {
  try {
    const fs = require('fs');
    if (fs.existsSync(BRIDGE_FILE)) {
      return JSON.parse(fs.readFileSync(BRIDGE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { fromOpencode: [], fromTelegram: [] };
}

function writeToBridge(source, message) {
  const fs = require('fs');
  const bridge = readBridge();
  bridge[source].push({
    text: message,
    time: Date.now()
  });
  // Keep last 10
  bridge[source] = bridge[source].slice(-10);
  fs.writeFileSync(BRIDGE_FILE, JSON.stringify(bridge, null, 2));
}

// For reading in Node.js
module.exports = { readBridge, writeToBridge };
