// Renders the menubar and handles dropdown menus.

import type { MenuItem, MenuDefinition } from './menu-config';

export class MenuRenderer {
  private activeMenu: HTMLElement | null = null;
  private documentClickHandler: (e: Event) => void;

  constructor(
    private menuEl: HTMLUListElement,
    private canvasEl: HTMLCanvasElement,
    private menus: MenuDefinition[],
    private onDispatch: (command: string) => void,
  ) {
    this.documentClickHandler = () => this.closeAll();
  }

  render(): void {
    this.menuEl.innerHTML = '';

    for (const menu of this.menus) {
      const li = document.createElement('li');
      li.className = 'lo-menu-item';

      const a = document.createElement('a');
      a.href = '#';
      a.textContent = menu.label;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle(li, menu);
      });
      a.addEventListener('mouseenter', () => {
        if (this.activeMenu && this.activeMenu !== li) {
          this.closeAll();
          this.open(li, menu);
        }
      });
      li.appendChild(a);
      this.menuEl.appendChild(li);
    }

    document.addEventListener('click', this.documentClickHandler);
  }

  destroy(): void {
    document.removeEventListener('click', this.documentClickHandler);
    this.menuEl.innerHTML = '';
    this.activeMenu = null;
  }

  // --- Private helpers ---

  private toggle(li: HTMLElement, menu: MenuDefinition): void {
    if (li.classList.contains('open')) {
      this.closeAll();
    } else {
      this.closeAll();
      this.open(li, menu);
    }
  }

  private open(li: HTMLElement, menu: MenuDefinition): void {
    const dropdown = this.buildDropdown(menu.items);
    li.appendChild(dropdown);
    li.classList.add('open');
    this.activeMenu = li;
  }

  private closeAll(): void {
    const openItems = this.menuEl.querySelectorAll('.lo-menu-item.open');
    for (const item of openItems) {
      const dropdown = item.querySelector('.lo-menu-dropdown');
      if (dropdown) dropdown.remove();
      item.classList.remove('open');
    }
    this.activeMenu = null;
  }

  private buildDropdown(items: MenuItem[]): HTMLElement {
    const ul = document.createElement('ul');
    ul.className = 'lo-menu-dropdown';

    for (const item of items) {
      if (item.type === 'separator') {
        const sep = document.createElement('li');
        sep.className = 'lo-menu-separator';
        ul.appendChild(sep);
        continue;
      }

      const li = document.createElement('li');
      li.className = 'lo-menu-entry';

      if (item.children) {
        li.classList.add('has-submenu');
        const a = document.createElement('a');
        a.href = '#';
        a.innerHTML = `<span class="lo-menu-label">${item.label}</span><span class="lo-menu-arrow">&#9656;</span>`;
        a.addEventListener('click', (e) => e.preventDefault());
        li.appendChild(a);

        const submenu = this.buildDropdown(item.children);
        submenu.classList.add('lo-submenu');
        li.appendChild(submenu);
      } else {
        const a = document.createElement('a');
        a.href = '#';
        let html = `<span class="lo-menu-label">${item.label}</span>`;
        if (item.shortcut) {
          html += `<span class="lo-menu-shortcut">${item.shortcut}</span>`;
        }
        a.innerHTML = html;
        a.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (item.command) {
            this.onDispatch(item.command);
            this.canvasEl.focus();
          }
          this.closeAll();
        });
        li.appendChild(a);
      }

      ul.appendChild(li);
    }

    return ul;
  }
}
