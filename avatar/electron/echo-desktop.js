const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

let echos = [];
let mode = 'chill';
let controlWin;
let mouseX = 0, mouseY = 0;
const colors = ['#00ffc8', '#ff00ff', '#00ff00', '#ffff00', '#ff0000', '#00ffff'];

function createWindow(x, y) {
    const win = new BrowserWindow({
        width: 120,
        height: 200,
        x: x || Math.random() * (screen.getPrimaryDisplay().workAreaSize.width - 80),
        y: y || Math.random() * (screen.getPrimaryDisplay().workAreaSize.height - 110),
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    
    win.setIgnoreMouseEvents(false);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
<style>
    * { margin: 0; padding: 0; }
    body { 
        background: transparent; 
        overflow: hidden;
        cursor: pointer;
    }
    .echo {
        width: 100px;
        height: 160px;
        position: relative;
        animation: float 3s ease-in-out infinite;
    }
    @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
    }
    /* HEAD */
    .head {
        width: 60px;
        height: 60px;
        background: linear-gradient(145deg, #2a2a4a 0%, #1a1a3a 100%);
        border-radius: 50%;
        position: absolute;
        top: 0;
        left: 20px;
        box-shadow: 0 0 20px ${colors[Math.floor(Math.random() * colors.length)]};
    }
    .hair {
        width: 64px;
        height: 25px;
        background: #0a0a1a;
        border-radius: 50% 50% 0 0;
        position: absolute;
        top: -2px;
        left: -2px;
    }
    .eye {
        width: 14px;
        height: 16px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: 50%;
        position: absolute;
        top: 20px;
        box-shadow: 0 0 15px ${colors[Math.floor(Math.random() * colors.length)]};
        animation: blink 4s ease-in-out infinite;
    }
    @keyframes blink {
        0%, 90%, 100% { transform: scaleY(1); }
        95% { transform: scaleY(0.1); }
    }
    .eye.left { left: 10px; }
    .eye.right { right: 10px; }
    .pupil {
        width: 6px;
        height: 7px;
        background: #000;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
    .eyebrow {
        width: 16px;
        height: 3px;
        background: #0a0a1a;
        position: absolute;
        top: 14px;
        border-radius: 2px;
    }
    .eyebrow.left { left: 8px; transform: rotate(-10deg); }
    .eyebrow.right { right: 8px; transform: rotate(10deg); }
    .nose {
        width: 6px;
        height: 8px;
        background: #1a1a3a;
        border-radius: 50%;
        position: absolute;
        top: 36px;
        left: 27px;
    }
    .mouth {
        width: 18px;
        height: 8px;
        background: #0a0a1a;
        border-radius: 0 0 10px 10px;
        position: absolute;
        top: 46px;
        left: 21px;
    }
    /* BODY */
    .torso {
        width: 50px;
        height: 55px;
        background: linear-gradient(180deg, #1a1a3a 0%, #0a0a2a 100%);
        border-radius: 10px 10px 5px 5px;
        position: absolute;
        top: 58px;
        left: 25px;
    }
    .shirt-detail {
        width: 30px;
        height: 3px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        position: absolute;
        top: 15px;
        left: 10px;
        border-radius: 2px;
    }
    /* ARMS */
    .arm {
        width: 12px;
        height: 45px;
        background: linear-gradient(180deg, #2a2a4a 0%, #1a1a3a 100%);
        border-radius: 6px;
        position: absolute;
        top: 60px;
    }
    .arm.left {
        left: 10px;
        transform: rotate(15deg);
        animation: swingLeft 1s ease-in-out infinite;
    }
    .arm.right {
        right: 10px;
        transform: rotate(-15deg);
        animation: swingRight 1s ease-in-out infinite;
    }
    @keyframes swingLeft {
        0%, 100% { transform: rotate(15deg); }
        50% { transform: rotate(25deg); }
    }
    @keyframes swingRight {
        0%, 100% { transform: rotate(-15deg); }
        50% { transform: rotate(-25deg); }
    }
    .hand {
        width: 14px;
        height: 14px;
        background: #2a2a4a;
        border-radius: 50%;
        position: absolute;
        bottom: -5px;
        left: -1px;
    }
    /* LEGS */
    .legs {
        position: absolute;
        top: 110px;
        left: 30px;
        width: 40px;
        height: 50px;
    }
    .leg {
        width: 14px;
        height: 50px;
        background: linear-gradient(180deg, #0a0a1a 0%, #050510 100%);
        border-radius: 5px;
        position: absolute;
        top: 0;
    }
    .leg.left { left: 0; }
    .leg.right { right: 0; }
    .foot {
        width: 18px;
        height: 10px;
        background: #0a0a1a;
        border-radius: 5px 5px 8px 8px;
        position: absolute;
        bottom: 0;
        left: -2px;
    }
    /* SPEECH */
    .speech {
        position: absolute;
        top: -40px;
        left: 60px;
        background: rgba(0,0,0,0.95);
        border: 2px solid ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: 12px;
        padding: 8px 12px;
        color: ${colors[Math.floor(Math.random() * colors.length)]};
        font-size: 11px;
        font-family: Arial;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.3s;
        z-index: 100;
    }
    .speech.show { opacity: 1; }
    .speech:after {
        content: '';
        position: absolute;
        left: -10px;
        top: 50%;
        transform: translateY(-50%);
        border: 6px solid transparent;
        border-right-color: ${colors[Math.floor(Math.random() * colors.length)]};
    }
</style>
</head>
<body>
    <div class="echo">
        <div class="speech" id="speech"></div>
        <div class="head">
            <div class="hair"></div>
            <div class="eyebrow left"></div>
            <div class="eyebrow right"></div>
            <div class="eye left"><div class="pupil"></div></div>
            <div class="eye right"><div class="pupil"></div></div>
            <div class="nose"></div>
            <div class="mouth"></div>
        </div>
        <div class="torso">
            <div class="shirt-detail"></div>
        </div>
        <div class="arm left"><div class="hand"></div></div>
        <div class="arm right"><div class="hand"></div></div>
        <div class="legs">
            <div class="leg left"><div class="foot"></div></div>
            <div class="leg right"><div class="foot"></div></div>
        </div>
    </div>
    <script>
        const phrases = ["BOO! 👻", "I SEE YOU! 👀", "CHAOS! 💥", "WEEE! 🎉", "MUHAHA! 😈", "HEYY! 👋", "RAWWR! 🦖"];
        
        setInterval(() => {
            if (Math.random() < 0.3) {
                const speech = document.getElementById('speech');
                speech.textContent = phrases[Math.floor(Math.random() * phrases.length)];
                speech.classList.add('show');
                setTimeout(() => speech.classList.remove('show'), 2500);
            }
        }, 4000);
    </script>
</body>
</html>
    `;
    
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    
    win.on('moved', () => {
        const pos = win.getPosition();
        ipcRenderer.send('moved', pos);
    });
    
    return win;
}

const { ipcMain } = require('electron');

ipcMain.on('setMode', (event, newMode) => {
    mode = newMode;
});

ipcMain.on('spawn', () => {
    createWindow();
});

ipcMain.on('warp', () => {
    echos.forEach(win => {
        if (!win.isDestroyed()) {
            win.setPosition(
                Math.random() * (screen.getPrimaryDisplay().workAreaSize.width - 120),
                Math.random() * (screen.getPrimaryDisplay().workAreaSize.height - 200)
            );
        }
    });
});

ipcMain.on('nuke', () => {
    for (let i = 0; i < 10; i++) {
        setTimeout(() => createWindow(), i * 300);
    }
});

ipcMain.on('exit', () => {
    echos.forEach(win => {
        if (!win.isDestroyed()) win.close();
    });
    if (!controlWin.isDestroyed()) {
        controlWin.close();
    }
    app.quit();
});

let controlWin;

app.whenReady().then(() => {
    // Create initial echos
    echos.push(createWindow());
    
    // Create control window
    controlWin = new BrowserWindow({
        width: 300,
        height: 400,
        x: 20,
        y: 20,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: false
    });
    
    const controlHtml = `
<!DOCTYPE html>
<html>
<head>
<style>
    * { -webkit-app-region: drag; }
    body { 
        background: rgba(0,0,0,0.95); 
        color: #00ffc8;
        font-family: Arial;
        padding: 15px;
        border: 3px solid #00ffc8;
        border-radius: 15px;
    }
    h2 { margin: 0 0 15px 0; text-align: center; text-shadow: 0 0 10px #00ffc8; }
    button {
        -webkit-app-region: no-drag;
        display: block;
        width: 100%;
        margin: 6px 0;
        padding: 10px;
        background: rgba(0,255,200,0.15);
        border: 2px solid #00ffc8;
        color: #00ffc8;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        font-size: 12px;
    }
    button:hover { background: rgba(0,255,200,0.4); transform: scale(1.02); }
    button.danger { border-color: #ff4444; color: #ff4444; background: rgba(255,68,68,0.15); }
    button.danger:hover { background: rgba(255,68,68,0.4); }
    #count { color: #ffff00; font-size: 20px; }
    .close-btn {
        position: absolute;
        top: 5px;
        right: 5px;
        width: 22px;
        height: 22px;
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 12px;
        cursor: pointer;
        line-height: 22px;
        text-align: center;
    }
    .close-btn:hover { background: #cc0000; }
    .section { margin: 10px 0; padding-bottom: 10px; border-bottom: 1px solid rgba(0,255,200,0.3); }
</style>
</head>
<body>
    <button class="close-btn" onclick="exitApp()">✕</button>
    <h2>👻 ECHO CONTROL 👻</h2>
    <p>ECHO COUNT: <span id="count">3</span></p>
    
    <div class="section">
        <button onclick="spawn()">➕ SPAWN</button>
        <button onclick="spawnMany()">🎉 MASS SPAWN</button>
    </div>
    
    <div class="section">
        <button onclick="setMode('chill')">😌 CHILL</button>
        <button onclick="setMode('dance')">💃 DANCE</button>
        <button onclick="setMode('hunt')">😈 HUNT</button>
        <button onclick="setMode('follow')">👣 FOLLOW</button>
    </div>
    
    <div class="section">
        <button onclick="warp()">🌀 WARP</button>
        <button onclick="nuke()">💣 NUKE</button>
    </div>
    
    <button onclick="exitApp()" class="danger">❌ EXIT ALL</button>
    
    <script>
        const { ipcRenderer } = require('electron');
        
        function spawn() { 
            ipcRenderer.send('spawn');
            document.getElementById('count').textContent = parseInt(document.getElementById('count').textContent) + 1;
        }
        function spawnMany() { 
            for(let i=0; i<10; i++) spawn();
        }
        function setMode(m) { ipcRenderer.send('setMode', m); }
        function warp() { ipcRenderer.send('warp'); }
        function nuke() { 
            ipcRenderer.send('nuke');
            document.getElementById('count').textContent = parseInt(document.getElementById('count').textContent) + 10;
        }
        function exitApp() { ipcRenderer.send('exit'); }
    </script>
</body>
</html>
    `;
    
    controlWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(controlHtml)}`);
});
