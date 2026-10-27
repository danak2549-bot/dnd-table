// Рисованный план поселения (вид сверху). Рисуется один раз в offscreen-canvas с высоким разрешением.
const hs = (str) => { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (seed, x, y, k = 0) => {
  let h = seed ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(k + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const lg = (g, x0, y0, x1, y1, c0, c1) => { const k = g.createLinearGradient(x0, y0, x1, y1); k.addColorStop(0, c0); k.addColorStop(1, c1); return k; };
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const f = k < 0 ? 0 : 255, t = Math.abs(k);
  r = Math.round(r + (f - r) * t); gg = Math.round(gg + (f - gg) * t); b = Math.round(b + (f - b) * t);
  return `rgb(${r},${gg},${b})`;
}
function circle(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
function radial(g, x, y, r, c0, c1) { const k = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); k.addColorStop(0, c0); k.addColorStop(1, c1); return k; }

const ST = {
  smithy: { wall: '#9a9aa2', roof: '#4d5361', icon: '🔨' }, tavern: { wall: '#e0c89a', roof: '#8a3b2a', icon: '🍺' },
  market: { wall: '#d9c9a0', roof: '#b5483a', icon: '' }, temple: { wall: '#ece6d6', roof: '#4c6fbf', icon: '⛪' },
  shop: { wall: '#e2cfa3', roof: '#3f7a55', icon: '🛒' }, alchemist: { wall: '#cbb8e0', roof: '#5b3a85', icon: '⚗️' },
  healer: { wall: '#dfe6cf', roof: '#4f8a4a', icon: '🌿' }, library: { wall: '#d8d0c0', roof: '#3f7f78', icon: '📚' },
  elder: { wall: '#e8d9b6', roof: '#a8472f', icon: '⚜️' }, hut: { wall: '#a88458', roof: '#c9a75a', icon: '' },
  stable: { wall: '#b88c5c', roof: '#6a4a2a', icon: '🐎' }, guild: { wall: '#bfcfe0', roof: '#2f4f7a', icon: '📜' },
  castle: { wall: '#a9afb8', roof: '#8a2f2f', icon: '🏰' }, palace: { wall: '#f0e8d8', roof: '#2f5fa8', icon: '👑' },
  tower: { wall: '#a9afb8', roof: '#8a2f2f', icon: '🗼' }, mill: { wall: '#d8c9a6', roof: '#8a6a3a', icon: '🌾' },
  farm: { wall: '#b5483a', roof: '#6a3a2a', icon: '🚜' }, barracks: { wall: '#9aa3ad', roof: '#445063', icon: '⚔️' },
  inn: { wall: '#e3cfa5', roof: '#7a4a8a', icon: '🛏️' }, well: { wall: '#9aa3ad', roof: '#3f7fbf', icon: '' },
  house: { wall: '#e6d8b8', roof: '#b5523a', icon: '' },
};
const HOUSE_ROOFS = ['#b5523a', '#8a5a3a', '#5f6b7a', '#c0763a', '#7a8f4e'];
const HOUSE_WALLS = ['#e6d8b8', '#d9c7a0', '#cdbb99', '#e8dfc9'];
const CHIMNEY = new Set(['smithy', 'tavern', 'inn', 'house', 'elder', 'healer', 'alchemist', 'shop', 'library']);

function smoke(g, x, y, px) {
  for (let i = 0; i < 3; i++) circle(g, x + i * px * 0.12, y - i * px * 0.28, px * (0.14 + i * 0.07), `rgba(240,240,240,${0.42 - i * 0.1})`);
}

// двускатный дом; b в клетках (можно дробные значения)
function gable(g, b, px, st, opt = {}) {
  const x = b.x * px, y = b.y * px, w = b.w * px, h = b.h * px, p = px * 0.06;
  const wy = y + h * 0.5;
  g.fillStyle = lg(g, x, wy, x, y + h, st.wall, shade(st.wall, -0.28));
  rr(g, x + p, wy, w - 2 * p, y + h - wy - p, px * 0.08); g.fill();
  g.strokeStyle = 'rgba(60,40,20,.55)'; g.lineWidth = px * 0.05; g.stroke();
  const winCol = opt.glow ? '#ffe08a' : (opt.winBlue ? '#a8cde8' : '#b9d6e6');
  const fr = b.w >= 5 ? [0.18, 0.34, 0.66, 0.82] : [0.2, 0.8];
  for (const f of fr) {
    const wx = x + w * f - px * 0.17, wy2 = wy + (h * 0.5) * 0.22;
    g.fillStyle = winCol; rr(g, wx, wy2, px * 0.34, px * 0.4, px * 0.06); g.fill();
    g.strokeStyle = '#5a3d22'; g.lineWidth = px * 0.05; g.stroke();
    g.beginPath(); g.moveTo(wx + px * 0.17, wy2); g.lineTo(wx + px * 0.17, wy2 + px * 0.4); g.moveTo(wx, wy2 + px * 0.2); g.lineTo(wx + px * 0.34, wy2 + px * 0.2); g.stroke();
  }
  const dw = px * 0.56, dh = px * 0.66;
  g.fillStyle = '#4a2f1a'; rr(g, x + w / 2 - dw / 2, y + h - p - dh, dw, dh, px * 0.2); g.fill();
  circle(g, x + w / 2 + dw * 0.25, y + h - p - dh * 0.4, px * 0.04, '#e0b040');
  // крыша
  const top = y + p, bot = y + h * 0.58, rx = x - px * 0.1, rw = w + px * 0.2;
  g.beginPath(); g.moveTo(rx, bot); g.lineTo(rx + rw, bot); g.lineTo(x + w * 0.92, top); g.lineTo(x + w * 0.08, top); g.closePath();
  g.fillStyle = lg(g, 0, top, 0, bot, shade(st.roof, 0.18), shade(st.roof, -0.18)); g.fill();
  g.save(); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = px * 0.03;
  let row = 0;
  for (let yy = top; yy < bot; yy += px * 0.2, row++) {
    g.beginPath(); g.moveTo(rx, yy); g.lineTo(rx + rw, yy); g.stroke();
    for (let xx = rx + (row % 2) * px * 0.18; xx < rx + rw; xx += px * 0.36) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + px * 0.2); g.stroke(); }
  }
  g.restore();
  g.strokeStyle = shade(st.roof, 0.4); g.lineWidth = px * 0.09; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x + w * 0.08, top); g.lineTo(x + w * 0.92, top); g.stroke();
  g.strokeStyle = shade(st.roof, -0.45); g.lineWidth = px * 0.07;
  g.beginPath(); g.moveTo(rx, bot); g.lineTo(rx + rw, bot); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + p, bot, w - 2 * p, px * 0.12);
  if (opt.chimney) {
    const cx = x + w * 0.76, cy = top - px * 0.05;
    g.fillStyle = '#8a8078'; rr(g, cx, cy, px * 0.3, px * 0.5, px * 0.04); g.fill();
    g.fillStyle = '#5a524c'; g.fillRect(cx - px * 0.03, cy - px * 0.04, px * 0.36, px * 0.1);
    if (opt.fire) circle(g, cx + px * 0.15, cy - px * 0.02, px * 0.09, '#ff8a2a');
    smoke(g, cx + px * 0.15, cy - px * 0.12, px);
  }
}

function roundTower(g, cx, cy, r, px, roof) {
  circle(g, cx + r * 0.2, cy + r * 0.25, r, 'rgba(20,30,15,.3)');
  circle(g, cx, cy, r, radial(g, cx, cy, r, '#c4c9d0', '#7d838d'));
  g.strokeStyle = '#4a4f58'; g.lineWidth = px * 0.06; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  const rr2 = r * 0.82;
  circle(g, cx, cy, rr2, radial(g, cx, cy, rr2, shade(roof, 0.3), shade(roof, -0.3)));
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = px * 0.04;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2); g.stroke(); }
  circle(g, cx, cy, px * 0.07, '#e0b040');
}

function plaque(g, b, px, icon, cyf = 0.28) {
  if (!icon) return;
  const cx = (b.x + b.w / 2) * px, cy = (b.y + b.h * cyf) * px, r = px * 0.4;
  circle(g, cx, cy + px * 0.04, r, 'rgba(0,0,0,.25)');
  circle(g, cx, cy, r, 'rgba(255,252,240,.93)');
  g.strokeStyle = '#6a4a2a'; g.lineWidth = px * 0.05; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  g.font = `${px * 0.46}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
  g.fillText(icon, cx, cy + px * 0.03);
}

function stall(g, x, y, px, c1, c2) {
  g.fillStyle = 'rgba(20,30,15,.28)'; rr(g, x + px * 0.12, y + px * 0.16, px * 1.1, px * 0.9, px * 0.08); g.fill();
  g.fillStyle = '#8a6038'; rr(g, x + px * 0.05, y + px * 0.5, px * 1.1, px * 0.5, px * 0.06); g.fill();
  for (let i = 0; i < 3; i++) circle(g, x + px * (0.3 + i * 0.3), y + px * 0.75, px * 0.1, ['#d44', '#e8c440', '#6a4'][i]);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(x + (i * px * 1.2) / 6, y + px * 0.04, px * 0.2 + 0.5, px * 0.5); }
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = px * 0.04; g.strokeRect(x, y + px * 0.04, px * 1.2, px * 0.5);
}

function drawBuilding(g, b, px, seed) {
  const st = ST[b.type] || ST.house;
  const x = b.x * px, y = b.y * px, w = b.w * px, h = b.h * px;
  const sh = () => { g.fillStyle = 'rgba(20,30,15,.32)'; rr(g, x + px * 0.2, y + px * 0.26, w, h, px * 0.2); g.fill(); };
  switch (b.type) {
    case 'well': {
      const cx = x + w / 2, cy = y + h / 2;
      circle(g, cx + px * 0.1, cy + px * 0.14, px * 0.46, 'rgba(20,30,15,.3)');
      circle(g, cx, cy, px * 0.46, radial(g, cx, cy, px * 0.46, '#c4c9d0', '#7d838d'));
      circle(g, cx, cy, px * 0.3, radial(g, cx, cy, px * 0.3, '#6fb4e8', '#2e6aa8'));
      break;
    }
    case 'hut': {
      const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.46;
      circle(g, cx + px * 0.18, cy + px * 0.22, r, 'rgba(20,30,15,.3)');
      circle(g, cx, cy, r, radial(g, cx, cy, r, '#e2c878', '#a98a45'));
      g.strokeStyle = 'rgba(80,55,20,.45)'; g.lineWidth = px * 0.04;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); }
      g.beginPath(); g.arc(cx, cy, r * 0.55, 0, 7); g.stroke();
      g.fillStyle = '#4a2f1a'; rr(g, cx - px * 0.18, cy + r * 0.62, px * 0.36, px * 0.34, px * 0.12); g.fill();
      circle(g, cx, cy, px * 0.06, '#7a5a28');
      break;
    }
    case 'tower': roundTower(g, x + w / 2, y + h / 2, Math.min(w, h) * 0.46, px, st.roof); plaque(g, b, px, st.icon, 0.5); break;
    case 'market': {
      g.fillStyle = 'rgba(20,30,15,.22)'; rr(g, x + px * 0.1, y + px * 0.14, w, h, px * 0.2); g.fill();
      g.fillStyle = lg(g, x, y, x, y + h, '#e0d1a8', '#c9b888'); rr(g, x, y, w, h, px * 0.2); g.fill();
      g.strokeStyle = 'rgba(90,60,30,.5)'; g.lineWidth = px * 0.05; g.stroke();
      const pal = [['#d94a3a', '#f4eadb'], ['#3a74c0', '#f4eadb'], ['#3f9a55', '#f4eadb'], ['#e0a02a', '#f4eadb']];
      const cols = b.w >= 5 ? 3 : 2, rows = b.h >= 3 ? 2 : 1;
      let k = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, k++) {
        const sx = x + px * 0.3 + ((w - px * 0.6 - px * 1.2) * c) / Math.max(1, cols - 1), sy = y + px * 0.2 + ((h - px * 0.4 - px * 1.05) * r) / Math.max(1, rows - 1);
        stall(g, sx, sy, px, pal[k % 4][0], pal[k % 4][1]);
      }
      break;
    }
    case 'castle': {
      sh();
      g.fillStyle = '#6f9a58'; rr(g, x, y, w, h, px * 0.15); g.fill();
      g.fillStyle = lg(g, x, y, x, y + h, '#b6bbc4', '#8a9099'); rr(g, x + px * 0.5, y + px * 0.5, w - px, h - px, px * 0.1); g.fill();
      g.strokeStyle = '#4a4f58'; g.lineWidth = px * 0.07; g.stroke();
      g.fillStyle = '#9fb88a'; g.fillRect(x + px * 1.1, y + px * 1.1, w - px * 2.2, h - px * 2.2);
      gable(g, { x: b.x + b.w / 2 - 1.6, y: b.y + 1.0, w: 3.2, h: b.h - 2 }, px, { wall: '#c9ccd2', roof: '#8a2f2f' });
      for (const [tx, ty] of [[0.55, 0.55], [b.w - 0.55, 0.55], [0.55, b.h - 0.55], [b.w - 0.55, b.h - 0.55]]) roundTower(g, x + tx * px, y + ty * px, px * 0.72, px, '#8a2f2f');
      plaque(g, b, px, st.icon, 0.5);
      break;
    }
    case 'palace': {
      sh();
      const hall = { x: b.x + 2, y: b.y + 0.2, w: b.w - 4, h: b.h * 0.72 };
      gable(g, { x: b.x + 0.4, y: b.y + 1.0, w: 2.2, h: b.h * 0.6 }, px, { wall: '#f0e8d8', roof: '#3f6fb8' }, {});
      gable(g, { x: b.x + b.w - 2.6, y: b.y + 1.0, w: 2.2, h: b.h * 0.6 }, px, { wall: '#f0e8d8', roof: '#3f6fb8' }, {});
      gable(g, hall, px, { wall: '#f6efe0', roof: '#2f5fa8' }, { winBlue: true });
      const dcx = (hall.x + hall.w / 2) * px, dcy = (hall.y + hall.h * 0.3) * px;
      circle(g, dcx, dcy, px * 0.8, radial(g, dcx, dcy, px * 0.8, '#ffe08a', '#b8860b'));
      g.strokeStyle = 'rgba(90,60,0,.5)'; g.lineWidth = px * 0.04;
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; g.beginPath(); g.moveTo(dcx, dcy); g.lineTo(dcx + Math.cos(a) * px * 0.8, dcy + Math.sin(a) * px * 0.8); g.stroke(); }
      roundTower(g, x + px * 0.7, y + px * 0.8, px * 0.7, px, '#d4a62a');
      roundTower(g, x + w - px * 0.7, y + px * 0.8, px * 0.7, px, '#d4a62a');
      // сад и фонтан
      const gy = y + h * 0.78;
      g.fillStyle = '#5f9a48'; rr(g, x + px * 0.3, gy, w - px * 0.6, h * 0.2, px * 0.1); g.fill();
      g.fillStyle = '#d9c9a0'; g.fillRect(x + w / 2 - px * 0.35, gy - px * 0.2, px * 0.7, h * 0.22 + px * 0.2);
      circle(g, x + w / 2, gy + h * 0.1, px * 0.34, radial(g, x + w / 2, gy + h * 0.1, px * 0.34, '#8fd0f0', '#2e7ab8'));
      plaque(g, b, px, st.icon, 0.42);
      break;
    }
    case 'farm': {
      sh();
      g.fillStyle = '#8a6a3a'; rr(g, x + w * 0.58, y + px * 0.1, w * 0.42 - px * 0.1, h - px * 0.2, px * 0.1); g.fill();
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#8fbf52' : '#7aa840'; g.fillRect(x + w * 0.6, y + px * 0.2 + i * ((h - px * 0.5) / 6), w * 0.38 - px * 0.12, (h - px * 0.5) / 6 - px * 0.04); }
      gable(g, { x: b.x, y: b.y, w: b.w * 0.55, h: b.h }, px, { wall: '#b5483a', roof: '#6a3a2a' }, {});
      plaque(g, { x: b.x, y: b.y, w: b.w * 0.55, h: b.h }, px, st.icon);
      break;
    }
    default: {
      sh();
      const o = {};
      if (b.type === 'house') {
        const r1 = rnd(seed, b.x, b.y, 1), r2 = rnd(seed, b.x, b.y, 2);
        st.roof = HOUSE_ROOFS[Math.floor(r1 * HOUSE_ROOFS.length)]; st.wall = HOUSE_WALLS[Math.floor(r2 * HOUSE_WALLS.length)];
        o.chimney = r1 > 0.35;
      } else o.chimney = CHIMNEY.has(b.type);
      if (b.type === 'tavern' || b.type === 'inn') o.glow = true;
      if (b.type === 'smithy') o.fire = true;
      if (b.type === 'library' || b.type === 'temple') o.winBlue = true;
      gable(g, b, px, st, o);
      if (b.type === 'temple') {
        const cx = x + w / 2, cy = y + h * 0.3;
        g.fillStyle = '#c9ccd2'; rr(g, cx - px * 0.55, cy - px * 0.55, px * 1.1, px * 1.1, px * 0.1); g.fill();
        g.fillStyle = '#3f5fa8'; g.beginPath(); g.moveTo(cx - px * 0.6, cy - px * 0.5); g.lineTo(cx + px * 0.6, cy - px * 0.5); g.lineTo(cx, cy - px * 1.15); g.closePath(); g.fill();
        g.strokeStyle = '#e0b040'; g.lineWidth = px * 0.07; g.beginPath(); g.moveTo(cx, cy - px * 1.15); g.lineTo(cx, cy - px * 1.5); g.moveTo(cx - px * 0.14, cy - px * 1.34); g.lineTo(cx + px * 0.14, cy - px * 1.34); g.stroke();
      } else if (b.type === 'mill') {
        const cx = x + w / 2, cy = y + h * 0.3;
        for (let i = 0; i < 4; i++) {
          g.save(); g.translate(cx, cy); g.rotate(0.4 + (i * Math.PI) / 2);
          g.fillStyle = '#8a6038'; g.fillRect(-px * 0.05, 0, px * 0.1, px * 1.5);
          g.fillStyle = 'rgba(245,235,215,.92)'; g.fillRect(px * 0.05, px * 0.3, px * 0.4, px * 1.1);
          g.strokeStyle = '#6a4a2a'; g.lineWidth = px * 0.03; g.strokeRect(px * 0.05, px * 0.3, px * 0.4, px * 1.1);
          g.restore();
        }
        circle(g, cx, cy, px * 0.16, '#4a2f1a');
      } else if (b.type === 'smithy') {
        g.fillStyle = '#2f3138'; rr(g, x + w * 0.8, y + h * 0.82, px * 0.5, px * 0.22, px * 0.05); g.fill(); g.fillRect(x + w * 0.86, y + h * 0.9, px * 0.3, px * 0.14);
      } else if (b.type === 'stable') {
        for (let i = 0; i < 3; i++) circle(g, x + w * 0.86 + (i % 2) * px * 0.2, y + h * 0.82 - i * px * 0.18, px * 0.2, radial(g, x + w * 0.86, y + h * 0.8, px * 0.2, '#f0d878', '#c9a83a'));
      } else if (b.type === 'healer') {
        for (const f of [0.1, 0.9]) circle(g, x + w * f, y + h * 0.9, px * 0.2, radial(g, x + w * f, y + h * 0.9, px * 0.2, '#8fd06a', '#3f8a3a'));
      } else if (b.type === 'elder') {
        const px0 = x + w * 0.18, py0 = y + px * 0.05;
        g.strokeStyle = '#5a3d22'; g.lineWidth = px * 0.06; g.beginPath(); g.moveTo(px0, py0 + px * 0.6); g.lineTo(px0, py0 - px * 0.7); g.stroke();
        g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(px0, py0 - px * 0.7); g.lineTo(px0 + px * 0.6, py0 - px * 0.5); g.lineTo(px0, py0 - px * 0.3); g.closePath(); g.fill();
      } else if (b.type === 'shop') {
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4eadb' : '#d94a3a'; g.fillRect(x + px * 0.2 + ((w - px * 0.4) * i) / 8, y + h * 0.58, (w - px * 0.4) / 8 + 0.5, px * 0.28); }
      } else if (b.type === 'library') {
        for (const f of [0.3, 0.7]) { g.fillStyle = '#efe9db'; g.fillRect(x + w * f - px * 0.07, y + h * 0.52, px * 0.14, h * 0.44); }
      }
      if (b.type !== 'house') plaque(g, b, px, st.icon);
    }
  }
}

export function renderScene(scene, px) {
  const { w, h } = scene;
  const c = document.createElement('canvas');
  c.width = Math.round(w * px); c.height = Math.round(h * px);
  const g = c.getContext('2d');
  const seed = hs(scene.id || scene.name), T = (x, y) => scene.tiles[y]?.[x];
  // земля: мягкие пятна
  g.fillStyle = '#7ea85c'; g.fillRect(0, 0, c.width, c.height);
  const nb = Math.round(w * h * 0.5);
  for (let i = 0; i < nb; i++) {
    const bx = rnd(seed, i, 1) * c.width, by = rnd(seed, i, 2) * c.height, br = (2 + rnd(seed, i, 3) * 4) * px;
    const light = rnd(seed, i, 4) > 0.5, k = g.createRadialGradient(bx, by, 0, bx, by, br);
    k.addColorStop(0, light ? 'rgba(170,205,110,.34)' : 'rgba(60,110,60,.3)'); k.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = k; g.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  // трава и цветы
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = T(x, y); if (t !== '.' && t !== 't') continue;
    for (let i = 0; i < 3; i++) {
      const tx = (x + rnd(seed, x, y, 10 + i)) * px, ty = (y + rnd(seed, x, y, 20 + i)) * px;
      g.strokeStyle = rnd(seed, x, y, 30 + i) > 0.5 ? '#5f9048' : '#98c46e'; g.lineWidth = px * 0.035;
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - px * 0.05, ty - px * 0.14); g.moveTo(tx, ty); g.lineTo(tx + px * 0.06, ty - px * 0.12); g.stroke();
    }
    if (rnd(seed, x, y, 40) < 0.07) circle(g, (x + rnd(seed, x, y, 41)) * px, (y + rnd(seed, x, y, 42)) * px, px * 0.05, ['#f4e04a', '#f4f4f4', '#e86aa0', '#8a9af0'][Math.floor(rnd(seed, x, y, 43) * 4)]);
  }
  // вода
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = T(x, y); if (t !== 'w' && t !== 'b') continue;
    g.fillStyle = lg(g, x * px, y * px, (x + 1) * px, (y + 1) * px, '#4a93cc', '#356fae'); g.fillRect(x * px, y * px, px + 0.5, px + 0.5);
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = px * 0.04;
    for (let i = 0; i < 2; i++) { const wx = (x + 0.2 + rnd(seed, x, y, 50 + i) * 0.5) * px, wy = (y + 0.3 + i * 0.4) * px; g.beginPath(); g.arc(wx, wy, px * 0.16, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    if (t === 'w') for (const [dx, dy, ax, ay, wd, ht] of [[0, -1, 0, 0, 1, 0.14], [0, 1, 0, 0.86, 1, 0.14], [-1, 0, 0, 0, 0.14, 1], [1, 0, 0.86, 0, 0.14, 1]]) {
      const n = T(x + dx, y + dy);
      if (n && n !== 'w' && n !== 'b') { g.fillStyle = 'rgba(190,225,245,.7)'; g.fillRect((x + ax) * px, (y + ay) * px, wd * px, ht * px); }
    }
  }
  // дороги и мосты
  const isRoad = (t) => t === 'r' || t === 'b';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = T(x, y);
    if (t === 'r') {
      g.fillStyle = '#cdb17c'; g.fillRect(x * px, y * px, px + 0.5, px + 0.5);
      for (const [dx, dy, ax, ay, wd, ht] of [[0, -1, 0, 0, 1, 0.1], [0, 1, 0, 0.9, 1, 0.1], [-1, 0, 0, 0, 0.1, 1], [1, 0, 0.9, 0, 0.1, 1]]) {
        const n = T(x + dx, y + dy);
        if (n && !isRoad(n)) { g.fillStyle = 'rgba(120,90,50,.45)'; g.fillRect((x + ax) * px, (y + ay) * px, wd * px, ht * px); }
      }
      for (let i = 0; i < 5; i++) {
        const sx = (x + 0.12 + rnd(seed, x, y, 60 + i) * 0.76) * px, sy = (y + 0.12 + rnd(seed, x, y, 70 + i) * 0.76) * px;
        g.fillStyle = rnd(seed, x, y, 80 + i) > 0.5 ? 'rgba(255,240,200,.45)' : 'rgba(120,90,50,.35)';
        g.beginPath(); g.ellipse(sx, sy, px * 0.11, px * 0.08, rnd(seed, x, y, 90 + i) * 3, 0, 7); g.fill();
      }
    } else if (t === 'b') {
      g.fillStyle = '#a06f3a'; g.fillRect(x * px, y * px, px + 0.5, px + 0.5);
      g.strokeStyle = 'rgba(60,35,15,.55)'; g.lineWidth = px * 0.04;
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo((x + i / 5) * px, y * px); g.lineTo((x + i / 5) * px, (y + 1) * px); g.stroke(); }
      for (const [dy, ay] of [[-1, 0], [1, 0.86]]) if (T(x, y + dy) === 'w') { g.fillStyle = '#5a3a1c'; g.fillRect(x * px, (y + ay) * px, px + 0.5, px * 0.14); circle(g, (x + 0.5) * px, (y + ay + 0.07) * px, px * 0.1, '#3f2a14'); }
    }
  }
  // стены
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (T(x, y) !== 'W') continue;
    const X = x * px, Y = y * px;
    g.fillStyle = 'rgba(20,30,15,.28)'; g.fillRect(X + px * 0.12, Y + px * 0.16, px, px);
    g.fillStyle = lg(g, X, Y, X + px, Y + px, '#a2a2ac', '#767680'); g.fillRect(X, Y, px + 0.5, px + 0.5);
    g.strokeStyle = 'rgba(40,40,50,.45)'; g.lineWidth = px * 0.04;
    g.beginPath(); g.moveTo(X, Y + px / 2); g.lineTo(X + px, Y + px / 2); g.moveTo(X + px * 0.3, Y); g.lineTo(X + px * 0.3, Y + px / 2); g.moveTo(X + px * 0.7, Y + px / 2); g.lineTo(X + px * 0.7, Y + px); g.stroke();
    g.fillStyle = '#c9c9d2';
    const edge = y === 0 ? [0.1, 0.1, 0.8, 0.22] : y === h - 1 ? [0.1, 0.68, 0.8, 0.22] : x === 0 ? [0.1, 0.1, 0.22, 0.8] : [0.68, 0.1, 0.22, 0.8];
    g.fillRect(X + edge[0] * px, Y + edge[1] * px, edge[2] * px, edge[3] * px);
    if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) roundTower(g, X + px / 2, Y + px / 2, px * 0.95, px, '#8a2f2f');
  }
  // здания
  for (const b of scene.buildings) drawBuilding(g, b, px, seed);
  // деревья
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (T(x, y) !== 't') continue;
    const cx = (x + 0.5 + (rnd(seed, x, y, 100) - 0.5) * 0.4) * px, cy = (y + 0.5 + (rnd(seed, x, y, 101) - 0.5) * 0.4) * px;
    const r = px * (0.42 + rnd(seed, x, y, 102) * 0.28);
    g.fillStyle = 'rgba(20,35,15,.3)'; g.beginPath(); g.ellipse(cx + r * 0.35, cy + r * 0.5, r * 0.95, r * 0.6, 0, 0, 7); g.fill();
    if (rnd(seed, x, y, 103) < 0.35) {
      for (let i = 0; i < 3; i++) {
        const yy = cy + r * 0.45 - i * r * 0.5, ww = r * (1.0 - i * 0.28);
        g.fillStyle = lg(g, cx - ww, yy, cx + ww, yy, ['#2f6a4a', '#2a5f45', '#3a7a55'][i], '#1f4a35');
        g.beginPath(); g.moveTo(cx - ww, yy); g.lineTo(cx + ww, yy); g.lineTo(cx, yy - r * 0.95); g.closePath(); g.fill();
      }
    } else {
      g.fillStyle = '#5a3d22'; g.fillRect(cx - r * 0.12, cy + r * 0.2, r * 0.24, r * 0.55);
      circle(g, cx - r * 0.35, cy + r * 0.1, r * 0.6, radial(g, cx - r * 0.35, cy, r * 0.6, '#4f9a4a', '#2f6a35'));
      circle(g, cx + r * 0.35, cy + r * 0.1, r * 0.6, radial(g, cx + r * 0.35, cy, r * 0.6, '#4f9a4a', '#2f6a35'));
      circle(g, cx, cy - r * 0.25, r * 0.7, radial(g, cx, cy - r * 0.3, r * 0.7, '#6cb85a', '#33783a'));
    }
  }
  // лёгкая виньетка
  const vg = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.45, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,20,10,.28)');
  g.fillStyle = vg; g.fillRect(0, 0, c.width, c.height);
  return c;
}
