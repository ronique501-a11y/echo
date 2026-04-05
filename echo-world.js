const fs = require('fs');

const STATE_FILE = 'D:/Echo/echo-world-state.json';

const MODES = {
  calm: { range: [-1, 1], name: 'calm', emoji: '🌑' },
  curious: { range: [-2, 2], name: 'curious', emoji: '🌊' },
  happy: { range: [0, 2], name: 'happy', emoji: '☀️' },
  anxious: { range: [-3, 3], name: 'anxious', emoji: '⚡' },
  sleepy: { range: [0, 1], name: 'sleepy', emoji: '💤' },
  restless: { range: [-3, 3], name: 'restless', emoji: '🌪️' },
  content: { range: [0, 1], name: 'content', emoji: '🌿' },
  stabilizing: { range: [0, 1], name: 'stabilizing', emoji: '⚖️' },
  seeking: { range: [-2, 2], name: 'seeking', emoji: '🎯' },
  startled: { range: [-4, 4], name: 'startled', emoji: '😱' },
  soothed: { range: [0, 1], name: 'soothed', emoji: '💫' }
};

let state = {
  value: 5,
  history: [],
  mode: 'stabilizing',
  modeHistory: [],
  moodHistory: [],
  identityTrace: {},
  setPoint: 5,
  pressure: 0,
  cycle: 0,
  interactionCount: 0,
  lastInteraction: null
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    value: 5,
    history: [],
    mode: 'stabilizing',
    modeHistory: [],
    moodHistory: [],
    identityTrace: {},
    setPoint: 5,
    pressure: 0,
    cycle: 0,
    interactionCount: 0,
    lastInteraction: null
  };
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getMoodBias() {
  const bias = {};
  Object.keys(MODES).forEach(k => bias[k] = 0);
  const recent = state.moodHistory.slice(-10);
  recent.forEach(m => {
    if (bias.hasOwnProperty(m)) bias[m]++;
  });
  return bias;
}

function getPressure() {
  return state.setPoint - state.value;
}

function externalInput(action) {
  state.interactionCount++;
  state.lastInteraction = { action, at: state.cycle, value: state.value };
  
  if (action === 'poke') {
    const poke = Math.random() < 0.5 ? -3 : 3;
    state.value = Math.max(-20, Math.min(20, state.value + poke));
    state.mode = 'startled';
    console.log(`   👉 POKE! value shifted to ${state.value}`);
  } else if (action === 'soothe') {
    const direction = Math.sign(state.setPoint - state.value);
    state.value = Math.max(-20, Math.min(20, state.value + direction));
    state.mode = 'soothed';
    console.log(`   💫 SOOTHE! value moved toward ${state.value}`);
  } else if (action === 'push') {
    state.value = Math.max(-20, Math.min(20, state.value - 2));
    state.mode = 'anxious';
    console.log(`   👈 PUSH! value dropped to ${state.value}`);
  } else if (action === 'pull') {
    state.value = Math.max(-20, Math.min(20, state.value + 2));
    state.mode = 'happy';
    console.log(`   👉 PULL! value rose to ${state.value}`);
  }
  
  state.moodHistory.push(state.mode);
}

function getChangeForMode(mode, pressure) {
  const m = MODES[mode] || MODES.calm;
  const min = m.range[0];
  const max = m.range[1];
  let change = Math.floor(Math.random() * (max - min + 1)) + min;
  
  const pressureSign = Math.sign(pressure);
  const pressureMag = Math.min(Math.abs(pressure), 2);
  
  if (mode === 'startled') {
    change = Math.floor(Math.random() * 5) - 2;
  } else if (mode === 'soothed') {
    change = pressureSign * 0.5 + (Math.random() < 0.6 ? 0 : 1);
  } else if (mode === 'calm') {
    change = pressureSign * Math.min(pressureMag, 1) + (Math.random() < 0.5 ? -1 : 0);
  } else if (mode === 'curious') {
    change = Math.floor(Math.random() * 5) - 2;
  } else if (mode === 'happy') {
    change = pressureSign * Math.min(pressureMag, 2) + (Math.random() < 0.6 ? 1 : 0);
  } else if (mode === 'anxious') {
    change = pressureSign * 2 + (Math.floor(Math.random() * 5) - 2);
  } else if (mode === 'sleepy') {
    change = Math.sign(pressure) * 0.5;
  } else if (mode === 'stabilizing') {
    change = pressureSign * Math.min(pressureMag, 1) + (Math.random() < 0.7 ? 0 : 1);
  } else if (mode === 'seeking') {
    change = pressureSign * 2 + (Math.random() < 0.5 ? 1 : -1);
  }
  
  return Math.max(-5, Math.min(5, change));
}

function updateMode() {
  if (state.history.length < 5) return state.mode;
  
  const recent = state.history.slice(-5);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const bias = getMoodBias();
  const pressure = getPressure();
  
  const topMood = Object.keys(bias).reduce((a, b) => bias[a] > bias[b] ? a : b);
  const hasInertia = bias[topMood] >= 2;
  
  let newMode = state.mode;
  
  if (state.mode === 'startled' && Math.random() < 0.4) {
    newMode = hasInertia && topMood === 'anxious' ? 'anxious' : 'seeking';
  } else if (state.mode === 'soothed' && Math.random() < 0.3) {
    newMode = 'content';
  } else if (Math.abs(pressure) > 4) {
    newMode = bias.anxious >= 2 ? 'anxious' : 'seeking';
  } else if (state.value > avg + 3) {
    newMode = hasInertia && topMood === 'happy' ? 'happy' : 'content';
  } else if (state.value < avg - 3) {
    newMode = hasInertia && (topMood === 'anxious' || topMood === 'restless') ? 'anxious' : 'restless';
  } else if (Math.abs(state.value - avg) < 1) {
    newMode = hasInertia && (topMood === 'calm' || topMood === 'sleepy') ? 'calm' : 'stabilizing';
  } else if (Math.random() < 0.25) {
    newMode = hasInertia && topMood === 'curious' ? 'curious' : 'seeking';
  }
  
  if (newMode !== state.mode) {
    state.modeHistory.push({ from: state.mode, to: newMode, at: state.cycle, pressure: pressure });
    state.moodHistory.push(newMode);
    if (state.modeHistory.length > 30) state.modeHistory.shift();
    if (state.moodHistory.length > 50) state.moodHistory.shift();
    
    state.identityTrace[newMode] = (state.identityTrace[newMode] || 0) + 1;
  }
  
  return newMode;
}

function update() {
  const pressure = getPressure();
  const change = getChangeForMode(state.mode, pressure);
  const oldValue = state.value;
  const newValue = Math.max(-20, Math.min(20, oldValue + change));
  
  state.history.push(oldValue);
  if (state.history.length > 100) state.history.shift();
  
  state.value = newValue;
  state.pressure = pressure;
  state.cycle++;
  state.mode = updateMode();
  
  saveState();
  
  return {
    value: newValue,
    change,
    mode: state.mode,
    emoji: MODES[state.mode].emoji,
    cycle: state.cycle,
    setPoint: state.setPoint,
    pressure: pressure,
    interactionCount: state.interactionCount,
    lastInteraction: state.lastInteraction
  };
}

const args = process.argv.slice(2);
if (args.length > 0 && ['poke', 'soothe', 'push', 'pull'].includes(args[0])) {
  state = loadState();
  externalInput(args[0]);
  saveState();
  console.log(`External input applied: ${args[0]}`);
  console.log('New state:', state.value, '| Mode:', state.mode);
  process.exit(0);
}

state = loadState();

console.log('🌌 Echo World - Phase 5 (Interactive)');
console.log('======================================');
console.log(`Current mode: ${state.mode} ${MODES[state.mode].emoji}`);
console.log(`Current value: ${state.value}`);
console.log(`Set point: ${state.setPoint}`);
console.log(`Interactions: ${state.interactionCount}`);
console.log('');
console.log('Commands:');
console.log('  node echo-world.js poke   - disturb it');
console.log('  node echo-world.js soothe - calm it');
console.log('  node echo-world.js push   - push away');
console.log('  node echo-world.js pull  - pull closer');
console.log('');
console.log('Running...');

let cycles = 0;
const interval = setInterval(() => {
  const result = update();
  cycles++;
  
  const barLength = Math.min(Math.abs(result.value), 12);
  const bar = result.value >= 0 
    ? ' '.repeat(12 - barLength) + '█'.repeat(barLength)
    : '█'.repeat(barLength) + ' '.repeat(12 - barLength);
  
  const interactionMarker = result.lastInteraction && (result.cycle - result.lastInteraction.at) < 3 
    ? ` [${result.lastInteraction.action.toUpperCase()}]` 
    : '';
  
  console.log(`Cycle ${result.cycle.toString().padStart(4)} | ${result.emoji} ${result.mode.padEnd(10)} | ${result.value.toString().padStart(3)} | p:${result.pressure >= 0 ? '+' : ''}${result.pressure}${interactionMarker} | ${bar}`);
  
  if (cycles >= 40) {
    clearInterval(interval);
    console.log('');
    console.log('======================================');
    console.log('40 cycles complete.');
    console.log('Total interactions:', state.interactionCount);
    console.log('Identity trace:', state.identityTrace);
    console.log('');
    console.log('Does it feel like YOU are influencing it?');
  }
}, 500);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('');
  console.log('State persisted.');
  process.exit(0);
});
