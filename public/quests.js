// Вкладка «Задания»: доска объявлений поселения, мои задания, управление для мастера.
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

export function mountQuests(root, { socket, getState, isMaster }) {
  root.textContent = '';
  const box = el('div', 'qs');
  const form = el('div', 'q-form');
  const title = el('input', 'sheet-input'); title.placeholder = 'Название задания'; title.maxLength = 80;
  const desc = el('textarea', 'sheet-input'); desc.placeholder = 'Описание'; desc.rows = 2; desc.maxLength = 600;
  const reward = el('input', 'sheet-input'); reward.placeholder = 'Награда (например, 100 зм)'; reward.maxLength = 80;
  const add = el('button', 'sheet-btn', 'Вывесить на доску'); add.type = 'button';
  add.onclick = () => {
    if (!title.value.trim()) return;
    socket.emit('quest:add', { title: title.value, description: desc.value, reward: reward.value }, () => {});
    title.value = desc.value = reward.value = '';
  };
  form.append(el('h3', 'sheet-h', 'Новое задание на доску'), title, desc, reward, add);
  const list = el('div', 'q-list');
  box.append(form, list);
  root.appendChild(box);

  const btn = (text, fn, alt) => { const b = el('button', 'sheet-btn' + (alt ? ' alt' : ''), text); b.type = 'button'; b.onclick = fn; return b; };
  const card = (q, actions, tag) => {
    const c = el('div', 'q-card' + (q.status === 'done' ? ' done' : ''));
    c.appendChild(el('div', 'q-title', (tag ? tag + ' ' : '') + q.title));
    if (q.description) c.appendChild(el('div', 'q-desc', q.description));
    const meta = [q.reward && 'Награда: ' + q.reward, q.giver && 'Даёт: ' + q.giver, q.status === 'done' && 'Выполнено'].filter(Boolean).join(' · ');
    if (meta) c.appendChild(el('div', 'q-meta', meta));
    if (actions.length) { const row = el('div', 'q-actions'); row.append(...actions); c.appendChild(row); }
    return c;
  };
  const section = (name, cards, emptyText) => {
    list.appendChild(el('h3', 'sheet-h', name));
    if (cards.length) cards.forEach((c) => list.appendChild(c)); else list.appendChild(el('div', 'sheet-empty', emptyText));
  };

  function render(state) {
    form.hidden = !isMaster();
    list.textContent = '';
    const qs = state.quests || [];
    if (isMaster()) {
      const groups = new Map();
      for (const q of qs) { const k = q.onBoard ? 'Доска: ' + (q.place || 'мир') : 'У жителей' + (q.place ? ': ' + q.place : ''); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }
      if (!qs.length) list.appendChild(el('div', 'sheet-empty', 'Заданий пока нет. Откройте поселение, и доска наполнится сама, или добавьте своё выше.'));
      for (const [k, arr] of groups) section(k, arr.map((q) => card(q, [
        q.status !== 'done' ? btn('Выполнено', () => socket.emit('quest:done', { id: q.id }, () => {})) : null,
        btn('Удалить', () => socket.emit('quest:remove', { id: q.id }, () => {}), true),
      ].filter(Boolean), q.takenBy.length ? '👥' + q.takenBy.length : '')), '');
      return;
    }
    const taken = qs.filter((q) => q.taken);
    const board = qs.filter((q) => q.onBoard && q.status === 'open' && !q.taken);
    const place = state.scene ? state.scene.name : 'мир';
    section('Моё актуальное и взятые', taken.map((q) => card(q, [
      q.id === state.myQuest ? el('span', 'q-pin', '★ актуальное') : btn('Сделать актуальным', () => socket.emit('quest:pin', { id: q.id }, () => {})),
      btn('Отказаться', () => socket.emit('quest:drop', { id: q.id }, () => {}), true),
    ], q.id === state.myQuest ? '★' : '')), 'Вы пока не взяли ни одного задания.');
    section('Доска объявлений: ' + place, board.map((q) => card(q, [btn('Взять', () => socket.emit('quest:take', { id: q.id }, () => {}))])), state.scene ? 'На доске пусто.' : 'Откройте поселение, чтобы увидеть доску объявлений.');
  }
  return { render };
}
