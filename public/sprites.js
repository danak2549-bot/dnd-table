// Спрайты: SVG-рисунки героев, жителей и монстров, превращённые в картинки и закэшированные.
import { heroInner } from './avatar.js';
import { photoId, composeHero } from './photo.js';
import { creatureArt } from './creatures.js';

const cache = new Map();
let onLoad = () => {};
export const setSpriteLoadHandler = (fn) => { onLoad = fn; };
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="496" viewBox="0 -20 200 310">${inner}</svg>`;
function imageFor(key, makeInner) {
  let e = cache.get(key);
  if (!e) {
    if (cache.size > 160) cache.delete(cache.keys().next().value);
    const img = new Image();
    e = { img, ok: false };
    img.onload = () => { e.ok = true; onLoad(); };
    img.onerror = () => { e.bad = true; };
    let inner = '';
    try { inner = makeInner(); } catch (err) { console.error('sprite failed', key, err); }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(wrap(inner));
    cache.set(key, e);
  }
  return e.ok ? e.img : null;
}

const hsh = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const BODIES = ['красная туника', 'синяя туника', 'зелёная туника', 'коричневая туника', 'жёлтая рубаха', 'серая роба', 'фиолетовая туника', 'белая рубаха'];
const HEADS = ['', '', 'шляпа', 'шапка', 'капюшон', ''];
const ROLE_EQ = [
  [/кузнец/, { body: 'кожаный фартук', weapon: 'молот', feet: 'сапоги' }],
  [/трактирщик|хозяин/, { body: 'красная туника', accessory: 'пояс' }],
  [/знахарь/, { body: 'зелёная роба', head: 'капюшон', accessory: 'сумка' }],
  [/хранитель|библиотек/, { body: 'синяя мантия', weapon: 'книга' }],
  [/жрец/, { body: 'белая ряса', weapon: 'посох', accessory: 'золотой амулет' }],
  [/староста/, { body: 'зелёная мантия', weapon: 'посох', head: 'шляпа' }],
  [/торговец|лавочник/, { body: 'жёлтая туника', head: 'шляпа', accessory: 'сумка' }],
  [/придворный/, { body: 'фиолетовая туника', accessory: 'золотой амулет' }],
  [/гильдии/, { body: 'синий жилет', accessory: 'пояс' }],
  [/капитан|страж/, { body: 'стальные латы', head: 'стальной шлем', weapon: 'копьё', offhand: 'щит', feet: 'сапоги' }],
  [/алхимик/, { body: 'фиолетовая роба', head: 'колпак' }],
  [/фермер/, { body: 'коричневая рубаха', head: 'соломенная шляпа' }],
  [/мельник/, { body: 'белая рубаха', head: 'шапка' }],
  [/конюх/, { body: 'кожаная куртка', head: 'шапка' }],
  [/кастелян/, { body: 'кольчуга', weapon: 'меч' }],
];
function roleEq(role, name) {
  for (const [re, eq] of ROLE_EQ) if (re.test(String(role).toLowerCase())) return eq;
  const h = hsh(name);
  return { body: BODIES[h % BODIES.length], head: HEADS[(h >> 3) % HEADS.length] };
}
const CULT_BODIES = {
  elf: ['белая роба', 'зелёная мантия', 'голубая роба', 'серебристая туника'],
  dwarf: ['кожаная куртка', 'кольчуга', 'коричневая туника', 'красная туника'],
  halfling: ['жёлтая рубаха', 'зелёный жилет', 'коричневая рубаха', 'красная рубаха'],
  angel: ['белая роба', 'золотая мантия', 'белая туника'],
  demon: ['чёрная роба', 'тёмная туника', 'стальные латы'],
  orc: ['коричневая рваная куртка', 'кожаная куртка', 'красная рубаха', 'стальные латы'],
  human: BODIES,
};
export const CULT_RACE = { human: 'человек', elf: 'эльф', dwarf: 'дварф', halfling: 'полурослик', orc: 'орк', angel: 'аасимар', demon: 'демон' };
export function walkerLook(culture, i) {
  const bodies = CULT_BODIES[culture] || BODIES, h = hsh('w' + i + culture);
  const eq = { body: bodies[h % bodies.length], head: HEADS[(h >> 4) % HEADS.length], feet: (h >> 7) % 3 ? 'сапоги' : '' };
  return { key: `w|${culture}|${h % 997}`, hero: { name: 'w' + i, race: CULT_RACE[culture] || 'человек', equipment: eq, weapons: [] }, scale: 1 };
}
export function lookOfToken(t) {
  const c = t.character || {};
  if (t.type === 'player') {
    const eq = c.equipment || {};
    return { key: `p|${t.name}|${c.race || ''}|${JSON.stringify(eq)}|${c.weapons && c.weapons[0] ? c.weapons[0].name : ''}`,
      hero: { name: t.name, race: c.race, equipment: eq, weapons: c.weapons }, scale: 1 };
  }
  if (t.role || t.type === 'npc') {
    const role = t.role || '';
    const race = c.race || t.race || 'Человек';
    const eq = roleEq(role, t.name);
    return { key: `n|${t.name}|${race}|${role}`, hero: { name: t.name, race, equipment: eq, weapons: [] }, scale: 1 };
  }
  const a = creatureArt(t.name);
  if (a.hero) return { key: `m|${t.name}`, hero: { name: t.name, race: a.hero.race, equipment: a.hero.eq, weapons: [] }, scale: a.scale };
  return { key: `m|${t.name}`, draw: a.draw, scale: a.scale };
}
const photoSpriteCache = new Map();
export function spriteFor(look, phase) {
  const ph = look.hero || look.draw ? phase : 0;
  if (look.hero) {
    const id = photoId(look.hero.race);
    if (id) {
      const eq = look.hero.equipment || {};
      const weapon = eq.weapon || (Array.isArray(look.hero.weapons) && look.hero.weapons[0] ? look.hero.weapons[0].name : '');
      const key = `${look.key}|photo|${id}|${JSON.stringify(eq)}|${weapon}|${ph}`;
      if (!photoSpriteCache.has(key)) {
        if (photoSpriteCache.size > 90) photoSpriteCache.delete(photoSpriteCache.keys().next().value);
        photoSpriteCache.set(key, composeHero({ id, eq, weapon }, ph, 496, onLoad));
      }
      return photoSpriteCache.get(key);
    }
  }
  return imageFor(look.key + '|' + ph, () => (look.hero ? heroInner({ ...look.hero, phase: ph }).inner : look.draw(ph)));
}
