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
  hideMailMergeToolbars();

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
          xModel.setModified(false);
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
      hideMailMergeToolbars();
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
    case 'queryModified':
      zetajs.mainPort.postMessage({
        cmd: 'queryModified-response',
        isModified: xModel.isModified(),
      });
      break;
    case 'insertMergeField': {
      var fieldName = e.data.fieldName;
      try {
        var xText = xModel.getText();
        var xViewCursor = ctrl.getViewCursor();
        var xTextCursor = xText.createTextCursorByRange(xViewCursor);

        // Try creating a Database text field (produces MERGEFIELD in .docx).
        var xField = xModel.createInstance('com.sun.star.text.textfield.Database');
        xField.setPropertyValue('Content', '\u00AB' + fieldName + '\u00BB');
        xField.setPropertyValue('CurrentPresentation', '\u00AB' + fieldName + '\u00BB');

        // Create or reuse field master for this field name.
        var masterServiceName = 'com.sun.star.text.fieldmaster.Database';
        var masterPrefix = 'com.sun.star.text.fieldmaster.Database.';
        var masters = xModel.getTextFieldMasters();
        var masterFullName = masterPrefix + fieldName;
        var xMaster;
        if (masters.hasByName(masterFullName)) {
          xMaster = masters.getByName(masterFullName);
        } else {
          xMaster = xModel.createInstance(masterServiceName);
          xMaster.setPropertyValue('DataColumnName', fieldName);
        }
        xField.attachTextFieldMaster(xMaster);

        xText.insertTextContent(xTextCursor, xField, false);
      } catch (ex) {
        console.warn('[office_thread] Database field failed, trying Input field fallback:', ex);
        // Fallback: use Input field (works without datasource, saved as FILLIN in .docx)
        try {
          var xText2 = xModel.getText();
          var xViewCursor2 = ctrl.getViewCursor();
          var xTextCursor2 = xText2.createTextCursorByRange(xViewCursor2);
          var xInputField = xModel.createInstance('com.sun.star.text.TextField.Input');
          xInputField.setPropertyValue('Hint', fieldName);
          xInputField.setPropertyValue('Content', '\u00AB' + fieldName + '\u00BB');
          xText2.insertTextContent(xTextCursor2, xInputField, false);
        } catch (ex2) {
          console.error('[office_thread] insertMergeField fallback also failed:', ex2);
        }
      }
      break;
    }
    case 'enumerateMergeFields': {
      var fields = [];
      try {
        var xTextFields = xModel.getTextFields();
        var xEnum = xTextFields.createEnumeration();
        var idx = 0;
        while (xEnum.hasMoreElements()) {
          var xField = xEnum.nextElement();
          try {
            // Check for Database fields (MERGEFIELD)
            if (xField.supportsService('com.sun.star.text.textfield.Database')) {
              var master = xField.getTextFieldMaster();
              var colName = String(master.getPropertyValue('DataColumnName'));
              var content = '';
              try { content = String(xField.getPropertyValue('Content')); } catch(e2) {}
              fields.push({ fieldName: colName, content: content, index: idx });
              idx++;
            }
            // Also check for Input fields (fallback type)
            else if (xField.supportsService('com.sun.star.text.TextField.Input')) {
              var hint = '';
              try { hint = String(xField.getPropertyValue('Hint')); } catch(e2) {}
              if (hint) {
                var content2 = '';
                try { content2 = String(xField.getPropertyValue('Content')); } catch(e2) {}
                fields.push({ fieldName: hint, content: content2, index: idx });
                idx++;
              }
            }
          } catch (fieldEx) {
            // Skip fields that can't be inspected
          }
        }
      } catch (ex) {
        console.error('[office_thread] enumerateMergeFields failed:', ex);
      }
      zetajs.mainPort.postMessage({ cmd: 'enumerateMergeFields-response', fields: fields });
      break;
    }
    case 'updateMergeField': {
      var oldName = e.data.oldFieldName;
      var newName = e.data.newFieldName;
      var targetIndex = e.data.index;
      try {
        var xTextFields = xModel.getTextFields();
        var xEnum = xTextFields.createEnumeration();
        var idx = 0;
        while (xEnum.hasMoreElements()) {
          var xField = xEnum.nextElement();
          try {
            var currentName = null;
            var isDbField = xField.supportsService('com.sun.star.text.textfield.Database');
            var isInputField = xField.supportsService('com.sun.star.text.TextField.Input');
            if (isDbField) {
              var master = xField.getTextFieldMaster();
              currentName = String(master.getPropertyValue('DataColumnName'));
            } else if (isInputField) {
              currentName = String(xField.getPropertyValue('Hint'));
            }
            if (currentName === oldName && (targetIndex === undefined || idx === targetIndex)) {
              // Remove old field and insert new one at the same position
              var anchor = xField.getAnchor();
              var xText = xModel.getText();
              var xTextCursor = xText.createTextCursorByRange(anchor);
              xText.removeTextContent(xField);

              // Insert replacement
              if (isDbField) {
                var xNewField = xModel.createInstance('com.sun.star.text.textfield.Database');
                xNewField.setPropertyValue('Content', '\u00AB' + newName + '\u00BB');
                xNewField.setPropertyValue('CurrentPresentation', '\u00AB' + newName + '\u00BB');
                var masterServiceName = 'com.sun.star.text.fieldmaster.Database';
                var masterPrefix = 'com.sun.star.text.fieldmaster.Database.';
                var masters = xModel.getTextFieldMasters();
                var masterFullName = masterPrefix + newName;
                var xMaster;
                if (masters.hasByName(masterFullName)) {
                  xMaster = masters.getByName(masterFullName);
                } else {
                  xMaster = xModel.createInstance(masterServiceName);
                  xMaster.setPropertyValue('DataColumnName', newName);
                }
                xNewField.attachTextFieldMaster(xMaster);
                xText.insertTextContent(xTextCursor, xNewField, false);
              } else {
                var xNewInput = xModel.createInstance('com.sun.star.text.TextField.Input');
                xNewInput.setPropertyValue('Hint', newName);
                xNewInput.setPropertyValue('Content', '\u00AB' + newName + '\u00BB');
                xText.insertTextContent(xTextCursor, xNewInput, false);
              }
              break;
            }
            if (currentName !== null) idx++;
          } catch (fieldEx) {
            // Skip
          }
        }
      } catch (ex) {
        console.error('[office_thread] updateMergeField failed:', ex);
      }
      break;
    }
    case 'readContentControlAtCursor': {
      // Read the text of the content control at the current cursor position.
      var result = { text: null, index: -1 };
      try {
        var xText = xModel.getText();
        var xViewCursor = ctrl.getViewCursor();
        var cursorStart = xText.createTextCursorByRange(xViewCursor.getStart());
        // Enumerate paragraphs and their text portions to find a content control
        var xParaEnum = xText.createEnumeration();
        var ccIndex = 0;
        var found = false;
        while (xParaEnum.hasMoreElements() && !found) {
          var xPara = xParaEnum.nextElement();
          // Check if it's a paragraph (not a table, etc.)
          if (!xPara.supportsService('com.sun.star.text.Paragraph')) continue;
          var xPortionEnum = xPara.createEnumeration();
          while (xPortionEnum.hasMoreElements() && !found) {
            var xPortion = xPortionEnum.nextElement();
            var portionType = String(xPortion.getPropertyValue('TextPortionType'));
            if (portionType === 'ContentControl') {
              var xCC = xPortion.getPropertyValue('ContentControl');
              // Check if the cursor is within this content control's range
              var ccText = xCC.getText();
              var ccCursor = ccText.createTextCursor();
              ccCursor.gotoStart(false);
              ccCursor.gotoEnd(true);
              var ccString = ccCursor.getString();
              // Compare ranges: check if cursor position is within the content control's anchor
              var xAnchor = xPortion.getStart();
              var xAnchorEnd = xPortion.getEnd();
              var comp = xText.compareRegionStarts(cursorStart, xAnchor);
              var comp2 = xText.compareRegionStarts(cursorStart, xAnchorEnd);
              // comp >= 0 means cursor is at or after CC start
              // comp2 <= 0 means cursor is at or before CC end
              if (comp >= 0 && comp2 <= 0) {
                result = { text: ccString, index: ccIndex };
                found = true;
              }
              ccIndex++;
            }
          }
        }
      } catch (ex) {
        console.error('[office_thread] readContentControlAtCursor failed:', ex);
      }
      zetajs.mainPort.postMessage({ cmd: 'readContentControlAtCursor-response', result: result });
      break;
    }
    case 'updateContentControlText': {
      // Update the text of a content control by index.
      var targetIdx = e.data.index;
      var newText = e.data.newText;
      try {
        var xText = xModel.getText();
        var xParaEnum = xText.createEnumeration();
        var ccIndex = 0;
        var done = false;
        while (xParaEnum.hasMoreElements() && !done) {
          var xPara = xParaEnum.nextElement();
          if (!xPara.supportsService('com.sun.star.text.Paragraph')) continue;
          var xPortionEnum = xPara.createEnumeration();
          while (xPortionEnum.hasMoreElements() && !done) {
            var xPortion = xPortionEnum.nextElement();
            var portionType = String(xPortion.getPropertyValue('TextPortionType'));
            if (portionType === 'ContentControl') {
              if (ccIndex === targetIdx) {
                var xCC = xPortion.getPropertyValue('ContentControl');
                var ccTextObj = xCC.getText();
                var ccCur = ccTextObj.createTextCursor();
                ccCur.gotoStart(false);
                ccCur.gotoEnd(true);
                ccTextObj.insertString(ccCur, newText, true);
                done = true;
              }
              ccIndex++;
            }
          }
        }
      } catch (ex) {
        console.error('[office_thread] updateContentControlText failed:', ex);
      }
      break;
    }
    case 'navigateToMergeField': {
      var targetName = e.data.fieldName;
      var targetIndex = e.data.index || 0;
      try {
        var xTextFields = xModel.getTextFields();
        var xEnum = xTextFields.createEnumeration();
        var idx = 0;
        while (xEnum.hasMoreElements()) {
          var xField = xEnum.nextElement();
          try {
            var currentName = null;
            if (xField.supportsService('com.sun.star.text.textfield.Database')) {
              var master = xField.getTextFieldMaster();
              currentName = String(master.getPropertyValue('DataColumnName'));
            } else if (xField.supportsService('com.sun.star.text.TextField.Input')) {
              currentName = String(xField.getPropertyValue('Hint'));
            }
            if (currentName === targetName && idx === targetIndex) {
              var anchor = xField.getAnchor();
              ctrl.select(anchor, false);
              break;
            }
            if (currentName !== null) idx++;
          } catch (fieldEx) {
            // Skip
          }
        }
      } catch (ex) {
        console.error('[office_thread] navigateToMergeField failed:', ex);
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

function hideMailMergeToolbars() {
  try {
    var lm = ctrl.getFrame().LayoutManager;
    // Hide all known Mail Merge toolbar resource names:
    var mmToolbars = [
      'private:resource/toolbar/mailmerge',
      'private:resource/toolbar/mailmergebar',
      'private:resource/toolbar/mmresultbar',
    ];
    for (var i = 0; i < mmToolbars.length; i++) {
      try { lm.hideElement(mmToolbars[i]); } catch (e) { /* may not exist */ }
    }
    // Also iterate all toolbar elements and hide any containing 'mail' or 'merge':
    try {
      var elements = lm.getElements();
      for (var j = 0; j < elements.length; j++) {
        var resUrl = String(elements[j].ResourceURL).toLowerCase();
        if (resUrl.indexOf('toolbar') !== -1 &&
            (resUrl.indexOf('mail') !== -1 || resUrl.indexOf('merge') !== -1)) {
          lm.hideElement(elements[j].ResourceURL);
        }
      }
    } catch (e) { /* getElements may not be available */ }
  } catch (ex) {
    console.warn('[office_thread] hideMailMergeToolbars:', ex);
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
