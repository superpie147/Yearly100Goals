// Small, dependency-free UI primitives: DOM builder, toast, modal, confirm,
// title formatting, and title/date helpers shared across views.

// Tiny hyperscript-ish DOM builder. el('div', {class:'x'}, [child, 'text']).
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'value') node.value = v;
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

// The canonical title used everywhere.
export function listTitle(ownerName, year) {
  return `${ownerName}的100個${year}年的小目標`;
}

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

// ---- toast -----------------------------------------------------------------
export function toast(message, type = 'info', ms = 2600) {
  const host = document.getElementById('toast-host');
  const t = el('div', { class: `toast toast--${type}`, role: 'status' }, message);
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => {
    t.classList.remove('is-in');
    setTimeout(() => t.remove(), 250);
  }, ms);
}

// ---- modal -----------------------------------------------------------------
// Opens an overlay. content is a DOM node. Returns a close() fn.
// Closable via X, backdrop click, and Esc.
export function openModal(content, { onClose, labelledBy } = {}) {
  const host = document.getElementById('modal-host');
  const backdrop = el('div', { class: 'modal-backdrop' });
  const dialog = el('div', {
    class: 'modal',
    role: 'dialog',
    'aria-modal': 'true',
    ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
  });
  const closeBtn = el(
    'button',
    { class: 'modal__close', 'aria-label': '關閉', title: '關閉' },
    '×'
  );
  dialog.appendChild(closeBtn);
  dialog.appendChild(content);
  backdrop.appendChild(dialog);
  host.appendChild(backdrop);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('is-in');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      backdrop.remove();
      onClose?.();
    }, 220);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => backdrop.classList.add('is-in'));
  return close;
}

// A simple promise-based confirm dialog (Chinese).
export function confirmDialog({ title, message, confirmText = '確定', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const body = el('div', { class: 'confirm' }, [
      title ? el('h3', { class: 'confirm__title', id: 'confirm-title' }, title) : null,
      message ? el('p', { class: 'confirm__msg' }, message) : null,
      el('div', { class: 'confirm__actions' }, [
        el('button', { class: 'btn btn--ghost', onClick: () => finish(false) }, cancelText),
        el(
          'button',
          { class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, onClick: () => finish(true) },
          confirmText
        ),
      ]),
    ]);
    const close = openModal(body, { onClose: () => resolve(pending), labelledBy: 'confirm-title' });
    let pending = false;
    function finish(v) {
      pending = v;
      close();
    }
  });
}

// A small prompt dialog for renaming / adding a custom category.
export function promptDialog({ title, label, value = '', placeholder = '', confirmText = '確定' }) {
  return new Promise((resolve) => {
    let result = null;
    const input = el('input', {
      class: 'input',
      type: 'text',
      value,
      placeholder,
      id: 'prompt-input',
    });
    const form = el('form', { class: 'confirm' }, [
      title ? el('h3', { class: 'confirm__title', id: 'prompt-title' }, title) : null,
      label ? el('label', { class: 'field-label', for: 'prompt-input' }, label) : null,
      input,
      el('div', { class: 'confirm__actions' }, [
        el('button', { class: 'btn btn--ghost', type: 'button', onClick: () => finish(null) }, '取消'),
        el('button', { class: 'btn btn--primary', type: 'submit' }, confirmText),
      ]),
    ]);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      finish(v || null);
    });
    const close = openModal(form, { onClose: () => resolve(result), labelledBy: 'prompt-title' });
    setTimeout(() => input.focus(), 60);
    function finish(v) {
      result = v;
      close();
    }
  });
}

// ---- confetti (CSS-only burst) ---------------------------------------------
// Spawns a small tasteful burst of colored bits near an element.
export function confettiBurst(anchor) {
  const rect = anchor.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ['#e07a5f', '#f2cc8f', '#81b29a', '#3d405b', '#f4a261'];
  const host = el('div', { class: 'confetti' });
  document.body.appendChild(host);
  for (let i = 0; i < 14; i++) {
    const bit = el('span', { class: 'confetti__bit' });
    const angle = Math.random() * Math.PI * 2;
    const dist = 26 + Math.random() * 40;
    bit.style.left = cx + 'px';
    bit.style.top = cy + 'px';
    bit.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    bit.style.setProperty('--dy', (Math.sin(angle) * dist - 20) + 'px');
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = Math.random() * 40 + 'ms';
    host.appendChild(bit);
  }
  setTimeout(() => host.remove(), 900);
}

// ---- error/loading blocks --------------------------------------------------
export function loadingBlock(text = '載入中…') {
  return el('div', { class: 'state-block' }, [el('div', { class: 'spinner' }), el('p', {}, text)]);
}

export function errorBlock(text, onRetry) {
  return el('div', { class: 'state-block state-block--error' }, [
    el('p', {}, text),
    onRetry ? el('button', { class: 'btn btn--ghost', onClick: onRetry }, '重試') : null,
  ]);
}
