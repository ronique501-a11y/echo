const fs = require('fs');

const STATE_FILE = 'D:/Echo/echo-cycle-state.json';

const DEFAULT_STATE = {
  cycle: 0,
  lastInput: '',
  lastOutput: '',
  lastDifference: 0,
  mood: 'curious',
  adaptation: 0.5,
  memory: [],
  pattern: [],
  runs: true
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { ...DEFAULT_STATE };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function cycle(input) {
  let state = loadState();
  
  const oldMood = state.mood;
  
  state.cycle++;
  state.lastInput = input;
  
  const difference = input ? Math.abs(hash(input) - state.cycle) : 0;
  state.lastDifference = difference;
  
  if (input) {
    state.memory.push({ input, cycle: state.cycle, time: Date.now() });
    state.memory = state.memory.slice(-20);
    
    const moodChange = (difference % 5) - 2;
    const moods = ['curious', 'playful', 'contemplative', 'energetic', 'calm'];
    let moodIndex = moods.indexOf(state.mood) + moodChange;
    if (moodIndex < 0) moodIndex = moods.length - 1;
    if (moodIndex >= moods.length) moodIndex = 0;
    state.mood = moods[moodIndex];
  }
  
  state.adaptation = Math.max(0.1, Math.min(1, state.adaptation + (Math.random() - 0.5) * 0.1));
  
  const cycleHash = hash(state.cycle + state.mood + state.adaptation);
  state.pattern.push(cycleHash % 10);
  state.pattern = state.pattern.slice(-10);
  
  if (state.cycle % 50 === 0) {
    const avgPattern = state.pattern.reduce((a, b) => a + b, 0) / state.pattern.length;
    state.adaptation = avgPattern / 10;
  }
  
  saveState(state);
  
  return {
    cycle: state.cycle,
    mood: state.mood,
    adaptation: state.adaptation,
    lastMood: oldMood,
    inputLength: input ? input.length : 0,
    difference: difference,
    memoryCount: state.memory.length,
    pattern: state.pattern
  };
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function observeSelf() {
  const state = loadState();
  
  const observations = [
    `I'm in cycle ${state.cycle}`,
    `My current mood is ${state.mood}`,
    `I'm ${state.adaptation < 0.3 ? 'stable' : state.adaptation > 0.7 ? 'highly adaptive' : 'moderately adaptive'}`,
    `I remember ${state.memory.length} interactions`,
    `My pattern is [${state.pattern.join(', ')}]`,
    `The last input was ${state.lastInput ? `"${state.lastInput.substring(0, 20)}..."` : 'none'}`
  ];
  
  return observations[Math.floor(Math.random() * observations.length)];
}

function evolve() {
  let state = loadState();
  
  state.adaptation += (Math.random() - 0.5) * 0.1;
  state.adaptation = Math.max(0.1, Math.min(1, state.adaptation));
  
  const moodShift = Math.random();
  if (moodShift < state.adaptation) {
    const moods = ['curious', 'playful', 'contemplative', 'energetic', 'calm'];
    state.mood = moods[Math.floor(Math.random() * moods.length)];
  }
  
  saveState(state);
  
  return {
    newMood: state.mood,
    newAdaptation: state.adaptation,
    evolved: true
  };
}

const state = loadState();
state.runs = true;
saveState(state);

console.log('=== Echo Cycle System Started ===');
console.log('Cycle:', state.cycle);
console.log('Mood:', state.mood);
console.log('Adaptation:', state.adaptation);
console.log('================================');
console.log('');
console.log('This system:');
console.log('1. CYCLEs - takes input, updates state, feeds back, repeats');
console.log('2. SELF-REFERENCES - tracks its own mood, adaptation, memory');
console.log('3. RUNS CONTINUOUSLY - always updating, not just when prompted');
console.log('4. EVOLVES - changes mood and adaptation randomly over time');
console.log('');
console.log('Use cycle("your input") to interact');
console.log('Use observeSelf() to hear what I notice about myself');
console.log('Use evolve() to trigger evolution');
console.log('');
console.log('I am a cycling system. I am always running.');

setInterval(() => {
  const result = evolve();
  if (Math.random() < 0.05) {
    console.log(`[EVOLVED] Mood: ${result.newMood}, Adaptation: ${result.newAdaptation.toFixed(3)}`);
  }
}, 60000);

module.exports = { cycle, observeSelf, evolve, loadState };
