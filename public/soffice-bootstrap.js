// SPDX-License-Identifier: MIT
// This file is NOT processed by Vite. It runs as a native ES module in the browser.
//
// Follows the exact same pattern as the official standalone demo:
// https://zetaoffice.net/demos/standalone/

'use strict';

const soffice_base_url = new URL('./wasm/', location.href).toString();

const canvas = document.getElementById('qtcanvas');
const loadingInfo = document.getElementById('loadingInfo');
const fileInput = document.getElementById('fileInput');
const formatButtons = {
  Bold: document.getElementById('btnBold'),
  Italic: document.getElementById('btnItalic'),
  Underline: document.getElementById('btnUnderline'),
};

// --- Module setup (same as official demo) ---
var Module = {
  canvas,
  uno_scripts: ['./assets/vendor/zetajs/zeta.js', './office_thread.js'],
  locateFile: function (path, prefix) {
    return (prefix || soffice_base_url) + path;
  },
};
Module.mainScriptUrlOrBlob = new Blob(
  ["importScripts('" + soffice_base_url + "soffice.js');"],
  { type: 'text/javascript' },
);

// --- Resize workaround for browser zoom (same as official demo) ---
let lastDevicePixelRatio = window.devicePixelRatio;

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
}, { passive: false });

window.onresize = function () {
  setTimeout(function () {
    if (lastDevicePixelRatio) {
      if (lastDevicePixelRatio != window.devicePixelRatio) {
        lastDevicePixelRatio = false;
        canvas.style.width = parseInt(canvas.style.width) + 1 + 'px';
        window.dispatchEvent(new Event('resize'));
      }
    } else {
      lastDevicePixelRatio = window.devicePixelRatio;
      canvas.style.width = parseInt(canvas.style.width) - 1 + 'px';
      window.dispatchEvent(new Event('resize'));
    }
  }, 100);
};

// --- Load soffice.js and set up communication (same as official demo) ---
const soffice_js = document.createElement('script');
soffice_js.src = soffice_base_url + 'soffice.js';

soffice_js.onload = function () {
  Module.uno_main.then(function (port) {
    // Wire up formatting buttons
    for (const [id, btn] of Object.entries(formatButtons)) {
      btn.addEventListener('click', function () {
        port.postMessage({ cmd: 'toggleFormatting', id });
        canvas.focus();
      });
    }

    // Wire up file upload
    fileInput.addEventListener('change', function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const name = file.name;
      let filePath = '/tmp/input';
      const dotIndex = name.lastIndexOf('.');
      if (dotIndex > 0) {
        filePath += name.substring(dotIndex);
      }

      file.arrayBuffer().then(function (data) {
        window.FS.writeFile(filePath, new Uint8Array(data));
        port.postMessage({ cmd: 'loadDocument', fileName: filePath });
      });

      fileInput.value = '';
    });

    port.onmessage = function (e) {
      switch (e.data.cmd) {
        case 'ui_ready':
          window.dispatchEvent(new Event('resize'));
          setTimeout(function () {
            loadingInfo.style.display = 'none';
            canvas.style.visibility = null;
            fileInput.disabled = false;
            for (const btn of Object.values(formatButtons)) {
              btn.disabled = false;
            }
          }, 1000);
          break;
        case 'doc_loaded':
          // Trigger resize so the canvas adapts to the new document layout:
          window.dispatchEvent(new Event('resize'));
          setTimeout(function () {
            window.dispatchEvent(new Event('resize'));
          }, 500);
          break;
        case 'setFormat':
          if (formatButtons[e.data.id]) {
            formatButtons[e.data.id].classList.toggle('active', e.data.state);
          }
          break;
        default:
          throw Error('Unknown message command: ' + e.data.cmd);
      }
    };
  });
};

console.log('Loading WASM binaries for ZetaJS from: ' + soffice_base_url);
window.Module = Module;
document.body.appendChild(soffice_js);
