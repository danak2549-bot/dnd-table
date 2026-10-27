// Инвентарь: предметы, количество, кнопка «Надеть» (кладёт вещь в нужный слот одеяния).
import { guessSlot, SLOT_NAMES } from './avatar.js';

const MAX_ITEMS = 40;
const gid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

export function mountInventory(root, { socket, getToken }) {
  let tokenId = null, rows = [], timer = null, inflight = 0;
  let list = null, status = null, addBtn = null;

  const read = () => rows.map((r) => ({ id: r.id, name: r.name.value, qty: Math.max(1, Math.min(999, Math.round(Number(r.qty.value)) || 1)), note: '' }));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const busy = () => timer !== null || inflight > 0;

  function save() {
    clearTimeout(timer);
    status.textContent = 'Сохранение…';
    timer = setTimeout(() => {
      timer = null;
      const t = getToken(); if (!t) return;
      inflight++;
      socket.emit('character:update', { tokenId: t.id, patch: { inventory: read() } }, (res) => {
        inflight = Math.max(0, inflight - 1);
        status.textContent = res && res.ok ? 'Сохранено' : (res && res.error) || 'Не удалось сохранить';
      });
    }, 400);
  }

  function equip(slot, value) {
    const t = getToken(); if (!t) return;
    const eq = { ...(t.character.equipment || {}), [slot]: value };
    socket.emit('character:update', { tokenId: t.id, patch: { equipment: eq } }, () => {});
  }

  function addRow(it) {
    const wrap = el('div', 'inv-row');
    const name = el('input', 'sheet-input inv-name'); name.type = 'text'; name.maxLength = 60; name.placeholder = 'Предмет'; name.value = it.name;
    const qty = el('input', 'sheet-input sheet-num inv-qty'); qty.type = 'number'; qty.min = '1'; qty.max = '999'; qty.value = String(it.qty); qty.setAttribute('aria-label', 'Количество');
    const sel = el('select', 'sheet-input inv-slot');
    for (const [k, label] of Object.entries(SLOT_NAMES)) { const o = el('option', '', label); o.value = k; sel.appendChild(o); }
    sel.value = guessSlot(it.name);
    const wear = el('button', 'sheet-btn inv-wear', 'Надеть'); wear.type = 'button';
    const del = el('button', 'sheet-btn sheet-btn-del', '×'); del.type = 'button'; del.setAttribute('aria-label', 'Удалить предмет');
    const row = { id: it.id, name, qty, sel, wear, wrap, manual: false };
    const worn = () => { const t = getToken(); return !!t && !!name.value && t.character.equipment?.[sel.value] === name.value; };
    const refreshWear = () => { wear.textContent = worn() ? 'Снять' : 'Надеть'; };
    name.addEventListener('input', () => { if (!row.manual) sel.value = guessSlot(name.value); refreshWear(); save(); });
    qty.addEventListener('input', save);
    sel.addEventListener('change', () => { row.manual = true; refreshWear(); });
    wear.addEventListener('click', () => { if (!name.value.trim()) return; equip(sel.value, worn() ? '' : name.value); });
    del.addEventListener('click', () => { rows = rows.filter((r) => r !== row); wrap.remove(); syncAdd(); save(); });
    row.refreshWear = refreshWear;
    wrap.append(name, qty, sel, wear, del);
    list.appendChild(wrap); rows.push(row); refreshWear();
    return row;
  }
  const syncAdd = () => { addBtn.disabled = rows.length >= MAX_ITEMS; };

  function build(items) {
    root.textContent = '';
    const box = el('div', 'inv');
    box.appendChild(el('h3', 'sheet-h', 'Инвентарь'));
    status = el('div', 'sheet-status', ''); box.appendChild(status);
    list = el('div', 'inv-list'); box.appendChild(list);
    addBtn = el('button', 'sheet-btn', '+ Предмет'); addBtn.type = 'button';
    addBtn.addEventListener('click', () => { if (rows.length >= MAX_ITEMS) return; addRow({ id: gid(), name: '', qty: 1 }).name.focus(); syncAdd(); save(); });
    box.appendChild(addBtn);
    box.appendChild(el('div', 'sheet-empty', 'Кнопка «Надеть» кладёт предмет в слот одеяния, и персонаж на листе сразу его покажет.'));
    root.appendChild(box);
    rows = [];
    for (const it of items) addRow(it);
    syncAdd();
  }

  function render(token) {
    const inv = token && token.character && token.character.inventory;
    if (!Array.isArray(inv)) {
      tokenId = null; rows = [];
      root.textContent = '';
      root.appendChild(el('div', 'sheet-empty', 'Инвентарь доступен только владельцу персонажа и мастеру'));
      return;
    }
    if (tokenId !== token.id || !list || !root.contains(list)) { tokenId = token.id; build(inv); return; }
    for (const r of rows) r.refreshWear();
    if (busy() || root.contains(document.activeElement)) return;
    if (!same(read().map(({ name, qty }) => ({ name, qty })), inv.map(({ name, qty }) => ({ name, qty })))) build(inv);
  }
  return { render };
}
