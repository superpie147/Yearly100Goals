// Data-access layer. Every Supabase table/RPC/storage call lives here so the
// views stay declarative and the security surface is reviewable in one file.
//
// Authenticated (owner) calls use PostgREST table access, gated by RLS.
// The anonymous share view uses ONLY get_shared_list() + public storage URLs.
import { supabase, STORAGE_BUCKET } from './config.js';

// ---- helpers ---------------------------------------------------------------

// Normalize a PostgREST/RPC error into a Chinese-friendly Error.
function wrap(error, fallback) {
  if (!error) return null;
  const msg = translateError(error.message || String(error));
  const e = new Error(msg || fallback);
  e.cause = error;
  return e;
}

// Translate the handful of DB-raised messages we surface directly.
function translateError(raw) {
  if (!raw) return '';
  if (/exactly 100 goals/i.test(raw)) {
    const m = raw.match(/has (\d+)/);
    return `清單必須剛好有 100 個目標才能發佈${m ? `（目前有 ${m[1]} 個）` : ''}。`;
  }
  if (/exceeded the maximum allowed size|too large|payload too large/i.test(raw)) return '這個檔案太大了（上限 5MB），請換一張小一點的圖片。';
  if (/already live/i.test(raw)) return '這份清單已經發佈了。';
  if (/not authorized/i.test(raw)) return '你沒有權限進行這個操作。';
  if (/list not found/i.test(raw)) return '找不到這份清單。';
  if (/is live/i.test(raw)) return '清單已發佈，此內容已被鎖定，無法修改。';
  return raw;
}

// ---- lists -----------------------------------------------------------------

export async function fetchMyLists() {
  const { data, error } = await supabase
    .from('lists')
    .select('id, owner_name, year, status, share_token, published_at, created_at')
    .order('created_at', { ascending: false });
  if (error) throw wrap(error, '載入清單失敗。');
  return data;
}

export async function fetchListGoalCounts(listIds) {
  if (!listIds.length) return {};
  const { data, error } = await supabase
    .from('goals')
    .select('list_id, completed')
    .in('list_id', listIds);
  if (error) throw wrap(error, '載入進度失敗。');
  const counts = {};
  for (const id of listIds) counts[id] = { total: 0, done: 0 };
  for (const g of data) {
    counts[g.list_id].total += 1;
    if (g.completed) counts[g.list_id].done += 1;
  }
  return counts;
}

export async function createList({ ownerName, year }) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) throw new Error('請先登入。');
  const { data, error } = await supabase
    .from('lists')
    .insert({ owner: uid, owner_name: ownerName, year, status: 'draft' })
    .select()
    .single();
  if (error) throw wrap(error, '建立清單失敗。');
  return data;
}

export async function fetchList(listId) {
  const { data, error } = await supabase
    .from('lists')
    .select('id, owner_name, year, status, share_token, published_at')
    .eq('id', listId)
    .single();
  if (error) throw wrap(error, '載入清單失敗。');
  return data;
}

export async function deleteList(listId) {
  const { error } = await supabase.from('lists').delete().eq('id', listId);
  if (error) throw wrap(error, '刪除清單失敗。');
}

export async function publishList(listId) {
  const { data, error } = await supabase.rpc('publish_list', { p_list_id: listId });
  if (error) throw wrap(error, '發佈失敗。');
  return data;
}

// ---- categories ------------------------------------------------------------

export async function createCategory({ listId, name, sortOrder }) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ list_id: listId, name, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw wrap(error, '新增分類失敗。');
  return data;
}

export async function renameCategory(categoryId, name) {
  const { error } = await supabase.from('categories').update({ name }).eq('id', categoryId);
  if (error) throw wrap(error, '重新命名分類失敗。');
}

export async function deleteCategory(categoryId) {
  const { error } = await supabase.from('categories').delete().eq('id', categoryId);
  if (error) throw wrap(error, '刪除分類失敗。');
}

// ---- goals -----------------------------------------------------------------

export async function createGoal({ categoryId, text, sortOrder }) {
  // list_id is derived by a DB trigger — do NOT set it here.
  const { data, error } = await supabase
    .from('goals')
    .insert({ category_id: categoryId, text, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw wrap(error, '新增目標失敗。');
  return data;
}

export async function updateGoalText(goalId, text) {
  const { error } = await supabase.from('goals').update({ text }).eq('id', goalId);
  if (error) throw wrap(error, '修改目標失敗。');
}

export async function deleteGoal(goalId) {
  const { error } = await supabase.from('goals').delete().eq('id', goalId);
  if (error) throw wrap(error, '刪除目標失敗。');
}

export async function setGoalCompleted(goalId, completed) {
  const { error } = await supabase.from('goals').update({ completed }).eq('id', goalId);
  if (error) throw wrap(error, '更新目標狀態失敗。');
}

// Load the full owner tree: categories + goals + records. Used in draft & live.
export async function fetchOwnerTree(listId) {
  const [catsRes, goalsRes, recsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, sort_order')
      .eq('list_id', listId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('goals')
      .select('id, category_id, text, sort_order, completed')
      .eq('list_id', listId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('records')
      .select('id, goal_id, record_date, note, image_paths')
      .eq('list_id', listId)
      .order('record_date', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);
  if (catsRes.error) throw wrap(catsRes.error, '載入分類失敗。');
  if (goalsRes.error) throw wrap(goalsRes.error, '載入目標失敗。');
  if (recsRes.error) throw wrap(recsRes.error, '載入紀錄失敗。');

  const recordsByGoal = {};
  for (const r of recsRes.data) (recordsByGoal[r.goal_id] ||= []).push(r);
  const goalsByCat = {};
  for (const g of goalsRes.data) {
    g.records = recordsByGoal[g.id] || [];
    (goalsByCat[g.category_id] ||= []).push(g);
  }
  const categories = catsRes.data.map((c) => ({ ...c, goals: goalsByCat[c.id] || [] }));
  return categories;
}

// ---- records ---------------------------------------------------------------

export async function fetchGoalRecords(goalId) {
  const { data, error } = await supabase
    .from('records')
    .select('id, goal_id, record_date, note, image_paths')
    .eq('goal_id', goalId)
    .order('record_date', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw wrap(error, '載入紀錄失敗。');
  return data;
}

export async function createRecord({ goalId, recordDate, note, imagePaths }) {
  const { data, error } = await supabase
    .from('records')
    .insert({
      goal_id: goalId,
      record_date: recordDate,
      note: note || '',
      image_paths: imagePaths || [],
    })
    .select()
    .single();
  if (error) throw wrap(error, '新增紀錄失敗。');
  return data;
}

export async function updateRecord(recordId, { recordDate, note, imagePaths }) {
  const patch = {};
  if (recordDate !== undefined) patch.record_date = recordDate;
  if (note !== undefined) patch.note = note;
  if (imagePaths !== undefined) patch.image_paths = imagePaths;
  const { data, error } = await supabase
    .from('records')
    .update(patch)
    .eq('id', recordId)
    .select()
    .single();
  if (error) throw wrap(error, '更新紀錄失敗。');
  return data;
}

export async function deleteRecord(recordId) {
  const { error } = await supabase.from('records').delete().eq('id', recordId);
  if (error) throw wrap(error, '刪除紀錄失敗。');
}

// ---- storage ---------------------------------------------------------------

export async function uploadScreenshot(path, file) {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw wrap(error, '上傳圖片失敗。');
  return path;
}

// Best-effort deletion of storage objects for a removed record.
export async function removeScreenshots(paths) {
  if (!paths || !paths.length) return;
  try {
    await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  } catch (_) {
    /* best-effort; ignore failures */
  }
}

export function publicUrl(path) {
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---- shared (anon) ---------------------------------------------------------

export async function getSharedList(token) {
  const { data, error } = await supabase.rpc('get_shared_list', { p_token: token });
  if (error) throw wrap(error, '載入分享清單失敗。');
  return data; // null when token invalid / list not live
}
