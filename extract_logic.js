import * as fs from 'fs';
import * as https from 'https';

const get = (url) => new Promise((res, rej) => https.get(url, r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => res(d));
}).on('error', rej));

async function run() {
    const html = fs.readFileSync('physio2.html', 'utf8');
    const regex = /"([^"]+\.js)"/g;
    let match;
    const jsFiles = [];
    while ((match = regex.exec(html)) !== null) {
        if (!jsFiles.includes(match[1])) jsFiles.push(match[1]);
    }
    console.log("Found JS files:", jsFiles);
    
    for (const file of jsFiles) {
        let url = file;
        if (url.startsWith('/')) url = 'https://physio-2-rsport.vercel.app' + url;
        try {
            const jsCode = await get(url);
            const searches = ['Grimpeur', 'Coureur rapide', 'VC T', 'indice', 'pente', 'theorique'];
            for (const s of searches) {
                const idx = jsCode.toLowerCase().indexOf(s.toLowerCase());
                if (idx !== -1) {
                    console.log(`\n\n--- MATCH IN ${file}: ${s} ---`);
                    console.log(jsCode.substring(Math.max(0, idx - 500), idx + 1000));
                }
            }
        } catch(e) { console.error(e); }
    }
}
run();
