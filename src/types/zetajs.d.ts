/** The Emscripten Module object, configured before soffice.js loads. */
interface EmscriptenModule {
  canvas: HTMLCanvasElement;
  uno_scripts: string[];
  locateFile: (path: string, prefix: string) => string;
  mainScriptUrlOrBlob?: Blob;
  uno_main: Promise<MessagePort>;
  zetajs: Promise<ZetaJS>;
  [key: string]: unknown;
}

/** The zetajs API object, resolved from Module.zetajs promise. */
interface ZetaJS {
  mainPort: MessagePort;
  uno: {
    com: {
      sun: {
        star: Record<string, unknown>;
      };
    };
  };
  getUnoComponentContext(): unknown;
  unoObject(interfaces: unknown[], implementation: Record<string, unknown>): unknown;
  fromAny(value: unknown): unknown;
  type: {
    interface(iface: unknown): unknown;
  };
}

/** Emscripten virtual filesystem, available as window.FS after soffice.js loads. */
interface EmscriptenFS {
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string): Uint8Array;
  unlink(path: string): void;
  mkdir(path: string): void;
  [key: string]: unknown;
}
