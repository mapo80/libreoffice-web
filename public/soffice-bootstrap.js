// SPDX-License-Identifier: MIT
// This file is NOT processed by Vite. It runs as a native ES module in the browser.
//
// Follows the exact same pattern as the official standalone demo:
// https://zetaoffice.net/demos/standalone/

'use strict';

const soffice_base_url = new URL('./wasm/', location.href).toString();

const canvas = document.getElementById('qtcanvas');

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
    // Expose port to main.ts via custom event
    window.dispatchEvent(new CustomEvent('soffice-port-ready', { detail: { port } }));

    port.onmessage = function (e) {
      switch (e.data.cmd) {
        case 'ui_ready':
          window.dispatchEvent(new Event('resize'));
          setTimeout(function () {
            window.dispatchEvent(new Event('uno-ui-ready'));
          }, 1000);
          break;
        case 'doc_loaded':
          window.dispatchEvent(new Event('resize'));
          setTimeout(function () {
            window.dispatchEvent(new Event('resize'));
          }, 500);
          break;
        case 'stateChanged':
          window.dispatchEvent(new CustomEvent('uno-state-changed', {
            detail: {
              command: e.data.command,
              value: e.data.value,
              enabled: e.data.enabled,
            }
          }));
          break;
        case 'fontList':
          window.dispatchEvent(new CustomEvent('uno-font-list', {
            detail: { fonts: e.data.fonts }
          }));
          break;
        default:
          console.warn('Unknown message from worker:', e.data.cmd);
      }
    };
  });
};

console.log('Loading WASM binaries for ZetaJS from: ' + soffice_base_url);
window.Module = Module;
document.body.appendChild(soffice_js);
