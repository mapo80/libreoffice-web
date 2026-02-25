// Quick headed test - takes a screenshot after WASM loads to verify UI visually.
import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const URL_BASE = 'http://127.0.0.1:5173/';
const DOCX_PATH = path.join(projectRoot, 'templates/custom-font-sample.docx');

(async () => {
  console.log('Launching Chromium (headed)...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('QObject') || text.includes('QRect') || text.includes('__syscall') ||
        text.includes('wasm-instantiate') || text.includes('run dependencies') ||
        text.includes('favicon') || text.includes('(end of list)')) return;
    console.log(`  [${msg.type()}] ${text}`);
  });

  console.log('Loading page...');
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('Waiting for WASM to initialize...');
  await page.waitForFunction(() => {
    const li = document.getElementById('loadingInfo');
    return li?.style.display === 'none';
  }, { timeout: 120000 });

  console.log('WASM ready. Waiting 3s for render...');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(projectRoot, 'test-blank.png') });
  console.log('Screenshot saved: test-blank.png (blank document)');

  // Now load the DOCX
  console.log('Uploading DOCX...');
  await page.locator('#fileInput').setInputFiles(DOCX_PATH);
  console.log('Waiting 10s for document to render...');
  await page.waitForTimeout(10000);

  await page.screenshot({ path: path.join(projectRoot, 'test-docx.png') });
  console.log('Screenshot saved: test-docx.png (after DOCX load)');

  await browser.close();
  console.log('Done.');
})();
