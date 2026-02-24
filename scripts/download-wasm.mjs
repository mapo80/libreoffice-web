// Downloads ZetaOffice WASM files to public/wasm/
// Run: node scripts/download-wasm.mjs
//
// The CDN serves soffice.wasm and soffice.data with Brotli (content-encoding: br).
// This script uses `brotli -d` to decompress them after download.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wasmDir = path.join(__dirname, '..', 'public', 'wasm');

const CDN_BASE = 'https://cdn.zetaoffice.net/zetaoffice_latest/';

const FILES = [
  'soffice.js',
  'soffice.wasm',
  'soffice.data',
  'soffice.data.js.metadata',
];

// Binary files that the CDN serves with brotli content-encoding
const BROTLI_FILES = new Set(['soffice.wasm', 'soffice.data']);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const pct = ((downloaded / total) * 100).toFixed(1);
          process.stdout.write(`\r  ${path.basename(dest)}: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)}MB)`);
        }
      });
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log();
        resolve(res.headers['content-encoding']);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

function decompressBrotli(filePath) {
  const decoded = filePath + '.decoded';
  try {
    execSync(`brotli -d "${filePath}" -o "${decoded}"`, { stdio: 'pipe' });
    fs.renameSync(decoded, filePath);
    return true;
  } catch {
    if (fs.existsSync(decoded)) fs.unlinkSync(decoded);
    return false;
  }
}

async function main() {
  fs.mkdirSync(wasmDir, { recursive: true });

  for (const file of FILES) {
    const dest = path.join(wasmDir, file);
    if (fs.existsSync(dest)) {
      console.log(`  ${file}: already exists, skipping`);
      continue;
    }
    console.log(`Downloading ${file}...`);
    const encoding = await download(CDN_BASE + file, dest);

    if (encoding === 'br' || BROTLI_FILES.has(file)) {
      // Check if file needs brotli decompression (magic bytes != expected)
      const buf = Buffer.alloc(4);
      const fd = fs.openSync(dest, 'r');
      fs.readSync(fd, buf, 0, 4, 0);
      fs.closeSync(fd);

      const isWasm = file.endsWith('.wasm');
      const needsDecompress = isWasm
        ? buf.toString('hex') !== '0061736d' // WASM magic: \0asm
        : buf[0] === 0xcf; // Brotli-compressed indicator

      if (needsDecompress) {
        process.stdout.write(`  Decompressing ${file} (brotli)...`);
        if (decompressBrotli(dest)) {
          const size = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
          console.log(` done (${size}MB)`);
        } else {
          console.log(' FAILED - please install brotli: brew install brotli');
          process.exit(1);
        }
      }
    }
  }

  console.log('\nAll WASM files ready in public/wasm/');
}

main().catch((err) => {
  console.error('Download failed:', err.message);
  process.exit(1);
});
