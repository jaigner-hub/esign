#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

const FONT_DIR = __dirname;
const BASE_URL = 'https://raw.githubusercontent.com/google/fonts/main';

const FONTS = [
  { dest: 'DancingScript-Regular.ttf', src: 'ofl/dancingscript/DancingScript%5Bwght%5D.ttf' },
  { dest: 'GreatVibes-Regular.ttf', src: 'ofl/greatvibes/GreatVibes-Regular.ttf' },
  { dest: 'Caveat-Regular.ttf', src: 'ofl/caveat/Caveat%5Bwght%5D.ttf' },
  { dest: 'Sacramento-Regular.ttf', src: 'ofl/sacramento/Sacramento-Regular.ttf' },
  { dest: 'Pacifico-Regular.ttf', src: 'ofl/pacifico/Pacifico-Regular.ttf' },
  { dest: 'HomemadeApple-Regular.ttf', src: 'apache/homemadeapple/HomemadeApple-Regular.ttf' },
];

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return download(res.headers.location, destPath).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  for (const font of FONTS) {
    const url = `${BASE_URL}/${font.src}`;
    const destPath = path.join(FONT_DIR, font.dest);
    process.stdout.write(`Downloading ${font.dest}...`);
    await download(url, destPath);
    const stat = fs.statSync(destPath);
    console.log(` done (${stat.size} bytes)`);
  }
  console.log('All fonts downloaded successfully.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
