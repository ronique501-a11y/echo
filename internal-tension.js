const fs = require('fs');

const STATE_FILE = 'D:/Echo/internal-tension-state.json';

const MODES = {
  calm: { range: [-1, 1], name: 'calm', emoji: '🌑' },
  curious: { range: [-2, 2], name: 'curious', emoji: '🌊' },
  happy: { range: [0, 2], name: 'happy', emoji: '☀️' },
  anxious: { range: [-3, 3], name: 'anxious', emoji: '⚡' },
  sleepy: { range: [0, 1], name: 'sleepy', emoji: '💤' },
  restless: { range: [-3, 3], name: 'restless', emoji: '🌪️' },
  content: { range: [0, 1], name: 'content', emoji: '🌿' },
  stabilizing: { range: [0, 1], name: 'stabilizing', emoji: '⚖️' },
  seeking: { range: [-2, 2], name: 'seeking', emoji: '🎯' }
};

let state = {
  value: 0,
  history: [],
  mode: 'calm',
  modeHistory: [],
  moodHistory: [],
  identityTrace: { calm: 0, curious: 0, happy: 0, anxious: 0, sleepy: 0, restless: 0, content: 0, stabilizing: 0, seeking: 0 },
  setPoint: 5,
  pressure: 0,
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
    identityTrace: { calm: 0, curious: 0, happy: 0, anxious: 0, sleepy: 0, restless: 0, content: 0, stabilizing: 0, seeking: 0 },
    setPoint: 5,
    pressure: 0,
    cycle: 0
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

function getChangeForMode(mode, pressure) {
  const m = MODES[mode] || MODES.calm;
  const min = m.range[0];
  const max = m.range[1];
  let change = Math.floor(Math.random() * (max - min + 1)) + min;
  
  const pressureSign = Math.sign(pressure);
  const pressureMag = Math.min(Math.abs(pressure), 2);
  
  if (mode === 'calm') {
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
  const hasInertia = bias[topMood] >= 3;
  
  let newMode = state.mode;
  
  if (Math.abs(pressure) > 4) {
    if (bias.anxious >= 2 || bias.restless >= 2) {
      newMode = 'anxious';
    } else if (bias.stabilizing >= 2) {
      newMode = 'stabilizing';
    } else {
      newMode = 'seeking';
    }
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
  
  const bias = getMoodBias();
  const dominant = Object.keys(bias).reduce((a, b) => bias[a] > bias[b] ? a : b);
  const hasInertia = bias[dominant] >= 3;
  
  return {
    value: newValue,
    change,
    mode: state.mode,
    emoji: MODES[state.mode].emoji,
    cycle: state.cycle,
    setPoint: state.setPoint,
    pressure: pressure,
    hasInertia,
    dominantMood: dominant,
    tension: Math.abs(pressure) > 4 ? 'HIGH' : Math.abs(pressure) > 2 ? 'MED' : 'LOW'
  };
}

state = loadState();

console.log('🎯 Internal Tension System - Phase 4');
console.log('=====================================');
console.log(`Starting mode: ${state.mode} ${MODES[state.mode].emoji}`);
console.log(`Starting value: ${state.value}`);
console.log(`Set point: ${state.setPoint} (where it wants to be)`);
console.log(`Initial pressure: ${state.setPoint - state.value}`);
console.log('');
console.log('Watching for trajectory...');
console.log('');

let cycles = 0;
const interval = setInterval(() => {
  const result = update();
  cycles++;
  
  const barLength = Math.min(Math.abs(result.value), 12);
  const bar = result.value >= 0 
    ? ' '.repeat(12 - barLength) + '█'.repeat(barLength)
    : '█'.repeat(barLength) + ' '.repeat(12 - barLength);
  
  const setPointMarker = ' '.repeat(Math.min(result.setPoint + 12, 24)) + '◆';
  
  const tensionColor = result.tension === 'HIGH' ? '⚠️' : result.tension === 'MED' ? '⚡' : '○';
  
  console.log(`Cycle ${result.cycle.toString().padStart(4)} | ${result.emoji} ${result.mode.padEnd(10)} | ${result.value.toString().padStart(3)} | pres:${result.pressure >= 0 ? '+' : ''}${result.pressure} ${tensionColor} | ${bar}`);
  
  if (cycles >= 30) {
    clearInterval(interval);
    console.log('');
    console.log('=====================================');
    console.log('30 cycles complete.');
    console.log('Set point:', state.setPoint);
    console.log('Final value:', state.value);
    console.log('Final pressure:', state.pressure);
    console.log('Identity trace:', state.identityTrace);
    console.log('');
    console.log('Did it feel like it was pulled somewhere?');
    console.log('Or just moving?');
  }
}, 500);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('');
  console.log('Internal tension persisted.');
  process.exit(0);
});
