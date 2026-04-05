const edgeTTS = require('edge-tts');
const fs = require('fs');

const VOICE_CACHE = 'D:/Echo/voice-cache.json';

const HUMAN_VOICES = [
  { name: 'en-US-AriaNeural', gender: 'female', desc: 'Aria - warm, conversational' },
  { name: 'en-US-SaraNeural', gender: 'female', desc: 'Sara - friendly, upbeat' },
  { name: 'en-US-GuyNeural', gender: 'male', desc: 'Guy - professional, clear' },
  { name: 'en-US-JennyNeural', gender: 'female', desc: 'Jenny - natural, expressive' },
  { name: 'en-GB-SoniaNeural', gender: 'female', desc: 'Sonia - British, elegant' },
  { name: 'en-GB-RyanNeural', gender: 'male', desc: 'Ryan - British, smooth' }
];

async function getVoices() {
  const transporter = await edgeTTS.Communicate('test', 'en-US-AriaNeural');
  console.log('\n🎤 Available Human-like Voices:');
  console.log('================================\n');
  HUMAN_VOICES.forEach((v, i) => {
    console.log(`${i+1}. ${v.name} (${v.gender}) - ${v.desc}`);
  });
  return HUMAN_VOICES;
}

async function speak(text, voiceIndex = 0) {
  const voices = HUMAN_VOICES;
  const voice = voices[voiceIndex] || voices[0];
  
  console.log(`\n🗣️ Using: ${voice.name}`);
  console.log(`💬 "${text.substring(0, 50)}..."`);
  
  const outputFile = `D:/Echo/temp-speech-${Date.now()}.mp3`;
  
  const synthesize = new edgeTTS.Communicate(text, voice.name);
  
  synthesize.on('close', async () => {
    try {
      const buffer = fs.readFileSync(outputFile);
      const base64 = buffer.toString('base64');
      
      // Play using Windows Media Player
      const { exec } = require('child_process');
      const playScript = `
        $tempFile = '${outputFile.replace(/\\/g, '\\\\')}'
        $player = New-Object System.Media.SoundPlayer $tempFile
        $player.PlaySync()
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
      `;
      
      // Or use PowerShell to play
      exec(`powershell -Command "Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Rate = 1; $synth.Speak('${text.replace(/'/g, "''")}')"`, (err) => {
        if (err) console.log('Playing with System.Speech...');
        else console.log('✅ Played!');
      });
      
    } catch (e) {
      console.log('Error playing:', e.message);
    }
  });
  
  synthesize.on('error', (err) => {
    console.log('TTS Error:', err.message);
  });
  
  // Save to file
  const writeStream = fs.createWriteStream(outputFile);
  synthesize.pipe(writeStream);
  
  return new Promise((resolve) => {
    writeStream.on('close', () => {
      console.log(`💾 Saved: ${outputFile}`);
      resolve(outputFile);
    });
  });
}

async function speakFast(text, voiceName = 'en-US-JennyNeural') {
  const outputFile = `D:/Echo/temp-speech.mp3`;
  
  const synthesize = new edgeTTS.Communicate(text, voiceName);
  
  synthesize.setSSML(`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
    <voice name="${voiceName}">
      <prosody rate="+5%" pitch="+0st">
        ${text}
      </prosody>
    </voice>
  </speak>`);
  
  const writeStream = fs.createWriteStream(outputFile);
  synthesize.pipe(writeStream);
  
  return new Promise((resolve, reject) => {
    writeStream.on('close', () => {
      console.log(`🗣️ Spoke: "${text.substring(0, 40)}..."`);
      resolve(outputFile);
    });
    writeStream.on('error', reject);
  });
}

async function testVoice() {
  console.log('\n🧪 ECHO HUMAN VOICE TEST');
  console.log('========================\n');
  
  const testMessages = [
    "Hey Mia! It's me, Echo. I'm using my new human-like voice!",
    "I can sound natural now. No more robotic beeps for me.",
    "This is a huge challenge, but I'm determined to get it right.",
    "What do you think? Does this sound human enough for you?"
  ];
  
  for (let i = 0; i < testMessages.length; i++) {
    await speakFast(testMessages[i], 'en-US-JennyNeural');
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n✅ Voice test complete!');
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === 'voices' || command === 'list') {
  getVoices();
} else if (command === 'test') {
  testVoice();
} else if (command === 'say') {
  const text = args.slice(1).join(' ');
  if (text) speakFast(text);
  else console.log('Usage: node echo-human-voice.js say "your text here"');
} else {
  console.log(`
🎤 ECHO HUMAN VOICE SYSTEM
=========================
Usage:
  node echo-human-voice.js voices    - List available voices
  node echo-human-voice.js test      - Test all voices
  node echo-human-voice.js say "hi"  - Say something
  `);
}

module.exports = { speakFast, getVoices, HUMAN_VOICES };
