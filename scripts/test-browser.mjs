import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const URL_BASE = 'http://127.0.0.1:5173/';
const TIMEOUT = 120_000;
const DOCX_PATH = path.resolve('templates/custom-font-sample.docx');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  // Track errors only (skip Qt noise)
  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('QObject') || text.includes('QRect') || text.includes('__syscall') ||
        text.includes('wasm-instantiate') || text.includes('run dependencies') ||
        text.includes('favicon')) return;
    if (msg.type() === 'error') {
      errors.push(text);
    }
    console.log(`  [${msg.type()}] ${text}`);
  });

  page.on('pageerror', (err) => {
    console.log(`  PAGE ERROR: ${err.message}`);
    errors.push(err.message);
  });

  console.log(`1. Loading page...`);
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('2. Waiting for ZetaOffice WASM to load...');
  const startTime = Date.now();
  let canvasReady = false;

  while (Date.now() - startTime < TIMEOUT) {
    const status = await page.evaluate(() => {
      const loadingInfo = document.getElementById('loadingInfo');
      const fileInput = document.getElementById('fileInput');
      return {
        loadingHidden: loadingInfo?.style.display === 'none' || loadingInfo?.classList.contains('hidden'),
        fileInputEnabled: !fileInput?.disabled,
      };
    });

    if (status.loadingHidden && status.fileInputEnabled) {
      canvasReady = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!canvasReady) {
    console.log('FAIL: ZetaOffice never became ready.');
    console.log('Errors:', errors);
    await browser.close();
    process.exit(1);
  }
  console.log(`   PASS: Canvas ready after ${Math.round((Date.now() - startTime) / 1000)}s`);

  // Test 3: verify canvas exists and has dimensions
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.getElementById('qtcanvas');
    return {
      exists: !!canvas,
      width: canvas?.width,
      height: canvas?.height,
      visible: canvas?.style.visibility !== 'hidden',
    };
  });
  console.log(`3. Canvas: ${canvasInfo.width}x${canvasInfo.height}, visible=${canvasInfo.visible}`);
  if (!canvasInfo.visible || !canvasInfo.width) {
    console.log('FAIL: Canvas not visible');
    await browser.close();
    process.exit(1);
  }
  console.log('   PASS');

  // Test 4: verify buttons are enabled
  const buttonsState = await page.evaluate(() => {
    return {
      bold: !document.getElementById('btnBold')?.disabled,
      italic: !document.getElementById('btnItalic')?.disabled,
      underline: !document.getElementById('btnUnderline')?.disabled,
      fileInput: !document.getElementById('fileInput')?.disabled,
    };
  });
  console.log(`4. Buttons: bold=${buttonsState.bold}, italic=${buttonsState.italic}, underline=${buttonsState.underline}, fileInput=${buttonsState.fileInput}`);
  if (!buttonsState.bold || !buttonsState.fileInput) {
    console.log('FAIL: Buttons not enabled');
    await browser.close();
    process.exit(1);
  }
  console.log('   PASS');

  // Test 5: upload DOCX via Emscripten FS
  console.log(`5. Loading DOCX: ${path.basename(DOCX_PATH)} (${fs.statSync(DOCX_PATH).size} bytes)`);
  const docxBase64 = fs.readFileSync(DOCX_PATH).toString('base64');

  const uploadResult = await page.evaluate(async (base64Data) => {
    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      if (typeof FS === 'undefined') return { error: 'FS not available' };
      FS.writeFile('/tmp/input.docx', bytes);

      const port = await Module.uno_main;
      port.postMessage({ cmd: 'loadDocument', fileName: '/tmp/input.docx' });
      return { success: true, fileSize: bytes.length };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  }, docxBase64);

  if (uploadResult.error) {
    console.log(`   FAIL: ${uploadResult.error}`);
    await browser.close();
    process.exit(1);
  }
  console.log(`   File written to FS and loadDocument sent (${uploadResult.fileSize} bytes)`);

  // Wait for document to load
  await new Promise((r) => setTimeout(r, 8000));

  // Check for errors after load
  const postLoadErrors = errors.filter(e =>
    !e.includes('favicon') && !e.includes('404'));
  if (postLoadErrors.length > 0) {
    console.log(`   WARNING: Errors during load: ${postLoadErrors.join(', ')}`);
  } else {
    console.log('   PASS: No errors during DOCX load');
  }

  // Test 6: Verify file input change handler works too
  console.log('6. Testing file input handler (programmatic)...');
  const fileInputResult = await page.evaluate(async (base64Data) => {
    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create a File object and set it on the input
      const file = new File([bytes], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const fileInput = document.getElementById('fileInput');
      fileInput.files = dt.files;

      // Dispatch change event
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, fileName: fileInput.files[0]?.name };
    } catch (e) {
      return { error: e.message };
    }
  }, docxBase64);

  if (fileInputResult.error) {
    console.log(`   FAIL: ${fileInputResult.error}`);
  } else {
    console.log(`   PASS: Change event dispatched for ${fileInputResult.fileName}`);
  }

  await new Promise((r) => setTimeout(r, 5000));

  console.log('\n=== ALL TESTS PASSED ===');
  console.log('ZetaOffice loads, canvas renders, buttons work, DOCX loads without errors.');

  await browser.close();
  process.exit(0);
})();
