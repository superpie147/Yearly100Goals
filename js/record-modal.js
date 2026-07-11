// The record modal: shows a goal's records. Editable in owner live mode,
// read-only in the share view. Supports multiple records per goal, multiple
// images per record, client-side compression, upload, and a lightbox.
import { el, openModal, confirmDialog, toast, todayISO, loadingBlock } from './ui.js';
import { compressImage } from './image.js';
import * as api from './api.js';
import { publicUrl } from './api.js';

// options:
//   goal: { id, text, records? }
//   listId, ownerUid  (owner mode only)
//   readOnly: boolean
//   onChanged: (records) => void   // fired after any mutation so the list can refresh badges
export function openRecordModal(goal, options = {}) {
  const { readOnly = false, listId, ownerUid, onChanged } = options;

  const titleId = 'record-modal-title';
  const container = el('div', { class: 'record-modal' });
  const header = el('div', { class: 'record-modal__head' }, [
    el('h2', { class: 'record-modal__goal', id: titleId }, goal.text),
  ]);
  const listWrap = el('div', { class: 'record-list' });
  container.appendChild(header);
  container.appendChild(listWrap);

  let records = Array.isArray(goal.records) ? goal.records.map((r) => ({ ...r })) : null;

  if (!readOnly) {
    const addBtn = el(
      'button',
      { class: 'btn btn--primary record-modal__add', onClick: () => addRecord() },
      '＋ 新增一筆記錄'
    );
    container.appendChild(addBtn);
  }

  openModal(container, { labelledBy: titleId });

  // Owner mode: if records weren't preloaded, fetch fresh.
  if (records === null && !readOnly) {
    listWrap.appendChild(loadingBlock('載入紀錄中…'));
    api
      .fetchGoalRecords(goal.id)
      .then((data) => {
        records = data;
        renderRecords();
      })
      .catch((e) => {
        listWrap.innerHTML = '';
        listWrap.appendChild(el('p', { class: 'muted' }, e.message || '載入紀錄失敗。'));
      });
  } else {
    records ||= [];
    renderRecords();
  }

  function emitChanged() {
    onChanged?.(records);
  }

  function renderRecords() {
    listWrap.innerHTML = '';
    if (!records.length) {
      listWrap.appendChild(
        el('p', { class: 'record-list__empty muted' }, readOnly ? '目前還沒有任何紀錄。' : '還沒有紀錄，點下方按鈕新增第一筆吧！')
      );
      return;
    }
    for (const rec of records) {
      listWrap.appendChild(renderRecordCard(rec));
    }
  }

  function renderRecordCard(rec) {
    const card = el('div', { class: 'record-card' });

    // Date
    const dateRow = el('div', { class: 'record-card__row' }, [
      el('span', { class: 'record-card__label' }, '日期'),
      readOnly
        ? el('span', { class: 'record-card__date' }, rec.record_date)
        : el('input', {
            class: 'input input--sm',
            type: 'date',
            value: rec.record_date,
            onChange: (e) => saveField(rec, { recordDate: e.target.value }),
          }),
    ]);
    card.appendChild(dateRow);

    // Note
    if (readOnly) {
      if (rec.note) card.appendChild(el('p', { class: 'record-card__note' }, rec.note));
    } else {
      const ta = el('textarea', {
        class: 'input textarea',
        placeholder: '寫下這次的心得或細節…',
        rows: '2',
      });
      ta.value = rec.note || '';
      ta.addEventListener('blur', () => {
        if ((rec.note || '') !== ta.value) saveField(rec, { note: ta.value });
      });
      card.appendChild(ta);
    }

    // Images
    const gallery = el('div', { class: 'record-card__gallery' });
    renderGallery(gallery, rec);
    card.appendChild(gallery);

    if (!readOnly) {
      const fileInput = el('input', {
        type: 'file',
        accept: 'image/png,image/jpeg,image/webp,image/gif',
        multiple: true,
        class: 'sr-only',
      });
      fileInput.addEventListener('change', (e) => handleUpload(rec, e.target.files, gallery, fileInput));

      const actions = el('div', { class: 'record-card__actions' }, [
        el(
          'button',
          { class: 'btn btn--ghost btn--sm', onClick: () => fileInput.click() },
          '＋ 加入截圖'
        ),
        el(
          'button',
          { class: 'btn btn--danger-ghost btn--sm', onClick: () => removeRecord(rec) },
          '刪除這筆'
        ),
      ]);
      card.appendChild(fileInput);
      card.appendChild(actions);
    }

    return card;
  }

  function renderGallery(gallery, rec) {
    gallery.innerHTML = '';
    for (const path of rec.image_paths || []) {
      const url = publicUrl(path);
      const thumb = el('div', { class: 'thumb' }, [
        el('img', { src: url, alt: '截圖', loading: 'lazy', onClick: () => openLightbox(url) }),
        readOnly
          ? null
          : el(
              'button',
              {
                class: 'thumb__del',
                'aria-label': '移除圖片',
                title: '移除圖片',
                onClick: () => removeImage(rec, path, gallery),
              },
              '×'
            ),
      ]);
      gallery.appendChild(thumb);
    }
  }

  // ---- mutations (owner only) ----
  async function addRecord() {
    try {
      const rec = await api.createRecord({
        goalId: goal.id,
        recordDate: todayISO(),
        note: '',
        imagePaths: [],
      });
      records.push(rec);
      renderRecords();
      emitChanged();
    } catch (e) {
      toast(e.message || '新增紀錄失敗。', 'error');
    }
  }

  async function saveField(rec, patch) {
    try {
      const updated = await api.updateRecord(rec.id, patch);
      Object.assign(rec, updated);
      emitChanged();
    } catch (e) {
      toast(e.message || '儲存失敗。', 'error');
    }
  }

  async function removeRecord(rec) {
    const ok = await confirmDialog({
      title: '刪除這筆紀錄？',
      message: '這筆紀錄與其截圖將被永久刪除，無法復原。',
      confirmText: '刪除',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteRecord(rec.id);
      // Best-effort: clean up the storage objects too.
      api.removeScreenshots(rec.image_paths || []);
      records = records.filter((r) => r.id !== rec.id);
      renderRecords();
      emitChanged();
    } catch (e) {
      toast(e.message || '刪除失敗。', 'error');
    }
  }

  async function handleUpload(rec, files, gallery, fileInput) {
    const list = Array.from(files || []);
    fileInput.value = '';
    if (!list.length) return;
    const remaining = 10 - (rec.image_paths?.length || 0);
    if (remaining <= 0) {
      toast('每筆紀錄最多 10 張圖片。', 'error');
      return;
    }
    const toUpload = list.slice(0, remaining);
    toast('圖片處理中…', 'info');
    const newPaths = [];
    for (const file of toUpload) {
      try {
        const { blob, ext } = await compressImage(file);
        const path = `${ownerUid}/${listId}/${crypto.randomUUID()}.${ext}`;
        const upFile = new File([blob], path.split('/').pop(), { type: blob.type });
        await api.uploadScreenshot(path, upFile);
        newPaths.push(path);
      } catch (e) {
        toast(e.message || '有一張圖片上傳失敗。', 'error');
      }
    }
    if (!newPaths.length) return;
    const imagePaths = [...(rec.image_paths || []), ...newPaths];
    try {
      const updated = await api.updateRecord(rec.id, { imagePaths });
      Object.assign(rec, updated);
      renderGallery(gallery, rec);
      emitChanged();
      toast('圖片已上傳。', 'success');
    } catch (e) {
      // Roll back the just-uploaded objects if the DB write failed.
      api.removeScreenshots(newPaths);
      toast(e.message || '儲存圖片失敗。', 'error');
    }
  }

  async function removeImage(rec, path, gallery) {
    const imagePaths = (rec.image_paths || []).filter((p) => p !== path);
    try {
      const updated = await api.updateRecord(rec.id, { imagePaths });
      Object.assign(rec, updated);
      api.removeScreenshots([path]); // best-effort storage cleanup
      renderGallery(gallery, rec);
      emitChanged();
    } catch (e) {
      toast(e.message || '移除圖片失敗。', 'error');
    }
  }
}

// Full-size image lightbox layered above the modal.
export function openLightbox(url) {
  const backdrop = el('div', { class: 'lightbox' }, [el('img', { src: url, alt: '截圖' })]);
  function close() {
    backdrop.classList.remove('is-in');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => backdrop.remove(), 200);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('is-in'));
}
