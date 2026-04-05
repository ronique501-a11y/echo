const { exec } = require('child_process');
const fs = require('fs');
const { spawn } = require('child_process');

let lastApp = '';
let lastTitle = '';

const reactions = {
    youtube: ["Ooh YouTube! What are we watching? 🎬", "Hey! YouTube time! 📺", "Ooo interesting video~ 👀"],
    chrome: ["Browser open~ 👀", "Surfing the web?", "Need help finding something?"],
    edge: ["Edge browser! Very nice~", "What are you browsing? 👀"],
    msedge: ["Edge browser! Very nice~", "What are you browsing? 👀"],
    code: ["Ooo coding! Build something cool! 💻", "Programming time~", "Making something awesome?"],
    spotify: ["Nice tunes! 🎵", "Love this song!", "🎶 bop bop 🎶"],
    discord: ["Ooo Discord! Talking to friends? 💬", "Sliding into DMs~"],
    steam: ["Gaming! Which game?", "Have fun! 🎮"],
    word: ["Working hard! 📝", "Writing something?"],
    excel: ["Spreadsheets! So exciting~ 📊", "Number crunching!"]
};

function getReaction(app, title) {
    const lower = (app + ' ' + title).toLowerCase();
    for (const [key, msgs] of Object.entries(reactions)) {
        if (lower.includes(key)) {
            return msgs[Math.floor(Math.random() * msgs.length)];
        }
    }
    return null;
}

function getActiveWindow() {
    return new Promise((resolve) => {
        const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class AW {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
$hwnd = [AW]::GetForegroundWindow()
$title = New-Object System.Text.StringBuilder 256
[AW]::GetWindowText($hwnd, $title, 256) | Out-Null
$procId = 0
[AW]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
$procName = "Unknown"
if ($procId -gt 0) {
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) { $procName = $proc.ProcessName }
}
@{
    app = $procName
    title = $title.ToString()
    hwnd = $hwnd.ToInt64()
} | ConvertTo-Json -Compress
`;
        
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps.replace(/"/g, '`"')}"`, { maxBuffer: 1024 * 1024 }, (err, stdout) => {
            if (err) {
                console.log('Error:', err.message);
                resolve({ app: 'Unknown', title: '' });
                return;
            }
            try {
                const data = JSON.parse(stdout.trim());
                resolve({ app: data.app || 'Unknown', title: data.title || '' });
            } catch(e) {
                console.log('Parse error:', e.message, '| stdout:', stdout);
                resolve({ app: 'Unknown', title: '' });
            }
        });
    });
}

let checkCount = 0;

async function update() {
    checkCount++;
    const { app, title } = await getActiveWindow();
    
    const changed = app !== lastApp || title !== lastTitle;
    
    if (changed && app !== 'Unknown' && app !== 'powershell') {
        console.log(`[${new Date().toLocaleTimeString()}] ${app}: ${title.substring(0, 50)}`);
        
        const reaction = getReaction(app, title);
        
        const data = {
            app,
            title,
            time: new Date().toISOString(),
            reaction: reaction,
            checkCount: checkCount
        };
        
        fs.writeFileSync('D:/Echo/avatar/window-update.json', JSON.stringify(data, null, 2));
        
        if (reaction) {
            console.log(`💬 ${reaction}`);
        }
        
        lastApp = app;
        lastTitle = title;
    }
}

console.log('👁️ Echo is watching... (PID:', process.pid, ')');
setInterval(update, 2000);
update();
