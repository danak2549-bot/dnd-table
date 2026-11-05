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

  // Сцена с отдельным нарисованным портретом торговца.
  function ensureMerchantStyles() {
    if (document.getElementById('shop-merchant-scene-styles')) return;
    const style = el('style');
    style.id = 'shop-merchant-scene-styles';
    style.textContent = `
      .shop-merchant-scene{position:relative;isolation:isolate;min-height:390px;margin:0 0 16px;overflow:hidden;border:1px solid #806744;border-radius:14px;background:radial-gradient(ellipse at 50% 20%,#594332 0%,#29201b 58%,#100e0d 100%);color:#f4e7ce;text-align:center}
      .shop-merchant-scene-head{position:relative;z-index:3;padding:12px 10px 7px;text-shadow:0 2px 5px #000;font-weight:800;font-size:18px;background:linear-gradient(180deg,#100d0bd9,#100d0b00)}
      .shop-merchant-scene-role{display:block;margin-top:3px;font-size:12px;font-weight:400;color:#ddc6a3}
      .shop-merchant-stage{height:320px;position:relative;display:flex;justify-content:center;align-items:flex-end;overflow:hidden}
      .shop-merchant-art{display:block;width:min(100%,430px);height:100%;object-fit:cover;object-position:center 35%;filter:drop-shadow(0 8px 10px #0009)}
      .shop-merchant-counter{position:absolute;z-index:4;bottom:0;left:0;right:0;height:43px;border-top:5px solid #c49a5d;background:repeating-linear-gradient(90deg,#694326 0 38px,#795332 39px 42px);box-shadow:0 -5px 15px #0008}
      .shop-merchant-counter:after{content:"";position:absolute;left:0;right:0;bottom:7px;height:3px;background:#3a2418}
      .shop-merchant-description{position:relative;z-index:5;margin:0;padding:9px 12px 12px;background:#100d0bd9;font-size:12px;color:#e4d3b7}
      @media(max-width:600px){.shop-merchant-scene{min-height:330px}.shop-merchant-stage{height:270px}.shop-merchant-art{width:100%;object-fit:contain}}
    `;
    document.head.appendChild(style);
  }

  function merchantArtKey(merchant) {
    const source = `${data?.category || ''} ${data?.building || ''} ${merchant?.title || ''} ${merchant?.role || ''}`.toLocaleLowerCase('ru');
    if (/брон|armou|доспех|щит/.test(source)) return 'armorer';
    if (/оруж|weapon|арсенал/.test(source)) return 'weaponsmith';
    if (/библи|книг|spell|гримуар/.test(source)) return 'librarian';
    if (/алхим|зель|порош|ингредиент/.test(source)) return 'alchemist';
    if (/маг|артефакт|чар|заклин/.test(source)) return 'mage';
    if (/рын|торгов|market|общая лавка/.test(source)) return 'market';
    if (/аксесс|украш|кольц|амулет/.test(source)) return 'accessories';
    if (/кузн|blacksmith|smith/.test(source)) return 'blacksmith';
    return ({ dwarf:'blacksmith', orc:'weaponsmith', elf:'librarian', fairy:'mage', halfling:'market' })[String(merchant?.race || '').toLowerCase()] || 'blacksmith';
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
    const artKey = merchantArtKey(merchant);
    scene.textContent = '';
    const heading = el('div', 'shop-merchant-scene-head', merchant.name || 'Хозяин лавки');
    heading.appendChild(el('span', 'shop-merchant-scene-role', merchant.title || merchant.raceLabel || 'Торговец'));
    const stage = el('div', 'shop-merchant-stage');
    const art = el('img', 'shop-merchant-art');
    art.alt = `${merchant.name || 'Торговец'} — ${merchant.title || 'продавец'}`;
    art.loading = 'eager';
    art.src = `/assets/merchants/${artKey}.webp`;
    art.onerror = () => { art.onerror = null; art.src = '/assets/merchants/blacksmith.webp'; };
    stage.append(art, el('div', 'shop-merchant-counter'));
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
