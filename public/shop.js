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

  // Сцена размещается отдельно от каталога: у обычного игрока каталог скрыт.
  let scene = null;
  let currentShowcase = null;

  function ensureMerchantScene() {
    if (scene && scene.isConnected) return scene;
    const panel = root.querySelector('.shop-panel') || root;
    scene = el('section', 'shop-scene');
    scene.setAttribute('aria-label', 'Сцена магазина и торговец');

    const speech = el('div', 'shop-speech', '');
    speech.setAttribute('aria-live', 'polite');
    speech.setAttribute('role', 'status');

    const stage = el('div', 'shop-merchant-stage');
    const portrait = el('img', 'shop-merchant-art');
    portrait.alt = 'Портрет продавца';
    portrait.loading = 'eager';
    portrait.addEventListener('error', () => {
      portrait.hidden = true;
      const fallback = scene.querySelector('.shop-merchant-fallback');
      if (fallback) fallback.hidden = false;
    });
    const fallback = el('div', 'shop-merchant-fallback', 'Продавец ожидает посетителей');
    fallback.hidden = true;
    stage.append(portrait, fallback);

    const counter = el('div', 'shop-counter');
    const showcase = el('article', 'shop-showcase');
    showcase.hidden = true;

    scene.append(speech, stage, counter, showcase);
    const bodyParent = body?.parentElement || panel;
    panel.insertBefore(scene, bodyParent === panel ? body : bodyParent);
    return scene;
  }

  function renderMerchant() {
    if (!data) return;
    const view = ensureMerchantScene();
    const merchant = data.merchant || {
      name: 'Хозяин лавки', race: 'human', raceLabel: 'Торговец',
      title: 'Хозяин магазина', appearance: 'Внимательно следит за ассортиментом.',
      greeting: `Добро пожаловать. Это ${data.building || 'моя лавка'}. Чем могу помочь?`
    };
    const race = String(merchant.race || 'human').toLowerCase().replace(/[^a-z-]/g, '') || 'human';
    const type = String(data.category || 'general').toLowerCase().replace(/[^a-z-]/g, '') || 'general';
    view.dataset.shopType = type;
    view.dataset.race = race;

    const speech = view.querySelector('.shop-speech');
    speech.textContent = merchant.greeting || `Добро пожаловать в ${data.building || 'мою лавку'}. Чем могу помочь?`;

    const portrait = view.querySelector('.shop-merchant-art');
    const fallback = view.querySelector('.shop-merchant-fallback');
    const portraitUrl = merchant.portraitUrl || merchant.imageUrl || `/assets/merchants/${race}-${type}.webp`;
    if (portrait.dataset.src !== portraitUrl) {
      portrait.dataset.src = portraitUrl;
      portrait.hidden = false;
      fallback.hidden = true;
      portrait.src = portraitUrl;
    }
    portrait.alt = `${merchant.raceLabel || race}, ${merchant.title || 'продавец'} — ${merchant.name || 'торговец'}`;

    const stage = view.querySelector('.shop-merchant-stage');
    stage.setAttribute('aria-label', `${merchant.name || 'Торговец'} за прилавком`);
    if (data.isMaster) {
      body.classList.add('is-visible');
      root.querySelector('.shop-toolbar')?.classList.add('is-visible');
    } else {
      body.classList.remove('is-visible');
      root.querySelector('.shop-toolbar')?.classList.remove('is-visible');
    }
  }

  function speak(text) {
    const view = ensureMerchantScene();
    const bubble = view.querySelector('.shop-speech');
    bubble.textContent = text || '';
  }

  function findMentionedItem(reply, playerMessage) {
    if (!data?.items?.length) return null;
    const haystack = `${reply || ''} ${playerMessage || ''}`.toLocaleLowerCase('ru');
    // Показываем только предмет из реального ассортимента, название которого названо в диалоге.
    return data.items.find(item => item.stock > 0 &&
      item.name && haystack.includes(String(item.name).toLocaleLowerCase('ru'))) || null;
  }

  function showItem(item) {
    if (!item || !data) return;
    currentShowcase = item;
    const view = ensureMerchantScene();
    const card = view.querySelector('.shop-showcase');
    card.textContent = '';
    const imageUrl = item.imageUrl || item.image || item.iconUrl;
    let art;
    if (imageUrl) {
      art = el('img', 'shop-showcase-art');
      art.alt = item.name || 'Демонстрируемый предмет';
      art.src = imageUrl;
      art.addEventListener('error', () => {
        const placeholder = el('div', 'shop-showcase-art', 'Изображение предмета пока не добавлено');
        art.replaceWith(placeholder);
      }, { once: true });
    } else {
      art = el('div', 'shop-showcase-art', 'Изображение предмета пока не добавлено');
      art.setAttribute('aria-hidden', 'true');
    }
    const info = el('div', 'shop-showcase-info');
    info.append(
      el('div', 'shop-showcase-name', item.name),
      el('div', 'shop-showcase-description',
        item.description || item.properties || item.type || 'Описание не указано.'),
      el('div', 'shop-showcase-price', `${fmt(item.price)} зм`)
    );
    const actions = el('div', 'shop-showcase-actions');
    if (!data.isMaster) {
      const buy = el('button', 'sheet-btn shop-buy', 'Купить');
      buy.type = 'button';
      buy.disabled = item.stock <= 0 || data.gold < item.price;
      buy.addEventListener('click', () => {
        if (!confirm(`Купить «${item.name}» за ${fmt(item.price)} зм?`)) return;
        buy.disabled = true;
        socket.emit('shop:purchase', { itemId: item.id, requestId: uid(), buildingIndex }, (r) => {
          if (!r?.ok) {
            status.textContent = r?.error || 'Покупка не выполнена';
            buy.disabled = false;
            return;
          }
          status.textContent = `Куплено: ${r.item}. Остаток: ${fmt(r.gold)} зм.`;
          data.gold = r.gold;
          data.items = data.items.map(x => x.id === item.id ? { ...x, stock: r.stock } : x);
          renderHeader();
          card.hidden = true;
          currentShowcase = null;
        });
      });
      actions.appendChild(buy);
    }
    const hide = el('button', 'sheet-btn alt', 'Убрать');
    hide.type = 'button';
    hide.addEventListener('click', () => { card.hidden = true; currentShowcase = null; });
    actions.appendChild(hide);
    info.appendChild(actions);
    card.append(art, info);
    card.hidden = false;
  }

  function say(text, who = 'merchant') {
    const line = el('div', 'shop-chat-line ' + who, text);
    chatLog.appendChild(line);
    chatLog.scrollTop = chatLog.scrollHeight;
    if (who === 'merchant') speak(text);
  }
  function close() { root.hidden = true; root.classList.remove('shop-scene-mode'); data = null; currentShowcase = null; chatLog.textContent = ''; status.textContent = ''; if (scene) scene.remove(); scene = null; }
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
    query = ''; search.value = ''; status.textContent = ''; chatLog.textContent = ''; currentShowcase = null;
    renderHeader();
    for (const b of root.querySelectorAll('[data-filter]')) {
      const key = b.dataset.filter;
      b.hidden = payload.category === 'all' ? false : key !== payload.category;
      b.classList.toggle('on', key === filter);
    }
    root.hidden = false;
    root.classList.add('shop-scene-mode');
    renderMerchant();
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
      const reply = r?.reply || r?.error || 'Торговец не ответил.';
      say(reply);
      const mentioned = findMentionedItem(reply, message);
      if (mentioned) showItem(mentioned);
      if (r?.items) {
        data.items = r.items;
        if (currentShowcase) {
          const refreshed = data.items.find(x => x.id === currentShowcase.id);
          if (refreshed) showItem(refreshed);
          else { currentShowcase = null; ensureMerchantScene().querySelector('.shop-showcase').hidden = true; }
        }
      }
    });
  }
  chatSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
  return { open, close };
}
