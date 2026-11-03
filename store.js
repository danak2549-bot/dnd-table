// Хранилище: Upstash Redis (бесплатно, переживает перезапуски Render) или файл data.json для локального запуска.
import fs from 'fs';

const URL_ = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const FILE = process.env.DATA_FILE || './data.json';
export const usingKV = !!(URL_ && TOKEN);

async function cmd(args) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || 'KV ' + r.status);
  return j.result;
}

let fileState = { users: {}, rooms: {} };
let fileTimer = null;
const knownCodes = new Set();
const writeFileSoon = () => {
  clearTimeout(fileTimer);
  fileTimer = setTimeout(() => fs.writeFile(FILE, JSON.stringify(fileState), () => {}), 300);
};

export async function loadAll() {
  if (usingKV) {
    const codes = (await cmd(['SMEMBERS', 'dnd:rooms'])) || [];
    const users = JSON.parse((await cmd(['GET', 'dnd:users'])) || '{}');
    const rooms = [];
    for (const c of codes) {
      const v = await cmd(['GET', 'dnd:room:' + c]);
      if (v) { rooms.push(JSON.parse(v)); knownCodes.add(c); }
    }
    return { users, rooms };
  }
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (Array.isArray(d)) fileState = { users: {}, rooms: Object.fromEntries(d.map((r) => [r.code, r])) };
    else fileState = { users: d.users || {}, rooms: d.rooms || {} };
  } catch {}
  return { users: fileState.users, rooms: Object.values(fileState.rooms) };
}

export async function saveRoom(room) {
  if (usingKV) {
    await cmd(['SET', 'dnd:room:' + room.code, JSON.stringify(room)]);
    if (!knownCodes.has(room.code)) { await cmd(['SADD', 'dnd:rooms', room.code]); knownCodes.add(room.code); }
    return;
  }
  fileState.rooms[room.code] = room;
  writeFileSoon();
}

export async function saveUsers(users) {
  if (usingKV) { await cmd(['SET', 'dnd:users', JSON.stringify(users)]); return; }
  fileState.users = users;
  writeFileSoon();
}
