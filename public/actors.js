// Персонажи на карте: рисованные спрайты, плавное движение, ходьба, жители, облачка речи.
import { lookOfToken, walkerLook, spriteFor } from './sprites.js';

const disp = new Map();
let walkers = [], wKey = null, roadSet = new Set(), roadList = [], sceneW = 0;
const rnd = (a, b) => a + Math.random() * (b - a);

function bfs(from, to) {
  if (from === to) return [];
  const prev = new Map([[from, null]]), q = [from];
  while (q.length) {
    const cur = q.shift();
    if (cur === to) break;
    const x = cur % sceneW, y = Math.floor(cur / sceneW);
    for (const n of [cur + 1, cur - 1, cur + sceneW, cur - sceneW]) {
      if ((n === cur + 1 && x === sceneW - 1) || (n === cur - 1 && x === 0)) continue;
      if (roadSet.has(n) && !prev.has(n)) { prev.set(n, cur); q.push(n); }
    }
  }
  if (!prev.has(to)) return [];
  const path = []; for (let c = to; c !== from; c = prev.get(c)) path.push(c);
  return path.reverse();
}

function initWalkers(scene) {
  walkers = []; roadSet = new Set(); roadList = []; sceneW = scene.w;
  scene.tiles.forEach((row, y) => { for (let x = 0; x < scene.w; x++) if (row[x] === 'r' || row[x] === 'b') { roadSet.add(y * scene.w + x); roadList.push(y * scene.w + x); } });
  if (!roadList.length) return;
  const n = { village: 5, town: 8, port: 8, fort: 4, city: 14, capital: 18 }[scene.kind] || 6;
  for (let i = 0; i < n; i++) {
    const c = roadList[Math.floor(Math.random() * roadList.length)];
    walkers.push({ x: (c % scene.w) + 0.5, y: Math.floor(c / scene.w) + 0.5, cell: c, path: [], wait: rnd(0, 3), speed: rnd(0.7, 1.3), face: 1, moving: false,
      ox: rnd(-0.28, 0.28), oy: rnd(-0.2, 0.2), look: walkerLook(scene.culture || 'human', i) });
  }
}

export function tickActors(state, dt, now) {
  let busy = false;
  const seen = new Set();
  for (const t of state.tokens) {
    seen.add(t.id);
    let d = disp.get(t.id);
    if (!d) { d = { x: t.x, y: t.y, moving: false, face: 1 }; disp.set(t.id, d); }
    const dx = t.x - d.x, dy = t.y - d.y, dist = Math.hypot(dx, dy);
    if (dist > 0.03) { const st = Math.min(dist, 7 * dt); d.x += (dx / dist) * st; d.y += (dy / dist) * st; d.moving = true; busy = true; if (Math.abs(dx) > 0.02) d.face = dx > 0 ? 1 : -1; }
    else { d.x = t.x; d.y = t.y; d.moving = false; }
  }
  for (const k of disp.keys()) if (!seen.has(k)) disp.delete(k);
  const key = state.scene ? state.scene.id || state.scene.name : null;
  if (key !== wKey) { wKey = key; walkers = []; if (state.scene) initWalkers(state.scene); }
  for (const w of walkers) {
    if (w.wait > 0) { w.wait -= dt; w.moving = false; continue; }
    if (!w.path.length) {
      const target = roadList[Math.floor(Math.random() * roadList.length)];
      w.path = bfs(w.cell, target);
      if (!w.path.length) { w.wait = rnd(1, 3); w.moving = false; continue; }
    }
    const nx = (w.path[0] % sceneW) + 0.5 + w.ox, ny = Math.floor(w.path[0] / sceneW) + 0.5 + w.oy;
    const dx = nx - w.x, dy = ny - w.y, dist = Math.hypot(dx, dy), st = w.speed * dt;
    if (dist <= st) { w.x = nx; w.y = ny; w.cell = w.path.shift(); if (!w.path.length) w.wait = Math.random() < 0.5 ? rnd(1, 4) : 0; }
    else { w.x += (dx / dist) * st; w.y += (dy / dist) * st; if (Math.abs(dx) > 0.01) w.face = dx > 0 ? 1 : -1; }
    w.moving = true;
  }
  return busy || walkers.length > 0;
}

function wrapText(t, n) {
  const words = String(t).split(' '), lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > n) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  return lines.slice(0, 5);
}

function drawOne(g, look, x, y, face, moving, cell, view, now, o = {}) {
  const phase = moving ? 1 + (Math.floor(now / 170) % 2) : 0;
  const sc = look.scale || 1, h = cell * 2.0 * sc, w = (h * 200) / 310;
  const fx = (x + 0.5) * cell, fy = (y + 0.9) * cell;
  const bob = moving ? Math.abs(Math.sin(now / 85)) * cell * 0.07 : Math.sin(now / 650 + x * 3) * cell * 0.012;
  g.save();
  g.globalAlpha = o.alpha ?? 1;
  g.fillStyle = 'rgba(15,20,10,.32)'; g.beginPath(); g.ellipse(fx, fy, cell * 0.3 * Math.min(sc, 1.5), cell * 0.1, 0, 0, 7); g.fill();
  if (o.selected) { g.strokeStyle = '#fff'; g.lineWidth = 2.5 / view.s; g.beginPath(); g.ellipse(fx, fy, cell * 0.42 * Math.min(sc, 1.4), cell * 0.16, 0, 0, 7); g.stroke(); }
  const img = spriteFor(look, phase);
  g.translate(fx, fy - bob);
  if (face < 0) g.scale(-1, 1);
  if (o.dead) { g.rotate(-Math.PI / 2); g.translate(h * 0.3, 0); }
  if (img) g.drawImage(img, -w / 2, -h * 0.96, w, h);
  else { g.beginPath(); g.arc(0, -cell * 0.5, cell * 0.35, 0, 7); g.fillStyle = o.color || '#888'; g.fill(); }
  g.restore();
  return { fx, fy, h };
}

export function drawActors(g, state, cell, view, selId, now) {
  const list = [];
  for (const w of walkers) list.push({ y: w.y, walker: w });
  for (const t of state.tokens) { const d = disp.get(t.id) || { x: t.x, y: t.y, face: 1, moving: false }; list.push({ y: d.y, t, d }); }
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    if (it.walker) { const w = it.walker; drawOne(g, w.look, w.x - 0.5, w.y - 0.5, w.face, w.moving, cell, view, now); continue; }
    const { t, d } = it, c = t.character || {};
    const dead = c.dead || (c.hp && c.hp.cur === 0);
    const look = lookOfToken(t);
    const r = drawOne(g, look, d.x, d.y, d.face, d.moving, cell, view, now, { selected: t.id === selId, dead, alpha: t.hidden ? 0.4 : dead ? 0.6 : 1, color: t.color });
    const pct = c.hp ? (c.hp.max ? c.hp.cur / c.hp.max : 0) : (c.hpPct ?? 100) / 100;
    if (!dead && (t.type !== 'npc' || c.hp)) {
      const bw = cell * 0.7;
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(r.fx - bw / 2, r.fy + cell * 0.1, bw, cell * 0.1);
      g.fillStyle = pct > 0.5 ? '#6fcf97' : pct > 0.25 ? '#ffd54f' : '#ff7a7a';
      g.fillRect(r.fx - bw / 2, r.fy + cell * 0.1, bw * Math.max(0, Math.min(1, pct)), cell * 0.1);
    }
    const top = r.fy - r.h * 0.98;
    if (t.questId) { g.fillStyle = '#ffd54a'; g.beginPath(); g.arc(r.fx, top - cell * 0.1, cell * 0.24, 0, 7); g.fill(); g.strokeStyle = '#7a5a00'; g.lineWidth = 1.5 / view.s; g.stroke(); g.fillStyle = '#4a3200'; g.font = `800 ${cell * 0.34}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', r.fx, top - cell * 0.09); }
    if (view.s >= 2.5) {
      g.font = `700 ${cell * 0.36}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineWidth = 3 / view.s;
      g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(t.name, r.fx, r.fy + cell * 0.52); g.fillStyle = '#fff'; g.fillText(t.name, r.fx, r.fy + cell * 0.52);
    }
    if (t.say && t.say.text) {
      const fs = cell * 0.34; g.font = `600 ${fs}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lines = wrapText(t.say.text, 22), bw = Math.max(...lines.map((l) => g.measureText(l).width)) + fs, bh = lines.length * fs * 1.2 + fs * 0.6;
      const bx = r.fx - bw / 2, by = top - bh - cell * 0.35;
      g.fillStyle = 'rgba(255,252,240,.96)'; g.strokeStyle = '#5a4a2a'; g.lineWidth = 1.5 / view.s;
      g.beginPath(); if (g.roundRect) g.roundRect(bx, by, bw, bh, fs * 0.5); else g.rect(bx, by, bw, bh); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(r.fx - fs * 0.3, by + bh); g.lineTo(r.fx, by + bh + fs * 0.6); g.lineTo(r.fx + fs * 0.3, by + bh); g.fill();
      g.fillStyle = '#222'; lines.forEach((l, i) => g.fillText(l, r.fx, by + fs * 0.3 + fs * 0.6 + i * fs * 1.2 - fs * 0.0));
    }
  }
}
