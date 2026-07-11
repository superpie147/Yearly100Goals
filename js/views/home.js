// Home view (#/). Logged-out: app intro + Google login. Logged-in: user's lists
// + create-new button. This page is the shareable "creation entry".
import { el, clear, listTitle, toast, loadingBlock, errorBlock } from '../ui.js';
import { getUser, signInWithGoogle, signOut } from '../auth.js';
import * as api from '../api.js';
import { navigate } from '../router.js';
import { GOAL_TARGET } from '../config.js';

export async function renderHome(mount) {
  const user = await getUser();
  if (!user) return renderLoggedOut(mount);
  return renderLoggedIn(mount, user);
}

function renderLoggedOut(mount) {
  const view = el('div', { class: 'home home--intro' }, [
    el('div', { class: 'hero' }, [
      el('div', { class: 'hero__badge' }, '一年 · 一百個小目標'),
      el('h1', { class: 'hero__title' }, '把想做的事，寫成一整年的旅程'),
      el(
        'p',
        { class: 'hero__lead' },
        '為新的一年立下 100 個小目標，一格一格地完成、記錄下每個值得留念的時刻。比清單更溫暖，比日記更輕盈。'
      ),
      el(
        'button',
        { class: 'btn btn--primary btn--lg btn--google', onClick: doLogin },
        [googleIcon(), el('span', {}, '使用 Google 登入')]
      ),
      el('p', { class: 'hero__hint muted' }, '登入後即可建立你自己的 100 個小目標清單。'),
    ]),
    el('div', { class: 'features' }, [
      feature('🎯', '一次立定一百個', '涵蓋健康、旅行、學習、家庭…用分類把想做的事整理得清清楚楚。'),
      feature('📝', '完成就留下紀錄', '每個目標都能寫下多筆日期、心得與截圖，回顧時滿滿都是回憶。'),
      feature('🔗', '一鍵分享成果', '把你的一年進度用連結分享給朋友，唯讀、乾淨、好看。'),
    ]),
  ]);
  clear(mount).appendChild(view);

  async function doLogin() {
    try {
      await signInWithGoogle();
    } catch (e) {
      toast(e.message || '登入失敗，請稍後再試。', 'error');
    }
  }
}

async function renderLoggedIn(mount, user) {
  const view = el('div', { class: 'home' });
  const topbar = el('div', { class: 'topbar' }, [
    el('div', { class: 'topbar__brand' }, '100 個小目標'),
    el('div', { class: 'topbar__right' }, [
      el('span', { class: 'topbar__user muted' }, user.email || ''),
      el('button', { class: 'btn btn--ghost btn--sm', onClick: doLogout }, '登出'),
    ]),
  ]);
  view.appendChild(topbar);

  const header = el('div', { class: 'home__header' }, [
    el('h1', { class: 'home__title' }, '我的目標清單'),
    el('button', { class: 'btn btn--primary', onClick: createNew }, '＋ 建立新的目標清單'),
  ]);
  view.appendChild(header);

  const body = el('div', { class: 'home__body' });
  view.appendChild(body);
  clear(mount).appendChild(view);

  await loadLists();

  async function loadLists() {
    clear(body).appendChild(loadingBlock('載入清單中…'));
    try {
      const lists = await api.fetchMyLists();
      const liveIds = lists.filter((l) => l.status === 'live').map((l) => l.id);
      const counts = liveIds.length ? await api.fetchListGoalCounts(liveIds) : {};
      renderList(lists, counts);
    } catch (e) {
      clear(body).appendChild(errorBlock(e.message || '載入失敗。', loadLists));
    }
  }

  function renderList(lists, counts) {
    clear(body);
    if (!lists.length) {
      body.appendChild(
        el('div', { class: 'empty-card' }, [
          el('p', {}, '你還沒有任何清單。'),
          el('button', { class: 'btn btn--primary', onClick: createNew }, '建立第一份清單'),
        ])
      );
      return;
    }
    const grid = el('div', { class: 'list-grid' });
    for (const l of lists) {
      grid.appendChild(listCard(l, counts[l.id]));
    }
    body.appendChild(grid);
  }

  function listCard(l, count) {
    const isLive = l.status === 'live';
    const done = count?.done ?? 0;
    const total = count?.total ?? GOAL_TARGET;
    const card = el(
      'button',
      { class: 'list-card', onClick: () => navigate(`#/list/${l.id}`) },
      [
        el('div', { class: 'list-card__top' }, [
          isLive
            ? el('span', { class: 'tag tag--live' }, '進行中')
            : el('span', { class: 'tag tag--draft' }, '草稿'),
        ]),
        el('h3', { class: 'list-card__title' }, listTitle(l.owner_name, l.year)),
        isLive
          ? el('div', { class: 'list-card__progress' }, [
              el('div', { class: 'progress' }, [
                el('div', {
                  class: 'progress__bar',
                  style: `width:${(done / GOAL_TARGET) * 100}%`,
                }),
              ]),
              el('span', { class: 'list-card__count' }, `${done} / ${GOAL_TARGET}`),
            ])
          : el('p', { class: 'list-card__hint muted' }, '尚未完成，點擊繼續編輯'),
      ]
    );
    return card;
  }

  async function createNew() {
    const nameField = el('input', { class: 'input', type: 'text', placeholder: '你的名字', id: 'cl-name' });
    const yearField = el('input', {
      class: 'input',
      type: 'number',
      value: '2026',
      min: '1900',
      max: '3000',
      id: 'cl-year',
    });
    let submitted = null;
    // Build a custom two-field dialog using openModal directly.
    const ui = await import('../ui.js');
    const form = ui.el('form', { class: 'confirm' }, [
      ui.el('h3', { class: 'confirm__title', id: 'newlist-title' }, '建立新的目標清單'),
      ui.el('label', { class: 'field-label', for: 'cl-name' }, '名字'),
      nameField,
      ui.el('label', { class: 'field-label', for: 'cl-year' }, '年份'),
      yearField,
      ui.el('p', { class: 'confirm__preview muted', id: 'newlist-preview' }, ''),
      ui.el('div', { class: 'confirm__actions' }, [
        ui.el('button', { class: 'btn btn--ghost', type: 'button', onClick: () => finish(null) }, '取消'),
        ui.el('button', { class: 'btn btn--primary', type: 'submit' }, '建立'),
      ]),
    ]);
    const preview = form.querySelector('#newlist-preview');
    function updatePreview() {
      const n = nameField.value.trim() || '（你的名字）';
      const y = yearField.value || '2026';
      preview.textContent = `標題預覽：${listTitle(n, y)}`;
    }
    nameField.addEventListener('input', updatePreview);
    yearField.addEventListener('input', updatePreview);
    updatePreview();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameField.value.trim();
      const year = parseInt(yearField.value, 10);
      if (!name) {
        toast('請輸入名字。', 'error');
        return;
      }
      if (!year || year < 1900 || year > 3000) {
        toast('請輸入有效的年份。', 'error');
        return;
      }
      finish({ name, year });
    });
    const close = ui.openModal(form, { onClose: () => afterClose(), labelledBy: 'newlist-title' });
    setTimeout(() => nameField.focus(), 60);

    function finish(v) {
      submitted = v;
      close();
    }
    async function afterClose() {
      if (!submitted) return;
      try {
        const list = await api.createList({ ownerName: submitted.name, year: submitted.year });
        navigate(`#/list/${list.id}`);
      } catch (e) {
        toast(e.message || '建立失敗。', 'error');
      }
    }
  }

  async function doLogout() {
    try {
      await signOut();
      navigate('#/');
    } catch (e) {
      toast(e.message || '登出失敗。', 'error');
    }
  }
}

function feature(icon, title, text) {
  return el('div', { class: 'feature' }, [
    el('div', { class: 'feature__icon' }, icon),
    el('h3', { class: 'feature__title' }, title),
    el('p', { class: 'feature__text muted' }, text),
  ]);
}

function googleIcon() {
  const span = el('span', { class: 'gicon' });
  span.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/></svg>';
  return span;
}
