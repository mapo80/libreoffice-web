// Template toolbar — provides buttons for inserting DocumentAssembler template tags.
// Renders a second toolbar row with 5 buttons: Content, Table, Repeat, If, Signature.

import { TemplateDialog, type DialogField } from './template-dialog';

export class TemplateToolbar {
  private containerEl: HTMLDivElement;
  private onInsert: (text: string) => void;
  private onInsertBlock: (lines: string[]) => void;
  private buttons: HTMLButtonElement[] = [];

  constructor(
    containerEl: HTMLDivElement,
    onInsert: (text: string) => void,
    onInsertBlock: (lines: string[]) => void,
  ) {
    this.containerEl = containerEl;
    this.onInsert = onInsert;
    this.onInsertBlock = onInsertBlock;
  }

  render(): void {
    // Data group
    const dataGroup = this.createGroup();
    dataGroup.appendChild(this.createButton('Content', 'Insert Content tag', () => this.handleContent()));
    dataGroup.appendChild(this.createButton('Table', 'Insert Table tag', () => this.handleTable()));
    this.containerEl.appendChild(dataGroup);

    // Structure group
    const structGroup = this.createGroup();
    structGroup.appendChild(this.createButton('Repeat', 'Insert Repeat block', () => this.handleRepeat()));
    structGroup.appendChild(this.createButton('If', 'Insert Conditional block', () => this.handleConditional()));
    this.containerEl.appendChild(structGroup);

    // Signature group
    const sigGroup = this.createGroup();
    sigGroup.appendChild(this.createButton('Signature', 'Insert Signature tag', () => this.handleSignature()));
    this.containerEl.appendChild(sigGroup);
  }

  show(): void {
    this.containerEl.style.display = '';
  }

  hide(): void {
    this.containerEl.style.display = 'none';
  }

  enableAll(): void {
    for (const btn of this.buttons) btn.disabled = false;
  }

  destroy(): void {
    this.containerEl.innerHTML = '';
    this.buttons = [];
  }

  // --- Button handlers ---

  private async handleContent(): Promise<void> {
    const fields: DialogField[] = [
      { name: 'select', label: 'Select (XPath)', type: 'text', required: true, placeholder: 'e.g. Customer/Name' },
      { name: 'optional', label: 'Optional', type: 'checkbox', defaultValue: 'true' },
    ];
    const result = await TemplateDialog.show('Insert Content Tag', fields);
    if (!result) return;

    let tag = `<Content Select="${result.select}"`;
    if (result.optional === 'false') tag += ' Optional="false"';
    tag += ' />';
    this.onInsert(tag);
  }

  private async handleTable(): Promise<void> {
    const fields: DialogField[] = [
      { name: 'select', label: 'Select (XPath)', type: 'text', required: true, placeholder: 'e.g. Orders/Order' },
    ];
    const result = await TemplateDialog.show('Insert Table Tag', fields);
    if (!result) return;

    this.onInsert(`<Table Select="${result.select}" />`);
  }

  private async handleRepeat(): Promise<void> {
    const fields: DialogField[] = [
      { name: 'select', label: 'Select (XPath)', type: 'text', required: true, placeholder: 'e.g. Items/Item' },
      { name: 'optional', label: 'Optional', type: 'checkbox', defaultValue: 'true' },
    ];
    const result = await TemplateDialog.show('Insert Repeat Block', fields);
    if (!result) return;

    let openTag = `<Repeat Select="${result.select}"`;
    if (result.optional === 'false') openTag += ' Optional="false"';
    openTag += ' />';

    this.onInsertBlock([openTag, '', '<EndRepeat />']);
  }

  private async handleConditional(): Promise<void> {
    const fields: DialogField[] = [
      { name: 'select', label: 'Select (XPath)', type: 'text', required: true, placeholder: 'e.g. Status' },
      {
        name: 'conditionType', label: 'Condition type', type: 'radio',
        options: [
          { value: 'Match', label: 'Match (equals)' },
          { value: 'NotMatch', label: 'NotMatch (not equals)' },
        ],
        defaultValue: 'Match',
      },
      { name: 'conditionValue', label: 'Value', type: 'text', required: true, placeholder: 'e.g. Active' },
    ];
    const result = await TemplateDialog.show('Insert Conditional Block', fields);
    if (!result) return;

    const attr = result.conditionType === 'NotMatch' ? 'NotMatch' : 'Match';
    const openTag = `<Conditional Select="${result.select}" ${attr}="${result.conditionValue}" />`;

    this.onInsertBlock([openTag, '', '<Else />', '', '<EndConditional />']);
  }

  private async handleSignature(): Promise<void> {
    const fields: DialogField[] = [
      { name: 'id', label: 'ID', type: 'text', required: true, placeholder: 'e.g. sig_1' },
      { name: 'label', label: 'Label', type: 'text', placeholder: 'e.g. Authorized By' },
      { name: 'width', label: 'Width', type: 'text', placeholder: 'e.g. 200pt' },
      { name: 'height', label: 'Height', type: 'text', placeholder: 'e.g. 50pt' },
    ];
    const result = await TemplateDialog.show('Insert Signature Tag', fields);
    if (!result) return;

    let tag = `<Signature Id="${result.id}"`;
    if (result.label) tag += ` Label="${result.label}"`;
    if (result.width) tag += ` Width="${result.width}"`;
    if (result.height) tag += ` Height="${result.height}"`;
    tag += ' />';
    this.onInsert(tag);
  }

  // --- DOM helpers ---

  private createGroup(): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'lo-template-group';
    return group;
  }

  private createButton(label: string, tooltip: string, handler: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'lo-template-btn';
    btn.textContent = label;
    btn.title = tooltip;
    btn.type = 'button';
    btn.disabled = true;
    btn.addEventListener('click', handler);
    this.buttons.push(btn);
    return btn;
  }
}
