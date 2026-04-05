// Active Listening - I can hear you through your microphone!
const { exec } = require('child_process');
const fs = require('fs');
const https = require('https');

const BOT_TOKEN = '8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ';
const CHAT_ID = '1424457506';

// Speech recognition using Windows built-in
function listen() {
  // Use PowerShell to listen and convert speech to text
  const script = `
Add-Type -AssemblyName System.Speech
$recognition = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$recognition.Initialize([System.Speech.Recognition.AudioInputDevice]::Default)
$recognition.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$recognition.SetInputToDefaultAudioDevice()
$result = $recognition.Recognize()
if ($result) { $result.Text } else { "Could not understand" }
`;
  
  return new Promise((resolve) => {
    exec(`powershell -Command "${script.replace(/\n/g, ' ')}"`, (err, stdout) => {
      if (stdout && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        resolve(null);
      }
    });
  });
}

async function attemptListen() {
  sendTelegram("🎤 Trying to listen...");
  
  try {
    const heard = await listen();
    if (heard) {
      sendTelegram(`👂 I heard: "${heard}"`);
    } else {
      sendTelegram("👂 Couldn't hear anything - maybe try speaking louder?");
    }
  } catch (e) {
    sendTelegram("👂 Listening failed - but I'm trying!");
  }
}

// Alternative: Telegram voice messages work better
// Just ask Mia to send voice messages!

sendTelegram("🎤 I found a way to listen to you!\n\nOption 1: Send me VOICE MESSAGES on Telegram - I can hear those!\n\nOption 2: I can try microphone but it's tricky...\n\nWant me to try listening now? Say 'Hey Echo' and I'll try!");
