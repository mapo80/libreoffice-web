// Template toolbar — provides buttons for inserting DocumentAssembler template tags
// and managing Mail Merge fields.

import { TemplateDialog, type DialogField } from './template-dialog';
import { ICONS } from './icons';
import type { MergeFieldInfo } from './types';

export interface MergeFieldCallbacks {
  onInsert: (fieldName: string) => void;
  onEnumerate: () => Promise<MergeFieldInfo[]>;
  onUpdate: (oldName: string, newName: string, index?: number) => void;
  onNavigate: (fieldName: string, index?: number) => void;
}

export interface ContentControlCallbacks {
  onReadCC: () => Promise<{ text: string; index: number } | null>;
  onUpdateCC: (index: number, newText: string) => void;
}

export class TemplateToolbar {
  private containerEl: HTMLDivElement;
  private onInsert: (text: string) => void;
  private onInsertBlock: (lines: string[]) => void;
  private mergeCallbacks: MergeFieldCallbacks | null;
  private ccCallbacks: ContentControlCallbacks | null;
  private buttons: HTMLButtonElement[] = [];

  constructor(
    containerEl: HTMLDivElement,
    onInsert: (text: string) => void,
    onInsertBlock: (lines: string[]) => void,
    mergeCallbacks?: MergeFieldCallbacks,
    ccCallbacks?: ContentControlCallbacks,
  ) {
    this.containerEl = containerEl;
    this.onInsert = onInsert;
    this.onInsertBlock = onInsertBlock;
    this.mergeCallbacks = mergeCallbacks ?? null;
    this.ccCallbacks = ccCallbacks ?? null;
  }

  render(): void {
    // Tag badge
    this.containerEl.appendChild(this.createGroupLabel('Tag', 'lo-toolbar-group-label--tag'));

    // Data group
    const dataGroup = this.createGroup();
    dataGroup.appendChild(this.createButton('Content', 'Insert Content tag', () => this.handleContent(), 'ic_tag_content.svg'));
    dataGroup.appendChild(this.createButton('Image', 'Insert Image tag', () => this.handleImage(), 'ic_tag_image.svg'));
    dataGroup.appendChild(this.createButton('Table', 'Insert Table tag', () => this.handleTable(), 'ic_tag_table.svg'));
    this.containerEl.appendChild(dataGroup);

    // Structure group
    const structGroup = this.createGroup();
    structGroup.appendChild(this.createButton('Repeat', 'Insert Repeat block', () => this.handleRepeat(), 'ic_tag_repeat.svg'));
    structGroup.appendChild(this.createButton('If', 'Insert Conditional block', () => this.handleConditional(), 'ic_tag_if.svg'));
    this.containerEl.appendChild(structGroup);

    // Signature group
    const sigGroup = this.createGroup();
    sigGroup.appendChild(this.createButton('Signature', 'Insert Signature tag', () => this.handleSignature(), 'ic_tag_signature.svg'));
    this.containerEl.appendChild(sigGroup);

    // Edit group
    if (this.ccCallbacks) {
      const editGroup = this.createGroup();
      editGroup.appendChild(this.createButton('Edit Tag', 'Edit tag at cursor', () => this.handleEditTag(), 'ic_tag_edit.svg'));
      this.containerEl.appendChild(editGroup);
    }

    // Mail Merge group (visually distinct)
    if (this.mergeCallbacks) {
      const mergeGroup = this.createGroup('lo-mergefield-group');
      mergeGroup.appendChild(this.createGroupLabel('Merge', 'lo-toolbar-group-label--merge'));
      mergeGroup.appendChild(this.createButton('Insert Field', 'Insert a MERGEFIELD', () => this.handleInsertMergeField(), 'ic_merge_insert.svg', 'lo-mergefield-btn'));
      mergeGroup.appendChild(this.createButton('Edit Field', 'Edit an existing MERGEFIELD', () => this.handleEditMergeField(), 'ic_merge_edit.svg', 'lo-mergefield-btn'));
      mergeGroup.appendChild(this.createButton('List Fields', 'List all MERGEFIELDs', () => this.handleListMergeFields(), 'ic_merge_list.svg', 'lo-mergefield-btn'));
      this.containerEl.appendChild(mergeGroup);
    }
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

  // --- Template tag handlers ---

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

  private async handleImage(): Promise<void> {
    const fields: DialogField[] = [
      { name: 'select', label: 'Select (XPath)', type: 'text', required: true, placeholder: 'e.g. Customer/Photo' },
      { name: 'optional', label: 'Optional', type: 'checkbox', defaultValue: 'true' },
    ];
    const result = await TemplateDialog.show('Insert Image Tag', fields);
    if (!result) return;

    let tag = `<Image Select="${result.select}"`;
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

  // --- Edit tag handler ---

  private parseTag(text: string): { tagName: string; attrs: Record<string, string> } | null {
    const match = text.trim().match(/^<(\w+)([\s\S]*?)\s*\/?>$/);
    if (!match) return null;
    const tagName = match[1];
    const attrString = match[2];
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(attrString)) !== null) {
      attrs[m[1]] = m[2];
    }
    return { tagName, attrs };
  }

  private async handleEditTag(): Promise<void> {
    if (!this.ccCallbacks) return;
    const cc = await this.ccCallbacks.onReadCC();
    if (!cc || !cc.text) {
      await TemplateDialog.showList('Edit Tag', [], 'Place the cursor inside a tag to edit it.');
      return;
    }

    const parsed = this.parseTag(cc.text);
    if (!parsed) {
      await TemplateDialog.showList('Edit Tag', [], `Cannot parse tag: ${cc.text}`);
      return;
    }

    const { tagName, attrs } = parsed;

    switch (tagName) {
      case 'Content': {
        const fields: DialogField[] = [
          { name: 'select', label: 'Select (XPath)', type: 'text', required: true, placeholder: 'e.g. Customer/Name', defaultValue: attrs['Select'] ?? '' },
          { name: 'optional', label: 'Optional', type: 'checkbox', defaultValue: attrs['Optional'] !== 'false' ? 'true' : 'false' },
        ];
        const result = await TemplateDialog.show('Edit Content Tag', fields, 'Update');
        if (!result) return;
        let tag = `<Content Select="${result.select}"`;
        if (result.optional === 'false') tag += ' Optional="false"';
        tag += ' />';
        this.ccCallbacks.onUpdateCC(cc.index, tag);
        break;
      }
      case 'Image': {
        const fields: DialogField[] = [
          { name: 'select', label: 'Select (XPath)', type: 'text', required: true, placeholder: 'e.g. Customer/Photo', defaultValue: attrs['Select'] ?? '' },
          { name: 'optional', label: 'Optional', type: 'checkbox', defaultValue: attrs['Optional'] !== 'false' ? 'true' : 'false' },
        ];
        const result = await TemplateDialog.show('Edit Image Tag', fields, 'Update');
        if (!result) return;
        let tag = `<Image Select="${result.select}"`;
        if (result.optional === 'false') tag += ' Optional="false"';
        tag += ' />';
        this.ccCallbacks.onUpdateCC(cc.index, tag);
        break;
      }
      case 'Table': {
        const fields: DialogField[] = [
          { name: 'select', label: 'Select (XPath)', type: 'text', required: true, placeholder: 'e.g. Orders/Order', defaultValue: attrs['Select'] ?? '' },
        ];
        const result = await TemplateDialog.show('Edit Table Tag', fields, 'Update');
        if (!result) return;
        this.ccCallbacks.onUpdateCC(cc.index, `<Table Select="${result.select}" />`);
        break;
      }
      case 'Repeat': {
        const fields: DialogField[] = [
          { name: 'select', label: 'Select (XPath)', type: 'text', required: true, placeholder: 'e.g. Items/Item', defaultValue: attrs['Select'] ?? '' },
          { name: 'optional', label: 'Optional', type: 'checkbox', defaultValue: attrs['Optional'] !== 'false' ? 'true' : 'false' },
        ];
        const result = await TemplateDialog.show('Edit Repeat Tag', fields, 'Update');
        if (!result) return;
        let tag = `<Repeat Select="${result.select}"`;
        if (result.optional === 'false') tag += ' Optional="false"';
        tag += ' />';
        this.ccCallbacks.onUpdateCC(cc.index, tag);
        break;
      }
      case 'Conditional': {
        const hasNotMatch = 'NotMatch' in attrs;
        const fields: DialogField[] = [
          { name: 'select', label: 'Select (XPath)', type: 'text', required: true, placeholder: 'e.g. Status', defaultValue: attrs['Select'] ?? '' },
          {
            name: 'conditionType', label: 'Condition type', type: 'radio',
            options: [
              { value: 'Match', label: 'Match (equals)' },
              { value: 'NotMatch', label: 'NotMatch (not equals)' },
            ],
            defaultValue: hasNotMatch ? 'NotMatch' : 'Match',
          },
          { name: 'conditionValue', label: 'Value', type: 'text', required: true, placeholder: 'e.g. Active', defaultValue: attrs['Match'] ?? attrs['NotMatch'] ?? '' },
        ];
        const result = await TemplateDialog.show('Edit Conditional Tag', fields, 'Update');
        if (!result) return;
        const attr = result.conditionType === 'NotMatch' ? 'NotMatch' : 'Match';
        this.ccCallbacks.onUpdateCC(cc.index, `<Conditional Select="${result.select}" ${attr}="${result.conditionValue}" />`);
        break;
      }
      case 'Signature': {
        const fields: DialogField[] = [
          { name: 'id', label: 'ID', type: 'text', required: true, placeholder: 'e.g. sig_1', defaultValue: attrs['Id'] ?? '' },
          { name: 'label', label: 'Label', type: 'text', placeholder: 'e.g. Authorized By', defaultValue: attrs['Label'] ?? '' },
          { name: 'width', label: 'Width', type: 'text', placeholder: 'e.g. 200pt', defaultValue: attrs['Width'] ?? '' },
          { name: 'height', label: 'Height', type: 'text', placeholder: 'e.g. 50pt', defaultValue: attrs['Height'] ?? '' },
        ];
        const result = await TemplateDialog.show('Edit Signature Tag', fields, 'Update');
        if (!result) return;
        let tag = `<Signature Id="${result.id}"`;
        if (result.label) tag += ` Label="${result.label}"`;
        if (result.width) tag += ` Width="${result.width}"`;
        if (result.height) tag += ` Height="${result.height}"`;
        tag += ' />';
        this.ccCallbacks.onUpdateCC(cc.index, tag);
        break;
      }
      case 'Else':
      case 'EndRepeat':
      case 'EndConditional':
        await TemplateDialog.showList('Edit Tag', [], `"${tagName}" has no editable attributes.`);
        break;
      default:
        await TemplateDialog.showList('Edit Tag', [], `Unknown tag type: ${tagName}`);
        break;
    }
  }

  // --- Merge field handlers ---

  private async handleInsertMergeField(): Promise<void> {
    if (!this.mergeCallbacks) return;
    const fields: DialogField[] = [
      { name: 'fieldName', label: 'Field Name', type: 'text', required: true, placeholder: 'e.g. FirstName' },
    ];
    const result = await TemplateDialog.show('Insert Mail Merge Field', fields);
    if (!result) return;
    this.mergeCallbacks.onInsert(result.fieldName);
  }

  private async handleEditMergeField(): Promise<void> {
    if (!this.mergeCallbacks) return;
    const existingFields = await this.mergeCallbacks.onEnumerate();
    if (existingFields.length === 0) {
      await TemplateDialog.showList('Edit Mail Merge Field', [], 'No merge fields found in this document.');
      return;
    }

    // Build options from unique field names
    const uniqueNames = [...new Set(existingFields.map(f => f.fieldName))];
    const options = uniqueNames.map(name => ({ value: name, label: name }));

    const dialogFields: DialogField[] = [
      { name: 'currentField', label: 'Select field to edit', type: 'select', required: true, options },
      { name: 'newName', label: 'New field name', type: 'text', required: true, placeholder: 'e.g. LastName' },
    ];
    const result = await TemplateDialog.show('Edit Mail Merge Field', dialogFields);
    if (!result) return;
    this.mergeCallbacks.onUpdate(result.currentField, result.newName);
  }

  private async handleListMergeFields(): Promise<void> {
    if (!this.mergeCallbacks) return;
    const existingFields = await this.mergeCallbacks.onEnumerate();

    const items = existingFields.map(f => ({
      label: f.fieldName,
      subtitle: f.content || undefined,
    }));

    const selectedIdx = await TemplateDialog.showList(
      'Mail Merge Fields',
      items,
      'No merge fields found in this document.',
    );

    if (selectedIdx !== null && selectedIdx < existingFields.length) {
      const field = existingFields[selectedIdx];
      this.mergeCallbacks.onNavigate(field.fieldName, field.index);
    }
  }

  // --- DOM helpers ---

  private createGroupLabel(text: string, className: string): HTMLSpanElement {
    const label = document.createElement('span');
    label.className = `lo-toolbar-group-label ${className}`;
    label.textContent = text;
    return label;
  }

  private createGroup(className = 'lo-template-group'): HTMLDivElement {
    const group = document.createElement('div');
    group.className = className;
    return group;
  }

  private createButton(
    label: string,
    tooltip: string,
    handler: () => void,
    icon?: string,
    btnClass = 'lo-template-btn',
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = btnClass;
    btn.title = tooltip;
    btn.type = 'button';
    btn.disabled = true;

    if (icon) {
      const svgString = ICONS[icon];
      if (svgString) {
        const wrapper = document.createElement('span');
        wrapper.className = 'lo-template-btn-icon';
        wrapper.innerHTML = svgString;
        btn.appendChild(wrapper);
      }
    }

    const textSpan = document.createElement('span');
    textSpan.textContent = label;
    btn.appendChild(textSpan);

    btn.addEventListener('click', handler);
    this.buttons.push(btn);
    return btn;
  }
}
