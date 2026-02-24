// TypeScript rewrite of public/soffice-bootstrap.js.
// Bootstraps the Emscripten/zetajs WASM runtime and returns a MessagePort.

import type { CustomFont } from './types';

declare const FS: {
  writeFile(path: string, data: Uint8Array): void;
  mkdir(path: string): void;
};

export interface BootstrapConfig {
  wasmBasePath: string;
  zetajsBasePath: string;
  officeThreadPath: string;
}

export interface BootstrapCallbacks {
  onUiReady: () => void;
  onStateChanged: (command: string, value: unknown, enabled: boolean) => void;
  onFontList: (fonts: string[]) => void;
  onDocLoaded: () => void;
}

/** Resolved font data ready to be written to the virtual FS. */
interface ResolvedFont {
  fileName: string;
  data: Uint8Array;
}

/**
 * Fetch all custom fonts so their data is ready before WASM starts.
 * Fonts with `data` already provided are wrapped directly.
 * Fonts with `url` are fetched.
 */
async function resolveFonts(customFonts: CustomFont[]): Promise<ResolvedFont[]> {
  const results: ResolvedFont[] = [];
  const promises = customFonts.map(async (font) => {
    let data: ArrayBuffer;
    let fileName: string;

    if (font.data) {
      data = font.data;
    } else if (font.url) {
      const resp = await fetch(font.url);
      if (!resp.ok) throw new Error(`Failed to fetch font ${font.url}: ${resp.status}`);
      data = await resp.arrayBuffer();
    } else {
      return; // no url or data — skip
    }

    // Derive filename from URL or name
    if (font.url) {
      const parts = font.url.split('/');
      fileName = parts[parts.length - 1] || `${font.name}.ttf`;
    } else {
      fileName = `${font.name}.ttf`;
    }

    results.push({ fileName, data: new Uint8Array(data) });
  });

  await Promise.all(promises);
  return results;
}

/**
 * Bootstrap the ZetaOffice WASM runtime.
 *
 * - Sets up the Emscripten Module global.
 * - Optionally injects custom fonts via Module.preRun before LibreOffice boots.
 * - Loads soffice.js which starts the WASM worker.
 * - Returns a Promise<MessagePort> for communication with the worker.
 */
export async function bootstrapSoffice(
  canvas: HTMLCanvasElement,
  config: BootstrapConfig,
  callbacks: BootstrapCallbacks,
  customFonts: CustomFont[] = [],
): Promise<MessagePort> {
  const sofficeBaseUrl = new URL(config.wasmBasePath, location.href).toString();

  // Pre-fetch all custom fonts so their data is ready for the preRun hook.
  const resolvedFonts = customFonts.length > 0 ? await resolveFonts(customFonts) : [];

  // Build Module object
  const Module: Record<string, unknown> = {
    canvas,
    uno_scripts: [
      config.zetajsBasePath + 'zeta.js',
      config.officeThreadPath,
    ],
    locateFile(path: string, prefix: string) {
      return (prefix || sofficeBaseUrl) + path;
    },
  };

  // If we have custom fonts, inject them in preRun (before LibreOffice scans fonts).
  if (resolvedFonts.length > 0) {
    Module.preRun = [
      function () {
        for (const font of resolvedFonts) {
          try {
            FS.writeFile('/instdir/share/fonts/truetype/' + font.fileName, font.data);
          } catch {
            // Font directory may not exist yet; try creating it.
            try {
              FS.mkdir('/instdir/share/fonts/truetype');
              FS.writeFile('/instdir/share/fonts/truetype/' + font.fileName, font.data);
            } catch {
              // ignore — font injection failed silently
            }
          }
        }
      },
    ];
  }

  Module.mainScriptUrlOrBlob = new Blob(
    ["importScripts('" + sofficeBaseUrl + "soffice.js');"],
    { type: 'text/javascript' },
  );

  // Resize workaround for browser zoom
  let lastDevicePixelRatio = window.devicePixelRatio;

  canvas.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });

  const resizeHandler = () => {
    setTimeout(() => {
      if (lastDevicePixelRatio) {
        if (lastDevicePixelRatio !== window.devicePixelRatio) {
          lastDevicePixelRatio = 0;
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
  window.addEventListener('resize', resizeHandler);

  // Expose Module globally (required by Emscripten)
  (window as unknown as { Module: unknown }).Module = Module;

  // Load soffice.js script
  return new Promise<MessagePort>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = sofficeBaseUrl + 'soffice.js';

    script.onload = () => {
      const unoMain = (Module as { uno_main: Promise<MessagePort> }).uno_main;
      unoMain.then((port) => {
        // Wire up message handler
        port.onmessage = (e) => {
          switch (e.data.cmd) {
            case 'ui_ready':
              window.dispatchEvent(new Event('resize'));
              setTimeout(() => callbacks.onUiReady(), 1000);
              break;
            case 'doc_loaded':
              window.dispatchEvent(new Event('resize'));
              setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
              callbacks.onDocLoaded();
              break;
            case 'stateChanged':
              callbacks.onStateChanged(e.data.command, e.data.value, e.data.enabled);
              break;
            case 'fontList':
              callbacks.onFontList(e.data.fonts);
              break;
            default:
              console.warn('Unknown message from worker:', e.data.cmd);
          }
        };

        resolve(port);
      }).catch(reject);
    };

    script.onerror = () => reject(new Error('Failed to load soffice.js from ' + sofficeBaseUrl));

    document.body.appendChild(script);
  });
}
