// Карта на canvas: фон, сетка, токены, масштаб и сдвиг (view = {s, x, y}).
const bgCache = new Map();
function bgImage(url, cb) {
  if (!url) return null;
  const c = bgCache.get(url);
  if (c) return c.complete && c.naturalWidth ? c : null;
  const img = new Image(); img.onload = cb; img.src = url; bgCache.set(url, img);
  return null;
}

const TILE = { '.': ['#7fa95d', '#76a055'], r: ['#cdb682', '#c4ad78'], w: ['#3f7fbf', '#4688c8'], b: ['#8a5a2b', '#8a5a2b'], W: ['#80808a', '#76767f'], t: ['#7fa95d', '#76a055'] };
const BCOL = {
  smithy: ['#7a7a84', '#c0392b'], tavern: ['#b27a45', '#7a2e1d'], market: ['#d9b44a', '#b5483a'], temple: ['#ece6d6', '#4c6fbf'],
  shop: ['#b08d57', '#4e7a4e'], alchemist: ['#9a77c0', '#5b3a85'], stable: ['#a87b4f', '#6a4a2a'], guild: ['#6f8fb0', '#344f73'],
  castle: ['#a3a9b3', '#5b6270'], tower: ['#a3a9b3', '#5b6270'], mill: ['#cdb98f', '#8a6a3a'], farm: ['#bf9f68', '#8a3f2a'],
  barracks: ['#818a97', '#4b5563'], inn: ['#ad7f56', '#6e3b2b'], well: ['#6aa7d6', '#355f85'], house: ['#c9a878', '#8a4b3a'],
};
const ICON = { smithy: '🔨', tavern: '🍺', market: '🧺', temple: '⛪', shop: '🛒', alchemist: '⚗️', stable: '🐎', guild: '📜', castle: '🏰', tower: '🗼', mill: '🌾', farm: '🚜', barracks: '⚔️', inn: '🛏️', well: '💧' };

function drawScene(g, scene, cell, view) {
  const { w, h } = scene;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = scene.tiles[y][x], col = TILE[c] || TILE['.'];
    g.fillStyle = col[(x * 7 + y * 13) % 2]; g.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5);
    if (c === 't') {
      g.fillStyle = '#2f6b34'; g.beginPath(); g.arc((x + 0.5) * cell, (y + 0.5) * cell, cell * 0.42, 0, 7); g.fill();
      g.fillStyle = '#3d8442'; g.beginPath(); g.arc((x + 0.4) * cell, (y + 0.4) * cell, cell * 0.22, 0, 7); g.fill();
    } else if (c === 'W') {
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1 / view.s; g.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    } else if (c === 'b') {
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1 / view.s;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x * cell, (y + k / 4) * cell); g.lineTo((x + 1) * cell, (y + k / 4) * cell); g.stroke(); }
    }
  }
  for (const b of scene.buildings) {
    const [wall, roof] = BCOL[b.type] || BCOL.house;
    const x = b.x * cell, y = b.y * cell, bw = b.w * cell, bh = b.h * cell, p = cell * 0.08;
    if (b.type === 'well') {
      g.fillStyle = roof; g.beginPath(); g.arc(x + bw / 2, y + bh / 2, cell * 0.42, 0, 7); g.fill();
      g.fillStyle = wall; g.beginPath(); g.arc(x + bw / 2, y + bh / 2, cell * 0.25, 0, 7); g.fill();
      continue;
    }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + p + cell * 0.12, y + p + cell * 0.12, bw - 2 * p, bh - 2 * p);
    g.fillStyle = wall; g.fillRect(x + p, y + p, bw - 2 * p, bh - 2 * p);
    g.fillStyle = roof; g.fillRect(x + p, y + p, bw - 2 * p, (bh - 2 * p) * 0.55);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1.5 / view.s; g.strokeRect(x + p, y + p, bw - 2 * p, bh - 2 * p);
    g.fillStyle = '#3b2a1a'; g.fillRect(x + bw / 2 - cell * 0.25, y + bh - p - cell * 0.5, cell * 0.5, cell * 0.5);
    const ic = ICON[b.type];
    if (ic) {
      g.font = `${Math.min(bh, bw) * 0.42}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ic, x + bw / 2, y + bh * 0.3);
    }
  }
  if (view.s >= 1.6) {
    g.font = `700 ${cell * 0.62}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (const b of scene.buildings) {
      if (!b.name || b.type === 'house') continue;
      const tx = (b.x + b.w / 2) * cell, ty = (b.y + b.h) * cell - cell * 0.62;
      g.lineWidth = 3 / view.s; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(b.name, tx, ty);
      g.fillStyle = '#fff'; g.fillText(b.name, tx, ty);
    }
  }
}

export const MAXZ = 8;
export function clampView(view, W, H) {
  view.s = Math.max(1, Math.min(MAXZ, view.s));
  view.x = Math.min(0, Math.max(W - W * view.s, view.x));
  view.y = Math.min(0, Math.max(H - H * view.s, view.y));
}

export function drawMap(canvas, state, selId, view) {
  const { w, h } = state.map;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 360;
  const cell = W / w, H = cell * h;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.style.height = H + 'px';
  clampView(view, W, H);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#101117'; g.fillRect(0, 0, W, H);
  g.save();
  g.translate(view.x, view.y); g.scale(view.s, view.s);
  if (state.scene) drawScene(g, state.scene, cell, view);
  const img = state.scene ? null : bgImage(state.map.bg, () => drawMap(canvas, state, selId, view));
  if (img) g.drawImage(img, 0, 0, W, H);
  g.strokeStyle = state.scene ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.16)'; g.lineWidth = 1 / view.s;
  for (let i = 0; i <= w; i++) { g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, H); g.stroke(); }
  for (let j = 0; j <= h; j++) { g.beginPath(); g.moveTo(0, j * cell); g.lineTo(W, j * cell); g.stroke(); }
  for (const t of state.tokens) {
    const cx = t.x * cell + cell / 2, cy = t.y * cell + cell / 2, r = cell * 0.42;
    const dead = t.character?.dead || t.character?.hp?.cur === 0;
    g.globalAlpha = t.hidden ? 0.4 : dead ? 0.5 : 1;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = t.color || '#888'; g.fill();
    g.lineWidth = (t.id === selId ? 3 : 1.5) / view.s;
    g.strokeStyle = t.id === selId ? '#fff' : 'rgba(0,0,0,.7)'; g.stroke();
    g.fillStyle = '#fff'; g.font = `600 ${cell * 0.5}px system-ui`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(dead ? '✕' : (t.name[0] || '?').toUpperCase(), cx, cy);
    const c = t.character;
    const pct = c?.hp ? (c.hp.max ? c.hp.cur / c.hp.max : 0) : (c?.hpPct ?? 0) / 100;
    g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(cx - r, cy + r + 1 / view.s, r * 2, cell * 0.12);
    g.fillStyle = pct > 0.5 ? '#6fcf97' : pct > 0.25 ? '#ffd54f' : '#ff7a7a';
    g.fillRect(cx - r, cy + r + 1 / view.s, r * 2 * Math.max(0, Math.min(1, pct)), cell * 0.12);
    if (view.s >= 2.5) {
      g.font = `600 ${cell * 0.38}px system-ui`; g.lineWidth = 3 / view.s;
      g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(t.name, cx, cy - r - cell * 0.2);
      g.fillStyle = '#fff'; g.fillText(t.name, cx, cy - r - cell * 0.2);
    }
    g.globalAlpha = 1;
  }
  g.restore();
}

export function cellFromEvent(canvas, state, e, view) {
  const r = canvas.getBoundingClientRect();
  const cell = r.width / state.map.w;
  const wx = (e.clientX - r.left - view.x) / view.s, wy = (e.clientY - r.top - view.y) / view.s;
  return {
    x: Math.max(0, Math.min(state.map.w - 1, Math.floor(wx / cell))),
    y: Math.max(0, Math.min(state.map.h - 1, Math.floor(wy / cell))),
  };
}
export const hitToken = (state, c) => [...state.tokens].reverse().find((t) => t.x === c.x && t.y === c.y) || null;
