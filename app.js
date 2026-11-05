import { mountSheet } from './sheet.js';
import { mountShop } from './shop.js';
import { renderAvatar } from './avatar.js';
import { mountInventory } from './inventory.js';
import { mountQuests } from './quests.js';
import { setSpriteLoadHandler } from './sprites.js';
import { tickActors } from './actors.js';
import { RACES } from './races.js';
import { drawMap, hitToken, cellFromEvent, MAXZ } from './map.js';

const $ = (s) => document.querySelector(s);
const socket = io();
const store = {
  get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
let me = { role: null, pid: store.get('pid') || 'p' + Math.random().toString(36).slice(2, 12), code: '' };
store.set('pid', me.pid);
let state = null, selId = null, drag = null, proposal = [];
let view = { s: 1, x: 0, y: 0 };

const selected = () => state?.tokens.find((t) => t.id === selId) || null;
const ownToken = () => state?.tokens.find((t) => t.owner === me.pid) || null;
const canEditTok = (t) => !!t && (me.role === 'master' || t.owner === me.pid);

const quests = mountQuests($('#quests'), { socket, getState: () => state, isMaster: () => me.role === 'master' });
const inv = mountInventory($('#inv'), { socket, getToken: selected });
const shop = mountShop($('#shop-modal'), { socket });
const sheet = mountSheet($('#sheet'), {
  socket, canEdit: () => canEditTok(selected()),
  getToken: () => selId,
});

// ---------- аккаунт и вход ----------
const err = (t) => { $('#l-err').textContent = t || ''; };
let authToken = store.get('auth');
const showAuth = () => { $('#login').hidden = false; $('#game').hidden = true; $('#auth-box').hidden = false; $('#lobby').hidden = true; };
function showLobby(user) {
  me.user = user || me.user;
  $('#login').hidden = false; $('#game').hidden = true; $('#auth-box').hidden = true; $('#lobby').hidden = false;
  $('#lobby-user').textContent = me.user;
  socket.emit('auth:rooms', {}, (r) => {
    const box = $('#my-games'); box.textContent = '';
    if (!r?.ok || !r.rooms.length) { const d = document.createElement('div'); d.className = 'dim'; d.textContent = 'Пока нет игр. Создайте комнату или войдите по коду.'; box.appendChild(d); return; }
    for (const g of r.rooms) {
      const card = document.createElement('div'); card.className = 'game-card';
      const info = document.createElement('div'); info.className = 'g-info';
      const b = document.createElement('b'); b.textContent = 'Комната ' + g.code;
      info.append(b, document.createElement('br'), document.createTextNode((g.role === 'master' ? 'вы мастер' : 'герой: ' + g.name) + (g.place ? ' · ' + g.place : '')));
      const go = document.createElement('button'); go.className = 'sheet-btn'; go.type = 'button'; go.textContent = 'Играть';
      go.onclick = () => enter(g.code, g.name || '');
      card.append(info, go); box.appendChild(card);
    }
  });
}
function afterConnect() {
  if (!authToken) return showAuth();
  socket.emit('auth:resume', { token: authToken }, (r) => {
    if (!r?.ok) { authToken = ''; store.set('auth', ''); return showAuth(); }
    me.user = r.user;
    if (me.role && me.code) enter(me.code, store.get('name'), '', true); else showLobby(r.user);
  });
}
function enter(code, name, masterKey, quiet) {
  socket.emit('room:join', { code, name, masterKey }, (r) => {
    if (!r?.ok) return quiet ? showLobby() : err(r?.error || 'Не удалось войти');
    err('');
    me.role = r.role; me.pid = r.pid; me.code = r.code;
    store.set('name', name || '');
    $('#login').hidden = true; $('#game').hidden = false;
    $('#room-code').textContent = 'Комната ' + me.code;
    $('#role').textContent = me.role === 'master' ? 'мастер' : 'игрок';
    $('#tab-master').hidden = me.role !== 'master';
    $('#profile').hidden = me.role === 'master';
    $('#mkey').textContent = me.code;
  });
}
const doAuth = (ev) => {
  const username = $('#a-user').value.trim(), password = $('#a-pass').value;
  socket.emit(ev, { username, password }, (r) => {
    if (!r?.ok) return err(r?.error || 'Не удалось войти');
    err(''); authToken = r.token; store.set('auth', authToken); $('#a-pass').value = ''; showLobby(r.user);
  });
};
$('#a-login').onclick = () => doAuth('auth:login');
$('#a-register').onclick = () => doAuth('auth:register');
$('#a-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doAuth('auth:login'); });
$('#a-logout').onclick = () => socket.emit('auth:logout', { token: authToken }, () => { authToken = ''; store.set('auth', ''); me.role = null; me.code = ''; showAuth(); });
$('#menu').onclick = () => { me.role = null; me.code = ''; location.reload(); };
$('#l-name').value = store.get('name');
$('#l-code').value = store.get('code');
$('#l-join').onclick = () => { store.set('code', $('#l-code').value.trim()); enter($('#l-code').value.trim(), $('#l-name').value.trim(), ''); };
$('#l-create').onclick = () => socket.emit('room:create', {}, (r) => { if (!r?.ok) return err(r?.error || 'Не удалось создать комнату'); enter(r.code, ''); });
$('#l-master').onclick = () => enter($('#l-code').value.trim().toUpperCase(), '', $('#l-key').value.trim());

// ---------- состояние ----------
let lastScene = '';
socket.on('state:sync', (s) => {
  state = s;
  const sk = s.scene ? s.scene.name + s.scene.w : '';
  if (sk !== lastScene) { lastScene = sk; view = { s: 1, x: 0, y: 0 }; }
  if (!selId || !s.tokens.some((t) => t.id === selId)) selId = ownToken()?.id || s.tokens[0]?.id || null;
  renderAll();
});
socket.on('disconnect', () => { err('Связь потеряна, переподключаюсь…'); });
socket.on('connect', afterConnect);

function renderAll() {
  $('#loc').textContent = state.location.name ? state.location.name + (state.location.description ? ' — ' + state.location.description : '') : '';
  sheet.render(selected());
  renderAvatar($('#avatar'), selected());
  inv.render(selected());
  const t = ownToken();
  if (t && me.role !== 'master' && t.character.race !== undefined) {
    for (const [id, v] of [['#pr-race', t.character.race], ['#pr-class', t.character.class], ['#pr-level', t.character.level]]) {
      if (document.activeElement !== $(id)) $(id).value = v ?? '';
    }
  }
  renderLog(); redraw();
  quests.render(state);
  renderHeroes();
  const mq = state.quests.find((q) => q.id === state.myQuest);
  $('#qbanner').hidden = !(me.role === 'player' && mq);
  if (mq) $('#qbanner').textContent = '★ Актуальное задание: ' + mq.title;
}
let raf = null, lastTs = 0, lastDraw = 0;
function loop(ts) {
  raf = null;
  if (!state) return;
  if (ts - lastDraw < 30) { raf = requestAnimationFrame(loop); return; }
  const dt = Math.min(0.06, (ts - (lastTs || ts)) / 1000); lastTs = ts; lastDraw = ts;
  const active = tickActors(state, dt, ts);
  drawMap($('#map'), state, selId, view, ts);
  if (active) raf = requestAnimationFrame(loop); else lastTs = 0;
}
const redraw = () => { if (state && !raf) raf = requestAnimationFrame(loop); };
setSpriteLoadHandler(redraw);
for (const r of RACES) { const o = document.createElement('option'); o.value = r; $('#races').appendChild(o); }
window.addEventListener('resize', redraw);

function renderLog() {
  const box = $('#log'); box.textContent = '';
  for (const e of [...state.log].reverse()) {
    const d = document.createElement('div'); d.className = e.kind; d.textContent = e.text; box.appendChild(d);
  }
}

// профиль (раса/класс/уровень)
let ptimer;
for (const [id, key] of [['#pr-race', 'race'], ['#pr-class', 'class'], ['#pr-level', 'level']]) {
  $(id).addEventListener('input', () => {
    clearTimeout(ptimer);
    ptimer = setTimeout(() => {
      const t = ownToken(); if (!t) return;
      socket.emit('character:update', { tokenId: t.id, patch: { [key]: $(id).value } }, () => {});
    }, 400);
  });
}

// ---------- карта: выбор, перетаскивание, масштаб ----------
const map = $('#map');
const ptrs = new Map();
let pan = null, pinch = null, tap = null;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function zoomAt(cx, cy, ns) {
  ns = Math.max(1, Math.min(MAXZ, ns));
  const k = ns / view.s;
  view.x = cx - (cx - view.x) * k; view.y = cy - (cy - view.y) * k; view.s = ns;
  redraw();
}
function finishDrag() {
  if (!drag) return;
  const t = state.tokens.find((x) => x.id === drag.id);
  if (drag.moved && t) socket.emit('token:move', { id: t.id, x: t.x, y: t.y }, () => {});
  drag = null;
}
map.addEventListener('pointerdown', (e) => {
  map.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) {
    finishDrag(); pan = null;
    const [a, b] = [...ptrs.values()];
    pinch = { d: dist(a, b) || 1, s: view.s };
    return;
  }
  const cell = cellFromEvent(map, state, e, view);
  const t = hitToken(state, cell);
  const buildingIndex = !t && state.scene ? state.scene.buildings.findIndex((b) =>
    ['smithy', 'armorer', 'library', 'market', 'shop'].includes(b.type) &&
    cell.x >= b.x && cell.x < b.x + b.w && cell.y >= b.y && cell.y < b.y + b.h) : -1;
  tap = { x: e.clientX, y: e.clientY, tok: t || null, buildingIndex,
    board: !t && !!state.scene && state.scene.buildings.some((b) => b.type === 'board' && cell.x >= b.x && cell.x < b.x + b.w && cell.y >= b.y && cell.y < b.y + b.h) };
  if (t) {
    selId = t.id; renderAll();
    if (canEditTok(t)) drag = { id: t.id, moved: false };
  } else {
    pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  }
});
map.addEventListener('pointermove', (e) => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], r = map.getBoundingClientRect();
    zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, pinch.s * dist(a, b) / pinch.d);
  } else if (drag) {
    const t = state.tokens.find((x) => x.id === drag.id), c = cellFromEvent(map, state, e, view);
    if (t.x !== c.x || t.y !== c.y) { t.x = c.x; t.y = c.y; drag.moved = true; redraw(); }
  } else if (pan) {
    view.x = pan.vx + (e.clientX - pan.x); view.y = pan.vy + (e.clientY - pan.y); redraw();
  }
});
const endPtr = (e) => {
  if (tap && e.type === 'pointerup' && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 8 && !(drag && drag.moved)) {
    if (tap.tok && tap.tok.type === 'npc' && (tap.tok.talk || tap.tok.quest)) openDialog(tap.tok);
    else if (tap.buildingIndex >= 0) {
      const index = tap.buildingIndex;
      socket.emit('shop:open', { buildingIndex: index }, (r) => {
        if (r?.ok) shop.open(r, index);
        else alert(r?.error || 'Не удалось открыть магазин');
      });
    }
    else if (tap.board) showTab('quests');
  }
  tap = null;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  finishDrag(); pan = null;
};
map.addEventListener('pointerup', endPtr);
map.addEventListener('pointercancel', endPtr);
map.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = map.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, view.s * (e.deltaY < 0 ? 1.25 : 0.8));
}, { passive: false });
const mid = () => { const r = map.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };
$('#z-in').onclick = () => zoomAt(...mid(), view.s * 1.5);
$('#z-out').onclick = () => zoomAt(...mid(), view.s / 1.5);
$('#z-reset').onclick = () => { view = { s: 1, x: 0, y: 0 }; redraw(); };
$('#z-focus').onclick = () => {
  const t = selected(); if (!t) return;
  const r = map.getBoundingClientRect(), cell = r.width / state.map.w;
  view.s = Math.max(view.s, 3);
  view.x = r.width / 2 - (t.x + 0.5) * cell * view.s;
  view.y = r.height / 2 - (t.y + 0.5) * cell * view.s;
  redraw();
};

// ---------- вкладки ----------
function showTab(n) {
  for (const x of $('#tabs').children) x.classList.toggle('on', x.dataset.tab === n);
  for (const k of ['sheet', 'inv', 'quests', 'log', 'master']) $('#p-' + k).hidden = k !== n;
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });
$('#qbanner').onclick = () => showTab('quests');

// ---------- диалог с жителем ----------
let dlgTok = null;
function openDialog(t) {
  dlgTok = t;
  $('#dlg-name').textContent = t.name;
  $('#dlg-sub').textContent = [t.race, t.role].filter(Boolean).join(', ');
  $('#dlg-text').textContent = t.say ? t.say.text : (t.talk ? t.talk.text : '');
  const q = t.quest, box = $('#dlg-quest');
  box.hidden = !q; box.textContent = '';
  if (q) {
    const a1 = document.createElement('div'); a1.className = 'q-title'; a1.textContent = 'Задание: ' + q.title;
    const a2 = document.createElement('div'); a2.className = 'q-desc'; a2.textContent = q.description;
    const a3 = document.createElement('div'); a3.className = 'q-meta'; a3.textContent = q.reward ? 'Награда: ' + q.reward : '';
    box.append(a1, a2, a3);
  }
  $('#dlg-take').hidden = !(me.role === 'player' && q && q.status === 'open' && !q.taken);
  $('#dlg-say').hidden = me.role !== 'master';
  $('#dialog').hidden = false;
}
$('#dlg-close').onclick = () => { $('#dialog').hidden = true; };
$('#dialog').addEventListener('click', (e) => { if (e.target.id === 'dialog') $('#dialog').hidden = true; });
$('#dlg-take').onclick = () => {
  if (!dlgTok || !dlgTok.quest) return;
  socket.emit('quest:take', { id: dlgTok.quest.id }, (r) => { if (r && r.ok) { $('#dialog').hidden = true; showTab('quests'); } else alert((r && r.error) || 'Не удалось'); });
};
$('#dlg-say-go').onclick = () => { if (dlgTok && $('#dlg-say-in').value.trim()) { socket.emit('npc:say', { id: dlgTok.id, text: $('#dlg-say-in').value }, () => {}); $('#dlg-say-in').value = ''; $('#dialog').hidden = true; } };


// ---------- герои (мастер) ----------
function renderHeroes() {
  const box = $('#heroes'); if (!box || me.role !== 'master') return;
  box.textContent = '';
  const mk = (t, fn, alt) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sheet-btn small' + (alt ? ' alt' : ''); b.textContent = t; b.onclick = fn; return b; };
  for (const h of state.roster || []) {
    const row = document.createElement('div'); row.className = 'game-card';
    const info = document.createElement('div'); info.className = 'g-info';
    const b = document.createElement('b'); b.textContent = h.name;
    info.append(b, document.createTextNode((h.race ? ' · ' + h.race : '') + (h.user ? ' · игрок ' + h.user : '') + (h.benched ? ' · в запасе' : '')));
    const act = document.createElement('div'); act.className = 'q-actions';
    if (h.benched) {
      act.append(mk('Вернуть', () => socket.emit('hero:restore', { id: h.id }, () => {})),
        mk('Удалить', () => { if (confirm('Удалить героя ' + h.name + ' навсегда вместе со статами?')) socket.emit('hero:delete', { id: h.id }, () => {}); }, true));
    } else {
      act.append(mk('Убрать', () => { if (confirm('Убрать героя ' + h.name + ' из игры? Статы сохранятся, он вернётся, когда игрок зайдёт снова.')) socket.emit('hero:bench', { id: h.id }, () => {}); }, true));
    }
    row.append(info, act); box.appendChild(row);
  }
  if (!box.children.length) { const d = document.createElement('div'); d.className = 'dim'; d.textContent = 'Героев пока нет.'; box.appendChild(d); }
}
socket.on('kicked', (d) => { me.role = null; me.code = ''; state = null; showLobby(); err(d && d.message); });

// ---------- кубы ----------
$('#dice-go').onclick = () => socket.emit('dice:roll', { expr: $('#dice-expr').value }, (r) => { if (!r?.ok) alert(r?.error || 'Ошибка'); });

// ---------- мастер ----------
function addChat(text, me2) {
  const d = document.createElement('div'); if (me2) d.className = 'me'; d.textContent = text;
  $('#chat').appendChild(d); $('#chat').scrollTop = 1e9;
}
function actionText(a) {
  switch (a.type) {
    case 'move_token': return `${a.name} → (${a.x}, ${a.y})`;
    case 'add_token': return `+ ${a.kind === 'npc' ? 'НПС' : 'Враг'} ${a.name}, ХП ${a.hp}, (${a.x}, ${a.y})`;
    case 'set_hp': return `ХП ${a.name}: ${a.value != null ? '=' + a.value : (a.delta > 0 ? '+' : '') + a.delta}`;
    case 'describe_location': return `Локация: ${a.name}`;
    case 'open_location': return `Открыть: ${a.name} (${(a.buildings || []).map((b) => b.name || b.type).join(', ')})`;
    case 'close_location': return 'Вернуться на карту мира';
    case 'generate_encounter': return `Бой «${a.title}»: ${(a.enemies || []).map((e) => e.name).join(', ')}`;
    default: return a.type;
  }
}
$('#ai-send').onclick = () => {
  const text = $('#ai-text').value.trim(); if (!text) return;
  addChat(text, true); $('#ai-text').value = ''; $('#ai-send').disabled = true;
  socket.emit('master:ai', { text }, (r) => {
    $('#ai-send').disabled = false;
    if (!r?.ok) return addChat('Ошибка: ' + (r?.error || 'нет ответа'));
    if (r.reply) addChat(r.reply);
    proposal = r.actions || [];
    $('#prop-list').textContent = proposal.map(actionText).join('\n');
    $('#prop-list').style.whiteSpace = 'pre-wrap';
    $('#proposal').hidden = !proposal.length;
  });
};
$('#apply').onclick = () => socket.emit('master:apply', { actions: proposal }, () => { proposal = []; $('#proposal').hidden = true; addChat('Применено, игроки видят изменения.'); });
$('#discard').onclick = () => { proposal = []; $('#proposal').hidden = true; };
const add = (type) => socket.emit('token:add', { name: $('#m-name').value, type, hp: +$('#m-hp').value || 10 }, () => {});
$('#m-enemy').onclick = () => add('enemy');
$('#m-npc').onclick = () => add('npc');
$('#m-loc').onclick = () => socket.emit('location:set', { name: $('#m-locname').value, description: $('#m-locdesc').value }, () => {});
$('#m-leave').onclick = () => socket.emit('scene:close', {}, () => {});
$('#m-world').onclick = () => socket.emit('map:set', { w: 40, h: 28, bg: '/world.jpg' }, () => {});
$('#m-map').onclick = () => socket.emit('map:set', { w: +$('#m-w').value || state.map.w, h: +$('#m-h').value || state.map.h, bg: $('#m-bg').value }, () => {});
$('#m-del').onclick = () => {
  const t = selected(); if (!t) return;
  if (t.type === 'player') { if (confirm('Убрать героя ' + t.name + ' из игры? Статы сохранятся.')) socket.emit('hero:bench', { id: t.id }, () => {}); }
  else if (confirm('Удалить токен?')) socket.emit('token:remove', { id: t.id }, () => {});
};
$('#m-hide').onclick = () => { const t = selected(); if (t) socket.emit('token:hide', { id: t.id, hidden: !t.hidden }, () => {}); };
