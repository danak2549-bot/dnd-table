// Сервер: комнаты, роли, токены, лист персонажа, кубы, ИИ-помощник мастера.
import express from 'express';
import http from 'http';
import fs from 'fs';
import crypto from 'crypto';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3000;
const FILE = process.env.DATA_FILE || './data.json';
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const KEY = process.env.ANTHROPIC_API_KEY;
// Бесплатный вариант: ключ Groq (console.groq.com), без карты.
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const app = express();
app.use(express.static('public'));
const server = http.createServer(app);
const io = new Server(server);

// ---------- хранилище ----------
const rooms = new Map();
try { for (const r of JSON.parse(fs.readFileSync(FILE, 'utf8'))) rooms.set(r.code, r); } catch {}
let saveT;
const save = () => {
  clearTimeout(saveT);
  saveT = setTimeout(() => fs.writeFile(FILE, JSON.stringify([...rooms.values()]), () => {}), 500);
};

// ---------- утилиты ----------
const rid = (n = 6) => crypto.randomBytes(n).toString('hex').slice(0, n);
const int = (v, min, max, d = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const str = (v, n) => String(v ?? '').slice(0, n);
const COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffd54f', '#ba68c8', '#4db6ac', '#ff8a65', '#a1887f'];
// Карта мира 1499x1049 px -> сетка 40x28. Ориентиры в пикселях картинки.
const GRID_W = 40, GRID_H = 28;
const LANDMARKS = [
  ['Лорнэйдар (город эльфов)', 275, 125], ['Траун (королевство эльфов)', 350, 330], ['Деревня Маунтайн', 410, 470],
  ['Горы Серебряного Клыка', 700, 90], ['Деревня Василиск', 690, 150], ['Дремучий Лес', 950, 170],
  ['Грозовой Пик', 1200, 135], ['Морской Утес', 1395, 255], ['Соленый Порт', 1390, 400],
  ['Каменный Град (Марокко, королевство людей)', 650, 380], ['Пещера Эха', 665, 525],
  ['Стальград (столица Аарда, королевство людей)', 990, 490], ['Золотонка', 830, 520], ['Старый Мост', 1190, 580],
  ['Дубравное', 960, 630], ['Вечнозелёный Лес', 540, 675], ['Тихие Топи', 270, 535],
  ['Мираж (королевство полуросликов)', 715, 760], ['Хоббитон', 700, 850],
  ['Королевство дварфов Магор', 1100, 930], ['Подземные Глубины', 1150, 870],
  ['Красное Ущелье', 1350, 550], ['Каньон Страха', 1355, 670], ['Пески Забвения', 1360, 955],
  ['Остров Отчаяния', 305, 910],
].map(([name, px, py]) => ({ name, x: Math.round((px / 1499) * GRID_W), y: Math.round((py / 1049) * GRID_H) }));
const SPAWN = LANDMARKS.find((l) => l.name.startsWith('Стальград'));
const SLOTS = ['head', 'body', 'hands', 'legs', 'feet', 'accessory'];

const res = (v) => { const max = int(v?.max, 0, 9999); return { cur: int(v?.cur, 0, 9999), max }; };
const acts = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 30).map((a) => ({
  id: str(a?.id, 40) || 'c' + rid(8),
  name: str(a?.name, 60),
  description: str(a?.description, 400),
  apCost: int(a?.apCost, 0, 20, 1),
  manaCost: int(a?.manaCost, 0, 999),
  range: int(a?.range, 0, 50, 1),
  effect: {
    type: ['damage', 'heal', 'none'].includes(a?.effect?.type) ? a.effect.type : 'none',
    dice: str(a?.effect?.dice, 20),
  },
}));
const SANITIZE = {
  hp: res, mana: res, ap: res,
  stats: (o) => {
    const out = {};
    for (const [k, v] of Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 20)) {
      const key = str(k, 30).trim();
      if (key) out[key] = int(v, -999, 999);
    }
    return out;
  },
  weapons: acts, skills: acts, spells: acts,
  equipment: (o) => Object.fromEntries(SLOTS.map((s) => [s, str(o?.[s], 80)])),
  notes: (v) => str(v, 2000),
  race: (v) => str(v, 40),
  class: (v) => str(v, 40),
  level: (v) => int(v, 1, 30, 1),
};

function newCharacter(hp = 20, mana = 10) {
  return {
    race: '', class: '', level: 1,
    hp: { cur: hp, max: hp }, mana: { cur: mana, max: mana }, ap: { cur: 3, max: 3 },
    stats: { Сила: 10, Ловкость: 10, Интеллект: 10 },
    weapons: [], skills: [], spells: [],
    equipment: Object.fromEntries(SLOTS.map((s) => [s, ''])),
    notes: '',
  };
}

function freeCell(room) {
  const taken = new Set(Object.values(room.tokens).map((t) => t.x + ',' + t.y));
  const sp = room.spawn || { x: 0, y: 0 };
  let best = null, bd = Infinity;
  for (let y = 0; y < room.map.h; y++)
    for (let x = 0; x < room.map.w; x++) {
      if (taken.has(x + ',' + y)) continue;
      const d = (x - sp.x) ** 2 + (y - sp.y) ** 2;
      if (d < bd) { bd = d; best = { x, y }; }
    }
  return best || { x: 0, y: 0 };
}

function createRoom() {
  const room = {
    code: rid(5).toUpperCase(), masterKey: rid(16),
    map: { w: GRID_W, h: GRID_H, bg: '/world.jpg' }, spawn: { x: SPAWN.x, y: SPAWN.y },
    tokens: {}, log: [], location: { name: 'Стальград', description: 'Столица Аарда. Отсюда начинается путь.' }, chat: [],
  };
  rooms.set(room.code, room);
  save();
  return room;
}

function addToken(room, { name, type, x, y, owner = null, character, hidden = false }) {
  const pos = x == null || y == null ? freeCell(room) : { x, y };
  const t = {
    id: 't' + rid(8), name: str(name, 40) || 'Безымянный', type,
    x: int(pos.x, 0, room.map.w - 1), y: int(pos.y, 0, room.map.h - 1),
    owner, hidden,
    color: type === 'enemy' ? '#c0392b' : type === 'npc' ? '#8e8e8e' : COLORS[Object.keys(room.tokens).length % COLORS.length],
    character: character || newCharacter(),
  };
  room.tokens[t.id] = t;
  return t;
}

function log(room, text, kind = 'info') {
  room.log.push({ t: Date.now(), kind, text: str(text, 600) });
  if (room.log.length > 200) room.log.shift();
}

// Что видит каждый зритель (скрываем чужие данные).
function viewToken(t, s) {
  const base = { id: t.id, name: t.name, x: t.x, y: t.y, type: t.type, owner: t.owner, color: t.color, hidden: t.hidden };
  const c = t.character;
  if (s.data.role === 'master' || t.owner === s.data.pid) return { ...base, character: c };
  if (t.type === 'player') {
    return { ...base, character: { race: c.race, hp: c.hp, mana: c.mana, ap: c.ap, equipment: c.equipment } };
  }
  return { ...base, character: { dead: c.hp.cur <= 0, hpPct: c.hp.max ? Math.round((c.hp.cur / c.hp.max) * 100) : 0 } };
}

function emitState(room) {
  save();
  for (const [, s] of io.sockets.sockets) {
    if (s.data.code !== room.code) continue;
    const master = s.data.role === 'master';
    s.emit('state:sync', {
      map: room.map, location: room.location,
      tokens: Object.values(room.tokens).filter((t) => master || !t.hidden).map((t) => viewToken(t, s)),
      log: room.log.slice(-60),
    });
  }
}

function roll(expr) {
  const m = /^(\d{0,2})d(\d{1,3})([+-]\d{1,3})?$/i.exec(String(expr).replace(/\s/g, ''));
  if (!m) return null;
  const n = Math.max(1, +m[1] || 1), faces = +m[2], bonus = +(m[3] || 0);
  if (faces < 2) return null;
  const rolls = Array.from({ length: n }, () => 1 + crypto.randomInt(faces));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) + bonus, expr: `${n}d${faces}${m[3] || ''}` };
}

// ---------- ИИ-помощник мастера ----------
const obj = (properties, required) => ({ type: 'object', properties, required });
const TOOLS = [
  { name: 'move_token', description: 'Переместить токен на клетку карты.',
    input_schema: obj({ name: { type: 'string' }, x: { type: 'integer' }, y: { type: 'integer' } }, ['name', 'x', 'y']) },
  { name: 'add_token', description: 'Добавить на карту НПС или врага.',
    input_schema: obj({ name: { type: 'string' }, kind: { type: 'string', enum: ['enemy', 'npc'] },
      x: { type: 'integer' }, y: { type: 'integer' }, hp: { type: 'integer' }, mana: { type: 'integer' } }, ['name', 'kind', 'x', 'y', 'hp']) },
  { name: 'set_hp', description: 'Изменить ХП токена: delta (урон отрицательный, лечение положительное) или абсолютное значение value.',
    input_schema: obj({ name: { type: 'string' }, delta: { type: 'integer' }, value: { type: 'integer' } }, ['name']) },
  { name: 'describe_location', description: 'Задать название и описание текущей локации для всех игроков.',
    input_schema: obj({ name: { type: 'string' }, description: { type: 'string' } }, ['name', 'description']) },
  { name: 'generate_encounter', description: 'Создать боевую сцену: описание и список врагов с позициями на карте.',
    input_schema: obj({ title: { type: 'string' }, description: { type: 'string' },
      enemies: { type: 'array', items: obj({ name: { type: 'string' }, hp: { type: 'integer' },
        x: { type: 'integer' }, y: { type: 'integer' } }, ['name', 'hp', 'x', 'y']) } }, ['title', 'description', 'enemies']) },
];

async function askClaude(room, text) {
  if (!GROQ_KEY && !KEY) throw new Error('ИИ не настроен: задайте GROQ_API_KEY (бесплатно) на сервере');
  const world = {
    карта: { ширина: room.map.w, высота: room.map.h },
    локация: room.location,
    токены: Object.values(room.tokens).map((t) => ({
      имя: t.name, тип: t.type, x: t.x, y: t.y,
      хп: `${t.character.hp.cur}/${t.character.hp.max}`, мана: `${t.character.mana.cur}/${t.character.mana.max}`,
      раса: t.character.race, класс: t.character.class,
    })),
  };
  const system = 'Ты помощник мастера настольной игры в стиле D&D. Отвечай по-русски, кратко и атмосферно. ' +
    'Изменения на карте и в мире делай ТОЛЬКО через инструменты, координаты в пределах карты (с нуля). ' +
    'Не придумывай токены, которых нет в списке, для move_token и set_hp. ' +
    (room.map.bg === '/world.jpg'
      ? 'Карта мира: сетка 40x28, одна клетка около 15 км. Север вверху. Море по краям (особенно слева, снизу и сверху справа), не ставь туда токены. Ориентиры (клетка x,y): ' +
        LANDMARKS.map((l) => `${l.name} (${l.x},${l.y})`).join('; ') + '. Для засад и встреч ставь токены на сушу рядом с подходящим ориентиром, на разных клетках. '
      : '') +
    'Текущее состояние: ' + JSON.stringify(world);
  room.chat.push({ role: 'user', content: text });
  room.chat = room.chat.slice(-12);
  let reply = '';
  const actions = [];
  if (GROQ_KEY) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + GROQ_KEY },
      body: JSON.stringify({
        model: GROQ_MODEL, max_tokens: 1200, temperature: 0.7,
        tools: TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })),
        messages: [{ role: 'system', content: system }, ...room.chat],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'Ошибка ИИ (возможно, лимит запросов, подождите минуту)');
    const msg = data.choices?.[0]?.message || {};
    reply = msg.content || '';
    for (const c of msg.tool_calls || []) {
      try { actions.push({ type: c.function.name, ...JSON.parse(c.function.arguments || '{}') }); } catch {}
    }
  } else {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, tools: TOOLS, system, messages: room.chat }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'Ошибка ИИ');
    for (const b of data.content || []) {
      if (b.type === 'text') reply += b.text;
      if (b.type === 'tool_use') actions.push({ type: b.name, ...b.input });
    }
  }
  room.chat.push({ role: 'assistant', content: reply || '(изменения предложены)' });
  return { reply: reply.trim(), actions };
}

const byName = (room, n) => Object.values(room.tokens).find((t) => t.name.toLowerCase() === String(n).toLowerCase());
const clampPos = (room, x, y) => ({ x: int(x, 0, room.map.w - 1), y: int(y, 0, room.map.h - 1) });

function applyAction(room, a) {
  switch (a.type) {
    case 'move_token': {
      const t = byName(room, a.name); if (!t) return;
      Object.assign(t, clampPos(room, a.x, a.y));
      log(room, `${t.name} перемещается на (${t.x}, ${t.y})`);
      break;
    }
    case 'add_token': {
      const p = clampPos(room, a.x, a.y);
      const t = addToken(room, { name: a.name, type: a.kind === 'npc' ? 'npc' : 'enemy', ...p,
        character: newCharacter(int(a.hp, 1, 9999, 10), int(a.mana, 0, 9999, 0)) });
      log(room, `На карте появляется: ${t.name}`);
      break;
    }
    case 'set_hp': {
      const t = byName(room, a.name); if (!t) return;
      const hp = t.character.hp;
      hp.cur = a.value != null ? int(a.value, 0, hp.max) : int(hp.cur + int(a.delta, -9999, 9999), 0, hp.max);
      log(room, `${t.name}: ХП ${hp.cur}/${hp.max}`);
      break;
    }
    case 'describe_location':
      room.location = { name: str(a.name, 80), description: str(a.description, 1500) };
      log(room, `Локация: ${room.location.name}. ${room.location.description}`, 'story');
      break;
    case 'generate_encounter':
      room.location = { name: str(a.title, 80), description: str(a.description, 1500) };
      log(room, `⚔ ${room.location.name}. ${room.location.description}`, 'story');
      for (const e of (a.enemies || []).slice(0, 12)) {
        addToken(room, { name: e.name, type: 'enemy', ...clampPos(room, e.x, e.y), character: newCharacter(int(e.hp, 1, 9999, 10), 0) });
      }
      break;
  }
}

// ---------- сокеты ----------
io.on('connection', (socket) => {
  socket.data = { code: null, role: null, pid: null };
  const room = () => rooms.get(socket.data.code);
  const master = () => socket.data.role === 'master';
  const safe = (fn) => (...args) => {
    const ack = typeof args[args.length - 1] === 'function' ? args.pop() : () => {};
    try { fn(args[0] || {}, ack); } catch (e) { ack({ ok: false, error: e.message }); }
  };

  socket.on('room:create', safe((_, ack) => {
    const r = createRoom();
    ack({ ok: true, code: r.code, masterKey: r.masterKey });
  }));

  socket.on('room:join', safe(({ code, name, pid, masterKey }, ack) => {
    const r = rooms.get(String(code || '').toUpperCase());
    if (!r) return ack({ ok: false, error: 'Комната не найдена' });
    socket.data.code = r.code;
    if (masterKey) {
      if (masterKey !== r.masterKey) return ack({ ok: false, error: 'Неверный ключ мастера' });
      socket.data.role = 'master'; socket.data.pid = 'master';
    } else {
      pid = str(pid, 40) || 'p' + rid(10);
      socket.data.role = 'player'; socket.data.pid = pid;
      if (!Object.values(r.tokens).some((t) => t.owner === pid)) {
        const t = addToken(r, { name: name || 'Герой', type: 'player', owner: pid });
        log(r, `${t.name} присоединяется к приключению`);
      }
    }
    socket.join(r.code);
    ack({ ok: true, role: socket.data.role, pid: socket.data.pid });
    emitState(r);
  }));

  socket.on('character:update', safe(({ tokenId, patch }, ack) => {
    const r = room(); const t = r?.tokens[tokenId];
    if (!t) return ack({ ok: false, error: 'Токен не найден' });
    if (!master() && t.owner !== socket.data.pid) return ack({ ok: false, error: 'Нет прав' });
    if (!patch || typeof patch !== 'object') return ack({ ok: false, error: 'Пустой патч' });
    for (const [k, v] of Object.entries(patch)) if (SANITIZE[k]) t.character[k] = SANITIZE[k](v);
    ack({ ok: true });
    emitState(r);
  }));

  socket.on('token:move', safe(({ id, x, y }, ack) => {
    const r = room(); const t = r?.tokens[id];
    if (!t || (!master() && t.owner !== socket.data.pid)) return ack({ ok: false });
    Object.assign(t, clampPos(r, x, y));
    ack({ ok: true });
    emitState(r);
  }));

  socket.on('token:add', safe((d, ack) => {
    const r = room(); if (!r || !master()) return ack({ ok: false });
    const type = ['enemy', 'npc'].includes(d.type) ? d.type : 'enemy';
    addToken(r, { name: d.name, type, x: d.x, y: d.y, hidden: !!d.hidden,
      character: newCharacter(int(d.hp, 1, 9999, 10), int(d.mana, 0, 9999, 0)) });
    ack({ ok: true });
    emitState(r);
  }));

  socket.on('token:remove', safe(({ id }, ack) => {
    const r = room(); if (!r || !master()) return ack({ ok: false });
    delete r.tokens[id];
    ack({ ok: true });
    emitState(r);
  }));

  socket.on('token:hide', safe(({ id, hidden }, ack) => {
    const r = room(); if (!r || !master() || !r.tokens[id]) return ack({ ok: false });
    r.tokens[id].hidden = !!hidden;
    ack({ ok: true });
    emitState(r);
  }));

  socket.on('map:set', safe((d, ack) => {
    const r = room(); if (!r || !master()) return ack({ ok: false });
    r.map.w = int(d.w, 5, 60, r.map.w);
    r.map.h = int(d.h, 5, 60, r.map.h);
    r.map.bg = /^(https?:\/\/\S{1,500}|\/[\w.-]{1,60})$/.test(d.bg || '') ? d.bg : '';
    if (r.map.bg === '/world.jpg') r.spawn = { x: SPAWN.x, y: SPAWN.y };
    for (const t of Object.values(r.tokens)) Object.assign(t, clampPos(r, t.x, t.y));
    ack({ ok: true });
    emitState(r);
  }));

  socket.on('location:set', safe((d, ack) => {
    const r = room(); if (!r || !master()) return ack({ ok: false });
    r.location = { name: str(d.name, 80), description: str(d.description, 1500) };
    log(r, `Локация: ${r.location.name}. ${r.location.description}`, 'story');
    ack({ ok: true });
    emitState(r);
  }));

  socket.on('dice:roll', safe(({ expr }, ack) => {
    const r = room(); if (!r) return ack({ ok: false });
    const res2 = roll(expr);
    if (!res2) return ack({ ok: false, error: 'Формат: 2d6+1' });
    const who = master() ? 'Мастер' : Object.values(r.tokens).find((t) => t.owner === socket.data.pid)?.name || 'Игрок';
    log(r, `🎲 ${who} бросает ${res2.expr}: [${res2.rolls.join(', ')}] = ${res2.total}`, 'dice');
    ack({ ok: true });
    emitState(r);
  }));

  socket.on('master:ai', safe(async ({ text }, ack) => {
    const r = room(); if (!r || !master()) return ack({ ok: false, error: 'Только для мастера' });
    try { ack({ ok: true, ...(await askClaude(r, str(text, 2000))) }); }
    catch (e) { ack({ ok: false, error: e.message }); }
  }));

  socket.on('master:apply', safe(({ actions }, ack) => {
    const r = room(); if (!r || !master()) return ack({ ok: false });
    for (const a of (Array.isArray(actions) ? actions : []).slice(0, 20)) applyAction(r, a);
    ack({ ok: true });
    emitState(r);
  }));
});

server.listen(PORT, () => console.log('Стол запущен: http://localhost:' + PORT));
