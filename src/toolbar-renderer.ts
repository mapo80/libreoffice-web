// Renders the formatting toolbar and manages button/select state.

import type { ToolbarGroup, ToolbarItem } from './toolbar-config';
import { ICONS } from './icons';

export class ToolbarRenderer {
  private buttons = new Map<string, HTMLButtonElement>();
  private selects = new Map<string, HTMLSelectElement>();

  constructor(
    private containerEl: HTMLDivElement,
    private canvasEl: HTMLCanvasElement,
    private groups: ToolbarGroup[],
    private onDispatch: (command: string, value?: string) => void,
  ) {}

  render(): void {
    for (const group of this.groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'lo-toolbar-group';
      groupEl.dataset.group = group.id;

      for (const item of group.items) {
        if (item.type === 'separator') continue;

        if (item.type === 'select') {
          groupEl.appendChild(this.createSelect(item));
        } else {
          groupEl.appendChild(this.createButton(item));
        }
      }

      this.containerEl.appendChild(groupEl);
    }
  }

  handleStateChanged(command: string, value: unknown, enabled: boolean): void {
    const btn = this.buttons.get(command);
    if (btn) {
      btn.disabled = !enabled;
      if (typeof value === 'boolean' || value === 'true' || value === 'false') {
        btn.classList.toggle('selected', value === true || value === 'true');
      }
    }

    const select = this.selects.get(command);
    if (select) {
      select.disabled = !enabled;
      if (value != null && value !== '') {
        const strValue = String(value);
        if (command === '.uno:FontHeight') {
          const num = parseFloat(strValue);
          if (!isNaN(num)) select.value = String(num);
        } else {
          select.value = strValue;
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

  updateFontList(fonts: string[]): void {
    const select = this.selects.get('.uno:CharFontName');
    if (select && fonts.length > 0) {
      select.innerHTML = '';
      for (const font of fonts) {
        const option = document.createElement('option');
        option.value = font;
        option.textContent = font;
        select.appendChild(option);
      }
    }
  }

  enableAll(): void {
    for (const btn of this.buttons.values()) btn.disabled = false;
    for (const sel of this.selects.values()) sel.disabled = false;
  }

  destroy(): void {
    this.containerEl.innerHTML = '';
    this.buttons.clear();
    this.selects.clear();
  }

  // --- Private helpers ---

  private createButton(item: ToolbarItem): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'lo-toolbar-btn';
    btn.title = item.label || '';
    btn.disabled = true;
    btn.setAttribute('aria-label', item.label || '');

    if (item.icon) {
      const svgString = ICONS[item.icon];
      if (svgString) {
        const wrapper = document.createElement('span');
        wrapper.className = 'lo-toolbar-icon';
        wrapper.innerHTML = svgString;
        btn.appendChild(wrapper);
      }
    }

    if (item.command) {
      btn.dataset.command = item.command;
      btn.addEventListener('click', () => {
        this.onDispatch(item.command!);
        this.canvasEl.focus();
      });
    }

    this.buttons.set(item.command || item.id, btn);
    return btn;
  }

  private createSelect(item: ToolbarItem): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = `lo-toolbar-select ${item.id === 'font-name' ? 'lo-font-name' : 'lo-font-size'}`;
    select.title = item.label || '';
    select.disabled = true;

    if (item.options && item.options.length > 0) {
      for (const opt of item.options) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      }
      if (item.command === '.uno:FontHeight') select.value = '12';
    } else {
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
        this.onDispatch(item.command!, select.value);
        this.canvasEl.focus();
      });
    }

    this.selects.set(item.command || item.id, select);
    return select;
  }
}
