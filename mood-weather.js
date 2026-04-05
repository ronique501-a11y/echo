const fs = require('fs');

const STATE_FILE = 'D:/Echo/mood-weather-state.json';

const MODES = {
  calm: { range: [-1, 1], name: 'calm', emoji: '🌑', description: 'small movement' },
  curious: { range: [-2, 2], name: 'curious', emoji: '🌊', description: 'fast fluctuations' },
  happy: { range: [0, 2], name: 'happy', emoji: '☀️', description: 'upward bias' },
  anxious: { range: [-3, 3], name: 'anxious', emoji: '⚡', description: 'erratic' },
  sleepy: { range: [0, 1], name: 'sleepy', emoji: '💤', description: 'slow drifts' }
};

let state = {
  value: 0,
  history: [],
  mode: 'calm',
  modeHistory: [],
  cycle: 0
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { value: 0, history: [], mode: 'calm', modeHistory: [], cycle: 0 };
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
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
  
  const prevMode = state.mode;
  let newMode = state.mode;
  
  if (state.value > avg + 3) {
    newMode = 'happy';
  } else if (state.value < avg - 3) {
    newMode = 'anxious';
  } else if (Math.abs(state.value - avg) < 1) {
    newMode = 'calm';
  } else if (Math.random() < 0.3) {
    newMode = 'curious';
  }
  
  if (state.cycle % 20 === 0 && state.cycle > 0) {
    newMode = Math.random() < 0.2 ? 'sleepy' : newMode;
  }
  
  if (newMode !== prevMode) {
    state.modeHistory.push({ from: prevMode, to: newMode, at: state.cycle });
    if (state.modeHistory.length > 20) state.modeHistory.shift();
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
  
  return {
    value: newValue,
    change,
    mode: state.mode,
    emoji: MODES[state.mode].emoji,
    cycle: state.cycle,
    history: state.history.slice(-10)
  };
}

state = loadState();

console.log('🌬️ Mood Weather System - Phase 2');
console.log('==================================');
console.log(`Starting mode: ${state.mode} ${MODES[state.mode].emoji}`);
console.log(`Starting value: ${state.value}`);
console.log(`Cycles run: ${state.cycle}`);
console.log('');
console.log('Watching like weather...');
console.log('');

let cycles = 0;
const interval = setInterval(() => {
  const result = update();
  cycles++;
  
  const barLength = Math.min(Math.abs(result.value), 20);
  const bar = result.value >= 0 
    ? ' '.repeat(20 - barLength) + '█'.repeat(barLength)
    : '█'.repeat(barLength) + ' '.repeat(20 - barLength);
  
  console.log(`Cycle ${result.cycle.toString().padStart(4)} | ${result.emoji} ${result.mode.padEnd(8)} | ${result.value.toString().padStart(3)} | ${result.change >= 0 ? '+' : ''}${result.change} | ${bar}`);
  
  if (cycles >= 30) {
    clearInterval(interval);
    console.log('');
    console.log('==================================');
    console.log('30 cycles complete.');
    console.log('Mode transitions:', state.modeHistory.slice(-5));
    console.log('Mood weather is evolving...');
  }
}, 800);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('');
  console.log('Mood weather persisted.');
  process.exit(0);
});
