/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; js-indent-level: 2; fill-column: 100 -*- */
// SPDX-License-Identifier: MIT

// Debugging note:
// Switch the web worker in the browsers debug tab to debug this code.
// It's the "em-pthread" web worker with the most memory usage, where "zetajs" is defined.

'use strict';

// global variables - zetajs environment:
let zetajs, css;

// common variables:
let context, desktop, xModel, ctrl;
var currentFilePath = null;

// All UNO commands we track for toolbar state updates.
var trackedCommands = [
  '.uno:Bold', '.uno:Italic', '.uno:Underline', '.uno:Strikeout',
  '.uno:SubScript', '.uno:SuperScript',
  '.uno:LeftPara', '.uno:CenterPara', '.uno:RightPara', '.uno:JustifyPara',
  '.uno:DefaultBullet', '.uno:DefaultNumbering',
  '.uno:CharFontName', '.uno:FontHeight',
  '.uno:Undo', '.uno:Redo',
  '.uno:FormatPaintbrush', '.uno:ControlCodes',
  '.uno:ParaLeftToRight', '.uno:ParaRightToLeft',
];

function demo() {
  context = zetajs.getUnoComponentContext();

  // Turn off toolbars:
  const config = css.configuration.ReadWriteAccess.create(context, 'en-US');
  const uielems = config.getByHierarchicalName(
    '/org.openoffice.Office.UI.WriterWindowState/UIElements/States');
  for (const i of uielems.getElementNames()) {
    const uielem = uielems.getByName(i);
    if (uielem.getByName('Visible')) {
      uielem.setPropertyValue('Visible', false);
    }
  }
  config.commitChanges();

  desktop = css.frame.Desktop.create(context);
  xModel = desktop.loadComponentFromURL('private:factory/swriter', '_default', 0, [])
  ctrl = xModel.getCurrentController();
  ctrl.getFrame().getContainerWindow().FullScreen = true;

  ctrl.getFrame().LayoutManager.hideElement("private:resource/menubar/menubar");

  // Turn off sidebar:
  dispatch('.uno:Sidebar');

  // Register status listeners for all tracked commands:
  registerStatusListeners();

  // Send font list to main thread:
  sendFontList();

  zetajs.mainPort.onmessage = function (e) {
    switch (e.data.cmd) {
    case 'dispatch':
      console.log('[office_thread] dispatch received:', e.data.command, 'currentFilePath:', currentFilePath);
      // Intercept Save: use storeToURL directly to avoid the native file picker dialog
      // which crashes in the WASM environment.
      if (e.data.command === '.uno:Save' && currentFilePath) {
        try {
          // storeToURL writes through LibreOffice's VFS. The worker's Emscripten FS is
          // separate from the main thread's, so we cannot FS.readFile here.
          // Instead, save to the original path and ask the main thread to read it.
          var filterName = 'MS Word 2007 XML';
          var ext = currentFilePath.substring(currentFilePath.lastIndexOf('.'));
          if (ext === '.odt') filterName = 'writer8';
          else if (ext === '.ods') filterName = 'calc8';
          else if (ext === '.xlsx') filterName = 'Calc MS Excel 2007 XML';
          var storeProps = [
            new css.beans.PropertyValue({ Name: 'FilterName', Value: filterName }),
            new css.beans.PropertyValue({ Name: 'Overwrite', Value: true }),
          ];
          console.log('[office_thread] storeToURL:', 'file://' + currentFilePath, 'filter:', filterName);
          xModel.storeToURL('file://' + currentFilePath, storeProps);
          console.log('[office_thread] storeToURL succeeded, asking main thread to read file');
          zetajs.mainPort.postMessage({cmd: 'read_saved_file', path: currentFilePath});
        } catch (ex) {
          console.error('[office_thread] Save failed:', ex);
        }
      } else if (e.data.value !== undefined) {
        dispatchWithParam(e.data.command, e.data.value);
      } else {
        dispatch(e.data.command);
      }
      break;
    case 'loadDocument':
      console.log('[office_thread] loadDocument:', e.data.fileName);
      currentFilePath = e.data.fileName;
      xModel.close(true);
      xModel = desktop.loadComponentFromURL('file://' + e.data.fileName, '_default', 0, []);
      ctrl = xModel.getCurrentController();
      ctrl.getFrame().getContainerWindow().FullScreen = true;
      ctrl.getFrame().LayoutManager.hideElement("private:resource/menubar/menubar");
      // Hide sidebar using XSidebarProvider API (not toggle):
      var xSidebar = ctrl.getSidebar();
      if (xSidebar) xSidebar.setVisible(false);
      // Re-register status listeners for the new controller:
      registerStatusListeners();
      // Tell main thread to trigger resize:
      zetajs.mainPort.postMessage({cmd: 'doc_loaded'});
      break;
    case 'insertContentControl': {
      // Insert a plain-text content control (SDT) at the current cursor position.
      var tagText = e.data.text;
      try {
        var xText = xModel.getText();
        var xViewCursor = ctrl.getViewCursor();
        var xTextCursor = xText.createTextCursorByRange(xViewCursor);

        // Insert the tag text and select it.
        xText.insertString(xTextCursor, tagText, false);
        xTextCursor.goLeft(tagText.length, true);

        // Create a plain-text content control wrapping the selected text.
        var xCC = xModel.createInstance('com.sun.star.text.ContentControl');
        xCC.setPropertyValue('PlainText', true);
        xText.insertTextContent(xTextCursor, xCC, true);
      } catch (ex) {
        console.error('[office_thread] insertContentControl failed:', ex);
      }
      break;
    }
    case 'insertContentControlBlock': {
      // Insert multiple content controls separated by paragraph breaks.
      // items: array of {text: string} (content control) or {para: true} (paragraph break)
      var items = e.data.items;
      try {
        var xText = xModel.getText();
        for (var idx = 0; idx < items.length; idx++) {
          var item = items[idx];
          if (item.para) {
            // Insert a paragraph break via dispatch (reliable cursor advance).
            dispatch('.uno:InsertPara');
          } else if (item.text) {
            var xViewCursor = ctrl.getViewCursor();
            var xTextCursor = xText.createTextCursorByRange(xViewCursor);
            xText.insertString(xTextCursor, item.text, false);
            xTextCursor.goLeft(item.text.length, true);
            var xCC = xModel.createInstance('com.sun.star.text.ContentControl');
            xCC.setPropertyValue('PlainText', true);
            xText.insertTextContent(xTextCursor, xCC, true);
          }
        }
      } catch (ex) {
        console.error('[office_thread] insertContentControlBlock failed:', ex);
      }
      break;
    }
    default:
      throw Error('Unknown message command: ' + e.data.cmd);
    }
  }
  zetajs.mainPort.postMessage({cmd: 'ui_ready'});
}

function registerStatusListeners() {
  for (var i = 0; i < trackedCommands.length; i++) {
    var command = trackedCommands[i];
    registerOneListener(command);
  }
}

function registerOneListener(command) {
  try {
    var urlObj = transformUrl(command);
    var disp = queryDispatch(urlObj);
    if (!disp) return;
    var listener = zetajs.unoObject([css.frame.XStatusListener], {
      disposing: function(source) {},
      statusChanged: function(state) {
        var val = zetajs.fromAny(state.State);
        // Extract usable value depending on type
        var sendVal;
        if (typeof val === 'boolean') {
          sendVal = val;
        } else if (val == null) {
          sendVal = '';
        } else if (typeof val === 'object') {
          // UNO struct: extract relevant field based on command
          // CharFontName returns a FontDescriptor with .Name (not .FamilyName)
          if (command === '.uno:CharFontName' && val.Name !== undefined) {
            sendVal = String(val.Name);
          } else if (command === '.uno:FontHeight' && val.Height !== undefined) {
            sendVal = String(val.Height);
          } else if (val.Name !== undefined) {
            sendVal = String(val.Name);
          } else if (val.Value !== undefined) {
            sendVal = String(val.Value);
          } else {
            sendVal = String(val);
          }
        } else {
          sendVal = String(val);
        }
        zetajs.mainPort.postMessage({
          cmd: 'stateChanged',
          command: command,
          value: sendVal,
          enabled: true,
        });
      }
    });
    disp.addStatusListener(listener, urlObj);
  } catch (ex) {
    // Some commands may not be available for the current document type
  }
}

function sendFontList() {
  try {
    var toolkit = css.awt.Toolkit.create(context);
    var device = toolkit.createScreenCompatibleDevice(0, 0);
    var fontDescriptors = device.getFontDescriptors();
    var fontNames = {};
    for (var i = 0; i < fontDescriptors.length; i++) {
      var name = String(fontDescriptors[i].Name);
      if (name && name !== 'undefined' && name !== '[object Object]') fontNames[name] = true;
    }
    var sorted = Object.keys(fontNames).sort(function(a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
    });
    zetajs.mainPort.postMessage({cmd: 'fontList', fonts: sorted});
  } catch (ex) {
    // Font enumeration not available
  }
}

function transformUrl(unoUrl) {
  var ioparam = {val: new css.util.URL({Complete: unoUrl})};
  css.util.URLTransformer.create(context).parseStrict(ioparam);
  return ioparam.val;
}

function queryDispatch(urlObj) {
  return ctrl.queryDispatch(urlObj, '_self', 0);
}

function dispatch(unoUrl) {
  var urlObj = transformUrl(unoUrl);
  var disp = queryDispatch(urlObj);
  if (disp) disp.dispatch(urlObj, []);
}

function dispatchWithParam(unoCommand, value) {
  var urlObj = transformUrl(unoCommand);
  var disp = queryDispatch(urlObj);
  if (!disp) return;

  var args = [];
  if (unoCommand === '.uno:CharFontName') {
    // SvxFont struct: must provide all members
    args = [
      new css.beans.PropertyValue({ Name: 'CharFontName.StyleName', Value: '' }),
      new css.beans.PropertyValue({ Name: 'CharFontName.Pitch', Value: zetajs.Any('short', 0) }),
      new css.beans.PropertyValue({ Name: 'CharFontName.CharSet', Value: zetajs.Any('short', -1) }),
      new css.beans.PropertyValue({ Name: 'CharFontName.Family', Value: zetajs.Any('short', 0) }),
      new css.beans.PropertyValue({ Name: 'CharFontName.FamilyName', Value: value }),
    ];
  } else if (unoCommand === '.uno:FontHeight') {
    // SvxFontHeight struct: Height (float), Prop (short), Diff (float)
    args = [
      new css.beans.PropertyValue({ Name: 'FontHeight.Height', Value: zetajs.Any('float', parseFloat(value)) }),
      new css.beans.PropertyValue({ Name: 'FontHeight.Prop', Value: zetajs.Any('short', 100) }),
      new css.beans.PropertyValue({ Name: 'FontHeight.Diff', Value: zetajs.Any('float', 0) }),
    ];
  } else if (unoCommand === '.uno:InsertText') {
    args = [new css.beans.PropertyValue({ Name: 'Text', Value: value })];
  } else if (unoCommand === '.uno:Color' || unoCommand === '.uno:CharBackColor' || unoCommand === '.uno:BackgroundColor') {
    args = [new css.beans.PropertyValue({
      Name: unoCommand.replace('.uno:', '') + '.Color',
      Value: zetajs.Any('long', parseInt(value)),
    })];
  }
  disp.dispatch(urlObj, args);
}

Module.zetajs.then(function(pZetajs) {
  // initializing zetajs environment:
  zetajs = pZetajs;
  css = zetajs.uno.com.sun.star;
  demo();  // launching demo
});

/* vim:set shiftwidth=2 softtabstop=2 expandtab cinoptions=b1,g0,N-s cinkeys+=0=break: */
