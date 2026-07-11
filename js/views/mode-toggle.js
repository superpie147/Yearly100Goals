// A small pill toggle between 清單 (the existing layout) and 回憶 (memory
// timeline). Pure client-side state — no route/hash change, no persistence.
import { el } from '../ui.js';

// onChange: (mode) => void   where mode is 'list' | 'memory'
// Returns the toggle element. Default active mode is 'list'.
export function renderModeToggle(onChange) {
  let mode = 'list';
  const buttons = {};

  function select(next) {
    if (next === mode) return;
    mode = next;
    for (const [m, btn] of Object.entries(buttons)) {
      btn.classList.toggle('is-active', m === mode);
      btn.setAttribute('aria-pressed', String(m === mode));
    }
    onChange(mode);
  }

  function mk(m, label) {
    const btn = el(
      'button',
      {
        class: 'mode-toggle__btn' + (m === mode ? ' is-active' : ''),
        'aria-pressed': String(m === mode),
        onClick: () => select(m),
      },
      label
    );
    buttons[m] = btn;
    return btn;
  }

  return el('div', { class: 'mode-toggle', role: 'group', 'aria-label': '檢視模式' }, [
    mk('list', '清單'),
    mk('memory', '回憶'),
  ]);
}
