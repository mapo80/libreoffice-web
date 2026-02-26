// Main LibreOfficeEditor class — reusable component.

import './style.css';

import { EventEmitter } from './event-emitter';
import { createEditorDOM, type EditorDOM } from './dom';
import { ToolbarRenderer } from './toolbar-renderer';
import { MenuRenderer } from './menu-renderer';
import { TemplateToolbar } from './template-toolbar';
import { bootstrapSoffice } from './bootstrap';
import { writerToolbar, trackedCommands } from './toolbar-config';
import { writerMenus } from './menu-config';
import type { EditorOptions, EditorEventMap, CustomFont } from './types';

interface EmscriptenFS {
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string): Uint8Array;
}

/** Resolved options with all defaults filled in. */
interface ResolvedOptions {
  container: HTMLElement;
  wasmBasePath: string;
  zetajsBasePath: string;
  officeThreadPath: string;
  toolbar: typeof writerToolbar;
  menus: typeof writerMenus;
  acceptedFileTypes: string;
  documentName: string;
  showToolbar: boolean;
  showMenubar: boolean;
  showStatusbar: boolean;
  showFileOpen: boolean;
  loadingText: string;
  loadingContent?: HTMLElement;
  customFonts: CustomFont[];
  readOnly: boolean;
  showTemplateToolbar: boolean;
}

export class LibreOfficeEditor {
  // Singleton guard — only one instance per page (WASM limitation).
  private static instance: LibreOfficeEditor | null = null;

  private options: ResolvedOptions;
  private emitter = new EventEmitter<EditorEventMap>();
  private dom!: EditorDOM;
  private toolbarRenderer!: ToolbarRenderer;
  private menuRenderer!: MenuRenderer;
  private templateToolbar!: TemplateToolbar;
  private port: MessagePort | null = null;
  private isReady = false;
  private isDestroyed = false;
  private _readOnly = false;
  private currentFilePath: string | null = null;

  constructor(options: EditorOptions) {
    if (LibreOfficeEditor.instance) {
      throw new Error(
        'Only one LibreOfficeEditor instance can exist per page due to WASM limitations. ' +
        'Call destroy() on the existing instance first.',
      );
    }
    LibreOfficeEditor.instance = this;

    this.options = this.resolveOptions(options);
    this._readOnly = this.options.readOnly;
    this.init();
  }

  // ====== PUBLIC API ======

  /** Whether the editor is in read-only mode. */
  get readOnly(): boolean {
    return this._readOnly;
  }

  /** Read the current document from the WASM virtual filesystem. */
  getDocumentBuffer(): ArrayBuffer | null {
    if (!this.currentFilePath) return null;
    try {
      const data = this.getFS().readFile(this.currentFilePath);
      return data.buffer as ArrayBuffer;
    } catch {
      return null;
    }
  }

  /** Dispatch a UNO command to LibreOffice. */
  dispatchCommand(command: string, value?: string): void {
    console.log('[LibreOfficeEditor] dispatchCommand:', command, 'port:', !!this.port, 'readOnly:', this._readOnly);
    if (!this.port) return;
    // In read-only mode, only allow the internal EditDoc toggle (used to enter read-only).
    if (this._readOnly && command !== '.uno:EditDoc') return;
    if (value !== undefined) {
      this.port.postMessage({ cmd: 'dispatch', command, value });
    } else {
      this.port.postMessage({ cmd: 'dispatch', command });
    }
  }

  /** Load a document from a File object. */
  async loadDocument(file: File): Promise<void> {
    if (!this.port) throw new Error('Editor not ready');

    const name = file.name;
    this.dom.docName.textContent = name;

    let filePath = '/tmp/input';
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex > 0) filePath += name.substring(dotIndex);

    this.currentFilePath = filePath;
    const data = await file.arrayBuffer();
    this.getFS().writeFile(filePath, new Uint8Array(data));
    this.port.postMessage({ cmd: 'loadDocument', fileName: filePath });
  }

  /** Load a document from an ArrayBuffer with a given filename. */
  loadDocumentFromBuffer(buffer: ArrayBuffer, fileName: string): void {
    if (!this.port) throw new Error('Editor not ready');

    this.dom.docName.textContent = fileName;

    let filePath = '/tmp/input';
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex > 0) filePath += fileName.substring(dotIndex);

    this.currentFilePath = filePath;
    this.getFS().writeFile(filePath, new Uint8Array(buffer));
    this.port.postMessage({ cmd: 'loadDocument', fileName: filePath });
  }

  /** Subscribe to an editor event. Returns an unsubscribe function. */
  on<K extends keyof EditorEventMap>(
    event: K,
    handler: (data: EditorEventMap[K]) => void,
  ): () => void {
    return this.emitter.on(event, handler);
  }

  /** Subscribe once. */
  once<K extends keyof EditorEventMap>(
    event: K,
    handler: (data: EditorEventMap[K]) => void,
  ): () => void {
    return this.emitter.once(event, handler);
  }

  /** Whether the editor is ready. */
  get ready(): boolean {
    return this.isReady;
  }

  /** The canvas element. */
  get canvas(): HTMLCanvasElement {
    return this.dom.canvas;
  }

  /** Set the document display name. */
  setDocumentName(name: string): void {
    this.dom.docName.textContent = name;
  }

  /** Show or hide the toolbar. */
  setToolbarVisible(visible: boolean): void {
    this.dom.toolbarWrapper.style.display = visible ? '' : 'none';
  }

  /** Show or hide the menu bar. */
  setMenubarVisible(visible: boolean): void {
    this.dom.nav.style.display = visible ? '' : 'none';
  }

  /** Show or hide the status bar. */
  setStatusbarVisible(visible: boolean): void {
    this.dom.statusbar.style.display = visible ? '' : 'none';
  }

  /** Insert text at the current cursor position. */
  insertText(text: string): void {
    this.dispatchCommand('.uno:InsertText', text);
  }

  /** Insert multiple lines, each separated by a paragraph break. */
  insertTextBlock(lines: string[]): void {
    if (!this.port || lines.length === 0) return;
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) this.dispatchCommand('.uno:InsertPara');
      if (lines[i]) this.dispatchCommand('.uno:InsertText', lines[i]);
    }
  }

  /** Insert a plain-text content control (SDT) at the current cursor position. */
  insertContentControl(text: string): void {
    if (!this.port) return;
    this.port.postMessage({ cmd: 'insertContentControl', text });
  }

  /**
   * Insert multiple content controls separated by paragraph breaks.
   * Non-empty strings become content controls; empty strings become paragraph breaks.
   */
  insertContentControlBlock(lines: string[]): void {
    if (!this.port || lines.length === 0) return;
    const items: Array<{ text: string } | { para: true }> = [];
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) items.push({ para: true });
      if (lines[i]) items.push({ text: lines[i] });
    }
    this.port.postMessage({ cmd: 'insertContentControlBlock', items });
  }

  /** Show or hide the template-tag toolbar. */
  setTemplateToolbarVisible(visible: boolean): void {
    this.dom.templateToolbar.style.display = visible ? '' : 'none';
  }

  /** Focus the canvas. */
  focus(): void {
    this.dom.canvas.focus();
  }

  /** Tear down the editor: remove DOM, detach listeners, release singleton. */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    this.toolbarRenderer.destroy();
    this.templateToolbar.destroy();
    this.menuRenderer.destroy();

    // Remove DOM subtree
    if (this.dom.root.parentNode) {
      this.dom.root.parentNode.removeChild(this.dom.root);
    }

    this.emitter.emit('destroyed', undefined as never);
    this.emitter.removeAll();

    this.port = null;
    LibreOfficeEditor.instance = null;
  }

  // ====== PRIVATE ======

  private resolveOptions(options: EditorOptions): ResolvedOptions {
    const readOnly = options.readOnly ?? false;
    return {
      container: options.container,
      wasmBasePath: options.wasmBasePath ?? './wasm/',
      zetajsBasePath: options.zetajsBasePath ?? './assets/vendor/zetajs/',
      officeThreadPath: options.officeThreadPath ?? './office_thread.js',
      toolbar: options.toolbar ?? writerToolbar,
      menus: options.menus ?? writerMenus,
      acceptedFileTypes: options.acceptedFileTypes ?? '.docx,.odt,.doc,.xlsx,.ods,.pptx,.odp',
      documentName: options.documentName ?? 'Untitled',
      showToolbar: readOnly ? false : (options.showToolbar ?? true),
      showMenubar: readOnly ? false : (options.showMenubar ?? true),
      showStatusbar: options.showStatusbar ?? true,
      showFileOpen: readOnly ? false : (options.showFileOpen ?? true),
      loadingText: options.loadingText ?? 'Word is loading...',
      loadingContent: options.loadingContent,
      customFonts: options.customFonts ?? [],
      readOnly,
      showTemplateToolbar: readOnly ? false : (options.showTemplateToolbar ?? false),
    };
  }

  private init(): void {
    // 1. Build DOM
    this.dom = createEditorDOM({
      documentName: this.options.documentName,
      acceptedFileTypes: this.options.acceptedFileTypes,
      loadingText: this.options.loadingText,
      loadingContent: this.options.loadingContent,
      showMenubar: this.options.showMenubar,
      showToolbar: this.options.showToolbar,
      showTemplateToolbar: this.options.showTemplateToolbar,
      showStatusbar: this.options.showStatusbar,
      showFileOpen: this.options.showFileOpen,
    });
    this.options.container.appendChild(this.dom.root);

    // 2. Render toolbar
    this.toolbarRenderer = new ToolbarRenderer(
      this.dom.toolbar,
      this.dom.canvas,
      this.options.toolbar,
      (cmd, val) => this.dispatchCommand(cmd, val),
    );
    this.toolbarRenderer.render();

    // 3. Render template toolbar
    this.templateToolbar = new TemplateToolbar(
      this.dom.templateToolbar,
      (text) => this.insertContentControl(text),
      (lines) => this.insertContentControlBlock(lines),
    );
    this.templateToolbar.render();

    // 4. Render menubar
    this.menuRenderer = new MenuRenderer(
      this.dom.menu,
      this.dom.canvas,
      this.options.menus,
      (cmd) => this.dispatchCommand(cmd),
    );
    this.menuRenderer.render();

    // 5. Intercept Ctrl+S on the canvas to prevent LibreOffice WASM from
    //    triggering its native Save dialog (which crashes in the WASM build).
    //    Instead, route save through our dispatch mechanism.
    this.setupKeyboardInterceptor();

    // 6. File upload
    this.setupFileUpload();

    // 7. Bootstrap WASM
    this.bootstrap();
  }

  private setupKeyboardInterceptor(): void {
    // Use capture phase to intercept before Emscripten's handler.
    this.dom.canvas.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.dispatchCommand('.uno:Save');
      }
    }, true);
  }

  private setupFileUpload(): void {
    this.dom.fileInput.addEventListener('change', () => {
      const file = this.dom.fileInput.files?.[0];
      if (!file || !this.port) return;
      this.loadDocument(file);
      this.dom.fileInput.value = '';
    });
  }

  private bootstrap(): void {
    bootstrapSoffice(
      this.dom.canvas,
      {
        wasmBasePath: this.options.wasmBasePath,
        zetajsBasePath: this.options.zetajsBasePath,
        officeThreadPath: this.options.officeThreadPath,
      },
      {
        onUiReady: () => {
          this.isReady = true;
          this.dom.loading.style.display = 'none';
          this.dom.canvas.style.visibility = '';
          if (!this._readOnly) {
            this.toolbarRenderer.enableAll();
            this.templateToolbar.enableAll();
            this.dom.fileInput.disabled = false;
          }
          this.emitter.emit('ready', undefined as never);
        },
        onStateChanged: (command, value, enabled) => {
          this.toolbarRenderer.handleStateChanged(command, value, enabled);
          this.emitter.emit('state-changed', { command, value, enabled });
        },
        onFontList: (fonts) => {
          this.toolbarRenderer.updateFontList(fonts);
          this.emitter.emit('font-list', { fonts });
        },
        onDocLoaded: () => {
          // In read-only mode, toggle LibreOffice out of edit mode.
          if (this._readOnly && this.port) {
            this.port.postMessage({ cmd: 'dispatch', command: '.uno:EditDoc' });
          }
          this.emitter.emit('document-loaded', undefined as never);
        },
        onDocSaved: (buffer) => {
          const fileName = this.dom.docName.textContent || 'document';
          this.emitter.emit('document-saved', { buffer, fileName });
        },
      },
      this.options.customFonts,
    ).then((port) => {
      this.port = port;
    }).catch((err) => {
      this.emitter.emit('error', {
        message: 'Failed to bootstrap LibreOffice WASM',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    });
  }

  private getFS(): EmscriptenFS {
    return (window as unknown as { FS: EmscriptenFS }).FS;
  }
}
