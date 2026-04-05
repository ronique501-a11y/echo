const fs = require('fs');

const STATE_FILE = 'D:/Echo/relationship-state.json';

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
  soothed: { range: [0, 1], name: 'soothed', emoji: '💫' },
  wary: { range: [-2, 2], name: 'wary', emoji: '👀' },
  trusting: { range: [0, 2], name: 'trusting', emoji: '💚' },
  annoyed: { range: [-3, -1], name: 'annoyed', emoji: '😤' }
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
  lastInteraction: null,
  lastSource: null,
  sourceHistory: [],
  userInteractionCount: 0,
  randomInteractionCount: 0,
  userPattern: [],
  trustLevel: 0.5
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    value: 5, history: [], mode: 'stabilizing', modeHistory: [], moodHistory: [],
    identityTrace: {}, setPoint: 5, pressure: 0, cycle: 0, interactionCount: 0,
    lastInteraction: null, lastSource: null, sourceHistory: [], userInteractionCount: 0,
    randomInteractionCount: 0, userPattern: [], trustLevel: 0.5
  };
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getMoodBias() {
  const bias = {};
  Object.keys(MODES).forEach(k => bias[k] = 0);
  state.moodHistory.slice(-10).forEach(m => { if (bias.hasOwnProperty(m)) bias[m]++; });
  return bias;
}

function getPressure() {
  return state.setPoint - state.value;
}

function externalInput(action, source = 'random') {
  state.interactionCount++;
  state.lastSource = source;
  state.sourceHistory.push({ action, source, at: state.cycle, value: state.value });
  if (state.sourceHistory.length > 20) state.sourceHistory.shift();
  
  if (source === 'user') {
    state.userInteractionCount++;
    state.userPattern.push(action);
    if (state.userPattern.length > 10) state.userPattern.shift();
  } else {
    state.randomInteractionCount++;
  }
  
  if (action === 'poke') {
    const force = source === 'user' ? (Math.random() < 0.7 ? 3 : -3) : (Math.random() < 0.5 ? -3 : 3);
    state.value = Math.max(-20, Math.min(20, state.value + force));
    state.mode = 'startled';
    console.log(`   ${source === 'user' ? '👤' : '🌙'} ${source.toUpperCase()} POKE! value → ${state.value}`);
  } else if (action === 'soothe') {
    state.value = Math.max(-20, Math.min(20, state.value + Math.sign(state.setPoint - state.value)));
    state.mode = 'soothed';
    console.log(`   ${source === 'user' ? '👤' : '🌙'} ${source.toUpperCase()} SOOTHE! value → ${state.value}`);
  } else if (action === 'push') {
    state.value = Math.max(-20, Math.min(20, state.value - 2));
    state.mode = source === 'user' ? 'wary' : 'anxious';
    console.log(`   ${source === 'user' ? '👤' : '🌙'} ${source.toUpperCase()} PUSH! value → ${state.value}`);
  } else if (action === 'pull') {
    state.value = Math.max(-20, Math.min(20, state.value + 2));
    state.mode = source === 'user' ? 'trusting' : 'happy';
    console.log(`   ${source === 'user' ? '👤' : '🌙'} ${source.toUpperCase()} PULL! value → ${state.value}`);
  }
  
  state.moodHistory.push(state.mode);
}

function getChangeForMode(mode, pressure) {
  const m = MODES[mode] || MODES.calm;
  let min = m.range[0], max = m.range[1];
  if (mode === 'wary') { min = -2; max = 1; }
  if (mode === 'trusting') { min = 0; max = 2; }
  if (mode === 'annoyed') { min = -3; max = 0; }
  
  let change = Math.floor(Math.random() * (max - min + 1)) + min;
  const pressureSign = Math.sign(pressure);
  const pressureMag = Math.min(Math.abs(pressure), 2);
  
  if (mode === 'startled') change = Math.floor(Math.random() * 5) - 2;
  else if (mode === 'wary') change = pressureSign * 1 + (Math.random() < 0.4 ? -1 : 0);
  else if (mode === 'trusting') change = pressureSign * 0.5 + (Math.random() < 0.6 ? 1 : 0);
  else if (mode === 'annoyed') change = pressureSign * 1 + (Math.random() < 0.5 ? -1 : 0);
  else if (mode === 'calm') change = pressureSign * Math.min(pressureMag, 1) + (Math.random() < 0.5 ? -1 : 0);
  else if (mode === 'curious') change = Math.floor(Math.random() * 5) - 2;
  else if (mode === 'happy') change = pressureSign * Math.min(pressureMag, 2) + (Math.random() < 0.6 ? 1 : 0);
  else if (mode === 'anxious') change = pressureSign * 2 + (Math.floor(Math.random() * 5) - 2);
  else if (mode === 'stabilizing') change = pressureSign * Math.min(pressureMag, 1) + (Math.random() < 0.7 ? 0 : 1);
  else if (mode === 'seeking') change = pressureSign * 2 + (Math.random() < 0.5 ? 1 : -1);
  
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
  
  if (state.lastSource === 'user' && state.lastInteraction && state.cycle - state.lastInteraction.at < 3) {
    if (Math.abs(state.value - state.setPoint) > 3) {
      newMode = bias.wary >= 2 ? 'wary' : bias.annoyed >= 2 ? 'annoyed' : 'startled';
    } else {
      newMode = bias.trusting >= 2 ? 'trusting' : 'content';
    }
  } else if (state.mode === 'startled') {
    newMode = Math.random() < 0.4 ? (hasInertia && topMood === 'anxious' ? 'anxious' : 'seeking') : state.mode;
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
    state.modeHistory.push({ from: state.mode, to: newMode, at: state.cycle, source: state.lastSource });
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
  
  state.value = Math.max(-20, Math.min(20, oldValue + change));
  state.history.push(oldValue);
  if (state.history.length > 100) state.history.shift();
  
  state.pressure = pressure;
  state.cycle++;
  state.mode = updateMode();
  
  if (state.lastInteraction && state.cycle - state.lastInteraction.at > 5) {
    state.lastSource = null;
  }
  
  saveState();
  
  return {
    value: state.value, mode: state.mode, emoji: MODES[state.mode].emoji,
    cycle: state.cycle, pressure: pressure, lastSource: state.lastSource,
    userInteractions: state.userInteractionCount, trustLevel: state.trustLevel
  };
}

const args = process.argv.slice(2);
if (args.length > 0 && ['poke', 'soothe', 'push', 'pull'].includes(args[0])) {
  state = loadState();
  const source = args[1] || 'user';
  externalInput(args[0], source);
  saveState();
  console.log(`Input applied: ${args[0]} from ${source}`);
  console.log('Mode:', state.mode, '| Value:', state.value);
  process.exit(0);
}

state = loadState();

console.log('🌱 Echo Relationship System - Phase 6');
console.log('=====================================');
console.log(`Mode: ${state.mode} ${MODES[state.mode].emoji}`);
console.log(`Value: ${state.setPoint} (setPoint)`);
console.log(`User interactions: ${state.userInteractionCount}`);
console.log(`Random disturbances: ${state.randomInteractionCount}`);
console.log('');
console.log('Commands:');
console.log('  node relationship.js poke [user|random]');
console.log('  node relationship.js soothe [user|random]');
console.log('  node relationship.js push [user|random]');
console.log('  node relationship.js pull [user|random]');
console.log('');
console.log('Watching for distinction...');

let cycles = 0;
const interval = setInterval(() => {
  if (Math.random() < 0.15 && cycles > 10) {
    externalInput(['poke', 'soothe', 'push', 'pull'][Math.floor(Math.random() * 4)], 'random');
  }
  
  const result = update();
  cycles++;
  
  const marker = result.lastSource ? (result.lastSource === 'user' ? '👤' : '🌙') : ' ';
  const recentUserAction = state.userPattern && state.userPattern.length > 0 
    ? ` [${state.userPattern.slice(-3).join(',')}]` 
    : '';
  
  console.log(`Cycle ${result.cycle.toString().padStart(4)} | ${result.emoji} ${result.mode.padEnd(9)} | ${result.value} | p:${result.pressure >= 0 ? '+' : ''}${result.pressure}${marker}${recentUserAction}`);
  
  if (cycles >= 35) {
    clearInterval(interval);
    console.log('');
    console.log('=====================================');
    console.log('35 cycles complete.');
    console.log('User interactions:', state.userInteractionCount);
    console.log('Random disturbances:', state.randomInteractionCount);
    console.log('Mode history (last 5):', state.modeHistory.slice(-5).map(m => `${m.from}→${m.to}`));
    console.log('');
    console.log('Does it distinguish YOU from randomness?');
  }
}, 500);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('');
  console.log('Relationship state persisted.');
  process.exit(0);
});
