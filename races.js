// Расы: внешность (цвет кожи, уши, рога, хвост, крылья и т. д.). Возвращает готовые слои SVG.
export const RACES = [
  'Человек', 'Эльф', 'Высший эльф', 'Лесной эльф', 'Тёмный эльф (дроу)', 'Полуэльф', 'Дварф', 'Горный дварф', 'Холмовой дварф',
  'Полурослик', 'Гном', 'Полуорк', 'Орк', 'Тифлинг', 'Драконорождённый', 'Голиаф', 'Аасимар', 'Генази огня', 'Генази воды',
  'Генази земли', 'Генази воздуха', 'Табакси', 'Кенку', 'Ящеролюд', 'Тортл', 'Тритон', 'Фирболг', 'Гоблин', 'Хобгоблин',
  'Багбир', 'Кобольд', 'Минотавр', 'Фея', 'Шифтер', 'Перевёртыш', 'Ведалкен', 'Сатир', 'Вампир', 'Тень',
];
const SKINS = ['#e8b890', '#d9a577', '#c68a5c', '#a8714a', '#f0cfb0'];
const hsh = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const mir = (p) => `${p}<g transform="translate(200 0) scale(-1 1)">${p}</g>`;
const ln = 'stroke="#000" stroke-opacity=".35" stroke-width="1.5"';
const earElf = (c, len) => mir(`<path d="M77 58 L${77 - len} 44 L78 68Z" fill="${c}" ${ln}/>`);
const earCat = (c) => mir(`<path d="M78 42 L80 14 L99 36Z" fill="${c}" ${ln}/><path d="M83 36 L84 24 L93 34Z" fill="#f0a0a0"/>`);
const horns = (c) => mir(`<path d="M82 40 Q60 22 72 4 Q76 24 91 34Z" fill="${c}" ${ln}/>`);
const bull = mir('<path d="M78 46 Q48 42 50 12 Q64 30 86 38Z" fill="#eee4c8" stroke="#6a5a3a" stroke-width="2"/>');
const tusks = mir('<path d="M92 77 L88 66 L98 74Z" fill="#fff" stroke="#999" stroke-width="1"/>');
const tail = (c, spade) => `<path d="M112 196 Q172 196 160 262 Q150 216 112 212Z" fill="${c}" ${ln}/>${spade ? '<path d="M160 262 L148 252 L172 250Z" fill="' + c + '"/>' : ''}`;
const beard = (c) => `<path d="M79 66 Q80 114 100 120 Q120 114 121 66 Q110 84 100 82 Q90 84 79 66Z" fill="${c}" ${ln}/>`;
const wingsAngel = mir('<path d="M66 96 Q8 46 6 142 Q36 120 64 136Z" fill="#fff" stroke="#c8d0e0" stroke-width="2"/><path d="M58 108 Q28 88 20 132" stroke="#c8d0e0" stroke-width="2" fill="none"/>');
const wingsFairy = mir('<ellipse cx="58" cy="100" rx="32" ry="14" transform="rotate(-30 58 100)" fill="#bfe8ff" fill-opacity=".65" stroke="#7ab" stroke-width="1.5"/><ellipse cx="66" cy="128" rx="22" ry="10" transform="rotate(25 66 128)" fill="#d8f0ff" fill-opacity=".65" stroke="#7ab" stroke-width="1.5"/>');
const batWings = mir('<path d="M66 96 Q6 38 4 120 Q20 108 30 128 Q44 110 66 134Z" fill="#5a1a2a" stroke="#2a0a14" stroke-width="2"/><path d="M60 104 Q28 80 14 118 M60 116 Q40 100 30 128" stroke="#2a0a14" stroke-width="2" fill="none"/>');
const halo = '<ellipse cx="100" cy="12" rx="20" ry="6" fill="none" stroke="#ffe08a" stroke-width="4"/>';
const snoutDrag = (c) => `<ellipse cx="100" cy="73" rx="15" ry="10" fill="${c}" ${ln}/><circle cx="94" cy="69" r="1.8" fill="#000"/><circle cx="106" cy="69" r="1.8" fill="#000"/>` + mir(`<path d="M82 40 Q70 20 82 12 L91 34Z" fill="${c}" ${ln}/>`);
const beak = '<path d="M91 63 L109 63 L100 86Z" fill="#e0a82a" stroke="#8a6a1a" stroke-width="1.5"/>';
const catFace = '<path d="M96 68 L104 68 L100 73Z" fill="#e88"/><path d="M82 72 L62 67 M82 77 L62 79 M118 72 L138 67 M118 77 L138 79" stroke="#fff" stroke-opacity=".8" stroke-width="1.5"/>';
const bullFace = '<ellipse cx="100" cy="76" rx="14" ry="9" fill="#e0a0a0" stroke="#6a3a3a" stroke-opacity=".5"/><circle cx="94" cy="77" r="2" fill="#6a3a3a"/><circle cx="106" cy="77" r="2" fill="#6a3a3a"/>';
const shell = '<ellipse cx="100" cy="132" rx="54" ry="58" fill="#7a8a3a" stroke="#4a5a20" stroke-width="3"/><path d="M58 110 L142 110 M58 152 L142 152 M100 74 L100 190" stroke="#4a5a20" stroke-width="3" opacity=".6"/>';
const fireHair = '<path d="M76 52 Q68 20 86 8 Q88 28 100 4 Q104 26 118 8 Q132 22 124 52Z" fill="#ff8a2a"/><path d="M90 42 Q100 12 110 42Z" fill="#ffd54a"/>';
const spots = '<circle cx="86" cy="48" r="2.5" fill="#6a4a1a"/><circle cx="112" cy="46" r="2.2" fill="#6a4a1a"/><circle cx="104" cy="52" r="1.8" fill="#6a4a1a"/>';
const fangs = mir('<path d="M95 77 L93 83 L98 78Z" fill="#fff"/>');

export function raceFeatures(text, seedName = '') {
  const t = String(text || '').toLowerCase();
  const f = { skin: SKINS[hsh(seedName) % SKINS.length], hair: null, bald: false, hairSvg: '', scale: [1, 1], behind: '', ears: '', horns: '', face: '', top: '', id: 'human' };
  const R = (re) => re.test(t);
  if (R(/полуэльф|полу-эльф|полу эльф/)) { f.id = 'halfelf'; f.skin = '#ecc59e'; f.ears = earElf(f.skin, 10); }
  else if (R(/дроу|тёмн\S* эльф|темн\S* эльф/)) { f.id = 'drow'; f.skin = '#4c4c68'; f.hair = '#f2f2f6'; f.ears = earElf(f.skin, 24); f.scale = [0.95, 1.03]; }
  else if (R(/эльф/)) { f.id = 'elf'; f.skin = R(/лесн/) ? '#d9b48a' : '#f2d2ae'; f.ears = earElf(f.skin, 24); f.scale = [0.94, 1.05]; f.hair = R(/высш/) ? '#f4e8a8' : null; }
  else if (R(/дварф|гном-?дварф/)) { f.id = 'dwarf'; f.skin = '#e0a878'; f.hair = ['#8a3a1a', '#5a3a1a', '#c9a050', '#8a8a8a'][hsh(seedName) % 4]; f.scale = [1.12, 0.82]; f.face = beard(f.hair); }
  else if (R(/полурослик|хоббит|халфлинг/)) { f.id = 'halfling'; f.skin = '#eac39a'; f.scale = [0.86, 0.72]; f.ears = earElf(f.skin, 6); }
  else if (R(/гном/)) { f.id = 'gnome'; f.skin = '#e6b890'; f.hair = '#f0f0f0'; f.scale = [0.82, 0.7]; f.ears = earElf(f.skin, 12); }
  else if (R(/полуорк|полу-орк|полу орк/)) { f.id = 'halforc'; f.skin = '#8fa876'; f.scale = [1.12, 1.06]; f.face = tusks; }
  else if (R(/орк|урук/)) { f.id = 'orc'; f.skin = '#5f8a46'; f.hair = '#222'; f.scale = [1.2, 1.1]; f.face = tusks; f.ears = earElf(f.skin, 8); }
  else if (R(/имп(?![а-яё])|чертёнок|чертенок|бесёнок|бесенок|гремлин/)) { f.id = 'imp'; f.skin = '#c0392b'; f.bald = true; f.horns = horns('#2a1a1a'); f.behind = batWings + tail('#c0392b', true); f.scale = [0.7, 0.64]; }
  else if (R(/демон|инфернал|дьявол|баатезу|рогат/)) { f.id = 'demon'; f.skin = '#a8281e'; f.bald = true; f.horns = bull.replace('#eee4c8', '#2a1a1a'); f.behind = batWings + tail('#a8281e', true); f.scale = [1.12, 1.12]; f.face = '<circle cx="91" cy="64" r="3.2" fill="#ffd54a"/><circle cx="109" cy="64" r="3.2" fill="#ffd54a"/>' + fangs; }
  else if (R(/зомби|упырь|гуль|мертвяк/)) { f.id = 'zombie'; f.skin = '#8aa070'; f.hair = '#555'; f.face = '<circle cx="91" cy="64" r="3.5" fill="#222"/><circle cx="109" cy="64" r="3.5" fill="#222"/>'; }
  else if (R(/тифлинг/)) { f.id = 'tiefling'; f.skin = ['#b04a5a', '#8a4a9a', '#c0603a'][hsh(seedName) % 3]; f.hair = '#2a1a2a'; f.horns = horns('#3a2a2a'); f.behind = tail(f.skin, true); }
  else if (R(/дракон/)) { f.id = 'dragonborn'; f.skin = R(/золот/) ? '#d4a62a' : R(/син|лазур/) ? '#3a7ab8' : R(/зелен|зелён/) ? '#4a9a5a' : R(/бел/) ? '#dfe8ee' : '#b0402a'; f.bald = true; f.face = snoutDrag(f.skin); f.behind = tail(f.skin, false); f.scale = [1.1, 1.08]; }
  else if (R(/голиаф/)) { f.id = 'goliath'; f.skin = '#a8a8b4'; f.bald = true; f.scale = [1.22, 1.22]; f.face = '<path d="M84 44 L116 44 M88 50 L112 50" stroke="#3a3a48" stroke-width="3"/>'; }
  else if (R(/аасимар|небесн/)) { f.id = 'aasimar'; f.skin = '#f6e4d0'; f.hair = '#f6f0d0'; f.behind = wingsAngel; f.top = halo; }
  else if (R(/генази/)) {
    f.id = 'genasi';
    if (R(/огн/)) { f.skin = '#d9542a'; f.bald = true; f.hairSvg = fireHair; }
    else if (R(/вод/)) { f.skin = '#3a8ac8'; f.hair = '#bfe8ff'; }
    else if (R(/земл/)) { f.skin = '#8a6a4a'; f.hair = '#4a3a2a'; }
    else { f.skin = '#a8c8e8'; f.hair = '#ffffff'; }
  }
  else if (R(/табакси/)) { f.id = 'tabaxi'; f.skin = '#d9a050'; f.bald = true; f.hairSvg = ''; f.ears = earCat(f.skin); f.face = spots + catFace; f.behind = tail(f.skin, false); }
  else if (R(/кенку/)) { f.id = 'kenku'; f.skin = '#2f2f3a'; f.bald = true; f.face = beak; }
  else if (R(/ящер|лизард|ящерол/)) { f.id = 'lizard'; f.skin = '#5a9a5a'; f.bald = true; f.face = snoutDrag('#5a9a5a'); f.behind = tail('#5a9a5a', false); }
  else if (R(/тортл|черепах/)) { f.id = 'tortle'; f.skin = '#9aa860'; f.bald = true; f.behind = shell; f.scale = [1.08, 0.98]; }
  else if (R(/тритон/)) { f.id = 'triton'; f.skin = '#4a9ac8'; f.hair = '#2a6a9a'; f.ears = mir('<path d="M76 60 L56 48 L60 64 L54 74 L76 70Z" fill="#7ac8e8" stroke="#2a6a8a" stroke-width="1.5"/>'); }
  else if (R(/фирболг/)) { f.id = 'firbolg'; f.skin = '#8aa0b8'; f.hair = '#3a4a6a'; f.scale = [1.2, 1.16]; f.ears = earElf(f.skin, 18); }
  else if (R(/хобгоблин/)) { f.id = 'hobgoblin'; f.skin = '#b0603a'; f.hair = '#2a1a1a'; f.ears = earElf(f.skin, 14); f.scale = [1.02, 0.98]; }
  else if (R(/багбир/)) { f.id = 'bugbear'; f.skin = '#8a6a3a'; f.hair = '#4a3a1a'; f.scale = [1.22, 1.12]; f.ears = earElf(f.skin, 12); f.face = tusks; }
  else if (R(/гоблин/)) { f.id = 'goblin'; f.skin = '#7aa83a'; f.hair = '#2a2a1a'; f.scale = [0.82, 0.72]; f.ears = earElf(f.skin, 34); }
  else if (R(/кобольд/)) { f.id = 'kobold'; f.skin = '#b0522d'; f.bald = true; f.scale = [0.78, 0.7]; f.face = snoutDrag('#b0522d'); f.behind = tail('#b0522d', false); }
  else if (R(/минотавр/)) { f.id = 'minotaur'; f.skin = '#7a5a3a'; f.bald = true; f.horns = bull; f.face = bullFace; f.scale = [1.22, 1.18]; f.ears = earElf(f.skin, 8); }
  else if (R(/фея|фэри|пикси|сприг/)) { f.id = 'fairy'; f.skin = '#f6d8e0'; f.hair = '#f08ac0'; f.behind = wingsFairy; f.scale = [0.7, 0.64]; f.ears = earElf(f.skin, 10); }
  else if (R(/шифтер|оборотень/)) { f.id = 'shifter'; f.skin = '#c89a68'; f.hair = '#5a3a1a'; f.ears = earCat('#c89a68'); f.face = fangs; }
  else if (R(/перевёртыш|перевертыш|хейнджлинг|чейнджлинг/)) { f.id = 'changeling'; f.skin = '#b8bcc8'; f.hair = '#e8e8ee'; }
  else if (R(/ведалкен/)) { f.id = 'vedalken'; f.skin = '#6a90c8'; f.bald = true; f.scale = [0.96, 1.06]; }
  else if (R(/сатир/)) { f.id = 'satyr'; f.skin = '#d9a878'; f.hair = '#6a3a1a'; f.horns = horns('#8a7a5a'); f.ears = earElf(f.skin, 14); }
  else if (R(/вампир/)) { f.id = 'vampire'; f.skin = '#ece0dc'; f.hair = '#1a1a22'; f.face = fangs + '<circle cx="91" cy="64" r="3" fill="#c0392b"/><circle cx="109" cy="64" r="3" fill="#c0392b"/>'; }
  return f;
}
