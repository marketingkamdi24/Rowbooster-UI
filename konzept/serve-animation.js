import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3456;

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, 'datenboost-animation.html');
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end('Error loading animation');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`\n🎬 RowBooster Cinematic Animation Server`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\n✨ Animation läuft auf: http://localhost:${PORT}`);
    console.log(`\n📽️  Öffne den Link im Browser für die Animation!`);
    console.log(`\nDrücke Ctrl+C zum Beenden.\n`);
});
