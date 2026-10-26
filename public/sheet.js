// Лист персонажа. ES-модуль без зависимостей.
// mountSheet(rootEl, { socket, getToken, canEdit }) -> { render(token) }
// Весь пользовательский текст выводится через textContent / value, не innerHTML.
const SLOT_LABELS = {
  head: 'Голова',
  body: 'Тело',
  hands: 'Руки',
  legs: 'Ноги',
  feet: 'Ступни',
  accessory: 'Аксессуар',
};
const SLOTS = Object.keys(SLOT_LABELS);
const KINDS = [
  { key: 'weapons', title: 'Оружие', empty: 'Оружия нет', defEffect: 'damage' },
  { key: 'skills', title: 'Навыки', empty: 'Навыков нет', defEffect: 'none' },
  { key: 'spells', title: 'Магия', empty: 'Заклинаний нет', defEffect: 'none' },
];
const RESOURCES = [
  { key: 'hp', title: 'ХП' },
  { key: 'mana', title: 'Мана' },
  { key: 'ap', title: 'ОД' },
];
const EFFECTS = [
  ['damage', 'Урон'],
  ['heal', 'Лечение'],
  ['none', 'Нет'],
];
const DEBOUNCE_MS = 400;
const MAX_ACTIONS = 30;
const MAX_STATS = 20;
const genId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function labeled(labelText, input, cls) {
  const wrap = el('label', 'sheet-field' + (cls ? ' ' + cls : ''));
  wrap.appendChild(el('span', 'sheet-label', labelText));
  wrap.appendChild(input);
  return wrap;
}
function numInput(min, max) {
  const i = el('input', 'sheet-input sheet-num');
  i.type = 'number';
  i.inputMode = 'numeric';
  if (min !== undefined) i.min = String(min);
  if (max !== undefined) i.max = String(max);
  return i;
}
function textInput(maxLength, cls) {
  const i = el('input', 'sheet-input' + (cls ? ' ' + cls : ''));
  i.type = 'text';
  if (maxLength) i.maxLength = maxLength;
  return i;
}
// Обновить значение поля, только если оно отличается и не в фокусе.
function setIfDiff(input, value) {
  if (document.activeElement === input) return;
  const v = String(value ?? '');
  if (input.value !== v) input.value = v;
}
function toInt(v, d = 0) {
  const n = Math.round(Number(v));
  return v !== '' && Number.isFinite(n) ? n : d;
}
export function mountSheet(rootEl, { socket, getToken, canEdit } = {}) {
  let tokenId = null;
  let mode = null; // 'full' | 'ro' | 'empty'
  let sections = {}; // key -> { update(character), getValue(), busy() }
  let roSig = null;
  let statusEl = null;
  const pending = new Map(); // key -> { timer, tokenId }
  const inflight = new Map(); // key -> count
  let errorText = '';
  const isBusy = (key) => pending.has(key) || (inflight.get(key) || 0) > 0;

  // --- статус и сохранение ---------------------------------------------
  function setStatus(kind, text) {
    if (!statusEl) return;
    statusEl.className = 'sheet-status sheet-status-' + kind;
    statusEl.textContent = text;
  }
  function refreshStatus() {
    if (errorText) return setStatus('error', errorText);
    if (pending.size || [...inflight.values()].some((n) => n > 0)) return setStatus('saving', 'Сохранение…');
    setStatus('saved', 'Сохранено');
  }
  function flush(key) {
    const p = pending.get(key);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(key);
    const sec = sections[key];
    if (!sec) return;
    const patch = { [key]: sec.getValue() };
    inflight.set(key, (inflight.get(key) || 0) + 1);
    errorText = '';
    refreshStatus();
    let done = false;
    const ack = (res) => {
      if (done) return;
      done = true;
      inflight.set(key, Math.max(0, (inflight.get(key) || 1) - 1));
      if (!res || res.ok === false) {
        errorText = (res && res.error) || 'Не удалось сохранить';
      } else {
        errorText = '';
      }
      refreshStatus();
    };
    try {
      socket.emit('character:update', { tokenId: p.tokenId, patch }, ack);
    } catch (e) {
      ack({ ok: false, error: 'Нет связи с сервером' });
    }
  }
  function schedule(key) {
    const prev = pending.get(key);
    if (prev) clearTimeout(prev.timer);
    const timer = setTimeout(() => flush(key), DEBOUNCE_MS);
    pending.set(key, { timer, tokenId });
    setStatus('saving', 'Сохранение…');
  }
  function flushAll() {
    for (const key of [...pending.keys()]) flush(key);
  }

  // --- секции формы -----------------------------------------------------
  function buildResource(def) {
    const box = el('div', 'sheet-res');
    box.appendChild(el('div', 'sheet-res-title', def.title));
    const row = el('div', 'sheet-pair');
    const cur = numInput(0);
    const max = numInput(0);
    cur.setAttribute('aria-label', def.title + ': текущее');
    max.setAttribute('aria-label', def.title + ': максимум');
    row.append(cur, el('span', 'sheet-sep', '/'), max);
    box.appendChild(row);
    const onInput = () => schedule(def.key);
    cur.addEventListener('input', onInput);
    max.addEventListener('input', onInput);
    const sec = {
      node: box,
      busy: () => isBusy(def.key),
      getValue: () => ({ cur: toInt(cur.value), max: toInt(max.value) }),
      update(c) {
        if (sec.busy() || !c[def.key]) return;
        setIfDiff(cur, c[def.key].cur);
        setIfDiff(max, c[def.key].max);
      },
    };
    return sec;
  }
  function buildStats() {
    const box = el('div', 'sheet-block');
    box.appendChild(el('h3', 'sheet-h', 'Характеристики'));
    const list = el('div', 'sheet-stats');
    const add = el('button', 'sheet-btn', '+ Характеристика');
    add.type = 'button';
    box.append(list, add);
    let rows = []; // { k, v, wrap }
    const getValue = () => {
      const out = {};
      for (const r of rows) {
        const k = r.k.value.trim();
        if (k) out[k] = toInt(r.v.value);
      }
      return out;
    };
    const syncAdd = () => {
      add.disabled = rows.length >= MAX_STATS;
    };
    const addRow = (k, v) => {
      const wrap = el('div', 'sheet-stat-row');
      const ki = textInput(30, 'sheet-stat-name');
      ki.placeholder = 'Название';
      ki.setAttribute('aria-label', 'Название характеристики');
      const vi = numInput(-999, 999);
      vi.placeholder = '0';
      vi.setAttribute('aria-label', 'Значение');
      ki.value = k;
      vi.value = String(v);
      const del = el('button', 'sheet-btn sheet-btn-del', '×');
      del.type = 'button';
      del.title = 'Удалить';
      del.setAttribute('aria-label', 'Удалить характеристику');
      const row = { k: ki, v: vi, wrap };
      ki.addEventListener('input', () => schedule('stats'));
      vi.addEventListener('input', () => schedule('stats'));
      del.addEventListener('click', () => {
        rows = rows.filter((r) => r !== row);
        wrap.remove();
        syncAdd();
        schedule('stats');
      });
      wrap.append(ki, el('span', 'sheet-sep', '='), vi, del);
      list.appendChild(wrap);
      rows.push(row);
      syncAdd();
      return row;
    };
    add.addEventListener('click', () => {
      if (rows.length >= MAX_STATS) return;
      const r = addRow('', 0);
      r.k.focus();
      schedule('stats');
    });
    const rebuild = (stats) => {
      list.textContent = '';
      rows = [];
      for (const [k, v] of Object.entries(stats)) addRow(k, v);
      syncAdd();
    };
    return {
      node: box,
      busy: () => isBusy('stats'),
      getValue,
      update(c) {
        if (isBusy('stats') || !c.stats || list.contains(document.activeElement)) return;
        if (!same(getValue(), c.stats)) rebuild(c.stats);
      },
    };
  }
  function buildActions(kind) {
    const box = el('div', 'sheet-block');
    box.appendChild(el('h3', 'sheet-h', kind.title));
    const list = el('div', 'sheet-cards');
    const empty = el('div', 'sheet-empty', kind.empty);
    const add = el('button', 'sheet-btn', '+ Добавить');
    add.type = 'button';
    box.append(list, empty, add);
    let cards = []; // { id, read(), wrap }
    const getValue = () => cards.map((c) => c.read());
    const syncMeta = () => {
      add.disabled = cards.length >= MAX_ACTIONS;
      empty.hidden = cards.length > 0;
    };
    const addCard = (a) => {
      const wrap = el('div', 'sheet-card');
      const name = textInput(60, 'sheet-card-name');
      name.placeholder = 'Название';
      name.value = a.name;
      const del = el('button', 'sheet-btn sheet-btn-del', '×');
      del.type = 'button';
      del.title = 'Удалить';
      del.setAttribute('aria-label', 'Удалить');
      const head = el('div', 'sheet-card-head');
      head.append(name, del);
      const desc = el('textarea', 'sheet-input sheet-desc');
      desc.rows = 2;
      desc.maxLength = 400;
      desc.value = a.description;
      const ap = numInput(0, 20);
      ap.value = String(a.apCost);
      const mana = numInput(0, 999);
      mana.value = String(a.manaCost);
      const range = numInput(0, 50);
      range.value = String(a.range);
      const eff = el('select', 'sheet-input');
      for (const [val, label] of EFFECTS) {
        const o = el('option', '', label);
        o.value = val;
        eff.appendChild(o);
      }
      eff.value = a.effect.type;
      const dice = textInput(20, 'sheet-dice');
      dice.placeholder = '2d6+1';
      dice.value = a.effect.dice;
      const grid = el('div', 'sheet-card-grid');
      grid.append(
        labeled('ОД', ap),
        labeled('Мана', mana),
        labeled('Дальность', range),
        labeled('Эффект', eff),
        labeled('Кубы', dice, 'sheet-field-dice')
      );
      wrap.append(head, labeled('Описание', desc), grid);
      const card = {
        id: a.id,
        wrap,
        read: () => ({
          id: a.id,
          name: name.value,
          description: desc.value,
          apCost: toInt(ap.value, 1),
          manaCost: toInt(mana.value),
          range: toInt(range.value, 1),
          effect: { type: eff.value, dice: dice.value.trim() },
        }),
      };
      const onChange = () => schedule(kind.key);
      for (const f of [name, desc, ap, mana, range, dice]) f.addEventListener('input', onChange);
      eff.addEventListener('change', onChange);
      del.addEventListener('click', () => {
        cards = cards.filter((c) => c !== card);
        wrap.remove();
        syncMeta();
        schedule(kind.key);
      });
      list.appendChild(wrap);
      cards.push(card);
      syncMeta();
      return { card, name };
    };
    add.addEventListener('click', () => {
      if (cards.length >= MAX_ACTIONS) return;
      const { name } = addCard({
        id: genId(),
        name: '',
        description: '',
        apCost: 1,
        manaCost: 0,
        range: 1,
        effect: { type: kind.defEffect, dice: '' },
      });
      name.focus();
      schedule(kind.key);
    });
    const rebuild = (actions) => {
      list.textContent = '';
      cards = [];
      for (const a of actions) addCard(a);
      syncMeta();
    };
    syncMeta();
    return {
      node: box,
      busy: () => isBusy(kind.key),
      getValue,
      update(c) {
        const actions = c[kind.key];
        if (isBusy(kind.key) || !Array.isArray(actions) || list.contains(document.activeElement)) return;
        if (!same(getValue(), actions)) rebuild(actions);
      },
    };
  }
  function buildEquipment() {
    const box = el('div', 'sheet-block');
    box.appendChild(el('h3', 'sheet-h', 'Одеяние'));
    const grid = el('div', 'sheet-equip');
    const inputs = {};
    for (const s of SLOTS) {
      const i = textInput(80);
      i.addEventListener('input', () => schedule('equipment'));
      inputs[s] = i;
      grid.appendChild(labeled(SLOT_LABELS[s], i));
    }
    box.appendChild(grid);
    return {
      node: box,
      busy: () => isBusy('equipment'),
      getValue: () => Object.fromEntries(SLOTS.map((s) => [s, inputs[s].value])),
      update(c) {
        if (isBusy('equipment') || !c.equipment) return;
        for (const s of SLOTS) setIfDiff(inputs[s], c.equipment[s] ?? '');
      },
    };
  }
  function buildNotes() {
    const box = el('div', 'sheet-block');
    box.appendChild(el('h3', 'sheet-h', 'Заметки'));
    const ta = el('textarea', 'sheet-input sheet-notes');
    ta.rows = 5;
    ta.maxLength = 2000;
    ta.addEventListener('input', () => schedule('notes'));
    box.appendChild(ta);
    return {
      node: box,
      busy: () => isBusy('notes'),
      getValue: () => ta.value,
      update(c) {
        if (isBusy('notes') || typeof c.notes !== 'string') return;
        setIfDiff(ta, c.notes);
      },
    };
  }

  // --- сборка ------------------------------------------------------------
  let titleEl = null;
  function buildFull(token) {
    rootEl.textContent = '';
    sections = {};
    const root = el('div', 'sheet sheet-full');
    titleEl = el('h2', 'sheet-title', token.name || 'Персонаж');
    statusEl = el('div', 'sheet-status');
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    root.append(titleEl, statusEl);
    const resBox = el('div', 'sheet-resources');
    for (const def of RESOURCES) {
      const s = buildResource(def);
      sections[def.key] = s;
      resBox.appendChild(s.node);
    }
    root.appendChild(resBox);
    sections.stats = buildStats();
    root.appendChild(sections.stats.node);
    for (const k of KINDS) {
      sections[k.key] = buildActions(k);
      root.appendChild(sections[k.key].node);
    }
    sections.equipment = buildEquipment();
    sections.notes = buildNotes();
    root.append(sections.equipment.node, sections.notes.node);
    rootEl.appendChild(root);
    refreshStatus();
  }
  function resText(r) {
    return r && typeof r.cur === 'number' ? r.cur + ' / ' + r.max : '—';
  }
  function renderReadOnly(token) {
    const c = token.character;
    const sig = JSON.stringify([token.name, c || null]);
    if (mode === 'ro' && sig === roSig) return;
    flushAll();
    sections = {};
    statusEl = null;
    mode = 'ro';
    roSig = sig;
    rootEl.textContent = '';
    const root = el('div', 'sheet sheet-ro');
    root.appendChild(el('h2', 'sheet-title', token.name || 'Токен'));
    if (!c) {
      root.appendChild(el('div', 'sheet-empty', 'Нет данных о персонаже'));
    } else if (c.hp && typeof c.hp.cur === 'number') {
      const resBox = el('div', 'sheet-ro-res');
      for (const def of RESOURCES) {
        const r = el('div', 'sheet-ro-item');
        r.append(el('span', 'sheet-label', def.title), el('span', 'sheet-ro-val', resText(c[def.key])));
        resBox.appendChild(r);
      }
      root.appendChild(resBox);
      if (c.equipment) {
        root.appendChild(el('h3', 'sheet-h', 'Одеяние'));
        const dl = el('div', 'sheet-ro-equip');
        for (const s of SLOTS) {
          const row = el('div', 'sheet-ro-item');
          row.append(el('span', 'sheet-label', SLOT_LABELS[s]), el('span', 'sheet-ro-val', c.equipment[s] || '—'));
          dl.appendChild(row);
        }
        root.appendChild(dl);
      }
    } else {
      const dead = !!c.dead;
      const pct = Number.isFinite(c.hpPct) ? c.hpPct : 0;
      const line = el('div', 'sheet-ro-enemy' + (dead ? ' sheet-dead' : ''), dead ? 'Повержен' : 'Здоровье: ' + pct + '%');
      root.appendChild(line);
      const bar = el('div', 'sheet-bar');
      const fill = el('div', 'sheet-bar-fill');
      fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
      bar.appendChild(fill);
      root.appendChild(bar);
    }
    rootEl.appendChild(root);
  }
  function render(token) {
    if (!token) {
      flushAll();
      tokenId = null;
      mode = null;
      sections = {};
      statusEl = null;
      roSig = null;
      rootEl.textContent = '';
      rootEl.appendChild(el('div', 'sheet-empty', 'Выберите токен'));
      return;
    }
    const c = token.character;
    const full = !!(c && Array.isArray(c.weapons)) && !!(canEdit && canEdit());
    if (!full) {
      if (mode === 'full') {
        flushAll();
        tokenId = null;
      }
      tokenId = token.id;
      renderReadOnly(token);
      return;
    }
    if (mode !== 'full' || tokenId !== token.id) {
      flushAll();
      tokenId = token.id;
      errorText = '';
      mode = 'full';
      buildFull(token);
    }
    if (titleEl && titleEl.textContent !== (token.name || 'Персонаж')) {
      titleEl.textContent = token.name || 'Персонаж';
    }
    for (const sec of Object.values(sections)) sec.update(c);
  }
  return { render };
}
