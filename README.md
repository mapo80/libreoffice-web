# LibreOffice Web Editor

**A TypeScript WASM integration component that embeds a full LibreOffice office suite into any web page.**

This project wraps the prebuilt [ZetaOffice](https://www.zetaoffice.net/) WebAssembly binary (a WASM-compiled LibreOffice) and exposes a clean, component-oriented API for web applications. It provides a Collabora Online-inspired toolbar UI, menu system, document loading, and bidirectional command dispatch — all driven from a single `LibreOfficeEditor` class.

> **Important:** This repository does **not** compile LibreOffice to WebAssembly. The ~250 MB WASM artifact is **prebuilt and downloaded** from the ZetaOffice CDN. This codebase is the **integration layer**: it loads, configures, and wraps the external WASM runtime for consumption by web applications.

---

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Architecture at a Glance](#architecture-at-a-glance)
4. [Repository Structure](#repository-structure)
5. [Deep Architecture](#deep-architecture)
6. [WASM Integration Runtime Model](#wasm-integration-runtime-model)
7. [Public API / Usage](#public-api--usage)
8. [Asset Packaging and Deployment](#asset-packaging-and-deployment)
9. [Development Workflow](#development-workflow)
10. [Testing Strategy](#testing-strategy)
11. [Performance Considerations](#performance-considerations)
12. [Security Considerations](#security-considerations)
13. [Compatibility Matrix](#compatibility-matrix)
14. [Troubleshooting](#troubleshooting)
15. [Known Limitations](#known-limitations)
16. [Versioning and Upgrade Notes](#versioning-and-upgrade-notes)
17. [Contributing](#contributing)
18. [License](#license)
19. [Appendix](#appendix)

---

## Overview

### What This Component Is

LibreOffice Web Editor is a TypeScript integration layer that turns the ZetaOffice WASM binary into an embeddable web component. It handles:

- Downloading and loading the ~250 MB prebuilt WASM artifact
- Bootstrapping the Emscripten runtime with correct COOP/COEP isolation
- Managing a Web Worker thread where LibreOffice runs
- Providing a Collabora Online-style toolbar and menu bar
- Exposing a `LibreOfficeEditor` class with methods for document loading, command dispatch, and event handling
- Marshaling data between JavaScript and the LibreOffice UNO API via the zetajs bridge

### What Problem It Solves

Running LibreOffice natively in the browser eliminates the need for server-side document conversion or a Collabora Online server installation. Users can open, edit, and format `.docx`, `.odt`, `.xlsx`, `.ods`, `.pptx`, and `.odp` files entirely client-side.

### Main Use Cases

- Embedding a document editor in a web application (CMS, intranet, SaaS product)
- Client-side document viewing without server-side rendering
- Offline-capable document editing (once WASM assets are cached)
- Rapid prototyping of document-based workflows

### Who Should Use It

- **Web developers** integrating document editing into their applications
- **Product teams** needing embedded office capabilities without server infrastructure
- **Architects** evaluating client-side document processing strategies

---

## Key Features

- **Full LibreOffice Writer** running natively in the browser via WebAssembly
- **Single-class API** — `new LibreOfficeEditor({ container })` is all that's needed
- **Collabora Online-inspired UI** — toolbar with 8 button groups, 6 dropdown menus with submenus
- **43 SVG toolbar icons** bundled inline (no network requests)
- **Font management** — dynamic font list from LibreOffice, custom font injection before boot
- **Document loading** from `File` objects or `ArrayBuffer`
- **Bidirectional UNO command dispatch** — send commands, receive state change events
- **Typed event system** — `ready`, `state-changed`, `font-list`, `document-loaded`, `error`, `destroyed`
- **Configurable UI** — show/hide toolbar, menubar, statusbar, file open button independently
- **Custom toolbar/menu definitions** — replace or extend the default Writer toolbar and menus
- **Zero runtime dependencies** beyond zetajs (no React, no jQuery, no CSS framework)
- **CSS scoped to `.lo-editor`** — no global style pollution
- **Vite-powered build** with ES2020 target
- **Cross-origin isolation** handled via Vite plugin (COOP/COEP headers)

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Consumer Application                         │
│                                                                     │
│   const editor = new LibreOfficeEditor({ container: el });          │
│   editor.on('ready', () => { ... });                                │
│   editor.loadDocument(file);                                        │
│   editor.dispatchCommand('.uno:Bold');                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LibreOfficeEditor  (this repository)                    │
│                                                                     │
│  ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌───────────────────┐  │
│  │ Toolbar  │ │   Menu     │ │   DOM      │ │   Event Emitter   │  │
│  │ Renderer │ │  Renderer  │ │  Builder   │ │   (typed, sync)   │  │
│  └─────┬────┘ └─────┬──────┘ └─────┬──────┘ └────────┬──────────┘  │
│        │             │              │                  │             │
│        └─────────────┴──────────────┴──────────────────┘             │
│                               │                                     │
│                    ┌──────────▼──────────┐                          │
│                    │   bootstrap.ts      │                          │
│                    │   (WASM loader)     │                          │
│                    └──────────┬──────────┘                          │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
              ▼                 ▼                  ▼
    ┌──────────────┐  ┌────────────────┐  ┌───────────────┐
    │  soffice.js  │  │ soffice.wasm   │  │ soffice.data  │
    │  (Emscripten │  │ (154 MB WASM   │  │ (95 MB VFS:   │
    │   glue code) │  │  binary)       │  │  fonts, libs) │
    │   838 KB     │  │                │  │               │
    └──────┬───────┘  └────────────────┘  └───────────────┘
           │              ZetaOffice CDN artifacts
           ▼
    ┌─────────────────────────────────────────────┐
    │              Web Worker Thread               │
    │                                              │
    │  ┌──────────┐   ┌────────────────────────┐  │
    │  │ zeta.js  │   │   office_thread.js     │  │
    │  │ (bridge) │   │   (UNO commands,       │  │
    │  │          │   │    status listeners,    │  │
    │  │          │   │    font enumeration)    │  │
    │  └──────────┘   └────────────────────────┘  │
    │                                              │
    │  LibreOffice UNO API  ←→  zetajs bridge     │
    └──────────────────────────────────────────────┘
```

---

## Repository Structure

```
libreoffice-web/
├── src/                              # TypeScript source (integration layer)
│   ├── index.ts                      #   Public entry point (exports)
│   ├── LibreOfficeEditor.ts          #   Main component class (singleton)
│   ├── bootstrap.ts                  #   WASM bootstrap logic
│   ├── dom.ts                        #   Programmatic DOM builder
│   ├── event-emitter.ts              #   Zero-dep typed event emitter
│   ├── toolbar-config.ts             #   Writer toolbar definition (8 groups)
│   ├── toolbar-renderer.ts           #   Toolbar DOM + state management
│   ├── menu-config.ts                #   Writer menu definitions (6 menus)
│   ├── menu-renderer.ts              #   Menu DOM + dropdown logic
│   ├── icons.ts                      #   39 SVG icons as inline strings
│   ├── types.ts                      #   Public API TypeScript types
│   ├── style.css                     #   Scoped CSS (Collabora Online theme)
│   ├── images/                       #   43 LibreOffice SVG icon files
│   │   ├── lc_bold.svg
│   │   ├── lc_italic.svg
│   │   └── ... (41 more)
│   └── types/
│       └── zetajs.d.ts               #   Type defs for Emscripten/zetajs globals
│
├── public/                           #   Static runtime assets (not bundled)
│   ├── office_thread.js              #   Web Worker: UNO commands + listeners
│   ├── soffice-bootstrap.js          #   Reference bootstrap pattern (unused)
│   ├── wasm/                         #   Downloaded WASM artifacts (gitignored)
│   │   ├── soffice.js                #     Emscripten glue code (838 KB)
│   │   ├── soffice.wasm              #     Main WASM binary (154 MB)
│   │   ├── soffice.data              #     Virtual filesystem (95 MB)
│   │   └── soffice.data.js.metadata  #     Data loading metadata (210 KB)
│   └── assets/vendor/zetajs/         #   Copied from node_modules (gitignored)
│       ├── zeta.js                   #     ZetaJS UNO bridge library
│       └── zetaHelper.js             #     ZetaJS helper utilities
│
├── scripts/                          #   Build and test scripts
│   ├── download-wasm.mjs             #   Downloads WASM from ZetaOffice CDN
│   ├── copy-zetajs.mjs               #   Copies zetajs from node_modules (postinstall)
│   ├── test-e2e.mjs                  #   Playwright end-to-end tests
│   ├── test-browser.mjs              #   Puppeteer integration tests
│   └── test-headed.mjs               #   Headed browser test variant
│
├── templates/
│   └── custom-font-sample.docx       #   Test document for e2e tests
│
├── index.html                        #   Demo app entry point
├── package.json                      #   npm manifest (zetajs dep)
├── tsconfig.json                     #   TypeScript config (ES2020, strict)
├── vite.config.ts                    #   Vite config + COOP/COEP plugin
└── .gitignore                        #   Ignores wasm/, zetajs vendor, dist/
```

### What's Gitignored (Must Be Generated)

| Path | Generated By | Size |
|------|-------------|------|
| `public/wasm/*` | `npm run download-wasm` | ~250 MB total |
| `public/assets/vendor/zetajs/*` | `npm install` (postinstall) | ~50 KB |
| `dist/` | `npm run build` | Varies |
| `node_modules/` | `npm install` | Varies |

---

## Deep Architecture

### Module Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│                    PUBLIC API LAYER                              │
│                                                                 │
│  index.ts ─── exports { LibreOfficeEditor, types, configs }     │
│  types.ts ─── EditorOptions, EditorEventMap, CustomFont         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                COMPONENT ORCHESTRATION LAYER                    │
│                                                                 │
│  LibreOfficeEditor.ts                                           │
│  ├── Singleton enforcement (one WASM instance per page)         │
│  ├── Option resolution with defaults                            │
│  ├── DOM creation delegation                                    │
│  ├── Toolbar + menu rendering delegation                        │
│  ├── File upload wiring                                         │
│  ├── WASM bootstrap delegation                                  │
│  ├── MessagePort command dispatch                               │
│  ├── Event forwarding to consumers                              │
│  └── Cleanup / destroy lifecycle                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
         ┌─────────────────┼──────────────────────┐
         │                 │                      │
         ▼                 ▼                      ▼
┌─────────────────┐ ┌──────────────┐  ┌──────────────────────┐
│  UI RENDERERS   │ │  DOM BUILDER │  │  EVENT SYSTEM        │
│                 │ │              │  │                      │
│ toolbar-        │ │ dom.ts       │  │ event-emitter.ts     │
│  renderer.ts    │ │ Creates:     │  │ Typed Map<Set<Fn>>   │
│  - render()     │ │  .lo-editor  │  │  - on() → unsub fn  │
│  - state sync   │ │  .lo-nav     │  │  - once()            │
│  - font list    │ │  .lo-toolbar │  │  - off()             │
│  - enable/      │ │  #qtcanvas   │  │  - emit()            │
│    disable      │ │  .lo-status  │  │  - removeAll()       │
│                 │ │              │  │                      │
│ menu-           │ │ Returns refs │  └──────────────────────┘
│  renderer.ts    │ │ to all key   │
│  - render()     │ │ DOM nodes    │
│  - dropdown     │ └──────────────┘
│  - submenus     │
│  - auto-close   │
└─────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                   CONFIGURATION LAYER                            │
│                                                                  │
│  toolbar-config.ts                  menu-config.ts               │
│  ├── 8 toolbar groups               ├── 6 dropdown menus         │
│  ├── 35+ toolbar items              ├── 70+ menu items           │
│  ├── 30 font sizes                  ├── Nested submenus          │
│  └── trackedCommands[]              └── Keyboard shortcuts       │
│                                                                  │
│  icons.ts                                                        │
│  └── 39 SVG strings (Vite ?raw)                                  │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                 WASM BOOTSTRAP LAYER                             │
│                                                                  │
│  bootstrap.ts                                                    │
│  ├── Resolve custom fonts (fetch URL or accept ArrayBuffer)      │
│  ├── Build Emscripten Module object                              │
│  │   ├── canvas: HTMLCanvasElement                               │
│  │   ├── uno_scripts: [zeta.js, office_thread.js]                │
│  │   ├── locateFile(): resolve WASM asset URLs                   │
│  │   ├── mainScriptUrlOrBlob: Blob('importScripts(soffice.js)') │
│  │   └── preRun: [inject fonts into virtual FS]                  │
│  ├── Attach browser zoom workaround                              │
│  ├── Set window.Module global (Emscripten requirement)           │
│  ├── Load soffice.js via <script> tag                            │
│  ├── Await Module.uno_main → MessagePort                         │
│  └── Wire port.onmessage → callbacks                             │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│            WASM WORKER THREAD (office_thread.js)                 │
│                                                                  │
│  Runs inside Emscripten Web Worker (em-pthread)                  │
│  ├── Initialize zetajs + UNO component context                   │
│  ├── Hide native LibreOffice toolbars/menubar/sidebar            │
│  ├── Load default blank Writer document                          │
│  ├── Set fullscreen mode                                         │
│  ├── Register 26 status listeners for UNO commands               │
│  ├── Enumerate and send font list                                │
│  ├── Handle incoming commands:                                   │
│  │   ├── dispatch  → execute UNO command                         │
│  │   └── loadDocument → close current, open new file             │
│  └── Post status changes back to main thread                     │
└──────────────────────────────────────────────────────────────────┘
```

### How Consumers Call the Component

```
Consumer App                    LibreOfficeEditor                  Worker Thread
     │                                │                                │
     │  new LibreOfficeEditor(opts)   │                                │
     │──────────────────────────────► │                                │
     │                                │  createEditorDOM()             │
     │                                │  ToolbarRenderer.render()      │
     │                                │  MenuRenderer.render()         │
     │                                │  bootstrapSoffice()            │
     │                                │───────────────────────────────►│
     │                                │   Load soffice.js              │
     │                                │   Init WASM, start worker      │
     │                                │   Worker: demo() ──────────── │
     │                                │   Hide native UI               │
     │                                │   Register status listeners    │
     │                                │◄── {cmd:'ui_ready'} ─────────│
     │  ◄── emit('ready') ───────── │                                │
     │                                │                                │
     │  dispatchCommand('.uno:Bold')  │                                │
     │──────────────────────────────► │                                │
     │                                │──{cmd:'dispatch',              │
     │                                │   command:'.uno:Bold'}────────►│
     │                                │                                │  disp.dispatch(urlObj,[])
     │                                │◄── {cmd:'stateChanged',       │
     │                                │     command:'.uno:Bold',       │
     │                                │     value:true} ──────────── │
     │  ◄── emit('state-changed') ─ │                                │
     │                                │                                │
     │  loadDocument(file)            │                                │
     │──────────────────────────────► │                                │
     │                                │  FS.writeFile('/tmp/input.docx')
     │                                │──{cmd:'loadDocument',          │
     │                                │   fileName:'/tmp/input.docx'}─►│
     │                                │                                │  desktop.loadComponentFromURL()
     │                                │◄── {cmd:'doc_loaded'} ───────│
     │  ◄── emit('document-loaded')  │                                │
     │                                │                                │
     │  destroy()                     │                                │
     │──────────────────────────────► │                                │
     │                                │  ToolbarRenderer.destroy()     │
     │                                │  MenuRenderer.destroy()        │
     │                                │  Remove DOM subtree            │
     │  ◄── emit('destroyed') ────── │  Release singleton             │
     │                                │                                │
```

### Toolbar State Synchronization Flow

```
 LibreOffice UNO (in Worker)          office_thread.js           Main Thread
         │                                  │                        │
         │  statusChanged(state) callback   │                        │
         │─────────────────────────────────►│                        │
         │                                  │  Extract value:        │
         │                                  │  - bool → raw          │
         │                                  │  - struct → .Name      │
         │                                  │    or .Height           │
         │                                  │  - null → ''           │
         │                                  │                        │
         │                                  │  postMessage({         │
         │                                  │    cmd:'stateChanged', │
         │                                  │    command, value,     │
         │                                  │    enabled })          │
         │                                  │───────────────────────►│
         │                                  │                        │
         │                                  │          ToolbarRenderer.handleStateChanged()
         │                                  │          ├── Toggle button .selected class
         │                                  │          ├── Update select value
         │                                  │          └── Enable/disable button
         │                                  │                        │
         │                                  │          EventEmitter.emit('state-changed')
         │                                  │          └── Consumer callback invoked
```

---

## WASM Integration Runtime Model

### Source of the Prebuilt WASM Artifact

The WASM binary is produced by [ZetaOffice](https://www.zetaoffice.net/), a project that compiles LibreOffice to WebAssembly using Emscripten. This repository downloads the prebuilt artifacts from:

```
https://cdn.zetaoffice.net/zetaoffice_latest/
```

Four files are downloaded:

| File | Purpose | Approx. Size |
|------|---------|-------------|
| `soffice.js` | Emscripten glue code: memory init, syscall shims, thread management | 838 KB |
| `soffice.wasm` | Main WebAssembly binary (MVP v1) containing compiled LibreOffice | 154 MB |
| `soffice.data` | Virtual filesystem: fonts, libraries, config, templates | 95 MB |
| `soffice.data.js.metadata` | Metadata for lazy data loading | 210 KB |

The CDN serves `soffice.wasm` and `soffice.data` with Brotli compression. The download script detects this and decompresses using the `brotli` CLI tool.

### Asset Loading Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│  1. bootstrap.ts: build Module object                            │
│     Module = {                                                   │
│       canvas: <HTMLCanvasElement id="qtcanvas">,                 │
│       uno_scripts: ['./assets/vendor/zetajs/zeta.js',            │
│                     './office_thread.js'],                        │
│       locateFile: (path) => wasmBasePath + path,                 │
│       mainScriptUrlOrBlob: Blob("importScripts('soffice.js')"), │
│       preRun: [() => FS.writeFile(font_path, font_data)]        │
│     }                                                            │
│                                                                  │
│  2. Set window.Module = Module (Emscripten global requirement)   │
│                                                                  │
│  3. Create <script src="wasm/soffice.js"> and append to <body>  │
│                                                                  │
│  4. soffice.js reads Module, resolves WASM file paths via        │
│     locateFile(), fetches soffice.wasm + soffice.data            │
│                                                                  │
│  5. soffice.js creates SharedArrayBuffer, spawns Web Workers     │
│     using mainScriptUrlOrBlob as worker entry point              │
│                                                                  │
│  6. Worker loads uno_scripts (zeta.js, office_thread.js)         │
│                                                                  │
│  7. Module.zetajs promise resolves → office_thread.js calls      │
│     demo() to initialize LibreOffice UNO environment             │
│                                                                  │
│  8. Worker posts {cmd:'ui_ready'} → main thread                  │
│                                                                  │
│  9. Module.uno_main promise resolves → MessagePort returned      │
└──────────────────────────────────────────────────────────────────┘
```

### Initialization Lifecycle

```
     Time ──────────────────────────────────────────────────────►

     ┌──────────┐
     │ new      │  Synchronous: resolve options, create DOM,
     │ Editor() │  render toolbar/menu, wire file input
     └────┬─────┘
          │
          ▼
     ┌──────────────────────┐
     │ Pre-fetch custom     │  Async: fetch font URLs if CustomFont[].url
     │ fonts (if any)       │  provided, or wrap .data ArrayBuffers
     └────┬─────────────────┘
          │
          ▼
     ┌──────────────────────┐
     │ Build Module object  │  Set canvas, uno_scripts, locateFile,
     │ + set window.Module  │  mainScriptUrlOrBlob, preRun (font inject)
     └────┬─────────────────┘
          │
          ▼
     ┌──────────────────────┐
     │ Append <script>      │  soffice.js loads, reads Module,
     │ soffice.js           │  begins fetching soffice.wasm + .data
     └────┬─────────────────┘
          │ (network: 154 MB + 95 MB)
          ▼
     ┌──────────────────────┐
     │ WASM instantiation   │  Emscripten compiles WASM, initializes
     │ + Worker spawn       │  memory (SharedArrayBuffer), spawns workers
     └────┬─────────────────┘
          │
          ▼
     ┌──────────────────────┐
     │ Worker: demo()       │  zetajs bridge init, hide native UI,
     │                      │  open blank swriter, register listeners,
     │                      │  send font list
     └────┬─────────────────┘
          │
          ▼
     ┌──────────────────────┐
     │ {cmd:'ui_ready'}     │  Main thread: hide loading spinner,
     │ message received     │  show canvas, enable all toolbar buttons,
     │                      │  enable file input, emit 'ready' event
     └────┬─────────────────┘
          │
          ▼
     ┌──────────────────────┐
     │ READY STATE          │  editor.ready === true
     │                      │  Consumer can now call dispatchCommand(),
     │                      │  loadDocument(), etc.
     └──────────────────────┘

     ERROR PATH:
     ┌──────────────────────┐
     │ script.onerror OR    │  bootstrap promise rejects
     │ uno_main rejects     │  → emitter.emit('error', {...})
     └──────────────────────┘
```

### JS/TS Glue Layer and Bindings

The bridge between JavaScript and LibreOffice uses three layers:

1. **Emscripten runtime** (`soffice.js`) — provides `Module`, `FS` (virtual filesystem), `SharedArrayBuffer`, pthread Web Workers
2. **zetajs bridge** (`zeta.js`) — translates between JavaScript objects and LibreOffice's UNO type system. Provides `zetajs.uno.com.sun.star.*` namespace, `zetajs.unoObject()`, `zetajs.fromAny()`, `zetajs.Any()`
3. **office_thread.js** — application-level glue that uses zetajs to register command listeners, dispatch commands, enumerate fonts, and load documents

### Message Protocol (Main Thread ↔ Worker)

**Main → Worker:**

| Message | Fields | Purpose |
|---------|--------|---------|
| `dispatch` | `command: string` | Execute a UNO command (e.g., `.uno:Bold`) |
| `dispatch` | `command: string, value: string` | Execute with parameter (e.g., font name) |
| `loadDocument` | `fileName: string` | Load document from virtual filesystem path |

**Worker → Main:**

| Message | Fields | Purpose |
|---------|--------|---------|
| `ui_ready` | — | LibreOffice UI initialized, canvas ready |
| `doc_loaded` | — | Document finished loading |
| `stateChanged` | `command, value, enabled` | UNO command state changed |
| `fontList` | `fonts: string[]` | Available fonts enumerated |

### Memory Model and Data Marshaling

- **SharedArrayBuffer**: Required for multi-threaded WASM (Emscripten pthreads). The entire LibreOffice memory space is shared across workers.
- **Virtual Filesystem (`FS`)**: Emscripten provides an in-memory POSIX-like filesystem accessed via `window.FS`. Documents are written to `/tmp/input.{ext}` before loading. Custom fonts are written to `/instdir/share/fonts/truetype/`.
- **UNO Struct Marshaling**: Complex UNO types (e.g., `SvxFont`, `SvxFontHeight`) require specific `PropertyValue` arrays with correct member names and types. The `office_thread.js` handles this per-command.
- **Value extraction**: `zetajs.fromAny(state.State)` converts UNO `Any` values to JS types. Objects with `.Name` or `.Height` fields are extracted accordingly.

### Threading Model

```
┌─────────────────────┐     ┌──────────────────────┐
│    Main Thread       │     │  em-pthread Worker    │
│                      │     │  (highest memory)     │
│ - DOM manipulation   │     │                       │
│ - Event dispatch     │◄═══►│ - LibreOffice runtime │
│ - User interaction   │ MSG │ - UNO API access      │
│ - Canvas rendering   │ PORT│ - Document processing │
│ - Toolbar state      │     │ - Font enumeration    │
│                      │     │ - Status listeners    │
└─────────────────────┘     └──────────────────────┘
         ▲                           ▲
         │ SharedArrayBuffer         │
         └───────────────────────────┘

Additional em-pthread workers may be spawned by Emscripten
for internal LibreOffice parallelism.
```

### Error Propagation

| Error Source | Propagation Path | Consumer Visibility |
|-------------|-----------------|-------------------|
| Font fetch failure | `resolveFonts()` throws → `bootstrapSoffice()` rejects → `emit('error')` | `error` event |
| `soffice.js` load failure | `script.onerror` → promise rejects → `emit('error')` | `error` event |
| WASM instantiation failure | `Module.uno_main` rejects → `emit('error')` | `error` event |
| Font FS injection failure | Silently caught in `preRun` (non-fatal) | Silent |
| UNO command not available | `try/catch` in `registerOneListener` (non-fatal) | Silent |
| Unknown worker message | `console.warn` | Console only |
| `dispatchCommand` before ready | `if (!this.port) return` — silently dropped | Silent |
| `loadDocument` before ready | Throws `Error('Editor not ready')` | Thrown exception |

### Cleanup and Disposal

```javascript
editor.destroy();
```

1. Calls `ToolbarRenderer.destroy()` — clears toolbar DOM and Map references
2. Calls `MenuRenderer.destroy()` — removes document click listener, clears menu DOM
3. Removes `.lo-editor` DOM subtree from container
4. Emits `destroyed` event
5. Calls `emitter.removeAll()` — clears all event subscriptions
6. Sets `this.port = null` — drops MessagePort reference
7. Sets `LibreOfficeEditor.instance = null` — releases singleton lock

**Note:** The WASM runtime itself is **not** unloaded. WebAssembly modules loaded via `<script>` tags and SharedArrayBuffer workers cannot be cleanly disposed. After `destroy()`, the page should be reloaded for a fresh WASM instance.

---

## Public API / Usage

### Installation

```bash
npm install   # Installs zetajs, copies bridge files (postinstall)
npm run download-wasm   # Downloads ~250 MB WASM from ZetaOffice CDN
```

### Minimal Example

```html
<div id="editor" style="width: 100%; height: 100vh;"></div>
<script type="module">
  import { LibreOfficeEditor } from './src/index.ts';

  const editor = new LibreOfficeEditor({
    container: document.getElementById('editor'),
  });

  editor.on('ready', () => {
    console.log('Editor ready');
  });

  editor.on('error', ({ message, error }) => {
    console.error('Editor error:', message, error);
  });
</script>
```

### Advanced Example: Custom Fonts + Document Loading

```typescript
import { LibreOfficeEditor } from 'libreoffice-web';

const editor = new LibreOfficeEditor({
  container: document.getElementById('editor')!,
  documentName: 'Report.docx',
  showStatusbar: false,
  loadingText: 'Starting office suite...',
  customFonts: [
    { name: 'Brand Font', url: '/fonts/BrandFont-Regular.ttf' },
    { name: 'Code Font', data: myFontArrayBuffer },
  ],
});

editor.on('ready', () => {
  // Load a document from an ArrayBuffer
  editor.loadDocumentFromBuffer(docxBuffer, 'Report.docx');
});

editor.on('document-loaded', () => {
  console.log('Document rendered');
});

editor.on('state-changed', ({ command, value }) => {
  if (command === '.uno:Bold') {
    console.log('Bold is now:', value);
  }
});

// Programmatic formatting
editor.dispatchCommand('.uno:Bold');
editor.dispatchCommand('.uno:CharFontName', 'Arial');
editor.dispatchCommand('.uno:FontHeight', '14');

// Cleanup
editor.destroy();
```

### Constructor Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | `HTMLElement` | **required** | DOM element to render the editor into |
| `wasmBasePath` | `string` | `'./wasm/'` | Base URL for WASM files (soffice.js, .wasm, .data) |
| `zetajsBasePath` | `string` | `'./assets/vendor/zetajs/'` | Base URL for zetajs bridge files |
| `officeThreadPath` | `string` | `'./office_thread.js'` | Path to the Web Worker script |
| `toolbar` | `ToolbarGroup[]` | `writerToolbar` | Toolbar button configuration |
| `menus` | `MenuDefinition[]` | `writerMenus` | Menu bar configuration |
| `acceptedFileTypes` | `string` | `'.docx,.odt,.doc,.xlsx,.ods,.pptx,.odp'` | File input accept attribute |
| `documentName` | `string` | `'Untitled'` | Initial document name in title bar |
| `showToolbar` | `boolean` | `true` | Show formatting toolbar |
| `showMenubar` | `boolean` | `true` | Show menu bar |
| `showStatusbar` | `boolean` | `true` | Show status bar |
| `showFileOpen` | `boolean` | `true` | Show "Open" file button |
| `loadingText` | `string` | `'ZetaOffice is loading...'` | Loading spinner message |
| `customFonts` | `CustomFont[]` | `[]` | Fonts to inject before LibreOffice boots |

### Public Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `dispatchCommand` | `(command: string, value?: string) => void` | Send UNO command to LibreOffice |
| `loadDocument` | `(file: File) => Promise<void>` | Load document from File object |
| `loadDocumentFromBuffer` | `(buffer: ArrayBuffer, fileName: string) => void` | Load document from buffer |
| `on` | `(event, handler) => () => void` | Subscribe to event, returns unsubscribe function |
| `once` | `(event, handler) => () => void` | Subscribe once |
| `setDocumentName` | `(name: string) => void` | Update document title display |
| `setToolbarVisible` | `(visible: boolean) => void` | Show/hide toolbar |
| `setMenubarVisible` | `(visible: boolean) => void` | Show/hide menu bar |
| `setStatusbarVisible` | `(visible: boolean) => void` | Show/hide status bar |
| `focus` | `() => void` | Focus the editor canvas |
| `destroy` | `() => void` | Tear down editor, release singleton |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `ready` | `boolean` (getter) | Whether WASM is initialized and editor is interactive |
| `canvas` | `HTMLCanvasElement` (getter) | The rendering canvas element |

### Events

| Event | Payload | When |
|-------|---------|------|
| `ready` | `void` | WASM loaded, UI interactive |
| `state-changed` | `{ command: string, value: unknown, enabled: boolean }` | UNO command state changed |
| `font-list` | `{ fonts: string[] }` | Font list received from LibreOffice |
| `document-loaded` | `void` | Document finished loading |
| `destroyed` | `void` | Editor destroyed |
| `error` | `{ message: string, error?: Error }` | Error occurred |

### Exported Configurations

The default toolbar and menu configurations are exported for customization:

```typescript
import {
  writerToolbar,    // ToolbarGroup[] — 8 groups, 35+ items
  trackedCommands,  // string[] — UNO commands with status tracking
  writerMenus,      // MenuDefinition[] — 6 menus, 70+ items
} from 'libreoffice-web';
```

---

## Asset Packaging and Deployment

### Required Files in Production

```
your-app/
├── index.html                        # Your app
├── your-bundle.js                    # Bundled JS (includes LibreOfficeEditor)
│
├── wasm/                             # WASM runtime (must match wasmBasePath)
│   ├── soffice.js                    #   838 KB — Emscripten glue
│   ├── soffice.wasm                  #   154 MB — WASM binary
│   ├── soffice.data                  #   95 MB  — Virtual filesystem
│   └── soffice.data.js.metadata      #   210 KB — Data metadata
│
├── assets/vendor/zetajs/             # ZetaJS bridge (must match zetajsBasePath)
│   ├── zeta.js                       #   ~30 KB
│   └── zetaHelper.js                 #   ~20 KB
│
└── office_thread.js                  # Worker script (must match officeThreadPath)
```

### Path Configuration

All asset paths are configurable via constructor options. The paths are resolved relative to the page URL (not the script URL):

```typescript
new LibreOfficeEditor({
  container: el,
  wasmBasePath: '/static/wasm/',              // Must end with /
  zetajsBasePath: '/static/vendor/zetajs/',   // Must end with /
  officeThreadPath: '/static/office_thread.js',
});
```

### HTTP Header Requirements

SharedArrayBuffer requires cross-origin isolation. Your server **must** set these headers on every response:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these headers, the browser will refuse to allocate SharedArrayBuffer and WASM initialization will fail silently or throw.

### MIME Type Requirements

| File | Required MIME Type |
|------|--------------------|
| `soffice.wasm` | `application/wasm` |
| `soffice.js` | `application/javascript` or `text/javascript` |
| `soffice.data` | `application/octet-stream` |
| `office_thread.js` | `application/javascript` or `text/javascript` |
| `zeta.js` | `application/javascript` or `text/javascript` |

### CDN / Caching Recommendations

| File | Cache Strategy | Rationale |
|------|---------------|-----------|
| `soffice.wasm` | Immutable / long TTL | Binary rarely changes, 154 MB |
| `soffice.data` | Immutable / long TTL | Filesystem snapshot, 95 MB |
| `soffice.js` | Short TTL or versioned | Glue code may change between versions |
| `office_thread.js` | Short TTL or versioned | Application logic, changes with your code |

### Bundler Notes (Vite)

The Vite config includes a custom plugin for dev/preview COOP/COEP headers. For production, headers must be set by the hosting server (Nginx, Cloudflare, etc.).

Files in `public/` are served as-is by Vite and copied to `dist/` during build. They are **not** bundled or processed. The TypeScript source in `src/` is bundled normally.

SVG icons use Vite's `?raw` import — they are inlined into the JS bundle as strings, not served as separate files.

---

## Development Workflow

### Prerequisites

- **Node.js** >= 18
- **npm** (comes with Node.js)
- **brotli** CLI tool for WASM decompression: `brew install brotli` (macOS) or `apt install brotli` (Linux)
- **Chromium-based browser** (Chrome, Edge, Brave) for testing — Firefox support unverified

### Local Setup

```bash
# 1. Install dependencies (also copies zetajs to public/ via postinstall)
npm install

# 2. Download WASM artifacts from ZetaOffice CDN (~250 MB)
npm run download-wasm

# 3. Start dev server with COOP/COEP headers
npm run dev
# → http://127.0.0.1:5173/
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173, with COOP/COEP) |
| `npm run build` | TypeScript check + Vite production build → `dist/` |
| `npm run preview` | Serve `dist/` with COOP/COEP headers |
| `npm run download-wasm` | Download WASM from ZetaOffice CDN to `public/wasm/` |
| `npm install` | Install deps + copy zetajs to `public/assets/vendor/zetajs/` |

### TypeScript Configuration

- Target: ES2020
- Module: ESNext (for tree-shaking)
- Strict mode enabled
- `noEmit: true` (Vite handles transpilation)
- DOM + DOM.Iterable libs
- Vite client types included

### WASM Binary Build Pipeline

**The WASM compilation pipeline is entirely external to this repository.** The ZetaOffice project (separate repository and build system) compiles LibreOffice C++ to WebAssembly using Emscripten. This project only downloads and consumes the prebuilt artifacts.

---

## Testing Strategy

### Test Files

| File | Framework | Type | Headless |
|------|-----------|------|----------|
| `scripts/test-e2e.mjs` | Playwright | End-to-end | Yes |
| `scripts/test-browser.mjs` | Puppeteer | Integration | Yes |
| `scripts/test-headed.mjs` | (varies) | Visual | No |

### What the Tests Verify

1. **Page loads** — DOMContentLoaded fires successfully
2. **WASM initializes** — Loading indicator hidden, file input enabled (up to 120s timeout)
3. **Canvas renders** — Canvas visible, has non-zero dimensions
4. **Toolbar buttons enabled** — Bold, italic, underline, file input all enabled after init
5. **DOCX upload works** — File written to Emscripten FS, `loadDocument` message sent, canvas survives reload
6. **File input handler** — Programmatic file change event triggers document load

### Running Tests

```bash
# Requires dev server running: npm run dev

# Playwright tests (headless Chromium)
node scripts/test-e2e.mjs

# Puppeteer tests (headless Chromium)
node scripts/test-browser.mjs
```

### Test Limitations

- Headless Chromium lacks full WebGL support — Qt/WASM console warnings about `getParameter` and `ErrorEvent` are expected
- Tests verify JS logic flow (DOM state, event handling), not pixel-perfect rendering
- WASM initialization takes 30-90 seconds in test environments
- No unit tests for individual modules (toolbar-renderer, menu-renderer, etc.)
- No mocking strategy for the WASM runtime — tests require the full binary

### Verifying Correct Initialization

The most reliable signal is:
1. `editor.ready === true`
2. `editor.on('ready', callback)` fires
3. Canvas `visibility` changes from `hidden` to visible
4. File input `disabled` changes from `true` to `false`

---

## Performance Considerations

### Startup Cost

| Phase | Typical Duration | Bottleneck |
|-------|-----------------|------------|
| DOM + toolbar creation | < 10 ms | Synchronous, negligible |
| Custom font fetch | Varies | Network, depends on font size/count |
| WASM download (cold) | 10-60 seconds | Network: 250 MB total |
| WASM download (cached) | < 1 second | Disk cache read |
| WASM compilation | 5-15 seconds | CPU: browser compiles WASM |
| Worker initialization | 2-5 seconds | LibreOffice UNO bootstrap |
| **Total (cold start)** | **20-90 seconds** | **Network + CPU bound** |
| **Total (cached)** | **10-30 seconds** | **CPU bound** |

### Asset Loading Overhead

- **soffice.wasm** (154 MB) is the primary bottleneck. Use HTTP/2, CDN, and aggressive caching.
- **soffice.data** (95 MB) loads in parallel. May support lazy chunk loading via metadata.
- **SVG icons** are bundled inline (~47 KB raw, ~10 KB gzipped) — zero additional requests.

### Memory Usage

- SharedArrayBuffer allocation: LibreOffice WASM requests a large contiguous memory block (typically 256 MB - 1 GB)
- Virtual filesystem: the 95 MB `.data` file is loaded into WASM memory
- Document content: additional memory per document

### Practical Tips

- **Pre-cache WASM assets** via Service Worker for repeat visits
- **Show meaningful loading progress** during the 20-90 second cold start
- **Avoid creating multiple editors** — singleton pattern enforced, but even after `destroy()` the WASM module remains in memory
- **Custom fonts add startup latency** — each font must be fetched before WASM boots
- **Browser zoom workaround** adds 100ms debounced resize events — this is intentional to fix Qt/WASM rendering issues

---

## Security Considerations

### Trust Boundary

The WASM binary is downloaded from `https://cdn.zetaoffice.net/` over HTTPS. This is a third-party CDN. Consider:

- **Integrity**: The download script does not verify checksums or signatures. A compromised CDN could serve malicious WASM.
- **Version pinning**: The CDN URL uses `zetaoffice_latest/` — there is no version pinning. Updates are automatic and may introduce breaking changes.
- **Mitigation**: For production, consider hosting the WASM files on your own infrastructure and verifying integrity.

### Cross-Origin Isolation

COOP/COEP headers are **required** and fundamentally change the security model of the page:

- `Cross-Origin-Opener-Policy: same-origin` — prevents the page from being accessed by cross-origin popup windows
- `Cross-Origin-Embedder-Policy: require-corp` — requires all subresources to opt-in via CORS or CORP headers

This means:
- All resources loaded by the page (images, scripts, iframes) must support CORS or CORP
- Third-party scripts that don't set appropriate headers will fail to load
- OAuth popup flows may break due to COOP restrictions

### Document Processing

Documents are processed entirely client-side inside the WASM sandbox. Document data is written to an in-memory virtual filesystem (`/tmp/`) and never sent to a server (unless the consumer application explicitly does so).

### Input Validation

The wrapper layer performs minimal input validation:
- File extension is extracted for the virtual filesystem path
- UNO commands are passed through without sanitization (they go directly to LibreOffice's internal dispatch)
- `innerHTML` is used in menu-renderer.ts for label rendering — menu labels come from the static `menu-config.ts`, not user input

---

## Compatibility Matrix

### Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome / Edge (Chromium) | Tested | Primary development target |
| Firefox | Unknown | SharedArrayBuffer support exists; untested |
| Safari | Unknown | SharedArrayBuffer available since Safari 15.2; untested |
| Mobile Chrome (Android) | Unknown | Memory constraints likely problematic (250 MB+ needed) |
| Mobile Safari (iOS) | Unknown | WebAssembly memory limits may be restrictive |

### Runtime Requirements

| Requirement | Reason |
|-------------|--------|
| SharedArrayBuffer | Multi-threaded WASM (Emscripten pthreads) |
| COOP/COEP headers | Required for SharedArrayBuffer |
| WebAssembly MVP | Core WASM support |
| Web Workers | Emscripten threading model |
| WebGL | Qt/WASM canvas rendering |
| ES2020 | Build target |

### Known Unsupported Scenarios

- **Node.js**: This is a browser-only component (requires DOM, Canvas, Web Workers)
- **Electron**: Should work but untested; COOP/COEP header configuration differs
- **Web Workers**: The component itself must run on the main thread (needs DOM access)
- **Server-side rendering**: Not applicable (requires browser APIs)
- **Multiple instances**: Only one `LibreOfficeEditor` per page (WASM singleton constraint)

---

## Troubleshooting

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Blank page, no loading spinner | `container` element not found or has zero height | Ensure container has explicit height (e.g., `height: 100vh`) |
| Loading spinner spins forever | WASM files not found (404) | Run `npm run download-wasm`, verify `wasmBasePath` points to correct location |
| Console: `SharedArrayBuffer is not defined` | Missing COOP/COEP headers | Configure server to send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` |
| Console: `Failed to load soffice.js` | Wrong `wasmBasePath` or file not served | Check network tab, verify path and MIME type |
| Console: `Only one LibreOfficeEditor instance` | Singleton violation | Call `destroy()` on existing instance before creating a new one |
| Toolbar buttons stay disabled | WASM not fully initialized yet | Wait for `ready` event before interacting |
| `dispatchCommand()` silently does nothing | Called before `ready` | Check `editor.ready` or wait for `ready` event |
| `loadDocument()` throws | Called before `ready` | Throws `Error('Editor not ready')` — wait for initialization |
| Document loads but canvas goes blank | WebGL context lost | May occur in headless browsers; in normal browsers, try page reload |
| Font dropdown is empty | Font list not received yet | Wait for `font-list` event |
| Custom fonts not appearing | Font injection failed silently | Verify font URL accessibility, check for CORS issues on font files |
| Browser zoom causes rendering glitch | Known Qt/WASM issue | The built-in zoom workaround fires resize events with 100ms delay; if still broken, try fixed zoom |
| Console noise: `QObject`, `QRect`, `__syscall` | Normal Qt/WASM debug output | Can be safely ignored |

### Debug Tips

1. **Access editor in console**: The demo app exposes `window.editor` for debugging
2. **Switch to worker in DevTools**: The LibreOffice worker is the `em-pthread` with the highest memory usage. Switch to it to debug `office_thread.js`
3. **Check `editor.ready`**: Quick way to verify initialization state
4. **Monitor events**: `editor.on('state-changed', console.log)` to see all UNO state changes
5. **Network tab**: Verify all 4 WASM files load successfully with correct MIME types
6. **Response headers**: Verify COOP/COEP headers on the main page response

---

## Known Limitations

### Technical Constraints

- **Singleton only**: One LibreOfficeEditor per page. The Emscripten WASM module uses globals (`window.Module`, `window.FS`) that cannot be scoped.
- **No clean WASM unload**: `destroy()` cleans up DOM and JS references but the WASM module and Web Workers remain in memory. Reload the page for a fresh instance.
- **250 MB download**: Cold start requires downloading ~250 MB of assets. No incremental or streaming loading.
- **Canvas ID requirement**: The canvas element **must** have `id="qtcanvas"` — this is hard-coded in the Emscripten build.
- **Writer-only toolbar**: The default toolbar and menu configuration targets Writer (word processing). Calc and Impress documents can be opened but the toolbar doesn't adapt.

### Runtime Constraints

- **No save-to-disk**: LibreOffice's Save/SaveAs dialogs open inside the WASM canvas, but actual file system writes go to the virtual FS. Extracting the saved file requires additional integration (not yet implemented).
- **No collaborative editing**: This is a single-user, single-document editor. No real-time collaboration support.
- **No print-to-PDF**: The Print command opens a dialog inside LibreOffice, but actual printing is limited by browser capabilities.
- **Clipboard limitations**: Copy/paste uses LibreOffice's internal clipboard. System clipboard integration is limited by browser security policies.

### External WASM Limitations

- **No version pinning**: Downloads from `zetaoffice_latest/` — no way to lock a specific version
- **No integrity verification**: Download script does not check checksums
- **Emscripten pthreads**: Requires SharedArrayBuffer, which requires COOP/COEP headers, which affects the entire page security model
- **Memory usage**: LibreOffice WASM may consume 500 MB - 1 GB of memory for complex documents

---

## Versioning and Upgrade Notes

### Current Version

`0.1.0` (pre-release, private package)

### Compatibility Between Wrapper and WASM

There is no formal versioning contract between this integration layer and the ZetaOffice WASM binary. The `zetajs` npm package (`^1.2.0`) provides the bridge API, and `office_thread.js` depends on specific zetajs APIs (`zetajs.mainPort`, `zetajs.unoObject`, `zetajs.fromAny`, `zetajs.Any`).

### Upgrade Checklist

When updating ZetaOffice WASM (re-running `npm run download-wasm`):

1. Delete `public/wasm/` to force fresh download
2. Run `npm run download-wasm`
3. Test that `ready` event fires
4. Test that toolbar state sync works (bold/italic toggle)
5. Test that document loading works
6. Check for new console warnings or errors

When updating the `zetajs` npm package:

1. `npm update zetajs`
2. Verify `public/assets/vendor/zetajs/` was refreshed (postinstall script)
3. Check for breaking changes in zetajs API
4. Run e2e tests

---

## Contributing

### In Scope

- Integration layer code (TypeScript source in `src/`)
- Toolbar and menu configuration
- Styling and theming
- Test scripts
- Documentation
- Build and deployment tooling

### Out of Scope

- LibreOffice-to-WASM compilation (ZetaOffice project)
- zetajs bridge library internals (zetajs npm package)
- Emscripten runtime behavior

### Development Guidelines

- TypeScript strict mode — no `any` leaks at public API boundary
- CSS scoped under `.lo-editor` — no global selectors
- Zero runtime dependencies beyond zetajs
- SVG icons imported via Vite `?raw` — no icon font or CDN dependency
- All public API types exported from `src/index.ts`

### Testing Expectations

- Run e2e tests before submitting changes: `node scripts/test-e2e.mjs`
- Dev server must be running for tests: `npm run dev`
- TypeScript must compile clean: `npx tsc --noEmit`

---

## License

This repository does not include a LICENSE file. The licensing status is currently unspecified.

### Third-Party Licensing

| Component | License | Source |
|-----------|---------|--------|
| ZetaOffice WASM binary | MPL 2.0 (LibreOffice) | cdn.zetaoffice.net |
| zetajs bridge | MIT | npm: zetajs |
| office_thread.js | MIT (SPDX header) | This repo |
| Vite | MIT | npm: vite |
| TypeScript | Apache 2.0 | npm: typescript |

---

## Appendix

### Glossary

| Term | Definition |
|------|-----------|
| **UNO** | Universal Network Objects — LibreOffice's component model and API |
| **UNO command** | A `.uno:CommandName` string that triggers a LibreOffice action |
| **zetajs** | JavaScript bridge that translates between JS objects and UNO types |
| **ZetaOffice** | Project that compiles LibreOffice to WebAssembly |
| **Emscripten** | C/C++ to WebAssembly compiler used by ZetaOffice |
| **COOP** | Cross-Origin-Opener-Policy HTTP header |
| **COEP** | Cross-Origin-Embedder-Policy HTTP header |
| **SharedArrayBuffer** | Shared memory primitive required for multi-threaded WASM |
| **em-pthread** | Emscripten's Web Worker-based pthread implementation |
| **Virtual FS** | Emscripten's in-memory POSIX filesystem (`window.FS`) |
| **MessagePort** | Web API for bidirectional message passing between threads |

### Architecture Decisions

1. **Singleton pattern**: Chosen because Emscripten sets globals (`window.Module`, `window.FS`) that conflict if multiple instances exist. Enforced with static `instance` field and constructor check.

2. **Programmatic DOM (no templates)**: All UI is created via `document.createElement()` in `dom.ts`. This avoids HTML template dependencies and ensures the component works in any environment.

3. **Zero-dependency event emitter**: A 50-line typed emitter avoids pulling in EventEmitter3, mitt, or similar libraries. The API returns unsubscribe functions (functional pattern).

4. **Inline SVG icons**: Vite's `?raw` import bundles icons as strings (~47 KB raw, ~10 KB gzipped). This eliminates icon font loading delays and ensures icons are available immediately.

5. **Delegated dispatch pattern**: The `LibreOfficeEditor` class owns the `MessagePort` but delegates UI concerns to renderers. Renderers receive a `onDispatch` callback, keeping command routing centralized.

6. **CSS custom properties**: All colors and sizes use CSS variables scoped to `.lo-editor`. This enables theming without modifying source code.

7. **Worker message protocol**: Simple `{cmd, ...payload}` JSON objects over MessagePort. No binary protocol or protobuf — adequate for the command/state volume.

### Key File Quick Reference

| File | Lines | Purpose |
|------|-------|---------|
| `src/LibreOfficeEditor.ts` | 286 | Main component class, singleton, lifecycle |
| `src/bootstrap.ts` | 187 | WASM loading, Module setup, font injection |
| `src/dom.ts` | 160 | Programmatic UI DOM construction |
| `src/toolbar-config.ts` | 136 | 8 toolbar groups, 35+ items, tracked commands |
| `src/toolbar-renderer.ts` | 157 | Toolbar DOM, state sync, font list |
| `src/menu-config.ts` | 208 | 6 menus, 70+ items with submenus |
| `src/menu-renderer.ts` | 131 | Menu dropdowns, keyboard shortcuts |
| `src/event-emitter.ts` | 53 | Typed event emitter (on/once/off/emit) |
| `src/icons.ts` | 85 | 39 SVG icons as inline strings |
| `src/types.ts` | 68 | Public API types (EditorOptions, EditorEventMap) |
| `src/style.css` | 385 | Scoped Collabora Online-style CSS |
| `public/office_thread.js` | 215 | Worker: UNO commands, listeners, fonts |
| `scripts/download-wasm.mjs` | 123 | CDN download with brotli decompression |
