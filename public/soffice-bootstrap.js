// SPDX-License-Identifier: MIT
// This file is NOT processed by Vite. It runs as a native ES module in the browser.

import { ZetaHelperMain } from './assets/vendor/zetajs/zetaHelper.js';

const canvas = document.getElementById('qtcanvas');
const loadingInfo = document.getElementById('loadingInfo');
const fileInput = document.getElementById('fileInput');
const btnBold = document.getElementById('btnBold');
const btnItalic = document.getElementById('btnItalic');
const btnUnderline = document.getElementById('btnUnderline');

const formatButtons = { Bold: btnBold, Italic: btnItalic, Underline: btnUnderline };

function setFormatState(id, active) {
  const btn = formatButtons[id];
  if (btn) {
    btn.classList.toggle('active', active);
  }
}

const zHM = new ZetaHelperMain('office_thread.js', {
  threadJsType: 'module',
  wasmPkg: 'url:./wasm/',
  blockPageScroll: true,
});

zHM.start(() => {
  // Set up message handler for worker thread communication
  zHM.thrPort.onmessage = (e) => {
    switch (e.data.cmd) {
      case 'ui_ready':
        window.dispatchEvent(new Event('resize'));
        setTimeout(() => {
          loadingInfo.style.display = 'none';
          canvas.style.visibility = '';
          fileInput.disabled = false;
          for (const btn of Object.values(formatButtons)) {
            btn.disabled = false;
          }
        }, 1000);
        break;

      case 'setFormat':
        setFormatState(e.data.id, e.data.state);
        break;

      default:
        console.warn('Unknown message from worker:', e.data.cmd);
    }
  };

  // Wire up formatting buttons
  for (const [id, btn] of Object.entries(formatButtons)) {
    btn.addEventListener('click', () => {
      zHM.thrPort.postMessage({ cmd: 'toggleFormatting', id });
      canvas.focus();
    });
  }

  // Wire up file upload
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const name = file.name;
    let filePath = '/tmp/input';
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex > 0) {
      filePath += name.substring(dotIndex);
    }

    file.arrayBuffer().then((data) => {
      zHM.FS.writeFile(filePath, new Uint8Array(data));
      zHM.thrPort.postMessage({ cmd: 'loadDocument', fileName: filePath });
    });

    fileInput.value = '';
  });
});
