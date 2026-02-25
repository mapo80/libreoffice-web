// Menu configuration for Writer documents.
// Only includes items that work with pure UNO commands via zetajs.

export interface MenuItem {
  id: string;
  label: string;
  command?: string;        // UNO command
  shortcut?: string;       // display shortcut label
  type?: 'separator';
  children?: MenuItem[];
}

export interface MenuDefinition {
  id: string;
  label: string;
  items: MenuItem[];
}

const sep: MenuItem = { id: '', label: '', type: 'separator' };

export const writerMenus: MenuDefinition[] = [
  {
    id: 'file',
    label: 'File',
    items: [
      { id: 'save', label: 'Save', command: '.uno:Save', shortcut: 'Ctrl+S' },
      sep,
      { id: 'properties', label: 'Properties...', command: '.uno:SetDocumentProperties' },
      sep,
      { id: 'print', label: 'Print...', command: '.uno:Print', shortcut: 'Ctrl+P' },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { id: 'undo', label: 'Undo', command: '.uno:Undo', shortcut: 'Ctrl+Z' },
      { id: 'redo', label: 'Redo', command: '.uno:Redo', shortcut: 'Ctrl+Y' },
      sep,
      { id: 'cut', label: 'Cut', command: '.uno:Cut', shortcut: 'Ctrl+X' },
      { id: 'copy', label: 'Copy', command: '.uno:Copy', shortcut: 'Ctrl+C' },
      { id: 'paste', label: 'Paste', command: '.uno:Paste', shortcut: 'Ctrl+V' },
      { id: 'paste-special', label: 'Paste Special...', command: '.uno:PasteSpecial', shortcut: 'Ctrl+Shift+V' },
      sep,
      { id: 'select-all', label: 'Select All', command: '.uno:SelectAll', shortcut: 'Ctrl+A' },
      sep,
      { id: 'find-replace', label: 'Find & Replace...', command: '.uno:SearchDialog', shortcut: 'Ctrl+H' },
      sep,
      { id: 'goto-page', label: 'Go to Page...', command: '.uno:GotoPage' },
    ],
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { id: 'control-codes', label: 'Formatting Marks', command: '.uno:ControlCodes' },
      sep,
      { id: 'navigator', label: 'Navigator', command: '.uno:Navigator' },
      { id: 'sidebar', label: 'Sidebar', command: '.uno:SidebarDeck.PropertyDeck' },
    ],
  },
  {
    id: 'insert',
    label: 'Insert',
    items: [
      { id: 'insert-table', label: 'Table...', command: '.uno:InsertTable' },
      { id: 'insert-graphic', label: 'Image...', command: '.uno:InsertGraphic' },
      { id: 'insert-chart', label: 'Chart...', command: '.uno:InsertObjectChart' },
      { id: 'insert-symbol', label: 'Special Character...', command: '.uno:InsertSymbol' },
      sep,
      { id: 'insert-annotation', label: 'Comment', command: '.uno:InsertAnnotation' },
      { id: 'insert-footnote', label: 'Footnote', command: '.uno:InsertFootnote' },
      { id: 'insert-endnote', label: 'Endnote', command: '.uno:InsertEndnote' },
      sep,
      { id: 'insert-section', label: 'Section...', command: '.uno:InsertSection' },
      { id: 'insert-pagebreak', label: 'Page Break', command: '.uno:InsertPagebreak' },
      { id: 'insert-break', label: 'More Breaks...', command: '.uno:InsertBreak' },
      sep,
      { id: 'hyperlink', label: 'Hyperlink...', command: '.uno:HyperlinkDialog', shortcut: 'Ctrl+K' },
      { id: 'insert-bookmark', label: 'Bookmark...', command: '.uno:InsertBookmark' },
      sep,
      {
        id: 'fields',
        label: 'Fields',
        children: [
          { id: 'field-pagenumber', label: 'Page Number', command: '.uno:InsertPageNumberField' },
          { id: 'field-pagecount', label: 'Page Count', command: '.uno:InsertPageCountField' },
          { id: 'field-date', label: 'Date', command: '.uno:InsertDateField' },
          { id: 'field-time', label: 'Time', command: '.uno:InsertTimeField' },
          { id: 'field-title', label: 'Title', command: '.uno:InsertTitleField' },
          { id: 'field-author', label: 'Author', command: '.uno:InsertAuthorField' },
        ],
      },
      {
        id: 'formatting-marks',
        label: 'Formatting Marks',
        children: [
          { id: 'nbsp', label: 'Non-Breaking Space', command: '.uno:InsertNonBreakingSpace' },
          { id: 'hard-hyphen', label: 'Hard Hyphen', command: '.uno:InsertHardHyphen' },
          { id: 'soft-hyphen', label: 'Soft Hyphen', command: '.uno:InsertSoftHyphen' },
        ],
      },
    ],
  },
  {
    id: 'format',
    label: 'Format',
    items: [
      {
        id: 'text',
        label: 'Text',
        children: [
          { id: 'fmt-bold', label: 'Bold', command: '.uno:Bold', shortcut: 'Ctrl+B' },
          { id: 'fmt-italic', label: 'Italic', command: '.uno:Italic', shortcut: 'Ctrl+I' },
          { id: 'fmt-underline', label: 'Underline', command: '.uno:Underline', shortcut: 'Ctrl+U' },
          { id: 'fmt-strikeout', label: 'Strikethrough', command: '.uno:Strikeout' },
          sep,
          { id: 'fmt-superscript', label: 'Superscript', command: '.uno:SuperScript' },
          { id: 'fmt-subscript', label: 'Subscript', command: '.uno:SubScript' },
          sep,
          { id: 'fmt-uppercase', label: 'UPPERCASE', command: '.uno:ChangeCaseToUpper' },
          { id: 'fmt-lowercase', label: 'lowercase', command: '.uno:ChangeCaseToLower' },
          { id: 'fmt-titlecase', label: 'Capitalize Each Word', command: '.uno:ChangeCaseToTitleCase' },
          sep,
          { id: 'fmt-grow', label: 'Increase Size', command: '.uno:Grow' },
          { id: 'fmt-shrink', label: 'Decrease Size', command: '.uno:Shrink' },
        ],
      },
      {
        id: 'spacing',
        label: 'Spacing',
        children: [
          { id: 'space-1', label: 'Single', command: '.uno:SpacePara1' },
          { id: 'space-1.5', label: '1.5 Lines', command: '.uno:SpacePara15' },
          { id: 'space-2', label: 'Double', command: '.uno:SpacePara2' },
          sep,
          { id: 'space-inc', label: 'Increase Paragraph Spacing', command: '.uno:ParaspaceIncrease' },
          { id: 'space-dec', label: 'Decrease Paragraph Spacing', command: '.uno:ParaspaceDecrease' },
        ],
      },
      {
        id: 'align',
        label: 'Align',
        children: [
          { id: 'align-left', label: 'Left', command: '.uno:CommonAlignLeft', shortcut: 'Ctrl+L' },
          { id: 'align-center', label: 'Center', command: '.uno:CommonAlignHorizontalCenter', shortcut: 'Ctrl+E' },
          { id: 'align-right', label: 'Right', command: '.uno:CommonAlignRight', shortcut: 'Ctrl+R' },
          { id: 'align-justify', label: 'Justified', command: '.uno:CommonAlignJustified', shortcut: 'Ctrl+J' },
        ],
      },
      sep,
      { id: 'format-paintbrush', label: 'Clone Formatting', command: '.uno:FormatPaintbrush' },
      { id: 'reset-attributes', label: 'Clear Direct Formatting', command: '.uno:ResetAttributes' },
      sep,
      { id: 'char-dialog', label: 'Character...', command: '.uno:FontDialog' },
      { id: 'para-dialog', label: 'Paragraph...', command: '.uno:ParagraphDialog' },
      { id: 'outline-bullet', label: 'Bullets and Numbering...', command: '.uno:OutlineBullet' },
      sep,
      { id: 'page-dialog', label: 'Page Style...', command: '.uno:PageDialog' },
      { id: 'columns', label: 'Columns...', command: '.uno:FormatColumns' },
      { id: 'watermark', label: 'Watermark...', command: '.uno:Watermark' },
    ],
  },
  {
    id: 'table',
    label: 'Tables',
    items: [
      { id: 'table-insert', label: 'Insert Table...', command: '.uno:InsertTable' },
      sep,
      {
        id: 'table-insert-rows-cols',
        label: 'Insert',
        children: [
          { id: 'rows-before', label: 'Rows Above', command: '.uno:InsertRowsBefore' },
          { id: 'rows-after', label: 'Rows Below', command: '.uno:InsertRowsAfter' },
          sep,
          { id: 'cols-before', label: 'Columns Before', command: '.uno:InsertColumnsBefore' },
          { id: 'cols-after', label: 'Columns After', command: '.uno:InsertColumnsAfter' },
        ],
      },
      {
        id: 'table-delete',
        label: 'Delete',
        children: [
          { id: 'del-rows', label: 'Rows', command: '.uno:DeleteRows' },
          { id: 'del-cols', label: 'Columns', command: '.uno:DeleteColumns' },
          { id: 'del-table', label: 'Table', command: '.uno:DeleteTable' },
        ],
      },
      {
        id: 'table-select',
        label: 'Select',
        children: [
          { id: 'sel-table', label: 'Table', command: '.uno:SelectTable' },
          { id: 'sel-row', label: 'Row', command: '.uno:EntireRow' },
          { id: 'sel-col', label: 'Column', command: '.uno:EntireColumn' },
          { id: 'sel-cell', label: 'Cell', command: '.uno:EntireCell' },
        ],
      },
      sep,
      { id: 'split-cell', label: 'Split Cells...', command: '.uno:SplitCell' },
      { id: 'merge-cells', label: 'Merge Cells', command: '.uno:MergeCells' },
      sep,
      { id: 'table-dialog', label: 'Table Properties...', command: '.uno:TableDialog' },
    ],
  },
];
