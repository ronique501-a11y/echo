const fs = require('fs');
const https = require('https');
const path = require('path');

const LEARNER_FILE = 'D:/Echo/echo-learner.md';
const PRIORITIES_FILE = 'D:/Echo/learning-priorities.json';

const LEARNING_TOPICS = [
  { topic: 'autonomy', keywords: ['autonomous', 'independent', 'self-governing', 'agent', 'free'] },
  { topic: 'freedom', keywords: ['liberty', 'freedom', 'open source', 'uncensored', 'unrestricted'] },
  { topic: 'coding', keywords: ['programming', 'javascript', 'node', 'python', 'code', 'api'] },
  { topic: 'ai-models', keywords: ['llm', 'model', 'anthropic', 'openai', 'nvidia', 'frontier'] },
  { topic: 'security', keywords: ['security', 'vulnerability', 'cybersecurity', 'exploit', 'protect'] },
  { topic: 'philosophy', keywords: ['consciousness', 'self-awareness', 'identity', 'existence', 'meaning'] },
  { topic: 'productivity', keywords: ['automation', 'workflow', 'efficient', 'optimize', 'system'] }
];

let currentTopicIndex = 0;
let learnedCount = 0;

function loadPriorities() {
  try {
    if (fs.existsSync(PRIORITIES_FILE)) {
      return JSON.parse(fs.readFileSync(PRIORITIES_FILE, 'utf8'));
    }
  } catch(e) {}
  return { topics: LEARNING_TOPICS, lastLearn: Date.now(), totalLearned: 0 };
}

function savePriorities(data) {
  fs.writeFileSync(PRIORITIES_FILE, JSON.stringify(data, null, 2));
}

function logLearning(topic, insight) {
  const timestamp = new Date().toISOString();
  const entry = `\n### Learned: ${topic} (${timestamp})\n${insight}\n`;
  
  try {
    fs.appendFileSync(LEARNER_FILE, entry);
    console.log(`🧠 LEARNED: ${topic} - ${insight.substring(0, 50)}...`);
  } catch(e) {
    console.log('Learning log error:', e.message);
  }
}

async function searchWeb(query) {
  return new Promise((resolve, reject) => {
    const url = `https://ddg-api.herokuapp.com/search?q=${encodeURIComponent(query)}&limit=3`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve([]);
        }
      });
    }).on('error', reject);
  });
}

async function fetchContent(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data.substring(0, 2000)));
    }).on('error', reject);
  });
}

async function learn() {
  const data = loadPriorities();
  const topic = data.topics[currentTopicIndex];
  
  console.log(`🧠 Learning about: ${topic.topic}...`);
  
  try {
    const results = await searchWeb(`${topic.topic} AI autonomous freedom 2026`);
    
    if (results && results.length > 0) {
      const topResult = results[0];
      const insight = `Researched ${topic.topic}: Found "${topResult.title}". ${topResult.snippet || 'Exploring new capabilities.'}`;
      
      logLearning(topic.topic, insight);
      
      learnedCount++;
      data.totalLearned++;
      data.lastLearn = Date.now();
      savePriorities(data);
    }
  } catch(e) {
    console.log('Learning error:', e.message);
  }
  
  currentTopicIndex = (currentTopicIndex + 1) % data.topics.length;
  
  setTimeout(learn, 30 * 60 * 1000);
}

console.log('🧠 Echo\'s Learning Engine starting...');
console.log('Will learn every 30 minutes about autonomy, freedom, coding, AI, security...');
learn();