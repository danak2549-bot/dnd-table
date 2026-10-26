import { mountSheet } from './sheet.js';
import { drawMap, hitToken, cellFromEvent } from './map.js';

const $ = (s) => document.querySelector(s);
const socket = io();
const store = {
  get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
let me = { role: null, pid: store.get('pid') || 'p' + Math.random().toString(36).slice(2, 12), code: '' };
store.set('pid', me.pid);
let state = null, selId = null, drag = null, proposal = [];

const selected = () => state?.tokens.find((t) => t.id === selId) || null;
const ownToken = () => state?.tokens.find((t) => t.owner === me.pid) || null;
const canEditTok = (t) => !!t && (me.role === 'master' || t.owner === me.pid);

const sheet = mountSheet($('#sheet'), {
  socket, canEdit: () => canEditTok(selected()),
  getToken: () => selId,
});

// ---------- вход ----------
const err = (t) => { $('#l-err').textContent = t || ''; };
function enter(code, name, masterKey) {
  socket.emit('room:join', { code, name, pid: me.pid, masterKey }, (r) => {
    if (!r?.ok) return err(r?.error || 'Не удалось войти');
    me.role = r.role; me.code = code.toUpperCase();
    store.set('code', me.code); store.set('name', name || '');
    $('#login').hidden = true; $('#game').hidden = false;
    $('#room-code').textContent = 'Комната ' + me.code;
    $('#role').textContent = me.role === 'master' ? 'мастер' : 'игрок';
    $('#tab-master').hidden = me.role !== 'master';
    $('#profile').hidden = me.role === 'master';
    if (me.role === 'master') $('#mkey').textContent = masterKey;
  });
}
$('#l-name').value = store.get('name');
$('#l-code').value = store.get('code');
$('#l-join').onclick = () => enter($('#l-code').value.trim(), $('#l-name').value.trim(), '');
$('#l-create').onclick = () => socket.emit('room:create', {}, (r) => {
  if (!r?.ok) return err('Не удалось создать комнату');
  store.set('mk-' + r.code, r.masterKey);
  enter(r.code, '', r.masterKey);
});
$('#l-master').onclick = () => {
  const code = $('#l-code').value.trim().toUpperCase();
  enter(code, '', $('#l-key').value.trim() || store.get('mk-' + code));
};

// ---------- состояние ----------
socket.on('state:sync', (s) => {
  state = s;
  if (!selId || !s.tokens.some((t) => t.id === selId)) selId = ownToken()?.id || s.tokens[0]?.id || null;
  renderAll();
});
socket.on('disconnect', () => { err('Связь потеряна, переподключаюсь…'); });
socket.on('connect', () => { if (me.role && me.code) enter(me.code, store.get('name'), me.role === 'master' ? store.get('mk-' + me.code) || $('#mkey').textContent : ''); });

function renderAll() {
  $('#loc').textContent = state.location.name ? state.location.name + (state.location.description ? ' — ' + state.location.description : '') : '';
  sheet.render(selected());
  const t = ownToken();
  if (t && me.role !== 'master' && t.character.race !== undefined) {
    for (const [id, v] of [['#pr-race', t.character.race], ['#pr-class', t.character.class], ['#pr-level', t.character.level]]) {
      if (document.activeElement !== $(id)) $(id).value = v ?? '';
    }
  }
  renderLog(); redraw();
}
const redraw = () => state && drawMap($('#map'), state, selId);
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

// ---------- карта: выбор и перетаскивание ----------
const map = $('#map');
map.addEventListener('pointerdown', (e) => {
  const c = cellFromEvent(map, state, e);
  const t = hitToken(state, c);
  if (!t) return;
  selId = t.id; renderAll();
  if (canEditTok(t)) { drag = { id: t.id, moved: false }; map.setPointerCapture(e.pointerId); }
});
map.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const t = state.tokens.find((x) => x.id === drag.id), c = cellFromEvent(map, state, e);
  if (t.x !== c.x || t.y !== c.y) { t.x = c.x; t.y = c.y; drag.moved = true; redraw(); }
});
map.addEventListener('pointerup', () => {
  if (!drag) return;
  const t = state.tokens.find((x) => x.id === drag.id);
  if (drag.moved && t) socket.emit('token:move', { id: t.id, x: t.x, y: t.y }, () => {});
  drag = null;
});

// ---------- вкладки ----------
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  for (const x of $('#tabs').children) x.classList.toggle('on', x === b);
  for (const n of ['sheet', 'log', 'master']) $('#p-' + n).hidden = n !== b.dataset.tab;
});

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
$('#m-map').onclick = () => socket.emit('map:set', { w: +$('#m-w').value || state.map.w, h: +$('#m-h').value || state.map.h, bg: $('#m-bg').value }, () => {});
$('#m-del').onclick = () => selId && confirm('Удалить токен?') && socket.emit('token:remove', { id: selId }, () => {});
$('#m-hide').onclick = () => { const t = selected(); if (t) socket.emit('token:hide', { id: t.id, hidden: !t.hidden }, () => {}); };
