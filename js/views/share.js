// Public read-only share view (#/share/{token}). Anon-safe: only calls
// get_shared_list RPC and reads public storage URLs. No table reads, no edit UI.
import { el, clear, listTitle, loadingBlock } from '../ui.js';
import * as api from '../api.js';
import { navigate } from '../router.js';
import { GOAL_TARGET } from '../config.js';
import { openRecordModal } from '../record-modal.js';
import { renderMemoryTimeline } from './memory-timeline.js';
import { renderModeToggle } from './mode-toggle.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function renderShareView(mount, { token }) {
  clear(mount).appendChild(loadingBlock('載入分享清單中…'));

  if (!UUID_RE.test(token)) {
    return renderInvalid(mount);
  }

  let data;
  try {
    data = await api.getSharedList(token);
  } catch (e) {
    return renderInvalid(mount, e.message);
  }
  if (!data || !data.list) {
    return renderInvalid(mount);
  }

  const { list, categories } = data;
  const root = el('div', { class: 'list-view list-view--share' });

  // Progress
  let done = 0;
  let total = 0;
  for (const c of categories) for (const g of c.goals) {
    total++;
    if (g.completed) done++;
  }

  root.appendChild(
    el('div', { class: 'share-banner' }, [
      el('span', { class: 'tag tag--live' }, '公開分享 · 唯讀'),
    ])
  );

  const bar = el('div', { class: 'progress__bar', style: `width:${(done / GOAL_TARGET) * 100}%` });
  root.appendChild(
    el('div', { class: 'list-header list-header--live' }, [
      el('h1', { class: 'list-header__title' }, listTitle(list.owner_name, list.year)),
      el('div', { class: 'progress-hero' }, [
        el('div', { class: 'progress-hero__display' }, [
          el('span', { class: 'progress-hero__num' }, String(done)),
          el('span', { class: 'progress-hero__sep' }, ` / ${GOAL_TARGET}`),
        ]),
        el('div', { class: 'progress progress--lg' }, [bar]),
      ]),
    ])
  );

  // Mode toggle: 清單 (existing layout) | 回憶 (memory timeline). Client-side only.
  root.appendChild(
    el('div', { class: 'mode-toggle-row' }, [
      renderModeToggle((mode) => {
        listArea.hidden = mode !== 'list';
        memoryArea.hidden = mode !== 'memory';
        if (mode === 'memory' && !memoryArea.firstChild) {
          memoryArea.appendChild(
            renderMemoryTimeline(categories, { readOnly: true, emptyText: '還沒有公開的回憶' })
          );
        }
      }),
    ])
  );

  const catsHost = el('div', { class: 'cats cats--live' });
  for (const cat of categories) {
    if (!cat.goals.length) continue;
    const card = el('div', { class: 'cat-card cat-card--live' });
    const catDone = cat.goals.filter((g) => g.completed).length;
    card.appendChild(
      el('div', { class: 'cat-card__head' }, [
        el('h2', { class: 'cat-card__name' }, cat.name),
        el('span', { class: 'cat-card__count muted' }, `${catDone} / ${cat.goals.length}`),
      ])
    );
    const ul = el('ul', { class: 'goal-checks' });
    for (const g of cat.goals) ul.appendChild(renderGoal(g));
    card.appendChild(ul);
    catsHost.appendChild(card);
  }

  const listArea = el('div', { class: 'mode-area' }, [catsHost]);
  const memoryArea = el('div', { class: 'mode-area', hidden: 'hidden' });
  root.appendChild(listArea);
  root.appendChild(memoryArea);

  // Footer CTA
  root.appendChild(
    el('div', { class: 'share-footer' }, [
      el(
        'button',
        { class: 'btn btn--primary', onClick: () => navigate('#/') },
        '我也要建立自己的 100 個小目標 →'
      ),
    ])
  );

  clear(mount).appendChild(root);

  function renderGoal(g) {
    const badge = el('span', { class: 'goal-check__badge' }, g.records.length ? `📝 ${g.records.length}` : '');
    badge.style.visibility = g.records.length ? 'visible' : 'hidden';
    const li = el('li', { class: 'goal-check goal-check--ro' + (g.completed ? ' is-done' : '') }, [
      el('span', { class: 'goal-check__mark' + (g.completed ? ' is-checked' : '') }, g.completed ? '✓' : ''),
      el('span', { class: 'goal-check__label' }, g.text),
      g.records.length
        ? el('button', { class: 'goal-check__open', title: '查看紀錄', onClick: () => openRecordModal(g, { readOnly: true }) }, badge)
        : el('span', { class: 'goal-check__open' }, badge),
    ]);
    return li;
  }
}

function renderInvalid(mount, extra) {
  const view = el('div', { class: 'state-block state-block--friendly' }, [
    el('div', { class: 'state-block__emoji' }, '🔍'),
    el('h2', {}, '找不到這份分享清單'),
    el(
      'p',
      { class: 'muted' },
      '這個分享連結可能已失效、輸入有誤，或清單尚未發佈。'
    ),
    el('button', { class: 'btn btn--primary', onClick: () => navigate('#/') }, '建立我自己的 100 個小目標 →'),
  ]);
  clear(mount).appendChild(view);
}
