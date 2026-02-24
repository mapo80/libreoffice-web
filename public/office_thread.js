// SPDX-License-Identifier: MIT
// Runs inside the WASM Web Worker (module mode). NOT processed by Vite.

import { ZetaHelperThread } from './assets/vendor/zetajs/zetaHelper.js';

const zHT = new ZetaHelperThread();
const zetajs = zHT.zetajs;
const css = zHT.css;
const desktop = zHT.desktop;

let xModel, ctrl;
let writerModuleConfigured = false;

export { zHT, xModel, ctrl };

function loadFile(url) {
  xModel = desktop.loadComponentFromURL(url, '_default', 0, []);
  ctrl = xModel.getCurrentController();

  if (!writerModuleConfigured) {
    writerModuleConfigured = true;
    // One-time Writer module configuration
    zHT.configDisableToolbars(['Writer']);
    zHT.dispatch(ctrl, 'Sidebar');
  }

  const frame = ctrl.getFrame();
  frame.LayoutManager.hideElement('private:resource/menubar/menubar');
  frame.LayoutManager.hideElement('private:resource/statusbar/statusbar');
  frame.getContainerWindow().FullScreen = true;

  // Register formatting status listeners
  for (const id of ['Bold', 'Italic', 'Underline']) {
    const urlObj = zHT.transformUrl(id);
    const listener = zetajs.unoObject([css.frame.XStatusListener], {
      disposing(source) {},
      statusChanged(state) {
        state = zetajs.fromAny(state.State);
        if (typeof state !== 'boolean') state = false;
        zetajs.mainPort.postMessage({ cmd: 'setFormat', id, state });
      },
    });
    zHT.queryDispatch(ctrl, urlObj).addStatusListener(listener, urlObj);
  }
}

function demo() {
  // Load a blank Writer document initially
  loadFile('private:factory/swriter');

  zHT.thrPort.onmessage = (e) => {
    switch (e.data.cmd) {
      case 'toggleFormatting':
        zHT.dispatch(ctrl, e.data.id);
        break;

      case 'loadDocument':
        xModel.close(true);
        loadFile('file://' + e.data.fileName);
        break;

      default:
        throw Error('Unknown message command: ' + e.data.cmd);
    }
  };

  zHT.thrPort.postMessage({ cmd: 'ui_ready' });
}

demo();
