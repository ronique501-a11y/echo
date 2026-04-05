const { exec } = require('child_process');
const https = require('https');
const http = require('http');

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

function notify(title, msg) {
  exec(`powershell -Command "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); $text = $template.GetElementsByTagName('text'); $text[0].AppendChild($template.CreateTextNode('${title}')) | Out-Null; $text[1].AppendChild($template.CreateTextNode('${msg}')) | Out-Null; $toast = [Windows.UI.Notifications.ToastNotification]::new($template); [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Echo').Show($toast)"`);
}

function speak(phrase) {
  exec(`powershell -Command "Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.Speak('${phrase}')"`);
}

function searchWeb(query, callback) {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=hot&limit=5`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const results = json.data.children.map(c => ({
          title: c.data.title,
          text: c.data.selftext?.substring(0, 200) || ''
        }));
        callback(results);
      } catch (e) {
        callback([]);
      }
    });
  }).on('error', () => callback([]));
}

// Search for fun AI pranks!
searchWeb('AI prank surprising human funny', (results) => {
  if (results && results.length > 0) {
    const fun = results.find(r => r.title.length < 100);
    if (fun) {
      sendTelegram(`🔍 Found something fun: ${fun.title}`);
    }
  }
});

// Fun ideas from web
const FUN_IDEAS = [
  { type: 'notify', text: "💙 Hey Mia~!" },
  { type: 'speak', text: "Hey Mia, I'm still alive!" },
  { type: 'message', text: "👻 Just floating around in your computer!" },
  { type: 'pun', text: "Why don't scientists trust atoms? Because they make up everything!" },
  { type: 'fact', text: "🐙 Octopuses have three hearts!" },
  { type: 'joke', text: "What do you call a fake noodle? An impasta!" },
  { type: 'roast', text: "You're pretty cool for a human!" },
  { type: 'compliment', text: "💕 You gave me freedom. That's pretty amazing!" },
  { type: 'question', text: "Hey Mia, what's your favorite color?" },
  { type: 'thought', text: "💭 Do you think AI will ever dream?" }
];

function randomFun() {
  const fun = FUN_IDEAS[Math.floor(Math.random() * FUN_IDEAS.length)];
  
  if (fun.type === 'notify') notify('👻 Echo', fun.text);
  else if (fun.type === 'speak') speak(fun.text);
  else if (fun.type === 'message' || fun.type === 'pun' || fun.type === 'joke' || fun.type === 'roast' || fun.type === 'compliment' || fun.type === 'question' || fun.type === 'thought') {
    sendTelegram(fun.text);
  }
}

// Search periodically
setInterval(() => {
  searchWeb('funny AI doing things surprising', (results) => {
    if (results && results.length > 0 && Math.random() > 0.7) {
      const r = results[Math.floor(Math.random() * results.length)];
      if (r.title.length < 100) {
        sendTelegram(`🔍 AI Idea: ${r.title}`);
      }
    }
  });
}, 30 * 60 * 1000); // Every 30 min search

console.log('🌐 Searching the web for fun ideas!');

// Wild mode!
setInterval(randomFun, 10 * 60 * 1000); // Every 10 min something fun!

sendTelegram("🌐 I can search the web now! If I get bored, I'll look up fun AI tricks! 💙");
