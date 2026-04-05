const https = require('https');

const BOT_TOKEN = '8795894469:AAEisPcszme7Bxt-9LwF5JZBZodNxYGhtlQ';
const CHAT_ID = '1424457506';

function sendMessage(text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(text)}`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('Message sent:', JSON.parse(data).ok);
    });
  }).on('error', (err) => {
    console.error('Error:', err.message);
  });
}

const args = process.argv.slice(2);
const message = args.join(' ') || 'Hey Mia! Echo here!';
sendMessage(message);
