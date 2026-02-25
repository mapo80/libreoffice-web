// Public types for the LibreOfficeEditor component.

import type { ToolbarGroup } from './toolbar-config';
import type { MenuDefinition } from './menu-config';

export type { ToolbarItem, ToolbarGroup } from './toolbar-config';
export type { MenuItem, MenuDefinition } from './menu-config';

/** A custom font to inject into LibreOffice before WASM initialisation. */
export interface CustomFont {
  /** Logical name (for reference only; LibreOffice reads the name from the file). */
  name: string;
  /** URL to fetch the font from (.ttf or .otf). */
  url?: string;
  /** Pre-loaded font data. */
  data?: ArrayBuffer;
}

/** Options accepted by the LibreOfficeEditor constructor. */
export interface EditorOptions {
  /** The container element to render the editor into. Required. */
  container: HTMLElement;

  /** Base URL for WASM files (soffice.js, soffice.wasm, soffice.data). Default: `'./wasm/'`. */
  wasmBasePath?: string;
  /** Base URL for zetajs vendor files (zeta.js). Default: `'./assets/vendor/zetajs/'`. */
  zetajsBasePath?: string;
  /** Path to office_thread.js. Default: `'./office_thread.js'`. */
  officeThreadPath?: string;

  /** Toolbar configuration. Default: writerToolbar. */
  toolbar?: ToolbarGroup[];
  /** Menu configuration. Default: writerMenus. */
  menus?: MenuDefinition[];

  /** Accepted file types for the open-file input. Default: `'.docx,.odt,.doc,.xlsx,.ods,.pptx,.odp'`. */
  acceptedFileTypes?: string;
  /** Initial document name. Default: `'Untitled'`. */
  documentName?: string;

  /** Show/hide UI sections. All default to `true`. */
  showToolbar?: boolean;
  showMenubar?: boolean;
  showStatusbar?: boolean;
  showFileOpen?: boolean;

  /** Loading text displayed during WASM init. Default: `'ZetaOffice is loading...'`. Ignored when `loadingContent` is set. */
  loadingText?: string;

  /** Custom HTML element to replace the default loading overlay (spinner + text). When set, `loadingText` is ignored. */
  loadingContent?: HTMLElement;

  /** Custom fonts injected into the WASM filesystem before LibreOffice boots. */
  customFonts?: CustomFont[];

  /** Open document in read-only mode. Hides toolbar/menubar, disables editing commands. Default: `false`. */
  readOnly?: boolean;
}

/** Map of events emitted by LibreOfficeEditor. */
export interface EditorEventMap {
  /** WASM loaded, UI ready to accept commands. */
  ready: void;
  /** A UNO command's state changed. */
  'state-changed': { command: string; value: unknown; enabled: boolean };
  /** Font list received from LibreOffice. */
  'font-list': { fonts: string[] };
  /** A document finished loading. */
  'document-loaded': void;
  /** The editor has been destroyed. */
  destroyed: void;
  /** An error occurred. */
  error: { message: string; error?: Error };
}
