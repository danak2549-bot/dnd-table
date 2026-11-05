// Интерфейс магазинов. Покупка подтверждается игроком и окончательно проверяется сервером.
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');
const uid = () => 'buy-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);

export function mountShop(root, { socket } = {}) {
  let data = null, buildingIndex = -1, filter = 'all', query = '';
  const body = root.querySelector('.shop-body');
  const title = root.querySelector('.shop-title');
  const sub = root.querySelector('.shop-sub');
  const gold = root.querySelector('.shop-gold');
  const status = root.querySelector('.shop-status');
  const search = root.querySelector('.shop-search');
  const chatLog = root.querySelector('.shop-chat-log');
  const chatInput = root.querySelector('.shop-chat-input');
  const chatSend = root.querySelector('.shop-chat-send');

  // Сцена торговца создаётся внутри списка магазина, поэтому HTML вручную менять не нужно.
  function ensureMerchantStyles() {
    if (document.getElementById('shop-merchant-scene-styles')) return;
    const style = el('style');
    style.id = 'shop-merchant-scene-styles';
    style.textContent = `
      .shop-merchant-scene{position:relative;isolation:isolate;min-height:250px;margin:0 0 16px;padding:18px 18px 0;overflow:hidden;border:1px solid #806744;border-radius:14px;background:radial-gradient(ellipse at 50% 25%,#67513a 0%,#30271f 55%,#171512 100%);color:#f4e7ce}
      .shop-merchant-scene:before{content:"";position:absolute;inset:0;z-index:-1;opacity:.32;background:repeating-linear-gradient(90deg,transparent 0 54px,#b99a6b22 55px 57px),linear-gradient(180deg,#d2a66a18,#0008)}
      .shop-merchant-scene-head{position:relative;z-index:3;text-align:center;text-shadow:0 2px 5px #000;font-weight:700;font-size:16px}
      .shop-merchant-scene-role{display:block;margin-top:4px;font-size:12px;font-weight:400;color:#d8c3a0}
      .shop-merchant-stage{height:174px;position:relative;display:flex;justify-content:center;align-items:flex-end}
      .shop-merchant-figure{position:relative;width:126px;height:160px;filter:drop-shadow(0 7px 5px #0009)}
      .shop-merchant-hair{position:absolute;z-index:3;top:8px;left:34px;width:58px;height:38px;border-radius:48% 48% 30% 30%;background:var(--merchant-hair,#49372c)}
      .shop-merchant-head{position:absolute;z-index:2;top:18px;left:39px;width:48px;height:57px;border-radius:44% 44% 46% 46%;background:var(--merchant-skin,#c58f69);box-shadow:inset 0 -5px 0 #00000012}
      .shop-merchant-ear{position:absolute;z-index:1;top:34px;width:23px;height:15px;border-radius:50%;background:var(--merchant-skin,#c58f69)}
      .shop-merchant-ear.left{left:22px}.shop-merchant-ear.right{right:22px}
      .shop-merchant-figure.elf .shop-merchant-ear{width:34px;height:10px;top:31px;clip-path:polygon(0 50%,100% 0,78% 100%)}
      .shop-merchant-figure.fairy .shop-merchant-ear{width:28px;height:10px;top:30px;clip-path:polygon(0 50%,100% 0,78% 100%)}
      .shop-merchant-eyes{position:absolute;top:41px;left:50px;z-index:4;width:5px;height:4px;border-radius:50%;background:#251c18;box-shadow:21px 0 #251c18}
      .shop-merchant-beard{position:absolute;z-index:4;top:53px;left:43px;width:40px;height:25px;border-radius:5px 5px 55% 55%;background:var(--merchant-hair,#49372c);clip-path:polygon(0 0,100% 0,85% 65%,50% 100%,15% 65%)}
      .shop-merchant-body{position:absolute;z-index:2;top:72px;left:22px;width:82px;height:86px;border-radius:24px 24px 8px 8px;background:var(--merchant-clothes,#6c4938);border:2px solid #17120f;clip-path:polygon(18% 0,82% 0,100% 100%,0 100%)}
      .shop-merchant-apron{position:absolute;z-index:3;top:91px;left:47px;width:32px;height:65px;background:#9a7952;border:1px solid #4b3828;clip-path:polygon(12% 0,88% 0,100% 100%,0 100%)}
      .shop-merchant-arm{position:absolute;z-index:4;top:86px;width:22px;height:66px;border-radius:14px;background:var(--merchant-clothes,#6c4938);border:2px solid #17120f}
      .shop-merchant-arm.left{left:9px;transform:rotate(17deg)}.shop-merchant-arm.right{right:9px;transform:rotate(-17deg)}
      .shop-merchant-wing{position:absolute;z-index:1;top:77px;width:45px;height:65px;border-radius:80% 20% 70% 25%;background:linear-gradient(135deg,#f3e7d0dd,#b9a7c7aa);border:1px solid #ffffff55}
      .shop-merchant-wing.left{left:-9px;transform:rotate(24deg)}.shop-merchant-wing.right{right:-9px;transform:scaleX(-1) rotate(24deg)}
      .shop-merchant-counter{position:absolute;z-index:5;bottom:0;left:-18px;right:-18px;height:48px;border-top:5px solid #c49a5d;background:repeating-linear-gradient(90deg,#694326 0 38px,#795332 39px 42px);box-shadow:0 -5px 15px #0008}
      .shop-merchant-counter:after{content:"";position:absolute;left:0;right:0;bottom:7px;height:3px;background:#3a2418}
      .shop-merchant-description{position:relative;z-index:6;margin:9px 0 0;text-align:center;font-size:12px;color:#e4d3b7}
      @media(max-width:600px){.shop-merchant-scene{min-height:228px;padding-top:14px}.shop-merchant-stage{height:155px}.shop-merchant-figure{transform:scale(.88);transform-origin:bottom center}.shop-merchant-description{font-size:11px}}
    `;
    document.head.appendChild(style);
  }

  function renderMerchant() {
    if (!data || !body) return;
    ensureMerchantStyles();
    let scene = body.querySelector('.shop-merchant-scene');
    if (!scene) {
      scene = el('section', 'shop-merchant-scene');
      scene.setAttribute('aria-label', 'Торговец за прилавком');
      body.prepend(scene);
    }
    const merchant = data.merchant || {
      name: 'Хозяин лавки', race: 'human', raceLabel: 'Торговец',
      title: 'Хозяин магазина', appearance: 'Внимательно следит за ассортиментом.',
      greeting: `Добро пожаловать. Это ${data.building || 'моя лавка'}. Чем могу помочь?`
    };
    const race = String(merchant.race || 'human').toLowerCase().replace(/[^a-z-]/g, '');
    const palettes = {
      human: ['#c58f69','#49372c','#596b62'], elf: ['#d6ad8b','#76533d','#456b54'],
      dwarf: ['#bd8059','#65402b','#80502f'], halfling: ['#d9a879','#70472d','#65754a'],
      orc: ['#8caa72','#342c25','#465c3c'], angel: ['#e0c5a5','#d8c7a1','#e6e0d1'],
      demon: ['#a65e55','#251b20','#693b48'], fairy: ['#d8b6a0','#6d527b','#566e83']
    };
    const colors = palettes[race] || palettes.human;
    scene.style.setProperty('--merchant-skin', colors[0]);
    scene.style.setProperty('--merchant-hair', colors[1]);
    scene.style.setProperty('--merchant-clothes', colors[2]);
    scene.textContent = '';
    const heading = el('div', 'shop-merchant-scene-head', merchant.name || 'Хозяин лавки');
    heading.appendChild(el('span', 'shop-merchant-scene-role', merchant.title || merchant.raceLabel || 'Торговец'));
    const stage = el('div', 'shop-merchant-stage');
    const figure = el('div', 'shop-merchant-figure ' + race);
    figure.append(
      el('div', 'shop-merchant-hair'),
      el('div', 'shop-merchant-ear left'),
      el('div', 'shop-merchant-ear right'),
      el('div', 'shop-merchant-head'),
      el('div', 'shop-merchant-eyes')
    );
    if (['dwarf', 'orc'].includes(race)) figure.appendChild(el('div', 'shop-merchant-beard'));
    if (['angel', 'fairy'].includes(race)) {
      figure.append(el('div', 'shop-merchant-wing left'), el('div', 'shop-merchant-wing right'));
    }
    figure.append(
      el('div', 'shop-merchant-body'),
      el('div', 'shop-merchant-apron'),
      el('div', 'shop-merchant-arm left'),
      el('div', 'shop-merchant-arm right')
    );
    stage.append(figure, el('div', 'shop-merchant-counter'));
    scene.append(heading, stage, el('p', 'shop-merchant-description', merchant.description || merchant.appearance || 'Торговец ждёт покупателей.'));
  }

  function say(text, who = 'merchant') {
    const line = el('div', 'shop-chat-line ' + who, text);
    chatLog.appendChild(line);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
  function close() { root.hidden = true; data = null; chatLog.textContent = ''; status.textContent = ''; }
  root.querySelector('.shop-close').addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  search.addEventListener('input', () => { query = search.value.trim().toLocaleLowerCase('ru'); renderItems(); });


  function renderItems() {
    if (!data) return;
    body.textContent = '';
    if (data.isMaster) {
      const form = el('div', 'shop-custom-form');
      form.appendChild(el('strong', '', 'Добавить свой товар'));
      const name = el('input', 'sheet-input'); name.placeholder = 'Название предмета'; name.maxLength = 60;
      const description = el('textarea', 'sheet-input'); description.placeholder = 'Описание и особые свойства'; description.maxLength = 500; description.rows = 2;
      const price = el('input', 'sheet-input'); price.type = 'number'; price.min = '1'; price.max = '2000000000'; price.placeholder = 'Цена, зм';
      const stock = el('input', 'sheet-input'); stock.type = 'number'; stock.min = '0'; stock.max = '9999'; stock.value = '1'; stock.placeholder = 'Количество';
      const category = el('select', 'sheet-input');
      const categories = data.category === 'all' ? [['weapon','Оружие'],['armor','Броня'],['shield','Щиты'],['boots','Обувь'],['gloves','Перчатки'],['book','Книги']]
        : data.category === 'armor' ? [['armor','Броня'],['shield','Щиты'],['boots','Обувь'],['gloves','Перчатки']]
        : [[data.category, data.category === 'weapon' ? 'Оружие' : 'Книги']];
      for (const [value, label] of categories) { const option = el('option', '', label); option.value = value; category.appendChild(option); }
      const add = el('button', 'sheet-btn', 'Добавить в ассортимент'); add.type = 'button';
      add.addEventListener('click', () => {
        if (!name.value.trim() || !price.value) { status.textContent = 'Укажите название и цену.'; return; }
        add.disabled = true;
        socket.emit('shop:admin:add-custom', { buildingIndex, name: name.value, description: description.value,
          category: category.value, price: price.value, stock: stock.value }, (r) => {
          add.disabled = false;
          if (!r?.ok) { status.textContent = r?.error || 'Не удалось добавить товар'; return; }
          data.items.push(r.item); status.textContent = `Добавлен предмет «${r.item.name}».`; renderItems();
        });
      });
      form.append(name, category, price, stock, description, add);
      body.appendChild(form);
    }
    const items = data.items.filter((item) => (filter === 'all' || item.category === filter ||
      (filter === 'armor' && ['armor','shield','boots','gloves'].includes(item.category))) &&
      (!query || (item.name + ' ' + item.description + ' ' + (item.spell || '')).toLocaleLowerCase('ru').includes(query)));
    if (!items.length) { body.appendChild(el('div', 'shop-empty', 'В этой лавке таких товаров нет.')); renderMerchant(); return; }
    for (const item of items) {
      const card = el('article', 'shop-item');
      const head = el('div', 'shop-item-head');
      const name = el('strong', 'shop-item-name', item.name);
      const price = el('span', 'shop-price', fmt(item.price) + ' зм');
      head.append(name, price);
      const meta = el('div', 'shop-item-meta', [item.type, item.spell ? 'Заклинание: ' + item.spell : '',
        item.spellLevel != null ? 'Уровень заклинания: ' + item.spellLevel : '',
        item.armorClass ? 'КД: ' + item.armorClass : '',
        item.damage ? 'Урон: ' + item.damage : ''].filter(Boolean).join(' · '));
      const desc = el('p', 'shop-item-desc', item.description || item.properties || 'Описание не указано.');
      const foot = el('div', 'shop-item-foot');
      foot.appendChild(el('span', 'shop-stock', item.stock > 0 ? 'В наличии: ' + item.stock : 'Нет в наличии'));
      if (!data.isMaster) {
        const buy = el('button', 'sheet-btn shop-buy', 'Купить');
        buy.type = 'button';
        buy.disabled = item.stock <= 0 || data.gold < item.price;
        buy.addEventListener('click', () => {
          if (!confirm(`Купить «${item.name}» за ${fmt(item.price)} зм?`)) return;
          buy.disabled = true;
          socket.emit('shop:purchase', { itemId: item.id, requestId: uid(), buildingIndex }, (r) => {
            if (!r?.ok) { status.textContent = r?.error || 'Покупка не выполнена'; buy.disabled = false; return; }
            status.textContent = `Куплено: ${r.item}. Остаток: ${fmt(r.gold)} зм.`;
            data.gold = r.gold;
            data.items = data.items.map((x) => x.id === item.id ? { ...x, stock: r.stock } : x);
            renderHeader(); renderItems();
          });
        });
        foot.appendChild(buy);
      } else {
        const admin = el('div', 'shop-admin');
        const p = el('input', 'sheet-input shop-admin-num'); p.type = 'number'; p.min = '1'; p.max = '2000000000'; p.value = String(item.basePrice);
        p.setAttribute('aria-label', 'Цена');
        const st = el('input', 'sheet-input shop-admin-num'); st.type = 'number'; st.min = '0'; st.max = '9999'; st.value = String(item.stock);
        st.setAttribute('aria-label', 'Остаток');
        const dc = el('input', 'sheet-input shop-admin-num'); dc.type = 'number'; dc.min = '0'; dc.max = '90'; dc.value = String(item.discount || 0);
        dc.setAttribute('aria-label', 'Скидка в процентах');
        const save = el('button', 'sheet-btn small', 'Сохранить');
        save.type = 'button';
        save.addEventListener('click', () => {
          socket.emit('shop:admin:update', { itemId: item.id, price: p.value, stock: st.value, discount: dc.value }, (r) => {
            if (!r?.ok) { status.textContent = r?.error || 'Не удалось сохранить'; return; }
            data.items = data.items.map((x) => x.id === item.id ? r.item : x);
            status.textContent = `Настройки «${item.name}» сохранены.`;
            renderItems();
          });
        });
        admin.append(el('label', '', 'Цена'), p, el('label', '', 'Остаток'), st, el('label', '', 'Скидка %'), dc, save);
        card.appendChild(admin);
      }
      card.append(head, meta, desc, foot);
      body.appendChild(card);
    }
    renderMerchant();
  }
  function renderHeader() {
    title.textContent = data.building || 'Магазин';
    sub.textContent = 'Королевство: ' + data.kingdom;
    gold.textContent = data.isMaster ? 'Режим мастера: настройка цен и остатков' : 'Ваше золото: ' + fmt(data.gold) + ' зм';
  }
  function open(payload, index) {
    data = payload; buildingIndex = index; filter = payload.category === 'all' ? 'all' : payload.category === 'armor' ? 'armor' : payload.category;
    query = ''; search.value = ''; status.textContent = ''; chatLog.textContent = '';
    renderHeader();
    for (const b of root.querySelectorAll('[data-filter]')) {
      const key = b.dataset.filter;
      b.hidden = payload.category === 'all' ? false : key !== payload.category;
      b.classList.toggle('on', key === filter);
    }
    root.hidden = false;
    renderItems();
    const greeting = payload.merchant?.greeting ||
      `Добро пожаловать. Это ${payload.building}. Здесь продаются товары королевства ${payload.kingdom}.`;
    say(greeting);
  }
  root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.filter; root.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('on', x === b)); renderItems();
  }));
  function sendChat() {
    const message = chatInput.value.trim();
    if (!message || !data) return;
    say(message, 'player'); chatInput.value = ''; chatSend.disabled = true;
    socket.emit('shop:chat', { message, buildingIndex }, (r) => {
      chatSend.disabled = false;
      say(r?.reply || r?.error || 'Торговец не ответил.');
      if (r?.items) { data.items = r.items; renderItems(); }
    });
  }
  chatSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
  return { open, close };
}
