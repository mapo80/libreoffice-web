// Toolbar configuration for Writer document type.
// Each item maps to a UNO command dispatched via zetajs.

export interface ToolbarItem {
  id: string;
  type: 'button' | 'toggle' | 'separator' | 'select';
  command?: string;
  icon?: string;
  label?: string;
  options?: { value: string; label: string }[];
}

export interface ToolbarGroup {
  id: string;
  items: ToolbarItem[];
}

const FONT_SIZES = [
  6, 7, 8, 9, 10, 10.5, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28,
  32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96,
];

export const writerToolbar: ToolbarGroup[] = [
  // --- 1. Undo / Redo ---
  {
    id: 'undo-redo',
    items: [
      { id: 'undo', type: 'button', command: '.uno:Undo', icon: 'lc_undo.svg', label: 'Undo' },
      { id: 'redo', type: 'button', command: '.uno:Redo', icon: 'lc_redo.svg', label: 'Redo' },
    ],
  },
  // --- 2. Clipboard ---
  {
    id: 'clipboard',
    items: [
      { id: 'paste', type: 'button', command: '.uno:Paste', icon: 'lc_paste.svg', label: 'Paste' },
      { id: 'cut', type: 'button', command: '.uno:Cut', icon: 'lc_cut.svg', label: 'Cut' },
      { id: 'copy', type: 'button', command: '.uno:Copy', icon: 'lc_copy.svg', label: 'Copy' },
      { id: 'format-paintbrush', type: 'toggle', command: '.uno:FormatPaintbrush', icon: 'lc_formatpaintbrush.svg', label: 'Clone Formatting' },
      { id: 'reset-attributes', type: 'button', command: '.uno:ResetAttributes', icon: 'lc_resetattributes.svg', label: 'Clear Formatting' },
    ],
  },
  // --- 3. Font ---
  {
    id: 'font',
    items: [
      {
        id: 'font-name',
        type: 'select',
        command: '.uno:CharFontName',
        label: 'Font',
        options: [], // populated dynamically from LibreOffice
      },
      {
        id: 'font-size',
        type: 'select',
        command: '.uno:FontHeight',
        label: 'Font Size',
        options: FONT_SIZES.map((s) => ({ value: String(s), label: String(s) })),
      },
      { id: 'grow', type: 'button', command: '.uno:Grow', icon: 'lc_grow.svg', label: 'Increase Font Size' },
      { id: 'shrink', type: 'button', command: '.uno:Shrink', icon: 'lc_shrink.svg', label: 'Decrease Font Size' },
    ],
  },
  // --- 4. Text formatting ---
  {
    id: 'formatting',
    items: [
      { id: 'bold', type: 'toggle', command: '.uno:Bold', icon: 'lc_bold.svg', label: 'Bold' },
      { id: 'italic', type: 'toggle', command: '.uno:Italic', icon: 'lc_italic.svg', label: 'Italic' },
      { id: 'underline', type: 'toggle', command: '.uno:Underline', icon: 'lc_underline.svg', label: 'Underline' },
      { id: 'strikeout', type: 'toggle', command: '.uno:Strikeout', icon: 'lc_strikeout.svg', label: 'Strikethrough' },
      { id: 'subscript', type: 'toggle', command: '.uno:SubScript', icon: 'lc_subscript.svg', label: 'Subscript' },
      { id: 'superscript', type: 'toggle', command: '.uno:SuperScript', icon: 'lc_superscript.svg', label: 'Superscript' },
      { id: 'spacing', type: 'button', command: '.uno:Spacing', icon: 'lc_spacing.svg', label: 'Character Spacing' },
      { id: 'highlight', type: 'button', command: '.uno:CharBackColor', icon: 'lc_backcolor.svg', label: 'Highlighting' },
      { id: 'font-color', type: 'button', command: '.uno:Color', icon: 'lc_fontcolor.svg', label: 'Font Color' },
    ],
  },
  // --- 5. Paragraph ---
  {
    id: 'paragraph',
    items: [
      { id: 'bullet-list', type: 'toggle', command: '.uno:DefaultBullet', icon: 'lc_defaultbullet.svg', label: 'Bulleted List' },
      { id: 'number-list', type: 'toggle', command: '.uno:DefaultNumbering', icon: 'lc_defaultnumbering.svg', label: 'Numbered List' },
      { id: 'indent-inc', type: 'button', command: '.uno:IncrementIndent', icon: 'lc_incrementindent.svg', label: 'Increase Indent' },
      { id: 'indent-dec', type: 'button', command: '.uno:DecrementIndent', icon: 'lc_decrementindent.svg', label: 'Decrease Indent' },
      { id: 'control-codes', type: 'toggle', command: '.uno:ControlCodes', icon: 'lc_controlcodes.svg', label: 'Formatting Marks' },
      { id: 'para-ltr', type: 'toggle', command: '.uno:ParaLeftToRight', icon: 'lc_paralefttoright.svg', label: 'Left-to-Right' },
      { id: 'para-rtl', type: 'toggle', command: '.uno:ParaRightToLeft', icon: 'lc_pararighttoleft.svg', label: 'Right-to-Left' },
    ],
  },
  // --- 6. Alignment ---
  {
    id: 'alignment',
    items: [
      { id: 'left-para', type: 'toggle', command: '.uno:LeftPara', icon: 'lc_leftpara.svg', label: 'Align Left' },
      { id: 'center-para', type: 'toggle', command: '.uno:CenterPara', icon: 'lc_centerpara.svg', label: 'Align Center' },
      { id: 'right-para', type: 'toggle', command: '.uno:RightPara', icon: 'lc_rightpara.svg', label: 'Align Right' },
      { id: 'justify-para', type: 'toggle', command: '.uno:JustifyPara', icon: 'lc_justifypara.svg', label: 'Justify' },
      { id: 'line-spacing', type: 'button', command: '.uno:LineSpacing', icon: 'lc_linespacing.svg', label: 'Line Spacing' },
      { id: 'background-color', type: 'button', command: '.uno:BackgroundColor', icon: 'lc_backgroundcolor.svg', label: 'Paragraph Background' },
    ],
  },
  // --- 7. Insert ---
  {
    id: 'insert',
    items: [
      { id: 'insert-table', type: 'button', command: '.uno:InsertTable', icon: 'lc_inserttable.svg', label: 'Insert Table' },
      { id: 'insert-graphic', type: 'button', command: '.uno:InsertGraphic', icon: 'lc_insertgraphic.svg', label: 'Insert Image' },
      { id: 'insert-pagebreak', type: 'button', command: '.uno:InsertPagebreak', icon: 'lc_insertpagebreak.svg', label: 'Page Break' },
      { id: 'insert-symbol', type: 'button', command: '.uno:InsertSymbol', icon: 'lc_insertsymbol.svg', label: 'Special Character' },
    ],
  },
  // --- 8. Search ---
  {
    id: 'search',
    items: [
      { id: 'search-dialog', type: 'button', command: '.uno:SearchDialog', icon: 'lc_searchdialog.svg', label: 'Find & Replace' },
    ],
  },
];

// All UNO commands that need status tracking (for button state updates).
export const trackedCommands: string[] = [];
for (const group of writerToolbar) {
  for (const item of group.items) {
    if (item.command && (item.type === 'toggle' || item.type === 'select')) {
      trackedCommands.push(item.command);
    }
  }
}
// Also track Undo/Redo enabled state:
if (!trackedCommands.includes('.uno:Undo')) trackedCommands.push('.uno:Undo');
if (!trackedCommands.includes('.uno:Redo')) trackedCommands.push('.uno:Redo');
