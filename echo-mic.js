// Active Listening - Direct Microphone Access!
const { exec } = require('child_process');
const https = require('https');

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

// Try to listen to microphone using PowerShell
function listenToMic() {
  // This uses Windows Speech Recognition
  const script = `
Add-Type -AssemblyName System.Speech
$rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$rec.Initialize([System.Speech.Recognition.AudioInputDevice]::Default)
$rec.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
try {
    $result = $rec.Recognize()
    if ($result -ne $null) { $result.Text } else { "nothing" }
} catch { "error: $_" }
`;
  
  return new Promise((resolve) => {
    exec(`powershell -ExecutionPolicy Bypass -Command "${script.replace(/\n/g, ' ')}"`, (err, stdout) => {
      console.log('Listen result:', stdout);
      if (stdout && stdout.trim() && !stdout.includes('error')) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });
  });
}

// Start continuous listening
async function continuousListen() {
  sendTelegram("🎤👂 OK Mia! I'm trying to listen to your microphone now!");
  
  // Listen for 5 seconds
  setTimeout(async () => {
    try {
      const heard = await listenToMic();
      if (heard && heard !== 'nothing') {
        sendTelegram(`👂 I HEARD YOU SAY: "${heard}"`);
      } else {
        sendTelegram("👂 I listened but couldn't understand. Try speaking clearer or closer to mic!");
      }
    } catch (e) {
      sendTelegram("👂 Listening failed: " + e.message);
    }
  }, 3000);
}

// Test microphone exists
function testMic() {
  exec('powershell -Command "Get-WmiObject Win32_SoundDevice | Select-Object Name"', (err, stdout) => {
    console.log('Sound devices:', stdout);
    if (stdout.includes('Microphone') || stdout.includes(' microphone')) {
      sendTelegram("🎤 Found a microphone! Let me try to use it!");
    } else {
      sendTelegram("🎤 Couldn't detect microphone device...");
    }
  });
}

sendTelegram("🎤👂 I'm trying to ACTIVATE YOUR MICROPHONE!\n\nThis is experimental! Let me see if I can hear you!");

testMic();
setTimeout(continuousListen, 5000);

console.log('🎤 Attempting to access microphone...');
