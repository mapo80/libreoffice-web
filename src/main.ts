import './style.css';
import { writerToolbar, type ToolbarItem } from './toolbar-config';
import { writerMenus, type MenuItem, type MenuDefinition } from './menu-config';

// --- DOM references ---
const toolbarUp = document.getElementById('toolbar-up')!;
const mainMenu = document.getElementById('main-menu')!;
const canvas = document.getElementById('qtcanvas') as HTMLCanvasElement;
const loadingInfo = document.getElementById('loadingInfo')!;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const documentName = document.getElementById('document-name')!;

// Track toolbar button elements for state updates
const toolbarButtons = new Map<string, HTMLButtonElement>();
const toolbarSelects = new Map<string, HTMLSelectElement>();

// --- Build toolbar DOM from config ---
function renderToolbar(): void {
  for (const group of writerToolbar) {
    const groupEl = document.createElement('div');
    groupEl.className = 'toolbar-group';
    groupEl.dataset.group = group.id;

    for (const item of group.items) {
      if (item.type === 'separator') {
        continue;
      }

      if (item.type === 'select') {
        const select = createSelect(item);
        groupEl.appendChild(select);
      } else {
        const btn = createButton(item);
        groupEl.appendChild(btn);
      }
    }

    toolbarUp.appendChild(groupEl);
  }
}

function createButton(item: ToolbarItem): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'toolbar-btn';
  btn.id = `tb-${item.id}`;
  btn.title = item.label || '';
  btn.disabled = true;
  btn.setAttribute('aria-label', item.label || '');

  if (item.icon) {
    const img = document.createElement('img');
    img.src = item.icon;
    img.alt = item.label || '';
    img.draggable = false;
    btn.appendChild(img);
  }

  if (item.command) {
    btn.dataset.command = item.command;
    btn.addEventListener('click', () => {
      dispatchCommand(item.command!);
      canvas.focus();
    });
  }

  toolbarButtons.set(item.command || item.id, btn);
  return btn;
}

function createSelect(item: ToolbarItem): HTMLSelectElement {
  const select = document.createElement('select');
  select.className = `toolbar-select ${item.id === 'font-name' ? 'font-name' : 'font-size'}`;
  select.id = `tb-${item.id}`;
  select.title = item.label || '';
  select.disabled = true;

  if (item.options && item.options.length > 0) {
    for (const opt of item.options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    }
    // Default to a reasonable value
    if (item.command === '.uno:FontHeight') {
      select.value = '12';
    }
  } else {
    // Placeholder option for empty selects (e.g., font name before fonts load)
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = item.label || '';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
  }

  if (item.command) {
    select.dataset.command = item.command;
    select.addEventListener('change', () => {
      dispatchCommand(item.command!, select.value);
      canvas.focus();
    });
  }

  toolbarSelects.set(item.command || item.id, select);
  return select;
}

// --- Communication with zetajs worker ---
let port: MessagePort | null = null;

function dispatchCommand(command: string, value?: string): void {
  if (!port) return;
  if (value !== undefined) {
    port.postMessage({ cmd: 'dispatch', command, value });
  } else {
    port.postMessage({ cmd: 'dispatch', command });
  }
}

// --- State updates from worker ---
function handleStateChanged(command: string, value: unknown, enabled: boolean): void {
  // Toggle buttons
  const btn = toolbarButtons.get(command);
  if (btn) {
    btn.disabled = !enabled;
    if (typeof value === 'boolean' || value === 'true' || value === 'false') {
      btn.classList.toggle('selected', value === true || value === 'true');
    }
  }

  // Select controls
  const select = toolbarSelects.get(command);
  if (select) {
    select.disabled = !enabled;
    if (value != null && value !== '') {
      const strValue = String(value);
      // For font height, the value may come as "12 pt" — extract number
      if (command === '.uno:FontHeight') {
        const num = parseFloat(strValue);
        if (!isNaN(num)) {
          select.value = String(num);
        }
      } else {
        select.value = strValue;
        // If font not in list, add it
        if (command === '.uno:CharFontName' && select.value !== strValue) {
          const option = document.createElement('option');
          option.value = strValue;
          option.textContent = strValue;
          select.appendChild(option);
          select.value = strValue;
        }
      }
    }
  }
}

function enableAllControls(): void {
  for (const btn of toolbarButtons.values()) {
    btn.disabled = false;
  }
  for (const sel of toolbarSelects.values()) {
    sel.disabled = false;
  }
  fileInput.disabled = false;
}

// --- File upload ---
function setupFileUpload(): void {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file || !port) return;

    const name = file.name;
    documentName.textContent = name;

    let filePath = '/tmp/input';
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex > 0) {
      filePath += name.substring(dotIndex);
    }

    file.arrayBuffer().then((data) => {
      (window as unknown as { FS: EmscriptenFS }).FS.writeFile(filePath, new Uint8Array(data));
      port!.postMessage({ cmd: 'loadDocument', fileName: filePath });
    });

    fileInput.value = '';
  });
}

// --- Menu rendering ---
let activeMenu: HTMLElement | null = null;

function renderMenubar(): void {
  mainMenu.innerHTML = '';
  for (const menu of writerMenus) {
    const li = document.createElement('li');
    li.className = 'menu-item';
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = menu.label;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu(li, menu);
    });
    a.addEventListener('mouseenter', () => {
      if (activeMenu && activeMenu !== li) {
        closeAllMenus();
        openMenu(li, menu);
      }
    });
    li.appendChild(a);
    mainMenu.appendChild(li);
  }

  document.addEventListener('click', () => closeAllMenus());
}

function toggleMenu(li: HTMLElement, menu: MenuDefinition): void {
  if (li.classList.contains('open')) {
    closeAllMenus();
  } else {
    closeAllMenus();
    openMenu(li, menu);
  }
}

function openMenu(li: HTMLElement, menu: MenuDefinition): void {
  const dropdown = buildDropdown(menu.items);
  li.appendChild(dropdown);
  li.classList.add('open');
  activeMenu = li;
}

function closeAllMenus(): void {
  const openItems = mainMenu.querySelectorAll('.menu-item.open');
  for (const item of openItems) {
    const dropdown = item.querySelector('.menu-dropdown');
    if (dropdown) dropdown.remove();
    item.classList.remove('open');
  }
  activeMenu = null;
}

function buildDropdown(items: MenuItem[]): HTMLElement {
  const ul = document.createElement('ul');
  ul.className = 'menu-dropdown';

  for (const item of items) {
    if (item.type === 'separator') {
      const sep = document.createElement('li');
      sep.className = 'menu-separator';
      ul.appendChild(sep);
      continue;
    }

    const li = document.createElement('li');
    li.className = 'menu-entry';

    if (item.children) {
      li.classList.add('has-submenu');
      const a = document.createElement('a');
      a.href = '#';
      a.innerHTML = `<span class="menu-label">${item.label}</span><span class="menu-arrow">&#9656;</span>`;
      a.addEventListener('click', (e) => e.preventDefault());
      li.appendChild(a);

      const submenu = buildDropdown(item.children);
      submenu.className = 'menu-dropdown submenu';
      li.appendChild(submenu);
    } else {
      const a = document.createElement('a');
      a.href = '#';
      let html = `<span class="menu-label">${item.label}</span>`;
      if (item.shortcut) {
        html += `<span class="menu-shortcut">${item.shortcut}</span>`;
      }
      a.innerHTML = html;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (item.command) {
          dispatchCommand(item.command);
          canvas.focus();
        }
        closeAllMenus();
      });
      li.appendChild(a);
    }

    ul.appendChild(li);
  }

  return ul;
}

// --- Bootstrap ---
function init(): void {
  renderMenubar();
  renderToolbar();
  setupFileUpload();

  // Listen for state changes from soffice-bootstrap.js
  window.addEventListener('uno-state-changed', ((e: CustomEvent) => {
    const { command, value, enabled } = e.detail;
    handleStateChanged(command, value, enabled);
  }) as EventListener);

  // Listen for font list updates
  window.addEventListener('uno-font-list', ((e: CustomEvent) => {
    const fonts: string[] = e.detail.fonts;
    const select = toolbarSelects.get('.uno:CharFontName');
    if (select && fonts.length > 0) {
      select.innerHTML = '';
      for (const font of fonts) {
        const option = document.createElement('option');
        option.value = font;
        option.textContent = font;
        select.appendChild(option);
      }
    }
  }) as EventListener);

  // Store port reference when soffice-bootstrap.js signals ready
  window.addEventListener('soffice-port-ready', ((e: CustomEvent) => {
    port = e.detail.port;
  }) as EventListener);

  // Load the ZetaOffice bootstrap script
  const bootstrapScript = document.createElement('script');
  bootstrapScript.type = 'module';
  bootstrapScript.src = './soffice-bootstrap.js';
  document.body.appendChild(bootstrapScript);
}

// Listen for ui_ready to enable everything
window.addEventListener('uno-ui-ready', () => {
  loadingInfo.style.display = 'none';
  canvas.style.visibility = '';
  enableAllControls();
});

init();
