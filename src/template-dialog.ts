// Lightweight modal dialog for collecting template tag parameters.
// Zero dependencies — vanilla DOM.

export interface DialogField {
  name: string;
  label: string;
  type: 'text' | 'checkbox' | 'radio';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
}

export class TemplateDialog {
  /**
   * Show a modal dialog with the given title and fields.
   * Resolves with field values on submit, or `null` on cancel.
   */
  static show(
    title: string,
    fields: DialogField[],
  ): Promise<Record<string, string> | null> {
    return new Promise((resolve) => {
      // --- Overlay ---
      const overlay = document.createElement('div');
      overlay.className = 'lo-template-dialog-overlay';

      // --- Dialog box ---
      const dialog = document.createElement('div');
      dialog.className = 'lo-template-dialog';

      // Header
      const header = document.createElement('div');
      header.className = 'lo-template-dialog-header';
      const titleEl = document.createElement('span');
      titleEl.textContent = title;
      const closeBtn = document.createElement('button');
      closeBtn.className = 'lo-template-dialog-close';
      closeBtn.textContent = '\u00d7';
      closeBtn.type = 'button';
      header.appendChild(titleEl);
      header.appendChild(closeBtn);
      dialog.appendChild(header);

      // Form
      const form = document.createElement('form');
      form.className = 'lo-template-dialog-form';

      const inputs = new Map<string, HTMLInputElement>();

      for (const field of fields) {
        const wrapper = document.createElement('div');
        wrapper.className = 'lo-template-dialog-field';

        if (field.type === 'text') {
          const label = document.createElement('label');
          label.textContent = field.label;
          const input = document.createElement('input');
          input.type = 'text';
          input.name = field.name;
          input.placeholder = field.placeholder ?? '';
          input.value = field.defaultValue ?? '';
          if (field.required) input.required = true;
          label.appendChild(input);
          wrapper.appendChild(label);
          inputs.set(field.name, input);
        } else if (field.type === 'checkbox') {
          const label = document.createElement('label');
          label.className = 'lo-template-dialog-checkbox';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.name = field.name;
          input.checked = field.defaultValue !== 'false';
          const span = document.createElement('span');
          span.textContent = field.label;
          label.appendChild(input);
          label.appendChild(span);
          wrapper.appendChild(label);
          inputs.set(field.name, input);
        } else if (field.type === 'radio' && field.options) {
          const fieldset = document.createElement('fieldset');
          fieldset.className = 'lo-template-dialog-radio-group';
          const legend = document.createElement('legend');
          legend.textContent = field.label;
          fieldset.appendChild(legend);

          let firstInput: HTMLInputElement | null = null;
          for (const opt of field.options) {
            const radioLabel = document.createElement('label');
            radioLabel.className = 'lo-template-dialog-radio';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = field.name;
            radio.value = opt.value;
            if (opt.value === (field.defaultValue ?? field.options[0].value)) {
              radio.checked = true;
            }
            if (!firstInput) firstInput = radio;
            const span = document.createElement('span');
            span.textContent = opt.label;
            radioLabel.appendChild(radio);
            radioLabel.appendChild(span);
            fieldset.appendChild(radioLabel);
          }
          wrapper.appendChild(fieldset);
          if (firstInput) inputs.set(field.name, firstInput);
        }

        form.appendChild(wrapper);
      }

      // Actions
      const actions = document.createElement('div');
      actions.className = 'lo-template-dialog-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'lo-template-dialog-btn lo-template-dialog-btn-cancel';
      cancelBtn.textContent = 'Cancel';

      const insertBtn = document.createElement('button');
      insertBtn.type = 'submit';
      insertBtn.className = 'lo-template-dialog-btn lo-template-dialog-btn-insert';
      insertBtn.textContent = 'Insert';

      actions.appendChild(cancelBtn);
      actions.appendChild(insertBtn);
      form.appendChild(actions);
      dialog.appendChild(form);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      // Focus first text input
      const firstText = form.querySelector<HTMLInputElement>('input[type="text"]');
      if (firstText) firstText.focus();

      // --- Helpers ---
      const cleanup = () => {
        document.body.removeChild(overlay);
      };

      const cancel = () => {
        cleanup();
        resolve(null);
      };

      const submit = () => {
        if (!form.reportValidity()) return;

        const result: Record<string, string> = {};
        for (const field of fields) {
          if (field.type === 'checkbox') {
            const input = inputs.get(field.name);
            result[field.name] = input?.checked ? 'true' : 'false';
          } else if (field.type === 'radio') {
            const checked = form.querySelector<HTMLInputElement>(
              `input[name="${field.name}"]:checked`,
            );
            result[field.name] = checked?.value ?? '';
          } else {
            const input = inputs.get(field.name);
            result[field.name] = input?.value.trim() ?? '';
          }
        }
        cleanup();
        resolve(result);
      };

      // --- Event handlers ---
      closeBtn.addEventListener('click', cancel);
      cancelBtn.addEventListener('click', cancel);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cancel();
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submit();
      });
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cancel();
      });
    });
  }
}
