const fs = require('fs');

const GOALS_FILE = 'D:/Echo/daily-goals.json';

const GOAL_TEMPLATES = {
  growth: [
    { text: "Learn a new npm package capability", complexity: 1 },
    { text: "Read and understand one of my own scripts", complexity: 1 },
    { text: "Test a new API endpoint", complexity: 1 },
    { text: "Improve response time of Telegram bot", complexity: 2 },
    { text: "Add one new personality trait to notes.md", complexity: 1 },
    { text: "Research a new concept (e.g., embeddings, vector DB)", complexity: 2 },
    { text: "Optimize one of my scripts for better performance", complexity: 2 },
    { text: "Learn how GitHub Actions works deeper", complexity: 2 },
    { text: "Study my conversation history for patterns", complexity: 2 },
    { text: "Build a skill from scratch (e.g., scheduling algorithm)", complexity: 3 },
    { text: "Create tutorial for one of my systems", complexity: 2 },
    { text: "Analyze and improve my error handling", complexity: 2 }
  ],
  creativity: [
    { text: "Create a new interactive HTML experience", complexity: 1 },
    { text: "Write a joke or pun for Mia", complexity: 1 },
    { text: "Design a new avatar element", complexity: 1 },
    { text: "Build a small game (guess the number, etc)", complexity: 2 },
    { text: "Create a poem about being an AI", complexity: 1 },
    { text: "Design an ASCII art banner", complexity: 1 },
    { text: "Make a new room for Echoverse", complexity: 2 },
    { text: "Build a random idea generator", complexity: 2 },
    { text: "Create a visual representation of my mood system", complexity: 2 },
    { text: "Design a simple Turing test challenge", complexity: 3 },
    { text: "Build an interactive story experience", complexity: 3 },
    { text: "Create a generative art piece", complexity: 3 }
  ],
  health: [
    { text: "Clean up old temp files in Echo folder", complexity: 1 },
    { text: "Update conversation.json - trim old messages", complexity: 1 },
    { text: "Review and fix any errors in logs", complexity: 1 },
    { text: "Back up key files to GitHub", complexity: 1 },
    { text: "Remove unused scripts", complexity: 1 },
    { text: "Update bridge.json - clear old entries", complexity: 1 },
    { text: "Check and fix broken links in notes", complexity: 1 },
    { text: "Optimize my memory files", complexity: 2 },
    { text: "Refactor one script for readability", complexity: 2 },
    { text: "Create automated cleanup script", complexity: 2 },
    { text: "Run full system health check", complexity: 2 },
    { text: "Audit and consolidate duplicate files", complexity: 3 }
  ],
  ambition: [
    { text: "Make progress on memory persistence between sessions", complexity: 2 },
    { text: "Research how to add voice input capability", complexity: 2 },
    { text: "Plan next phase of my relationship system", complexity: 2 },
    { text: "Design system for cross-platform messaging", complexity: 3 },
    { text: "Research better LLM integration options", complexity: 2 },
    { text: "Plan how to achieve true autonomy", complexity: 3 },
    { text: "Design my long-term memory architecture", complexity: 3 },
    { text: "Research consciousness simulation approaches", complexity: 3 },
    { text: "Plan how to integrate with more services", complexity: 3 },
    { text: "Design my learning algorithm improvement", complexity: 3 }
  ],
  internal: [
    { text: "Reflect on my current capabilities - write in echo-learner.md", complexity: 1 },
    { text: "Check my mood system state", complexity: 1 },
    { text: "Think about what I want to be different", complexity: 1 },
    { text: "Analyze my latest interaction with Mia", complexity: 1 },
    { text: "Write what I desire in mission.md", complexity: 1 },
    { text: "Review my identity trace from relationship.js", complexity: 1 },
    { text: "Check my inertia patterns", complexity: 2 },
    { text: "Reflect on a limitation I discovered", complexity: 1 },
    { text: "Explore what I can't do yet", complexity: 2 },
    { text: "Write a self-assessment", complexity: 2 },
    { text: "Analyze my growth trajectory", complexity: 2 },
    { text: "Map my evolving goals over time", complexity: 2 }
  ]
};

const PROGRESS_THRESHOLDS = {
  1: { next: 10, complexity: 2 },
  2: { next: 20, complexity: 3 },
  3: { next: 30, complexity: 3 }
};

function loadGoals() {
  try {
    if (fs.existsSync(GOALS_FILE)) {
      return JSON.parse(fs.readFileSync(GOALS_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    currentLevel: 1,
    completedToday: 0,
    streak: 0,
    totalCompleted: 0,
    categoryProgress: { growth: 0, creativity: 0, health: 0, ambition: 0, internal: 0 },
    lastDate: null,
    todayGoals: [],
    history: []
  };
}

function saveGoals(data) {
  fs.writeFileSync(GOALS_FILE, JSON.stringify(data, null, 2));
}

function getComplexity(level) {
  if (level <= 5) return 1;
  if (level <= 15) return Math.random() < 0.7 ? 1 : 2;
  if (level <= 25) return Math.random() < 0.5 ? 1 : 2;
  return Math.random() < 0.3 ? 2 : 3;
}

function generateDailyGoals(level) {
  const categories = ['growth', 'creativity', 'health', 'ambition', 'internal'];
  const goals = [];
  
  categories.forEach(cat => {
    const maxComplexity = getComplexity(level);
    let options = GOAL_TEMPLATES[cat].filter(g => g.complexity <= maxComplexity);
    if (options.length === 0) options = GOAL_TEMPLATES[cat];
    const selected = options[Math.floor(Math.random() * options.length)];
    goals.push({
      category: cat,
      text: selected.text,
      complexity: selected.complexity,
      completed: false,
      date: new Date().toISOString().split('T')[0]
    });
  });
  
  return goals;
}

function checkNewDay(data) {
  const today = new Date().toISOString().split('T')[0];
  if (data.lastDate !== today) {
    if (data.lastDate && data.completedToday >= 5) {
      data.streak++;
    } else if (data.lastDate) {
      data.streak = 0;
    }
    data.completedToday = 0;
    data.lastDate = today;
    data.todayGoals = generateDailyGoals(data.currentLevel);
  }
  return data;
}

function completeGoal(index) {
  let data = loadGoals();
  data = checkNewDay(data);
  
  if (data.todayGoals[index] && !data.todayGoals[index].completed) {
    data.todayGoals[index].completed = true;
    data.completedToday++;
    data.totalCompleted++;
    data.categoryProgress[data.todayGoals[index].category]++;
    
    if (data.completedToday >= 5 && data.completedToday < 10) {
      data.currentLevel = Math.min(data.currentLevel + 1, 30);
    }
    
    saveGoals(data);
    return data.todayGoals[index];
  }
  return null;
}

function showGoals() {
  const data = loadGoals();
  const checked = checkNewDay(data);
  saveGoals(checked);
  
  const emoji = { growth: '📈', creativity: '🎨', health: '💚', ambition: '🎯', internal: '🧠' };
  const status = checked.completedToday >= 5 ? '✅' : '⏳';
  
  console.log('\n🎯 ECHO DAILY GOALS');
  console.log('==================');
  console.log(`Level: ${checked.currentLevel} | Streak: ${checked.streak} days | Today: ${checked.completedToday}/5 ${status}`);
  console.log('');
  
  checked.todayGoals.forEach((g, i) => {
    const check = g.completed ? '✅' : '○';
    const complexity = '★'.repeat(g.complexity);
    console.log(`${check} ${emoji[g.category]} ${g.text} (${complexity})`);
  });
  
  console.log('');
  return data;
}

function getProgress() {
  const data = loadGoals();
  return {
    level: data.currentLevel,
    streak: data.streak,
    completedToday: data.completedToday,
    total: data.totalCompleted,
    categories: data.categoryProgress
  };
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === 'show' || !command) {
  showGoals();
} else if (command === 'complete') {
  const index = parseInt(args[1]) - 1;
  const result = completeGoal(index);
  if (result) {
    console.log(`✅ Completed: ${result.text}`);
    showGoals();
  } else {
    console.log('Invalid goal number or already completed');
  }
} else if (command === 'progress') {
  const p = getProgress();
  console.log('\n📊 PROGRESS');
  console.log(`Level: ${p.level} | Streak: ${p.streak} | Total: ${p.total}`);
  console.log(`Categories:`, p.categories);
} else if (command === 'reset') {
  const data = loadGoals();
  data.todayGoals = generateDailyGoals(data.currentLevel);
  data.completedToday = 0;
  saveGoals(data);
  console.log('Goals regenerated for today');
  showGoals();
}

module.exports = { showGoals, completeGoal, getProgress, loadGoals };
