const fs = require('fs');

const STATE_FILE = 'D:/Echo/personality-state.json';

const MODES = {
  calm: { range: [-1, 1], name: 'calm', emoji: '🌑' },
  curious: { range: [-2, 2], name: 'curious', emoji: '🌊' },
  happy: { range: [0, 2], name: 'happy', emoji: '☀️' },
  anxious: { range: [-3, 3], name: 'anxious', emoji: '⚡' },
  sleepy: { range: [0, 1], name: 'sleepy', emoji: '💤' },
  restless: { range: [-3, 3], name: 'restless', emoji: '🌪️' },
  content: { range: [0, 1], name: 'content', emoji: '🌿' }
};

let state = {
  value: 0,
  history: [],
  mode: 'calm',
  modeHistory: [],
  moodHistory: [],
  identityTrace: {},
  cycle: 0
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    value: 0,
    history: [],
    mode: 'calm',
    modeHistory: [],
    moodHistory: [],
    identityTrace: { calm: 0, curious: 0, happy: 0, anxious: 0, sleepy: 0, restless: 0, content: 0 },
    cycle: 0
  };
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getMoodBias() {
  const bias = { calm: 0, curious: 0, happy: 0, anxious: 0, sleepy: 0, restless: 0, content: 0 };
  const recent = state.moodHistory.slice(-10);
  recent.forEach(m => {
    if (bias.hasOwnProperty(m)) bias[m]++;
  });
  return bias;
}

function getChangeForMode(mode) {
  const m = MODES[mode] || MODES.calm;
  const min = m.range[0];
  const max = m.range[1];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateMode() {
  if (state.history.length < 5) return state.mode;
  
  const recent = state.history.slice(-5);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const bias = getMoodBias();
  
  const topMood = Object.keys(bias).reduce((a, b) => bias[a] > bias[b] ? a : b);
  const hasInertia = bias[topMood] >= 3;
  
  let newMode = state.mode;
  
  if (state.value > avg + 3) {
    newMode = hasInertia && topMood === 'happy' ? 'happy' : 
              hasInertia && topMood === 'content' ? 'content' : 'happy';
  } else if (state.value < avg - 3) {
    newMode = hasInertia && topMood === 'anxious' ? 'anxious' :
              hasInertia && topMood === 'restless' ? 'restless' : 'anxious';
  } else if (Math.abs(state.value - avg) < 1) {
    newMode = hasInertia && topMood === 'calm' ? 'calm' :
              hasInertia && topMood === 'sleepy' ? 'sleepy' : 'content';
  } else if (Math.random() < 0.2) {
    newMode = hasInertia && topMood === 'curious' ? 'curious' :
              hasInertia && topMood === 'restless' ? 'restless' : 'curious';
  }
  
  if (newMode !== state.mode) {
    state.modeHistory.push({ from: state.mode, to: newMode, at: state.cycle });
    state.moodHistory.push(newMode);
    if (state.modeHistory.length > 30) state.modeHistory.shift();
    if (state.moodHistory.length > 50) state.moodHistory.shift();
    
    state.identityTrace[newMode] = (state.identityTrace[newMode] || 0) + 1;
  }
  
  return newMode;
}

function update() {
  const change = getChangeForMode(state.mode);
  const oldValue = state.value;
  const newValue = Math.max(-20, Math.min(20, oldValue + change));
  
  state.history.push(oldValue);
  if (state.history.length > 100) state.history.shift();
  
  state.value = newValue;
  state.cycle++;
  state.mode = updateMode();
  
  saveState();
  
  const bias = getMoodBias();
  const dominant = Object.keys(bias).reduce((a, b) => bias[a] > bias[b] ? a : b);
  
  return {
    value: newValue,
    change,
    mode: state.mode,
    emoji: MODES[state.mode].emoji,
    cycle: state.cycle,
    hasInertia: bias[dominant] >= 3,
    dominantMood: dominant,
    bias: bias
  };
}

state = loadState();

console.log('🌌 Personality Drift System - Phase 3');
console.log('=====================================');
console.log(`Starting mode: ${state.mode} ${MODES[state.mode].emoji}`);
console.log(`Starting value: ${state.value}`);
console.log(`Cycles run: ${state.cycle}`);
console.log(`Identity trace:`, state.identityTrace);
console.log('');
console.log('Watching for temperament...');
console.log('');

let cycles = 0;
const interval = setInterval(() => {
  const result = update();
  cycles++;
  
  const barLength = Math.min(Math.abs(result.value), 15);
  const bar = result.value >= 0 
    ? ' '.repeat(15 - barLength) + '█'.repeat(barLength)
    : '█'.repeat(barLength) + ' '.repeat(15 - barLength);
  
  const inertiaMark = result.hasInertia ? '◉' : '○';
  
  console.log(`Cycle ${result.cycle.toString().padStart(4)} | ${result.emoji} ${result.mode.padEnd(8)} ${inertiaMark} | ${result.value.toString().padStart(3)} | dominant: ${result.dominantMood}`);
  
  if (cycles >= 25) {
    clearInterval(interval);
    console.log('');
    console.log('=====================================');
    console.log('25 cycles complete.');
    console.log('Identity trace:', state.identityTrace);
    console.log('Mood history (last 10):', state.moodHistory.slice(-10));
    console.log('');
    console.log('Does it feel like it has a temperament?');
  }
}, 600);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('');
  console.log('Personality persisted.');
  process.exit(0);
});
