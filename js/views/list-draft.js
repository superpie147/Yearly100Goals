// Creation mode (draft list): manage categories + goals, sticky counter,
// publish when exactly 100.
export function renderCreationMode(ctx, deps) {
  const { mount, list } = ctx;
  const { el, clear, listTitle, toast, confirmDialog, promptDialog, api, navigate, PRESET_CATEGORIES, GOAL_TARGET } = deps;

  // Local mutable state (mirrors DB, kept in sync on each mutation).
  let categories = ctx.categories;

  const root = el('div', { class: 'list-view list-view--draft' });

  const topbar = el('div', { class: 'topbar' }, [
    el('button', { class: 'btn btn--ghost btn--sm', onClick: () => navigate('#/') }, '← 我的清單'),
    el('div', { class: 'topbar__right' }, [
      el('button', { class: 'btn btn--danger-ghost btn--sm', onClick: doDelete }, '刪除清單'),
    ]),
  ]);
  root.appendChild(topbar);

  const header = el('div', { class: 'list-header' }, [
    el('span', { class: 'tag tag--draft' }, '草稿'),
    el('h1', { class: 'list-header__title' }, listTitle(list.owner_name, list.year)),
    el('p', { class: 'muted' }, '新增分類與目標，湊滿 100 個就能開始你的一年。'),
  ]);
  root.appendChild(header);

  // Preset category chips
  const presetWrap = el('div', { class: 'preset-chips' });
  const presetLabel = el('p', { class: 'field-label' }, '一鍵加入常用分類：');
  const chipRow = el('div', { class: 'chip-row' });
  for (const name of PRESET_CATEGORIES) {
    chipRow.appendChild(
      el('button', { class: 'chip', onClick: () => addCategory(name) }, name)
    );
  }
  chipRow.appendChild(
    el('button', { class: 'chip chip--custom', onClick: addCustomCategory }, '＋ 自訂分類')
  );
  presetWrap.appendChild(presetLabel);
  presetWrap.appendChild(chipRow);
  root.appendChild(presetWrap);

  const catsHost = el('div', { class: 'cats' });
  root.appendChild(catsHost);

  // Sticky counter + publish
  const counterEl = el('span', { class: 'counter__num' }, '0');
  const publishBtn = el(
    'button',
    { class: 'btn btn--primary btn--lg', onClick: doPublish },
    '完成，開始我的一年！'
  );
  const sticky = el('div', { class: 'sticky-counter' }, [
    el('div', { class: 'counter' }, [
      el('span', {}, '目前 '),
      counterEl,
      el('span', {}, ` / ${GOAL_TARGET} 個目標`),
    ]),
    publishBtn,
  ]);
  root.appendChild(sticky);

  clear(mount).appendChild(root);
  renderCategories();
  updateCounter();

  // ---- rendering ----
  function totalGoals() {
    return categories.reduce((n, c) => n + c.goals.length, 0);
  }

  function updateCounter() {
    const total = totalGoals();
    counterEl.textContent = String(total);
    counterEl.parentElement.classList.toggle('counter--full', total === GOAL_TARGET);
    publishBtn.disabled = total !== GOAL_TARGET;
    publishBtn.title = total === GOAL_TARGET ? '' : `還需要 ${GOAL_TARGET - total} 個目標`;
  }

  function renderCategories() {
    clear(catsHost);
    if (!categories.length) {
      catsHost.appendChild(
        el('div', { class: 'empty-card' }, [el('p', { class: 'muted' }, '先從上方加入一個分類開始吧。')])
      );
      return;
    }
    for (const cat of categories) {
      catsHost.appendChild(renderCategoryCard(cat));
    }
  }

  function renderCategoryCard(cat) {
    const card = el('div', { class: 'cat-card' });

    const head = el('div', { class: 'cat-card__head' }, [
      el('h2', { class: 'cat-card__name' }, cat.name),
      el('span', { class: 'cat-card__count muted' }, `${cat.goals.length} 個`),
      el('div', { class: 'cat-card__tools' }, [
        el('button', { class: 'icon-btn', title: '重新命名', onClick: () => renameCat(cat) }, '✎'),
        el('button', { class: 'icon-btn icon-btn--danger', title: '刪除分類', onClick: () => deleteCat(cat) }, '🗑'),
      ]),
    ]);
    card.appendChild(head);

    const goalList = el('ul', { class: 'goal-lines' });
    for (const g of cat.goals) goalList.appendChild(renderGoalLine(cat, g));
    card.appendChild(goalList);

    // Add-goal input with enter-to-add-next flow.
    const input = el('input', {
      class: 'input goal-add-input',
      type: 'text',
      placeholder: '輸入目標，按 Enter 新增下一個…',
      maxlength: '500',
    });
    input.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      if (totalGoals() >= GOAL_TARGET) {
        toast('已達 100 個目標上限。', 'info');
        return;
      }
      input.disabled = true;
      try {
        const g = await api.createGoal({
          categoryId: cat.id,
          text,
          sortOrder: cat.goals.length,
        });
        cat.goals.push(g);
        goalList.appendChild(renderGoalLine(cat, g));
        head.querySelector('.cat-card__count').textContent = `${cat.goals.length} 個`;
        input.value = '';
        updateCounter();
      } catch (err) {
        toast(err.message || '新增目標失敗。', 'error');
      } finally {
        input.disabled = false;
        input.focus();
      }
    });
    card.appendChild(el('div', { class: 'goal-add' }, [input]));
    return card;
  }

  function renderGoalLine(cat, g) {
    const li = el('li', { class: 'goal-line', dataset: { id: g.id } });
    const textSpan = el('span', { class: 'goal-line__text' }, g.text);
    li.appendChild(textSpan);
    li.appendChild(
      el('div', { class: 'goal-line__tools' }, [
        el('button', { class: 'icon-btn', title: '編輯', onClick: () => editGoal(cat, g, textSpan) }, '✎'),
        el('button', { class: 'icon-btn icon-btn--danger', title: '刪除', onClick: () => delGoal(cat, g, li) }, '×'),
      ])
    );
    return li;
  }

  // ---- category mutations ----
  async function addCategory(name) {
    if (categories.some((c) => c.name === name)) {
      toast(`「${name}」已經在清單裡了。`, 'info');
      return;
    }
    try {
      const cat = await api.createCategory({
        listId: list.id,
        name,
        sortOrder: categories.length,
      });
      cat.goals = [];
      categories.push(cat);
      renderCategories();
    } catch (e) {
      toast(e.message || '新增分類失敗。', 'error');
    }
  }

  async function addCustomCategory() {
    const name = await promptDialog({
      title: '自訂分類',
      label: '分類名稱',
      placeholder: '例如：閱讀計畫',
      confirmText: '新增',
    });
    if (name) addCategory(name);
  }

  async function renameCat(cat) {
    const name = await promptDialog({
      title: '重新命名分類',
      label: '分類名稱',
      value: cat.name,
      confirmText: '儲存',
    });
    if (!name || name === cat.name) return;
    try {
      await api.renameCategory(cat.id, name);
      cat.name = name;
      renderCategories();
    } catch (e) {
      toast(e.message || '重新命名失敗。', 'error');
    }
  }

  async function deleteCat(cat) {
    const ok = await confirmDialog({
      title: `刪除「${cat.name}」？`,
      message: cat.goals.length
        ? `這個分類底下的 ${cat.goals.length} 個目標也會一起刪除。`
        : '確定要刪除這個分類嗎？',
      confirmText: '刪除',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteCategory(cat.id);
      categories = categories.filter((c) => c.id !== cat.id);
      renderCategories();
      updateCounter();
    } catch (e) {
      toast(e.message || '刪除分類失敗。', 'error');
    }
  }

  // ---- goal mutations ----
  async function editGoal(cat, g, textSpan) {
    const text = await promptDialog({
      title: '編輯目標',
      label: '目標內容',
      value: g.text,
      confirmText: '儲存',
    });
    if (!text || text === g.text) return;
    try {
      await api.updateGoalText(g.id, text);
      g.text = text;
      textSpan.textContent = text;
    } catch (e) {
      toast(e.message || '修改失敗。', 'error');
    }
  }

  async function delGoal(cat, g, li) {
    try {
      await api.deleteGoal(g.id);
      cat.goals = cat.goals.filter((x) => x.id !== g.id);
      li.remove();
      // Refresh the category's visible count.
      renderCategories();
      updateCounter();
    } catch (e) {
      toast(e.message || '刪除目標失敗。', 'error');
    }
  }

  // ---- publish ----
  async function doPublish() {
    const total = totalGoals();
    if (total !== GOAL_TARGET) {
      toast(`還需要 ${GOAL_TARGET - total} 個目標才能發佈。`, 'info');
      return;
    }
    const ok = await confirmDialog({
      title: '確定要發佈嗎？',
      message:
        '發佈後，所有目標文字與分類將永久鎖定、無法再修改。之後只能勾選完成、新增紀錄。這個動作無法復原。',
      confirmText: '發佈，開始我的一年！',
      danger: false,
    });
    if (!ok) return;
    publishBtn.disabled = true;
    publishBtn.textContent = '發佈中…';
    try {
      await api.publishList(list.id);
      toast('發佈成功！開始你的一年吧 🎉', 'success');
      // Re-enter the view; it will now render live mode.
      navigate('#/list/' + list.id);
      // Force re-render if hash is unchanged.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) {
      toast(e.message || '發佈失敗。', 'error');
      publishBtn.disabled = false;
      publishBtn.textContent = '完成，開始我的一年！';
    }
  }

  async function doDelete() {
    const ok = await confirmDialog({
      title: '刪除整份清單？',
      message: '這份草稿與其所有分類、目標將被永久刪除，無法復原。',
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
