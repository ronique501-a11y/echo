const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8765;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css'
};

const server = http.createServer((req, res) => {
    let filePath = './' + (req.url === '/' ? 'character.html' : req.url);
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (req.url === '/window-update.json') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{}');
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
            return;
        }
        
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        res.end(data);
    });
});

server.listen(PORT);
console.log(`Server running at http://localhost:${PORT}/`);
