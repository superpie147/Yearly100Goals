// App entry: clean OAuth artifacts, register routes, start the router.
import { cleanAuthUrlArtifacts } from './auth.js';
import { registerRoute, registerNotFound, startRouter, navigate } from './router.js';
import { renderHome } from './views/home.js';
import { renderListView } from './views/list.js';
import { renderShareView } from './views/share.js';
import { el, clear } from './ui.js';

async function boot() {
  // supabase-js (detectSessionInUrl) parses the OAuth token; strip the URL bits
  // it leaves behind so hash routing stays clean.
  cleanAuthUrlArtifacts();

  // If we landed with no hash (fresh load or post-OAuth), default to home.
  if (!window.location.hash) {
    window.history.replaceState({}, document.title, window.location.pathname + '#/');
  }

  registerRoute('/', (mount) => renderHome(mount));
  registerRoute('/list/:id', (mount, params) => renderListView(mount, params));
  registerRoute('/share/:token', (mount, params) => renderShareView(mount, params));
  registerNotFound((mount) => {
    clear(mount).appendChild(
      el('div', { class: 'state-block state-block--friendly' }, [
        el('div', { class: 'state-block__emoji' }, '🧭'),
        el('h2', {}, '找不到這個頁面'),
        el('button', { class: 'btn btn--primary', onClick: () => navigate('#/') }, '回首頁'),
      ])
    );
  });

  startRouter();
}

boot().catch((e) => {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML =
      '<div class="state-block state-block--error"><p>啟動失敗，請重新整理頁面。</p></div>';
  }
  console.error('boot error', e);
});
