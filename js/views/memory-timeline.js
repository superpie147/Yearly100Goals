// 回憶模式 (memory timeline): a reverse-chronological journal of ALL records
// across every goal, grouped by month. Pure view — data in, DOM out. Shared by
// the owner live view and the public share view. No API calls, no schema reads.
import { el } from '../ui.js';
import { publicUrl } from '../api.js';
import { openRecordModal, openLightbox } from '../record-modal.js';

// Flatten categories → goals → records into a single list, carrying the goal
// each record belongs to so we can render its chip and open its modal.
function collectRecords(categories) {
  const items = [];
  for (const cat of categories || []) {
    for (const g of cat.goals || []) {
      for (const r of g.records || []) {
        items.push({ rec: r, goal: g });
      }
    }
  }
  return items;
}

// Sort newest first. record_date is an ISO 'YYYY-MM-DD' string, so lexical
// compare is chronological. Ties keep a stable order (records with the same
// date preserve their original relative order via the index tiebreaker).
function sortNewestFirst(items) {
  return items
    .map((it, i) => ({ ...it, i }))
    .sort((a, b) => {
      const d = (b.rec.record_date || '').localeCompare(a.rec.record_date || '');
      return d !== 0 ? d : a.i - b.i;
    });
}

// '2026-04-12' → { key: '2026-04', monthLabel: '4月', dateLabel: '4/12' }
function partsFor(iso) {
  const [y, m, d] = (iso || '').split('-');
  const mNum = String(parseInt(m, 10) || '');
  const dNum = String(parseInt(d, 10) || '');
  return { key: `${y}-${m}`, monthLabel: `${mNum}月`, dateLabel: `${mNum}/${dNum}` };
}

// options:
//   readOnly: boolean          — share view is read-only, owner is editable
//   emptyText: string          — message shown when there are no records at all
//   onModalChanged: (goal, records) => void   — owner only, to refresh badges
export function renderMemoryTimeline(categories, options = {}) {
  const { readOnly = true, emptyText = '還沒有公開的回憶', onModalChanged } = options;

  const root = el('div', { class: 'timeline' });

  const items = sortNewestFirst(collectRecords(categories));
  if (!items.length) {
    root.appendChild(
      el('div', { class: 'state-block state-block--friendly timeline__empty' }, [
        el('div', { class: 'state-block__emoji' }, '🕊️'),
        el('p', { class: 'muted' }, emptyText),
      ])
    );
    return root;
  }

  // Walk the sorted items, opening a new month section each time the key flips.
  let currentKey = null;
  let currentBody = null;
  for (const it of items) {
    const parts = partsFor(it.rec.record_date);
    if (parts.key !== currentKey) {
      currentKey = parts.key;
      root.appendChild(el('h3', { class: 'timeline__month' }, parts.monthLabel));
      currentBody = el('div', { class: 'timeline__body' });
      root.appendChild(currentBody);
    }
    currentBody.appendChild(renderCard(it, parts, { readOnly, onModalChanged }));
  }

  return root;
}

function renderCard(it, parts, { readOnly, onModalChanged }) {
  const { rec, goal } = it;

  const chip = el(
    'button',
    {
      class: 'timeline-card__chip',
      title: '查看紀錄',
      onClick: () =>
        openRecordModal(goal, {
          readOnly,
          onChanged: readOnly ? undefined : (records) => onModalChanged?.(goal, records),
        }),
    },
    goal.text
  );

  const head = el('div', { class: 'timeline-card__head' }, [
    el('span', { class: 'timeline-card__date' }, parts.dateLabel),
    chip,
  ]);

  const card = el('div', { class: 'timeline-card' }, [head]);

  if (rec.note) {
    // Preserve line breaks; long notes render in full (this mode is for reading).
    card.appendChild(el('p', { class: 'timeline-card__note' }, rec.note));
  }

  const paths = rec.image_paths || [];
  if (paths.length) {
    const gallery = el('div', { class: 'timeline-card__gallery' });
    for (const path of paths) {
      const url = publicUrl(path);
      gallery.appendChild(
        el('div', { class: 'thumb' }, [
          el('img', { src: url, alt: '截圖', loading: 'lazy', onClick: () => openLightbox(url) }),
        ])
      );
    }
    card.appendChild(gallery);
  }

  return card;
}
