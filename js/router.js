// Hash-based router for GitHub Pages (no server rewrites).
//   #/                -> home
//   #/list/{id}       -> owner view (draft = creation mode, live = live mode)
//   #/share/{token}   -> public read-only view
//
// Views are async render functions that receive (mountEl, params).

const routes = [];
let notFound = null;
let current = null; // cleanup fn from the last-rendered view

export function registerRoute(pattern, handler) {
  routes.push({ pattern, handler });
}
export function registerNotFound(handler) {
  notFound = handler;
}

export function navigate(hash) {
  if (window.location.hash === hash) render();
  else window.location.hash = hash;
}

function parse() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const path = raw.split('?')[0];
  return path;
}

async function render() {
  const path = parse();
  const mount = document.getElementById('app');

  // Tear down previous view (unsubscribe listeners, etc.).
  if (typeof current === 'function') {
    try { current(); } catch (_) {}
    current = null;
  }

  for (const { pattern, handler } of routes) {
    const m = matchPattern(pattern, path);
    if (m) {
      mount.innerHTML = '';
      current = (await handler(mount, m)) || null;
      window.scrollTo(0, 0);
      return;
    }
  }
  mount.innerHTML = '';
  if (notFound) current = (await notFound(mount)) || null;
}

// Pattern like '/list/:id' -> { id }. Returns null on no match.
function matchPattern(pattern, path) {
  const pp = pattern.split('/').filter(Boolean);
  const sp = path.split('/').filter(Boolean);
  if (pp.length !== sp.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(sp[i]);
    else if (pp[i] !== sp[i]) return null;
  }
  return params;
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}
