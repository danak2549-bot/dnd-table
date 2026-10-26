// Карта на canvas: сетка, токены, полоски ХП.
const bgCache = new Map();
function bgImage(url, cb) {
  if (!url) return null;
  const c = bgCache.get(url);
  if (c) return c.complete && c.naturalWidth ? c : null;
  const img = new Image(); img.onload = cb; img.src = url; bgCache.set(url, img);
  return null;
}

export function drawMap(canvas, state, selId) {
  const { w, h } = state.map;
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 360;
  const cell = cssW / w;
  canvas.width = cssW * dpr; canvas.height = cell * h * dpr;
  canvas.style.height = cell * h + 'px';
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = '#101117'; g.fillRect(0, 0, cssW, cell * h);
  const img = bgImage(state.map.bg, () => drawMap(canvas, state, selId));
  if (img) g.drawImage(img, 0, 0, cssW, cell * h);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
  for (let i = 0; i <= w; i++) { g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, h * cell); g.stroke(); }
  for (let j = 0; j <= h; j++) { g.beginPath(); g.moveTo(0, j * cell); g.lineTo(w * cell, j * cell); g.stroke(); }
  for (const t of state.tokens) {
    const cx = t.x * cell + cell / 2, cy = t.y * cell + cell / 2, r = cell * 0.42;
    const dead = t.character?.dead || t.character?.hp?.cur === 0;
    g.globalAlpha = t.hidden ? 0.4 : dead ? 0.5 : 1;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = t.color || '#888'; g.fill();
    g.lineWidth = t.id === selId ? 3 : 1.5;
    g.strokeStyle = t.id === selId ? '#fff' : 'rgba(0,0,0,.6)'; g.stroke();
    g.fillStyle = '#fff'; g.font = `600 ${Math.max(10, cell * 0.4)}px system-ui`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(dead ? '✕' : (t.name[0] || '?').toUpperCase(), cx, cy);
    const c = t.character;
    const pct = c?.hp ? (c.hp.max ? c.hp.cur / c.hp.max : 0) : (c?.hpPct ?? 0) / 100;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(cx - r, cy + r + 1, r * 2, 4);
    g.fillStyle = pct > 0.5 ? '#6fcf97' : pct > 0.25 ? '#ffd54f' : '#ff7a7a';
    g.fillRect(cx - r, cy + r + 1, r * 2 * Math.max(0, Math.min(1, pct)), 4);
    g.globalAlpha = 1;
  }
}

export function cellFromEvent(canvas, state, e) {
  const r = canvas.getBoundingClientRect();
  const cell = r.width / state.map.w;
  return {
    x: Math.max(0, Math.min(state.map.w - 1, Math.floor((e.clientX - r.left) / cell))),
    y: Math.max(0, Math.min(state.map.h - 1, Math.floor((e.clientY - r.top) / cell))),
  };
}
export const hitToken = (state, c) => [...state.tokens].reverse().find((t) => t.x === c.x && t.y === c.y) || null;
