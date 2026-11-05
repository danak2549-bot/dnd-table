// Герои-«картинки»: человек, табакси, фея, аасимар, тень. Оружие кладётся в ладонь, на голову ставятся шлемы,
// ноги и тело качаются при ходьбе (кукольная анимация).
import { PHOTO_META } from './photo-meta.js';
import { weaponSvg, shieldSvg, headSvg } from './avatar.js';

export const PHOTO_SCALE = { human: 1, tabaxi: 1, fairy: 0.85, aasimar: 1.1, shadow: 1.3 };
const PUPPET = { human: true, tabaxi: true, aasimar: true, shadow: true, fairy: false };
const has = (re, t) => re.test(t);

export function photoId(race) {
  const t = String(race || '').toLowerCase().trim();
  if (!t || /^человек|human/.test(t)) return 'human';
  if (/(^|\s)тен[ьи]|теневой/.test(t)) return 'shadow';
  if (/фея|фэри|пикси/.test(t)) return 'fairy';
  if (/табакси/.test(t)) return 'tabaxi';
  if (/аасимар|небесн|ангел/.test(t)) return 'aasimar';
  return null;
}

const imgCache = new Map();
function loadImage(src) {
  if (!imgCache.has(src)) imgCache.set(src, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }));
  return imgCache.get(src);
}
const svgImage = (svg) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="930" viewBox="-50 -20 300 310">${inner}</svg>`;

// размеры холста: 300 x 310 условных единиц, ступни на y = 278
const geom = (id) => {
  const m = PHOTO_META[id];
  const top = m.head.y - m.head.w * 0.65;
  const u = (m.feetY - top) / 260;
  const toSvg = (p) => ({ x: 100 + (p.x - m.cx) / u, y: 278 + (p.y - m.feetY) / u });
  return { m, u, toSvg };
};

function layers(o, g) {
  const { m, u, toSvg } = g;
  const eq = o.eq || {};
  const hR = toSvg(m.handR), hL = toSvg(m.handL), head = toSvg(m.head), chest = toSvg(m.chest);
  const hw = m.head.w / u;
  let back = '', front = '', top = '';
  const acc = String(eq.accessory || '').toLowerCase(), body = String(eq.body || '').toLowerCase();
  if (has(/плащ|накидк/, acc) || has(/плащ|накидк/, body)) {
    const col = (/красн|багров/.test(acc + body) ? '#a8302e' : /син/.test(acc + body) ? '#3b5fb0' : /зелен|зелён/.test(acc + body) ? '#3f8a4a' : /черн|чёрн/.test(acc + body) ? '#2b2b33' : '#7a2f3a');
    const ys = chest.y - 16, yb = 236, sw = hw * 1.35;
    back = `<path d="M${100 - sw} ${ys} Q100 ${ys - 10} ${100 + sw} ${ys} L${100 + sw * 1.55} ${yb - 6} Q100 ${yb + 12} ${100 - sw * 1.55} ${yb - 6}Z" fill="${col}" stroke="#000" stroke-opacity=".35" stroke-width="2"/><path d="M100 ${ys} L100 ${yb + 6}" stroke="#000" stroke-opacity=".18" stroke-width="2"/>`;
  }
  const off = String(eq.offhand || '').toLowerCase();
  if (off) front += has(/щит/, off) ? `<g transform="translate(${hL.x - 40} ${hL.y - 168}) scale(1.05)">${shieldSvg(off)}</g>` : weaponSvg(off, hL.x, hL.y, true);
  if (o.weapon) front += weaponSvg(o.weapon, hR.x, hR.y, false);
  const hs = headSvg(eq.head);
  if (hs) { const k = (hw / 50) * 1.7; top = `<g transform="translate(${head.x} ${head.y + hw * 0.38}) scale(${k}) translate(-100 -60)">${hs}</g>`; }
  return { back: back && wrap(back), front: front && wrap(front), top: top && wrap(top), hR, hL };
}

const cache = new Map();
export function composeHero(o, phase, outH, onLoad) {
  const key = JSON.stringify([o.id, o.eq, o.weapon, phase, outH]);
  const hit = cache.get(key);
  if (hit) return hit.canvas;
  if (cache.size > 90) cache.delete(cache.keys().next().value);
  const e = { canvas: null }; cache.set(key, e);
  const g = geom(o.id), L = layers(o, g);
  Promise.all([loadImage(`/races/${o.id}.webp`), L.back ? svgImage(L.back) : null, L.front ? svgImage(L.front) : null, L.top ? svgImage(L.top) : null]).then(([img, back, front, top]) => {
    e.canvas = paint(o, g, L, img, back, front, top, phase, outH);
    onLoad && onLoad();
  }).catch((err) => { console.error('hero compose failed', err); });
  return null;
}

function paint(o, g, L, img, back, front, top, phase, outH) {
  const { m, u } = g;
  const s = outH / 310, cw = Math.round(300 * s), ch = Math.round(outH);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  const drawLayer = (im) => { if (im) x.drawImage(im, 0, 0, cw, ch); };
  drawLayer(back);
  // спрайт: пиксель картинки (px,py) -> холст
  const k = s / u, ox = (150 - m.cx / u) * s, oy = (298 - m.feetY / u) * s;   // 150 = центр холста, 298 = ступни (278 + 20)
  const lean = phase ? (phase === 1 ? 0.012 : -0.012) : 0;
  x.save(); x.translate(ox, oy); x.scale(k, k);
  if (PUPPET[o.id] && phase) {
    const th = (phase === 1 ? 1 : -1) * 0.17, hipY = m.hipY, sep = m.head.w * 0.5;
    const leg = (x0, x1, pivotX, a) => {
      x.save(); x.translate(pivotX, hipY); x.rotate(a);
      x.drawImage(img, x0, hipY - 6, x1 - x0, img.height - (hipY - 6), x0 - pivotX, -6, x1 - x0, img.height - (hipY - 6)); x.restore();
    };
    leg(0, m.cx, m.cx - sep, th); leg(m.cx, img.width, m.cx + sep, -th);
    x.save(); x.translate(m.cx, hipY); x.rotate(lean); x.drawImage(img, 0, 0, img.width, hipY + 12, -m.cx, -hipY, img.width, hipY + 12); x.restore();
  } else x.drawImage(img, 0, 0);
  x.restore();
  drawLayer(front);
  // пальцы поверх рукояти: оружие «зажато» в кулаке
  if (front && o.weapon) {
    const r = Math.round(m.head.w * 0.55), hx = m.handR.x, hy = m.handR.y;
    const t = document.createElement('canvas'); t.width = t.height = r * 2; const tc = t.getContext('2d');
    tc.drawImage(img, hx - r, hy - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
    const gr = tc.createRadialGradient(r, r, r * 0.45, r, r, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    tc.globalCompositeOperation = 'destination-in'; tc.fillStyle = gr; tc.fillRect(0, 0, r * 2, r * 2);
    x.drawImage(t, ox + (hx - r) * k, oy + (hy - r) * k, r * 2 * k, r * 2 * k);
  }
  drawLayer(top);
  return c;
}

// Рисует героя в окно листа персонажа. Возвращает true, если раса «картиночная».
export function renderPhotoAvatar(box, token) {
  const c = token && token.character;
  const id = c && photoId(c.race);
  if (!id || !c.equipment) return false;
  const eq = c.equipment, weapon = eq.weapon || (Array.isArray(c.weapons) && c.weapons[0] ? c.weapons[0].name : '');
  const cv = composeHero({ id, eq, weapon }, 0, 560, () => renderPhotoAvatar(box, token));
  const holder = box.querySelector('.av-svg');
  if (holder) holder.style.width = '210px';
  if (cv && holder) { holder.textContent = ''; cv.style.width = '100%'; cv.style.height = 'auto'; holder.appendChild(cv); }
  return true;
}
