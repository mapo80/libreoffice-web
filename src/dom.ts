// Programmatic DOM builder for the LibreOfficeEditor component.
// Creates the entire UI subtree inside the user-provided container.

export interface EditorDOM {
  root: HTMLDivElement;
  nav: HTMLElement;
  menu: HTMLUListElement;
  docName: HTMLSpanElement;
  fileInput: HTMLInputElement;
  fileLabel: HTMLLabelElement;
  navActions: HTMLDivElement;
  toolbarWrapper: HTMLDivElement;
  toolbar: HTMLDivElement;
  canvasContainer: HTMLElement;
  loading: HTMLDivElement;
  canvas: HTMLCanvasElement;
  statusbar: HTMLElement;
}

export interface CreateDOMOptions {
  documentName: string;
  acceptedFileTypes: string;
  loadingText: string;
  showMenubar: boolean;
  showToolbar: boolean;
  showStatusbar: boolean;
  showFileOpen: boolean;
}

export function createEditorDOM(options: CreateDOMOptions): EditorDOM {
  // Root wrapper
  const root = document.createElement('div');
  root.className = 'lo-editor';
  root.dataset.doctype = 'text';

  // --- 1. MENUBAR ---
  const nav = document.createElement('nav');
  nav.className = 'lo-nav';
  if (!options.showMenubar && !options.showFileOpen) {
    nav.style.display = 'none';
  }

  const menu = document.createElement('ul');
  menu.className = 'lo-menu';
  if (!options.showMenubar) menu.style.display = 'none';
  nav.appendChild(menu);

  const docTitle = document.createElement('div');
  docTitle.className = 'lo-doc-title';
  const docName = document.createElement('span');
  docName.className = 'lo-doc-name';
  docName.textContent = options.documentName;
  docTitle.appendChild(docName);
  nav.appendChild(docTitle);

  const navActions = document.createElement('div');
  navActions.className = 'lo-nav-actions';
  if (!options.showFileOpen) navActions.style.display = 'none';

  const fileLabel = document.createElement('label');
  fileLabel.className = 'lo-file-label';
  fileLabel.textContent = 'Open';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.className = 'lo-file-input';
  fileInput.accept = options.acceptedFileTypes;
  fileInput.disabled = true;
  fileLabel.htmlFor = fileInput.id = 'lo-file-input-' + Math.random().toString(36).slice(2, 8);

  navActions.appendChild(fileLabel);
  navActions.appendChild(fileInput);
  nav.appendChild(navActions);
  root.appendChild(nav);

  // --- 2. TOOLBAR ---
  const toolbarWrapper = document.createElement('div');
  toolbarWrapper.className = 'lo-toolbar-wrapper';
  if (!options.showToolbar) toolbarWrapper.style.display = 'none';

  const toolbar = document.createElement('div');
  toolbar.className = 'lo-toolbar';
  toolbarWrapper.appendChild(toolbar);
  root.appendChild(toolbarWrapper);

  // --- 3. CANVAS CONTAINER ---
  const canvasContainer = document.createElement('main');
  canvasContainer.className = 'lo-canvas-container';
  canvasContainer.onselectstart = (e) => e.preventDefault();

  const loading = document.createElement('div');
  loading.className = 'lo-loading';
  const spinner = document.createElement('div');
  spinner.className = 'lo-spinner';
  loading.appendChild(spinner);
  const loadingText = document.createElement('p');
  loadingText.textContent = options.loadingText;
  loading.appendChild(loadingText);
  canvasContainer.appendChild(loading);

  // Canvas MUST have id="qtcanvas" — Emscripten requires it.
  const canvas = document.createElement('canvas');
  canvas.id = 'qtcanvas';
  canvas.contentEditable = 'true';
  canvas.oncontextmenu = (e) => e.preventDefault();
  canvas.onkeydown = (e) => e.preventDefault();
  canvas.style.cssText = 'border: 0px none; padding: 0; width: 100%; height: 100%; visibility: hidden;';
  canvasContainer.appendChild(canvas);
  root.appendChild(canvasContainer);

  // --- 4. STATUS BAR ---
  const statusbar = document.createElement('footer');
  statusbar.className = 'lo-statusbar';
  if (!options.showStatusbar) statusbar.style.display = 'none';

  const pageInfo = document.createElement('span');
  pageInfo.textContent = 'Page 1 of 1';
  statusbar.appendChild(pageInfo);

  const sep1 = document.createElement('span');
  sep1.className = 'lo-separator';
  statusbar.appendChild(sep1);

  const wordCount = document.createElement('span');
  statusbar.appendChild(wordCount);

  const spacer = document.createElement('span');
  spacer.className = 'lo-spacer';
  statusbar.appendChild(spacer);

  const insertMode = document.createElement('span');
  insertMode.textContent = 'Insert';
  statusbar.appendChild(insertMode);

  const sep2 = document.createElement('span');
  sep2.className = 'lo-separator';
  statusbar.appendChild(sep2);

  const zoom = document.createElement('span');
  zoom.textContent = '100%';
  statusbar.appendChild(zoom);

  root.appendChild(statusbar);

  return {
    root,
    nav,
    menu,
    docName,
    fileInput,
    fileLabel,
    navActions,
    toolbarWrapper,
    toolbar,
    canvasContainer,
    loading,
    canvas,
    statusbar,
  };
}
