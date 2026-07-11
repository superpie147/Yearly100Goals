// Live mode (owner): progress display, categories with checkable goals,
// record modal on check, share button. Records are NOT inline.
import { confettiBurst } from '../ui.js';
import { openRecordModal } from '../record-modal.js';
import { renderMemoryTimeline } from './memory-timeline.js';
import { renderModeToggle } from './mode-toggle.js';

export function renderLiveMode(ctx, deps) {
  const { mount, user, list } = ctx;
  const { el, clear, listTitle, toast, confirmDialog, api, navigate, GOAL_TARGET } = deps;

  let categories = ctx.categories;

  const root = el('div', { class: 'list-view list-view--live' });

  const topbar = el('div', { class: 'topbar' }, [
    el('button', { class: 'btn btn--ghost btn--sm', onClick: () => navigate('#/') }, '← 我的清單'),
    el('div', { class: 'topbar__right' }, [
      el('button', { class: 'btn btn--primary btn--sm', onClick: doShare }, '🔗 分享'),
      el('button', { class: 'btn btn--danger-ghost btn--sm', onClick: doDelete }, '刪除清單'),
    ]),
  ]);
  root.appendChild(topbar);

  // Progress header
  const bigNum = el('span', { class: 'progress-hero__num' }, '0');
  const bar = el('div', { class: 'progress__bar' });
  const header = el('div', { class: 'list-header list-header--live' }, [
    el('h1', { class: 'list-header__title' }, listTitle(list.owner_name, list.year)),
    el('div', { class: 'progress-hero' }, [
      el('div', { class: 'progress-hero__display' }, [
        bigNum,
        el('span', { class: 'progress-hero__sep' }, ` / ${GOAL_TARGET}`),
      ]),
      el('div', { class: 'progress progress--lg' }, [bar]),
    ]),
  ]);
  root.appendChild(header);

  // Mode toggle: 清單 (existing checklist) | 回憶 (memory timeline). Client-side only.
  root.appendChild(
    el('div', { class: 'mode-toggle-row' }, [
      renderModeToggle((mode) => {
        listArea.hidden = mode !== 'list';
        memoryArea.hidden = mode !== 'memory';
        if (mode === 'memory') renderMemory();
      }),
    ])
  );

  const catsHost = el('div', { class: 'cats cats--live' });
  const listArea = el('div', { class: 'mode-area' }, [catsHost]);
  const memoryArea = el('div', { class: 'mode-area', hidden: 'hidden' });
  root.appendChild(listArea);
  root.appendChild(memoryArea);

  clear(mount).appendChild(root);
  renderCategories();
  updateProgress();

  // Rebuild the timeline each time it's shown so edits made via the record
  // modal (which mutate goal.records) are reflected without a full reload.
  function renderMemory() {
    clear(memoryArea);
    memoryArea.appendChild(
      renderMemoryTimeline(categories, {
        readOnly: false,
        emptyText: '還沒有任何回憶，完成第一個目標時記下一筆吧',
        onModalChanged: (goal, records) => {
          goal.records = records;
          // Keep the checklist badge in sync too, in case the user toggles back.
          const badge = document
            .querySelector(`#g-${goal.id}`)
            ?.closest('.goal-check')
            ?.querySelector('.goal-check__badge');
          if (badge) {
            badge.textContent = `📝 ${records.length}`;
            badge.classList.toggle('is-empty', !records.length);
          }
          renderMemory();
        },
      })
    );
  }

  function doneCount() {
    let n = 0;
    for (const c of categories) for (const g of c.goals) if (g.completed) n++;
    return n;
  }

  function updateProgress() {
    const done = doneCount();
    bigNum.textContent = String(done);
    bar.style.width = `${(done / GOAL_TARGET) * 100}%`;
  }

  function renderCategories() {
    clear(catsHost);
    for (const cat of categories) {
      if (!cat.goals.length) continue;
      const card = el('div', { class: 'cat-card cat-card--live' });
      const done = cat.goals.filter((g) => g.completed).length;
      card.appendChild(
        el('div', { class: 'cat-card__head' }, [
          el('h2', { class: 'cat-card__name' }, cat.name),
          el('span', { class: 'cat-card__count muted' }, `${done} / ${cat.goals.length}`),
        ])
      );
      const ul = el('ul', { class: 'goal-checks' });
      for (const g of cat.goals) ul.appendChild(renderGoalItem(cat, g));
      card.appendChild(ul);
      catsHost.appendChild(card);
    }
  }

  function renderGoalItem(cat, g) {
    const checkbox = el('input', {
      type: 'checkbox',
      class: 'goal-check__box',
      id: `g-${g.id}`,
    });
    checkbox.checked = g.completed;

    const badge = el(
      'span',
      { class: 'goal-check__badge' + (g.records.length ? '' : ' is-empty'), title: '紀錄數' },
      `📝 ${g.records.length}`
    );

    const label = el('label', { class: 'goal-check__label', for: `g-${g.id}` }, g.text);
    const li = el('li', { class: 'goal-check' + (g.completed ? ' is-done' : '') }, [
      checkbox,
      label,
      el('button', { class: 'goal-check__open', title: '查看紀錄', onClick: () => openRecords(cat, g) }, badge),
    ]);

    checkbox.addEventListener('change', () => onToggle(cat, g, li, checkbox, badge));
    return li;
  }

  async function onToggle(cat, g, li, checkbox, badge) {
    const wantChecked = checkbox.checked;
    if (wantChecked) {
      // Optimistic: mark done, animate, open the record modal.
      g.completed = true;
      li.classList.add('is-done');
      confettiBurst(checkbox);
      try {
        await api.setGoalCompleted(g.id, true);
        updateCatCount(cat);
        updateProgress();
        openRecords(cat, g, badge);
      } catch (e) {
        // rollback
        g.completed = false;
        li.classList.remove('is-done');
        checkbox.checked = false;
        toast(e.message || '更新失敗。', 'error');
      }
    } else {
      // Unchecking requires confirm; revert the visual toggle until confirmed.
      checkbox.checked = true;
      const ok = await confirmDialog({
        title: '取消完成？',
        message: '這個目標會標記為未完成，但已建立的紀錄會保留。',
        confirmText: '取消完成',
        danger: false,
      });
      if (!ok) return;
      g.completed = false;
      checkbox.checked = false;
      li.classList.remove('is-done');
      try {
        await api.setGoalCompleted(g.id, false);
        updateCatCount(cat);
        updateProgress();
      } catch (e) {
        g.completed = true;
        checkbox.checked = true;
        li.classList.add('is-done');
        toast(e.message || '更新失敗。', 'error');
      }
    }
  }

  function updateCatCount(cat) {
    // Find the card by re-rendering the count text.
    const cards = catsHost.querySelectorAll('.cat-card');
    let idx = 0;
    for (const c of categories) {
      if (!c.goals.length) continue;
      if (c.id === cat.id) {
        const done = cat.goals.filter((g) => g.completed).length;
        const countEl = cards[idx]?.querySelector('.cat-card__count');
        if (countEl) countEl.textContent = `${done} / ${cat.goals.length}`;
        return;
      }
      idx++;
    }
  }

  function openRecords(cat, g, badgeEl) {
    openRecordModal(g, {
      listId: list.id,
      ownerUid: user.id,
      readOnly: false,
      onChanged: (records) => {
        g.records = records;
        // Update the badge for this goal.
        const badge =
          badgeEl || document.querySelector(`#g-${g.id}`)?.closest('.goal-check')?.querySelector('.goal-check__badge');
        if (badge) {
          badge.textContent = `📝 ${records.length}`;
          badge.classList.toggle('is-empty', !records.length);
        }
      },
    });
  }

  async function doShare() {
    const url = `${window.location.origin}${window.location.pathname}#/share/${list.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('已複製分享連結', 'success');
    } catch (_) {
      // Fallback: show the URL so the user can copy manually.
      toast('無法自動複製，連結為：' + url, 'info', 5000);
    }
  }

  async function doDelete() {
    const ok = await confirmDialog({
      title: '刪除整份清單？',
      message: '這份清單與所有目標、紀錄、截圖將被永久刪除，分享連結也會失效。此動作無法復原。',
      confirmText: '刪除',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteList(list.id);
      toast('清單已刪除。', 'success');
      navigate('#/');
    } catch (e) {
      toast(e.message || '刪除失敗。', 'error');
    }
  }
}
