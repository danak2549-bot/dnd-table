// Человечек, на котором видна надетая одежда и оружие. Пользовательский текст в SVG не вставляется:
// из него только выбираются тип предмета и цвет из готового набора.
export const SLOT_NAMES = {
  head: 'Голова', body: 'Тело', hands: 'Руки', legs: 'Ноги', feet: 'Ступни',
  accessory: 'Аксессуар', weapon: 'В правой руке', offhand: 'В левой руке',
};
const COLORS = [
  [/красн|багров|алый|алая|алое/, '#b3302e'], [/син|лазур|голуб/, '#3b5fb0'], [/зелен|зелён|изумруд/, '#3f8a4a'],
  [/черн|чёрн|тёмн|темн/, '#2b2b33'], [/бел|светл/, '#ece8dc'], [/золот|золоч/, '#d4a62a'],
  [/серебр|стальн|железн|стал|мифрил/, '#b4bcc8'], [/фиолет|пурпур/, '#7b4bb0'], [/коричн|кожан/, '#7a5230'],
  [/жёлт|желт/, '#e0c040'], [/оранж/, '#d9772b'], [/сер[ыа]/, '#8d939c'],
];
const hashColor = (t) => {
  let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360},38%,46%)`;
};
const colorOf = (t, def) => { for (const [re, c] of COLORS) if (re.test(t)) return c; return def || hashColor(t); };
const has = (re, t) => re.test(t);

export function guessSlot(name) {
  const t = String(name || '').toLowerCase();
  if (has(/щит/, t)) return 'offhand';
  if (has(/меч|клинок|сабл|рапир|шпаг|катан|палаш|топор|секир|кинжал|нож|лук|арбалет|посох|жезл|молот|булав|дубин|копь|пик|алебард|трезубец/, t)) return 'weapon';
  if (has(/шлем|каск|корон|венец|диадем|капюшон|шляп|колпак|берет|шапк|тюрбан|маск/, t)) return 'head';
  if (has(/сапог|ботин|сандал|туфл|башмак|лапти/, t)) return 'feet';
  if (has(/перчат|рукавиц|наруч|краги/, t)) return 'hands';
  if (has(/штан|поножи|лосин|килт|юбк|бриджи/, t)) return 'legs';
  if (has(/кольчуг|доспех|латы|нагрудник|кирас|брон|панцир|мантия|роба|ряса|халат|куртк|жилет|рубах|туник/, t)) return 'body';
  return 'accessory';
}

const SKIN = '#e8b890';
const HAIR = ['#3a2a1a', '#6a4a2a', '#c9a050', '#222222', '#8a3a1a'];

function weaponSvg(text, tx, ty, mirror) {
  const t = text.toLowerCase();
  const blade = colorOf(t, '#cfd5dd');
  let inner;
  if (has(/топор|секир/, t)) inner = `<rect x="-3" y="-92" width="6" height="116" rx="3" fill="#7a5230"/><path d="M3 -90 Q34 -96 32 -62 Q20 -72 3 -66Z" fill="${blade}" stroke="#6b7480" stroke-width="2"/><path d="M-3 -90 Q-26 -92 -24 -66 Q-16 -72 -3 -68Z" fill="${blade}" stroke="#6b7480" stroke-width="2"/>`;
  else if (has(/кинжал|нож|стилет/, t)) inner = `<path d="M-3 -6 L-3 -46 L0 -56 L3 -46 L3 -6Z" fill="${blade}" stroke="#6b7480" stroke-width="1.5"/><rect x="-9" y="-8" width="18" height="5" rx="2" fill="#d4a62a"/><rect x="-2.5" y="-4" width="5" height="16" fill="#5a3d22"/>`;
  else if (has(/арбалет/, t)) inner = `<rect x="-3" y="-50" width="6" height="86" fill="#7a5230"/><path d="M-30 -42 Q0 -62 30 -42" stroke="#5a3d22" stroke-width="5" fill="none"/><path d="M-30 -42 L30 -42" stroke="#ddd" stroke-width="1.5"/>`;
  else if (has(/лук/, t)) inner = `<path d="M-4 -96 Q-38 -10 -4 76" stroke="#7a5230" stroke-width="6" fill="none"/><path d="M-4 -96 L-4 76" stroke="#ddd" stroke-width="1.5"/>`;
  else if (has(/посох|жезл|трост|палк/, t)) inner = `<rect x="-3" y="-108" width="6" height="150" rx="3" fill="#7a5230"/><circle cx="0" cy="-116" r="16" fill="${colorOf(t, '#6ab4ff')}" opacity=".35"/><circle cx="0" cy="-116" r="10" fill="${colorOf(t, '#6ab4ff')}" stroke="#fff" stroke-width="1.5"/>`;
  else if (has(/молот|кувалд/, t)) inner = `<rect x="-3" y="-84" width="6" height="106" rx="3" fill="#7a5230"/><rect x="-20" y="-104" width="40" height="26" rx="4" fill="${blade}" stroke="#6b7480" stroke-width="2"/>`;
  else if (has(/булав|дубин|палиц/, t)) inner = `<rect x="-3" y="-70" width="6" height="92" rx="3" fill="#7a5230"/><circle cx="0" cy="-82" r="16" fill="${blade}" stroke="#6b7480" stroke-width="2"/>`;
  else if (has(/копь|пик|алебард|трезубец/, t)) inner = `<rect x="-2.5" y="-120" width="5" height="160" rx="2" fill="#7a5230"/><path d="M-9 -112 L0 -140 L9 -112Z" fill="${blade}" stroke="#6b7480" stroke-width="2"/>`;
  else if (has(/книг|гримуар|фолиант/, t)) inner = `<rect x="-18" y="-36" width="36" height="46" rx="4" fill="${colorOf(t, '#7a2e2e')}" stroke="#3a1a1a" stroke-width="2"/><rect x="-14" y="-32" width="28" height="38" rx="2" fill="#f4ecd8"/><path d="M0 -32 L0 6" stroke="#b9a98a" stroke-width="2"/>`;
  else if (has(/факел/, t)) inner = `<rect x="-3" y="-30" width="6" height="56" rx="2" fill="#7a5230"/><path d="M0 -62 Q16 -44 0 -28 Q-16 -44 0 -62Z" fill="#ff8a2a"/><path d="M0 -50 Q8 -42 0 -32 Q-8 -42 0 -50Z" fill="#ffd54a"/>`;
  else inner = `<path d="M-4 -10 L-4 -88 L0 -102 L4 -88 L4 -10Z" fill="${blade}" stroke="#6b7480" stroke-width="2"/><path d="M0 -96 L0 -14" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/><rect x="-15" y="-13" width="30" height="6" rx="3" fill="#d4a62a"/><rect x="-3" y="-8" width="6" height="22" fill="#5a3d22"/><circle cx="0" cy="17" r="5" fill="#d4a62a"/>`;
  return `<g transform="translate(${tx} ${ty})${mirror ? ' scale(-1 1)' : ''}">${inner}</g>`;
}

function shieldSvg(text) {
  const t = text.toLowerCase(), col = colorOf(t, '#8a5a2a');
  const kite = has(/башен|геральд|рыцарск/, t);
  const shape = kite
    ? `<path d="M-24 -34 L24 -34 L24 0 Q24 30 0 44 Q-24 30 -24 0Z" fill="${col}" stroke="#aeb6c2" stroke-width="4"/>`
    : `<circle r="30" fill="${col}" stroke="#aeb6c2" stroke-width="4"/><circle r="22" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="2"/>`;
  return `<g transform="translate(40 168)">${shape}<circle r="7" fill="#d4a62a" stroke="#8a6a1a" stroke-width="2"/></g>`;
}

function build(eq, name) {
  const g = (k) => String(eq[k] || '').toLowerCase();
  const head = g('head'), body = g('body'), hands = g('hands'), legs = g('legs'), feet = g('feet'), acc = g('accessory');
  const hair = HAIR[[...String(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % HAIR.length];
  let s = '';
  // плащ за спиной
  if (has(/плащ|накидк|мантия-?плащ/, acc) || has(/плащ|накидк/, body)) {
    const c = colorOf(acc || body, '#8a2f2f');
    s += `<path d="M62 94 Q100 84 138 94 L160 252 Q100 272 40 252Z" fill="${c}" stroke="#000" stroke-opacity=".3" stroke-width="2"/><path d="M100 90 L100 262" stroke="#000" stroke-opacity=".15" stroke-width="2"/>`;
  }
  // ноги
  const robe = has(/мантия|роба|ряса|халат/, body);
  const pc = legs ? colorOf(legs, has(/поножи|латн/, legs) ? '#aeb6c2' : '#6a5a48') : '#7a6a58';
  s += `<rect x="76" y="170" width="22" height="86" rx="9" fill="${pc}" stroke="#000" stroke-opacity=".3" stroke-width="2"/><rect x="102" y="170" width="22" height="86" rx="9" fill="${pc}" stroke="#000" stroke-opacity=".3" stroke-width="2"/>`;
  if (has(/поножи|латн/, legs)) s += `<circle cx="87" cy="214" r="9" fill="#cfd5dd"/><circle cx="113" cy="214" r="9" fill="#cfd5dd"/>`;
  // обувь
  if (feet) {
    const c = colorOf(feet, '#5a3d22');
    s += `<path d="M70 248 H100 V268 Q100 278 90 278 H76 Q68 278 68 268Z" fill="${c}" stroke="#000" stroke-opacity=".4" stroke-width="2"/><path d="M100 248 H130 V268 Q132 278 124 278 H110 Q100 278 100 268Z" fill="${c}" stroke="#000" stroke-opacity=".4" stroke-width="2"/>`;
  } else s += `<ellipse cx="86" cy="262" rx="13" ry="6" fill="${SKIN}"/><ellipse cx="114" cy="262" rx="13" ry="6" fill="${SKIN}"/>`;
  // тело
  let torso, bc;
  if (robe) {
    bc = colorOf(body, '#4b3a8a');
    torso = `<path d="M66 94 Q100 82 134 94 L148 264 Q100 276 52 264Z" fill="${bc}" stroke="#000" stroke-opacity=".35" stroke-width="2"/><path d="M100 90 L100 270" stroke="#000" stroke-opacity=".2" stroke-width="2"/><rect x="72" y="166" width="56" height="8" fill="#000" fill-opacity=".25"/>`;
  } else if (has(/кольчуг|доспех|латы|нагрудник|кирас|брон|панцир/, body)) {
    bc = colorOf(body, '#aeb6c2');
    torso = `<path d="M68 94 Q100 84 132 94 L128 178 L72 178Z" fill="${bc}" stroke="#4a4f58" stroke-width="2.5"/><path d="M80 104 Q100 112 120 104 M78 128 Q100 136 122 128 M76 152 Q100 160 124 152" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none"/><circle cx="66" cy="100" r="14" fill="${bc}" stroke="#4a4f58" stroke-width="2.5"/><circle cx="134" cy="100" r="14" fill="${bc}" stroke="#4a4f58" stroke-width="2.5"/>`;
  } else if (has(/кожан|куртк|жилет/, body)) {
    bc = colorOf(body, '#7a5230');
    torso = `<path d="M68 94 Q100 84 132 94 L128 178 L72 178Z" fill="${bc}" stroke="#000" stroke-opacity=".4" stroke-width="2"/><path d="M100 94 L100 178" stroke="#000" stroke-opacity=".35" stroke-width="2"/><path d="M92 106 L108 112 M92 124 L108 130 M92 142 L108 148" stroke="#e8d9b6" stroke-width="2"/>`;
  } else {
    bc = body ? colorOf(body, hashColor(body)) : '#d8c9a8';
    torso = `<path d="M68 94 Q100 84 132 94 L128 178 L72 178Z" fill="${bc}" stroke="#000" stroke-opacity=".3" stroke-width="2"/><path d="M88 92 Q100 104 112 92" stroke="#000" stroke-opacity=".3" stroke-width="2" fill="none"/>`;
  }
  s += torso;
  // руки
  const sleeve = robe ? bc : (body ? bc : '#d8c9a8');
  s += `<path d="M68 98 L48 172 L64 178 L80 108Z" fill="${sleeve}" stroke="#000" stroke-opacity=".3" stroke-width="2"/><path d="M132 98 L152 172 L136 178 L120 108Z" fill="${sleeve}" stroke="#000" stroke-opacity=".3" stroke-width="2"/>`;
  const hc = hands && has(/перчат|рукавиц|наруч|краги/, hands) ? colorOf(hands, '#6a4a2a') : SKIN;
  s += `<circle cx="56" cy="182" r="10" fill="${hc}" stroke="#000" stroke-opacity=".35" stroke-width="2"/><circle cx="144" cy="182" r="10" fill="${hc}" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
  if (hc !== SKIN && has(/наруч/, hands)) s += `<rect x="46" y="162" width="20" height="10" rx="3" fill="${hc}"/><rect x="134" y="162" width="20" height="10" rx="3" fill="${hc}"/>`;
  // пояс, сумка, амулет, кольцо
  if (has(/пояс|ремень/, acc)) s += `<rect x="70" y="164" width="60" height="11" fill="#5a3d22"/><rect x="95" y="162" width="10" height="15" rx="2" fill="#d4a62a"/>`;
  if (has(/сумк|рюкзак|кошел/, acc)) s += `<rect x="122" y="168" width="22" height="26" rx="7" fill="#7a5230" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
  if (has(/кольц|перстен/, acc)) s += `<circle cx="56" cy="186" r="5" fill="none" stroke="#d4a62a" stroke-width="3"/>`;
  if (acc && has(/амулет|кулон|ожерел|подвеск|медальон|талисман/, acc) || (acc && !has(/плащ|накидк|пояс|ремень|сумк|рюкзак|кошел|кольц|перстен/, acc))) {
    s += `<path d="M86 93 Q100 126 114 93" stroke="#d4a62a" stroke-width="2.5" fill="none"/><circle cx="100" cy="121" r="7" fill="${colorOf(acc, '#c0392b')}" stroke="#d4a62a" stroke-width="2"/>`;
  }
  // шея и голова
  s += `<rect x="92" y="80" width="16" height="14" fill="${SKIN}"/><circle cx="100" cy="60" r="25" fill="${SKIN}" stroke="#000" stroke-opacity=".3" stroke-width="2"/>`;
  s += `<path d="M75 58 Q76 30 100 32 Q124 30 125 58 Q112 44 100 46 Q88 44 75 58Z" fill="${hair}"/>`;
  s += `<circle cx="91" cy="64" r="2.8" fill="#2a1a10"/><circle cx="109" cy="64" r="2.8" fill="#2a1a10"/><path d="M93 74 Q100 79 107 74" stroke="#7a3a2a" stroke-width="2" fill="none"/>`;
  if (head) {
    const hcn = colorOf(head, '');
    if (has(/корон|венец|диадем/, head)) s += `<path d="M77 42 L82 20 L91 35 L100 15 L109 35 L118 20 L123 42Z" fill="${colorOf(head, '#d4a62a')}" stroke="#8a6a1a" stroke-width="2"/><circle cx="100" cy="30" r="3.5" fill="#c0392b"/><circle cx="86" cy="36" r="2.5" fill="#3b5fb0"/><circle cx="114" cy="36" r="2.5" fill="#3f8a4a"/>`;
    else if (has(/шлем|каск|шишак/, head)) s += `<path d="M74 62 Q72 26 100 26 Q128 26 126 62 L119 62 L119 52 L81 52 L81 62Z" fill="${colorOf(head, '#aeb6c2')}" stroke="#4a4f58" stroke-width="2.5"/><rect x="97.5" y="50" width="5" height="20" fill="${colorOf(head, '#aeb6c2')}" stroke="#4a4f58" stroke-width="1.5"/><path d="M100 26 Q100 10 112 14 Q104 18 104 28Z" fill="#b3302e"/>`;
    else if (has(/капюшон/, head)) s += `<path d="M70 74 Q68 24 100 22 Q132 24 130 74 Q120 50 100 50 Q80 50 70 74Z" fill="${hcn || '#3a3a46'}" stroke="#000" stroke-opacity=".4" stroke-width="2"/>`;
    else if (has(/шляп|колпак|тюрбан|берет/, head)) s += `<ellipse cx="100" cy="44" rx="40" ry="9" fill="${hcn || '#5a3d6a'}" stroke="#000" stroke-opacity=".35" stroke-width="2"/><path d="M79 44 Q100 -10 121 44Z" fill="${hcn || '#5a3d6a'}" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
    else s += `<path d="M76 52 Q100 22 124 52Z" fill="${hcn || '#7a5230'}" stroke="#000" stroke-opacity=".35" stroke-width="2"/><rect x="76" y="48" width="48" height="7" rx="3" fill="#000" fill-opacity=".2"/>`;
  }
  return s;
}

export function renderAvatar(box, token) {
  const c = token && token.character;
  if (!c || !c.equipment || typeof c.equipment !== 'object') { box.hidden = true; return; }
  const eq = { ...c.equipment };
  const fallbackW = Array.isArray(c.weapons) && c.weapons[0] ? c.weapons[0].name : '';
  const weapon = eq.weapon || fallbackW;
  let s = build(eq, token.name);
  if (eq.offhand && has(/щит/, eq.offhand.toLowerCase())) s += shieldSvg(eq.offhand);
  else if (eq.offhand) s += weaponSvg(eq.offhand, 56, 182, true);
  if (weapon) s += weaponSvg(weapon, 144, 182, false);
  box.querySelector('.av-svg').innerHTML = `<svg viewBox="0 -20 200 310" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Персонаж"><ellipse cx="100" cy="276" rx="60" ry="9" fill="#000" opacity=".25"/>${s}</svg>`;
  const ul = box.querySelector('.av-list'); ul.textContent = '';
  for (const [k, label] of Object.entries(SLOT_NAMES)) {
    const v = k === 'weapon' ? weapon : eq[k];
    if (!v) continue;
    const li = document.createElement('li');
    const b = document.createElement('b'); b.textContent = label + ': ';
    li.append(b, document.createTextNode(v)); ul.appendChild(li);
  }
  if (!ul.children.length) { const li = document.createElement('li'); li.textContent = 'Ничего не надето: впишите вещи в «Одеяние»'; ul.appendChild(li); }
  box.hidden = false;
}
