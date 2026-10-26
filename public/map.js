// Карта на canvas: фон, сетка, токены, масштаб и сдвиг (view = {s, x, y}).
const bgCache = new Map();
function bgImage(url, cb) {
  if (!url) return null;
  const c = bgCache.get(url);
  if (c) return c.complete && c.naturalWidth ? c : null;
  const img = new Image(); img.onload = cb; img.src = url; bgCache.set(url, img);
  return null;
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
  const img = bgImage(state.map.bg, () => drawMap(canvas, state, selId, view));
  if (img) g.drawImage(img, 0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 1 / view.s;
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
