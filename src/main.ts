// Demo entry point — instantiates the LibreOfficeEditor component.

import { LibreOfficeEditor } from './index';

const editor = new LibreOfficeEditor({
  container: document.getElementById('editor')!,
});

editor.on('ready', () => {
  console.log('LibreOffice editor is ready');
});

editor.on('error', ({ message, error }) => {
  console.error('Editor error:', message, error);
});

// Expose editor globally for debugging in the browser console.
(window as unknown as { editor: LibreOfficeEditor }).editor = editor;
