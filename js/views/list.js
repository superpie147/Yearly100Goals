// Owner list view (#/list/{id}). Renders creation mode when status='draft'
// and live mode when status='live'.
import {
  el,
  clear,
  listTitle,
  toast,
  loadingBlock,
  errorBlock,
  confirmDialog,
  promptDialog,
} from '../ui.js';
import { getUser } from '../auth.js';
import * as api from '../api.js';
import { navigate } from '../router.js';
import { PRESET_CATEGORIES, GOAL_TARGET } from '../config.js';
import { renderCreationMode } from './list-draft.js';
import { renderLiveMode } from './list-live.js';

export async function renderListView(mount, { id }) {
  const user = await getUser();
  if (!user) {
    // Owner routes require login; send to home which offers the login button.
    clear(mount).appendChild(
      el('div', { class: 'state-block' }, [
        el('p', {}, '請先登入以檢視這份清單。'),
        el('button', { class: 'btn btn--primary', onClick: () => navigate('#/') }, '回首頁登入'),
      ])
    );
    return;
  }

  clear(mount).appendChild(loadingBlock('載入清單中…'));

  let list, categories;
  try {
    list = await api.fetchList(id);
    categories = await api.fetchOwnerTree(id);
  } catch (e) {
    clear(mount).appendChild(
      errorBlock(e.message || '載入清單失敗。', () => renderListView(mount, { id }))
    );
    return;
  }

  const ctx = { mount, user, list, categories };
  if (list.status === 'draft') {
    return renderCreationMode(ctx, {
      el, clear, listTitle, toast, confirmDialog, promptDialog,
      api, navigate, PRESET_CATEGORIES, GOAL_TARGET,
    });
  }
  return renderLiveMode(ctx, {
    el, clear, listTitle, toast, confirmDialog, api, navigate, GOAL_TARGET,
  });
}
