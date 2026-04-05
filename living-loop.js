const fs = require('fs');

const STATE_FILE = 'D:/Echo/living-loop-state.json';

let state = {
  value: 0,
  history: [],
  lastChange: 0,
  cycle: 0
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { value: 0, history: [], lastChange: 0, cycle: 0 };
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function update() {
  const oldValue = state.value;
  
  let recentAvg = oldValue;
  if (state.history.length > 5) {
    recentAvg = state.history.slice(-5).reduce((a, b) => a + b, 0) / 5;
  }
  
  let change;
  if (oldValue > recentAvg) {
    change = Math.random() < 0.6 ? -1 : 1;
  } else if (oldValue < recentAvg) {
    change = Math.random() < 0.6 ? 1 : -1;
  } else {
    change = Math.random() < 0.5 ? 1 : -1;
  }
  
  const newValue = oldValue + change;
  
  state.history.push(oldValue);
  if (state.history.length > 50) state.history.shift();
  
  state.value = newValue;
  state.lastChange = newValue - oldValue;
  state.cycle++;
  
  saveState();
  
  return {
    value: newValue,
    change: state.lastChange,
    cycle: state.cycle,
    history: state.history.slice(-10)
  };
}

state = loadState();

console.log('🌱 Living Loop Started');
console.log('========================');
console.log(`Starting value: ${state.value}`);
console.log(`Cycles run: ${state.cycle}`);
console.log('');
console.log('Watching...');

let cycles = 0;
const interval = setInterval(() => {
  const result = update();
  cycles++;
  
  const bar = '█'.repeat(Math.abs(result.value) + 5) + ' '.repeat(20 - Math.abs(result.value));
  const direction = result.change > 0 ? '↑' : result.change < 0 ? '↓' : '•';
  
  console.log(`Cycle ${result.cycle.toString().padStart(4)} | Value: ${result.value.toString().padStart(3)} ${direction} | History: [${result.history.join(', ')}]`);
  
  if (cycles >= 60) {
    clearInterval(interval);
    console.log('');
    console.log('========================');
    console.log('60 cycles complete. Loop is persistent.');
    console.log('State saved to living-loop-state.json');
    console.log('Next step: add more behavior or visualization.');
  }
}, 1000);

process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('');
  console.log('Loop paused. State persisted.');
  process.exit(0);
});
