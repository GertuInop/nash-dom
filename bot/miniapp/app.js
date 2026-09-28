/**
 * Наш Дом — мини-приложение MAX
 * Bridge: https://dev.max.ru/docs/webapps/bridge
 * API:    https://dev.max.ru/docs-api
 * Intro:  https://dev.max.ru/docs/webapps/introduction
 */
(() => {
  const TOKEN_KEY = 'nash-dom-token';
  const $ = (sel, root = document) => root.querySelector(sel);
  const app = $('#app');

  const state = {
    token: localStorage.getItem(TOKEN_KEY),
    user: null,
    houses: [],
    chats: [],
    messages: [],
    topics: [],
    tickets: [],
    works: [],
    route: 'boot',
    chatId: null,
    entrance: 1,
    toast: null,
    max: {
      inside: false,
      platform: null,
      version: null,
      deviceName: null,
      startParam: null,
      entryPoint: null,
      profile: null,
    },
  };

  const wa = () => window.WebApp || null;
  let backButtonBound = false;

  function haptic(kind = 'light') {
    try {
      const h = wa()?.HapticFeedback;
      if (!h) return;
      if (kind === 'success' || kind === 'error' || kind === 'warning') {
        h.notificationOccurred?.(kind);
      } else if (kind === 'select') {
        h.selectionChanged?.();
      } else {
        h.impactOccurred?.(kind);
      }
    } catch {
      /* вне MAX */
    }
  }

  function toast(text) {
    state.toast = text;
    render();
    setTimeout(() => {
      if (state.toast === text) {
        state.toast = null;
        render();
      }
    }, 2800);
  }

  async function setToken(token) {
    state.token = token;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    const ds = wa()?.DeviceStorage;
    if (!ds) return;
    try {
      if (token) await ds.setItem(TOKEN_KEY, token);
      else await ds.removeItem(TOKEN_KEY);
    } catch {
      /* DeviceStorage только в клиенте MAX */
    }
  }

  async function loadStoredToken() {
    if (state.token) return state.token;
    const ds = wa()?.DeviceStorage;
    if (!ds?.getItem) return null;
    try {
      const t = await ds.getItem(TOKEN_KEY);
      if (t) {
        state.token = t;
        localStorage.setItem(TOKEN_KEY, t);
      }
      return t || null;
    } catch {
      return null;
    }
  }

  async function applyBootstrap(data, token) {
    if (token) await setToken(token);
    state.user = data.user;
    state.houses = data.houses || [];
    state.chats = data.chats || [];
    state.messages = data.messages || [];
    state.topics = data.topics || [];
    state.tickets = data.tickets || [];
    state.works = data.works || [];
  }

  async function api(path, init = {}) {
    const headers = new Headers(init.headers || {});
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (state.token) headers.set('Authorization', `Bearer ${state.token}`);
    let res;
    try {
      res = await fetch(path, { ...init, headers });
    } catch {
      throw new Error('Сервер недоступен');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
    return data;
  }

  function digitsPhone(v) {
    let d = String(v || '').replace(/\D/g, '');
    if (d.startsWith('8')) d = `7${d.slice(1)}`;
    if (d && !d.startsWith('7')) d = `7${d}`;
    return d.slice(0, 11);
  }

  function formatPhone(v) {
    const d = digitsPhone(v);
    if (!d) return '';
    const r = d.slice(1);
    let out = '+7';
    if (!r.length) return out;
    out += ` ${r.slice(0, 3)}`;
    if (r.length > 3) out += ` ${r.slice(3, 6)}`;
    if (r.length > 6) out += `-${r.slice(6, 8)}`;
    if (r.length > 8) out += `-${r.slice(8, 10)}`;
    return out;
  }

  function houseTitle(h) {
    return h ? `${h.city}, ${h.address}` : '';
  }

  function currentHouse() {
    return state.houses.find((h) => h.id === state.user?.houseId) || null;
  }

  function workLabel(s) {
    if (s === 'done') return 'Сделано';
    if (s === 'in_progress') return 'В работе';
    return 'Нужно';
  }

  function worst(list) {
    if (list.includes('todo')) return 'todo';
    if (list.includes('in_progress')) return 'work';
    if (list.includes('done')) return 'done';
    return 'clear';
  }

  function go(route, extra = {}) {
    state.route = route;
    Object.assign(state, extra);
    syncBackButton();
    render();
    window.scrollTo(0, 0);
  }

  function syncBackButton() {
    const w = wa();
    if (!w?.BackButton) return;
    if (!backButtonBound) {
      w.BackButton.onClick(onBack);
      backButtonBound = true;
    }
    const nested = ['address', 'chat', 'passport', 'tickets', 'topic-new', 'select-house'].includes(
      state.route,
    );
    if (nested) w.BackButton.show();
    else w.BackButton.hide();
  }

  function onBack() {
    haptic('select');
    if (state.route === 'chat') return go('chats');
    if (state.route === 'topic-new') return go('home');
    if (state.route === 'tickets' || state.route === 'passport' || state.route === 'address') {
      return go('home');
    }
    if (state.route === 'select-house' && state.user?.houseId) return go('home');
    go('home');
  }

  /**
   * MAX Bridge: https://dev.max.ru/docs/webapps/bridge
   * initData валидируется на сервере: https://dev.max.ru/docs/webapps/validation
   */
  async function initMaxBridge() {
    const w = wa();
    if (!w) {
      state.max.inside = false;
      return false;
    }

    // Наличие initData / platform — признак запуска внутри клиента MAX
    state.max.inside = Boolean(w.initData || w.platform);
    state.max.platform = w.platform || null;
    state.max.version = w.version || null;
    state.max.deviceName = w.deviceName || null;
    state.max.startParam = w.initDataUnsafe?.start_param || null;
    state.max.profile = w.initDataUnsafe?.user || null;

    if (!state.max.inside) return false;

    document.body.classList.add('max-client');
    if (state.max.platform) {
      document.body.dataset.maxPlatform = state.max.platform;
    }

    try {
      w.enableClosingConfirmation?.();
    } catch {
      /* односторонний вызов */
    }

    try {
      const ctx = await w.getLaunchContext?.();
      state.max.entryPoint = ctx?.entryPoint || null;
      if (state.max.entryPoint === 'tabbar') {
        document.body.classList.add('max-tabbar');
      }
    } catch {
      /* старые клиенты */
    }

    try {
      const vp = await w.getViewportSize?.();
      if (vp?.height) {
        document.documentElement.style.setProperty('--max-vh', `${vp.height}px`);
      }
    } catch {
      /* optional */
    }

    await loadStoredToken();

    if (w.initData) {
      try {
        const data = await api('/api/auth/max', {
          method: 'POST',
          body: JSON.stringify({
            initData: w.initData,
            platform: w.platform,
            version: w.version,
          }),
        });
        await applyBootstrap(data, data.token);
        haptic('success');
        routeAfterAuth();
        return true;
      } catch (e) {
        console.warn('MAX auth failed, fallback UI', e);
        toast(e.message || 'Не удалось войти через MAX');
        haptic('error');
      }
    }
    return false;
  }

  function routeAfterAuth() {
    const u = state.user;
    if (!u) return go(state.max.inside ? 'max-gate' : 'login');

    const sp = state.max.startParam;
    if (sp && typeof sp === 'string') {
      if (sp === 'passport' && u.houseId) return go('passport');
      if (sp === 'chats' && u.houseId) return go('chats');
      if (sp.startsWith('house_') && !u.houseId) {
        const houseId = sp.slice(6);
        if (houseId) {
          api('/api/me/house', {
            method: 'POST',
            body: JSON.stringify({ houseId }),
          })
            .then(async (data) => {
              await applyBootstrap(data);
              routeAfterAuth();
            })
            .catch(() => go('select-house'));
          return go('boot');
        }
      }
    }

    if (!u.houseId) return go('select-house');
    if (u.role === 'resident' && !u.skippedAddress && !u.street && !u.flat) return go('address');
    go('home');
  }

  async function boot() {
    const authedViaMax = await initMaxBridge();
    if (authedViaMax || state.user) {
      render();
      return;
    }
    if (state.token) {
      try {
        const data = await api('/api/me');
        await applyBootstrap(data);
        routeAfterAuth();
        render();
        return;
      } catch {
        await setToken(null);
      }
    }
    go(state.max.inside ? 'max-gate' : 'login');
  }

  async function loginPhone(phone, password) {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    });
    await applyBootstrap(data, data.token);
    haptic('success');
    routeAfterAuth();
  }

  async function requestMaxPhone() {
    const w = wa();
    if (!w?.requestContact) {
      toast('requestContact недоступен вне MAX');
      return;
    }
    try {
      const result = await w.requestContact();
      if (result?.error) {
        const code = result.error.code || '';
        if (String(code).includes('user_refused')) {
          toast('Вы отказались поделиться телефоном');
        } else {
          toast(result.error.reason || code || 'Телефон не получен');
        }
        haptic('warning');
        return;
      }
      if (!result?.phone) {
        toast('Телефон не получен');
        return;
      }
      // phone без «+» при проверке hash на сервере (docs/webapps/bridge)
      const payload = {
        phone: String(result.phone).replace(/\D/g, ''),
        authDate: result.authDate,
        hash: result.hash,
      };
      const user = await api('/api/auth/max/phone', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      state.user = user.user;
      haptic('success');
      toast('Телефон сохранён');
      render();
    } catch (e) {
      haptic('error');
      toast(e.message || 'Ошибка запроса телефона');
    }
  }

  async function shareHouse() {
    const house = currentHouse();
    const text = house
      ? `Наш Дом — ${houseTitle(house)} (${house.uk})`
      : 'Наш Дом — мини-приложение для жителей и УК';
    const w = wa();
    try {
      if (w?.shareMaxContent) {
        await w.shareMaxContent({ text });
        haptic('success');
        return;
      }
      if (w?.shareContent) {
        await w.shareContent({ text });
        haptic('success');
        return;
      }
      toast('Шеринг доступен в клиенте MAX');
    } catch (e) {
      toast(e.message || 'Не удалось поделиться');
    }
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function navHtml(active) {
    const items = state.user?.role === 'uk'
      ? [
          ['home', '🏠', 'Панель'],
          ['passport', '🏢', 'Дом'],
          ['chats', '💬', 'Чаты'],
          ['profile', '👤', 'Профиль'],
        ]
      : [
          ['home', '🏠', 'Лента'],
          ['passport', '🏢', 'Дом'],
          ['chats', '💬', 'Чаты'],
          ['profile', '👤', 'Профиль'],
        ];
    return `<nav class="nav">${items
      .map(
        ([id, ico, label]) =>
          `<button type="button" data-nav="${id}" class="${active === id ? 'active' : ''}">
            <div class="ico">${ico}</div><span>${label}</span>
          </button>`,
      )
      .join('')}</nav>`;
  }

  function shell(title, sub, body, activeNav) {
    const hideHeader = activeNav === 'passport';
    return `
      <div class="shell">
        ${hideHeader ? '' : `<header class="header"><div class="grow"><h2>${esc(title)}</h2>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div></header>`}
        <div class="content">${body}</div>
        ${navHtml(activeNav)}
      </div>`;
  }

  function renderLogin() {
    return `
      <div class="auth-page"><div class="auth-card">
        <div class="logo"><div class="logo-mark">ND</div><div><strong>Наш Дом</strong><div class="muted" style="font-size:12px">мини-приложение MAX</div></div></div>
        <h1>Вход</h1>
        <p class="muted">Браузерный вход · в MAX авторизация через Bridge</p>
        <form id="login-form">
          <label class="field"><span>Телефон</span><input name="phone" type="tel" inputmode="tel" placeholder="+7 900 123-45-67" required /></label>
          <label class="field"><span>Пароль</span><input name="password" type="password" minlength="4" placeholder="Минимум 4 символа" required /></label>
          <div id="login-error" class="error hidden"></div>
          <button class="btn btn-primary" type="submit">Продолжить</button>
        </form>
        <div class="demo">Демо: +7 900 123-45-67 / 1234 (житель). Номер на 1 — УК.</div>
      </div></div>`;
  }

  function renderMaxGate() {
    const u = state.max.profile;
    const name = [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'пользователь MAX';
    const meta = [state.max.platform, state.max.version].filter(Boolean).join(' · ');
    return `
      <div class="auth-page"><div class="auth-card">
        <div class="logo"><div class="logo-mark">ND</div><div><strong>Наш Дом</strong></div></div>
        <span class="max-badge">MAX${meta ? ` · ${esc(meta)}` : ''}</span>
        <h1>Привет, ${esc(name)}</h1>
        <p class="muted">Не удалось войти по initData. Проверьте, что бот и мини-приложение привязаны к одному токену, и попробуйте снова.</p>
        <button class="btn btn-primary" id="retry-max" type="button">Войти через MAX</button>
        <button class="btn btn-ghost btn-block" id="to-login" type="button" style="margin-top:10px">Вход по телефону</button>
      </div></div>`;
  }

  function renderSelectHouse() {
    const list = state.houses
      .map(
        (h) => `
        <button type="button" class="house-item" data-house="${esc(h.id)}">
          <strong>${esc(houseTitle(h))}</strong>
          <div class="muted">${esc(h.uk)}</div>
        </button>`,
      )
      .join('');
    return shell(
      'Выбор дома',
      'Адрес и УК из базы',
      `<div class="pad">${list || '<p class="muted">Дома не загружены с сервера</p>'}<p class="muted" style="margin-top:12px">Данные из MySQL через API бота</p></div>`,
      'home',
    );
  }

  function renderAddress() {
    return shell(
      'Мой адрес',
      'Видно только вам',
      `<div class="pad">
        <form id="addr-form">
          <label class="field"><span>Улица</span><input name="street" /></label>
          <label class="field"><span>Подъезд</span><input name="entrance" /></label>
          <label class="field"><span>Квартира</span><input name="flat" /></label>
          <button class="btn btn-primary" type="submit">Сохранить</button>
          <button class="btn btn-ghost btn-block" type="button" id="skip-addr" style="margin-top:10px">Пропустить</button>
        </form>
      </div>`,
      'profile',
    );
  }

  function renderHome() {
    const u = state.user;
    const house = currentHouse();
    if (u.role === 'uk') {
      const tickets = state.tickets;
      const body = `
        <div class="pad">
          <button class="teaser" data-go="passport" type="button">
            <div><strong>${esc(houseTitle(house) || 'Паспорт дома')}</strong><span>Этажи и работы подъездов</span></div>
          </button>
          <div class="stats">
            <div class="stat"><b>${tickets.filter((t) => t.status === 'new').length}</b><span class="muted">Новые</span></div>
            <div class="stat"><b>${tickets.filter((t) => t.status === 'in_progress').length}</b><span class="muted">В работе</span></div>
            <div class="stat"><b>${tickets.filter((t) => t.status === 'done').length}</b><span class="muted">Готово</span></div>
          </div>
          ${tickets
            .map(
              (t) => `
            <article class="ticket">
              <div class="work-top"><strong>${esc(t.title)}</strong><span class="pill ${t.status === 'new' ? 'todo' : t.status === 'in_progress' ? 'work' : 'done'}">${esc(workLabel(t.status === 'new' ? 'todo' : t.status))}</span></div>
              <p class="muted">${esc(t.description)}</p>
              <div class="muted" style="font-size:12px">${esc(t.address)}</div>
              <div class="work-actions">
                ${t.status !== 'in_progress' ? `<button class="btn btn-ghost" data-ticket="${esc(t.id)}" data-st="in_progress">В работу</button>` : ''}
                ${t.status !== 'done' ? `<button class="btn btn-ghost" data-ticket="${esc(t.id)}" data-st="done">Готово</button>` : ''}
              </div>
            </article>`,
            )
            .join('') || '<div class="empty">Заявок пока нет</div>'}
        </div>`;
      return shell('Панель УК', houseTitle(house), body, 'home');
    }

    const topics = state.topics.filter((t) => t.houseId === u.houseId);
    const body = `
      <div class="pad">
        <button class="teaser" data-go="passport" type="button">
          <div><strong>${esc(houseTitle(house) || 'Паспорт дома')}</strong><span>Статус подъездов и этажей</span></div>
        </button>
        <div class="section-head"><h3>Лента дома</h3><button class="btn btn-ghost" data-go="topic-new" type="button">+ Тема</button></div>
        ${topics
          .map(
            (t) => `
          <article class="topic" data-open-chat="${esc(t.chatId)}">
            <strong>${esc(t.title)}</strong>
            <p class="muted">${esc(t.description)}</p>
            <div class="muted" style="font-size:12px">${esc(t.author)} · ${esc(t.time)}</div>
          </article>`,
          )
          .join('') || '<div class="empty">Пока нет тем — создайте первую</div>'}
      </div>`;
    return shell('Наш Дом', houseTitle(house), body, 'home');
  }

  function renderPassport() {
    const house = currentHouse();
    if (!house) return shell('Дом', '', '<div class="pad muted">Сначала выберите дом</div>', 'passport');
    const floors = house.floors || 5;
    const entrances = house.entrances || 2;
    const works = state.works.filter((w) => w.houseId === house.id);
    const entrance = state.entrance;
    const by = works.filter((w) => w.entrance === entrance);
    const counts = {
      todo: works.filter((w) => w.status === 'todo').length,
      work: works.filter((w) => w.status === 'in_progress').length,
      done: works.filter((w) => w.status === 'done').length,
    };

    const tabs = Array.from({ length: entrances }, (_, i) => i + 1)
      .map((n) => {
        const tone = worst(works.filter((w) => w.entrance === n).map((w) => w.status));
        return `<button type="button" class="entrance-tab ${tone} ${n === entrance ? 'active' : ''}" data-entrance="${n}"><b>${n}</b><span>подъезд</span></button>`;
      })
      .join('');

    const floorRows = Array.from({ length: floors }, (_, i) => floors - i)
      .map((floor) => {
        const fw = by.filter((w) => w.floor === floor);
        const st = worst(fw.map((w) => w.status));
        const cls = st === 'todo' ? 'todo' : st === 'work' ? 'work' : st === 'done' ? 'done' : '';
        return `<div class="floor-row ${cls}">
          <div class="floor-num">${floor}</div>
          <div>
            <div class="floor-title">${floor} этаж <span class="pill ${cls || ''}">${esc(st === 'clear' ? 'Без работ' : workLabel(st === 'work' ? 'in_progress' : st))}</span></div>
            <div class="muted" style="font-size:12px">${fw.length ? esc(fw.map((w) => w.title).join(' · ')) : 'Записей нет'}</div>
          </div>
        </div>`;
      })
      .join('');

    const workCards = by
      .map(
        (w) => `
      <article class="work-card ${w.status === 'todo' ? 'todo' : w.status === 'in_progress' ? 'work' : 'done'}">
        <div class="work-top"><strong>${esc(w.title)}</strong><span class="pill ${w.status === 'todo' ? 'todo' : w.status === 'in_progress' ? 'work' : 'done'}">${esc(workLabel(w.status))}</span></div>
        <p class="muted">${esc(w.detail)}</p>
        <div class="muted" style="font-size:12px">${w.floor ? `${w.floor} этаж` : 'Весь подъезд'}</div>
      </article>`,
      )
      .join('');

    const body = `
      <section class="passport-hero">
        <div class="passport-kicker">Паспорт дома</div>
        <h2 class="passport-title">${esc(houseTitle(house))}</h2>
        <p class="muted" style="color:rgba(255,255,255,.85);margin:0">${esc(house.uk)}</p>
        <div class="passport-metrics">
          <div class="passport-metric"><b>${floors}</b><span>Этажей</span></div>
          <div class="passport-metric"><b>${entrances}</b><span>Подъездов</span></div>
          <div class="passport-metric"><b>${counts.todo}</b><span>Нужно</span></div>
          <div class="passport-metric"><b>${counts.work}</b><span>В работе</span></div>
        </div>
      </section>
      <div class="passport-panel">
        <div class="card">
          <div class="section-head"><h3>Подъезды</h3><span class="muted">из БД</span></div>
          <div class="entrance-rail">${tabs}</div>
        </div>
        <div class="card">
          <div class="section-head"><h3>Этажи подъезда ${entrance}</h3></div>
          <div class="floor-list">${floorRows}</div>
        </div>
        <div class="card">
          <div class="section-head"><h3>Работы</h3><span class="muted">${by.length}</span></div>
          ${workCards || '<p class="muted">Нет записей</p>'}
        </div>
      </div>`;
    return shell('Паспорт', '', body, 'passport');
  }

  function renderChats() {
    if (state.route === 'chat') {
      const chat = state.chats.find((c) => c.id === state.chatId);
      const msgs = state.messages.filter((m) => m.chatId === state.chatId);
      const body = `
        <div class="messages">
          ${msgs
            .map(
              (m) =>
                `<div class="bubble ${m.senderId === state.user.id ? 'me' : ''}"><div style="font-size:12px;font-weight:700;color:var(--brand)">${esc(m.senderName)}</div>${esc(m.text)}<div class="muted" style="font-size:11px;margin-top:4px">${esc(m.time)}</div></div>`,
            )
            .join('') || '<div class="empty">Пока нет сообщений</div>'}
        </div>
        <form class="composer" id="msg-form">
          <input name="text" placeholder="Сообщение" autocomplete="off" />
          <button class="send" type="submit">→</button>
        </form>`;
      return shell(chat?.name || 'Чат', '', body, 'chats');
    }

    const list = state.chats
      .map(
        (c) => `
      <button type="button" class="chat-row" data-open-chat="${esc(c.id)}">
        <div class="avatar">${c.type === 'uk' ? 'UK' : c.type === 'topic' ? 'T' : 'O'}</div>
        <div class="grow"><strong>${esc(c.name)}</strong><div class="muted" style="font-size:13px">${esc(c.lastMessage || 'Нет сообщений')}</div></div>
      </button>`,
      )
      .join('');
    return shell('Чаты', houseTitle(currentHouse()), `<div>${list || '<div class="empty">Чатов нет</div>'}</div>`, 'chats');
  }

  function renderProfile() {
    const u = state.user;
    const maxMeta = state.max.inside
      ? `<div style="margin-top:10px"><span class="max-badge">MAX · ${esc(state.max.platform || '?')}${state.max.profile?.id ? ` · id ${esc(state.max.profile.id)}` : ''}</span></div>`
      : '';
    return shell(
      'Профиль',
      '',
      `<div class="profile-hero">
        <div class="avatar" style="width:64px;height:64px;margin:0 auto 12px;font-size:22px">${esc((u.name || 'Н')[0])}</div>
        <h2 style="margin:0">${esc(u.name)}</h2>
        <div style="opacity:.9;font-size:13px;margin-top:6px">${esc(u.phone || 'Телефон не указан')}</div>
        ${maxMeta}
      </div>
      <button class="menu-item" data-go="tickets" type="button">Мои обращения</button>
      <button class="menu-item" data-go="select-house" type="button">Сменить дом</button>
      ${state.max.inside && !u.phone ? '<button class="menu-item" id="ask-phone" type="button">Запросить телефон из MAX</button>' : ''}
      ${state.max.inside ? '<button class="menu-item" id="share-house" type="button">Поделиться домом в MAX</button>' : ''}
      <button class="menu-item" id="logout" type="button">Выйти</button>`,
      'profile',
    );
  }

  function renderTopicNew() {
    return `
      <div class="modal-back" id="topic-back">
        <div class="modal">
          <h3 style="margin-top:0">Новая тема</h3>
          <form id="topic-form">
            <label class="field"><span>Категория</span>
              <select name="category" style="height:44px;border:1.5px solid var(--border);border-radius:12px;padding:0 12px">
                <option value="accident">Авария</option>
                <option value="quality">Качество услуг</option>
                <option value="cleaning">Уборка</option>
                <option value="other">Другое</option>
              </select>
            </label>
            <label class="field"><span>Заголовок</span><input name="title" required /></label>
            <label class="field"><span>Описание</span><input name="description" required /></label>
            <button class="btn btn-primary" type="submit">Опубликовать</button>
            <button class="btn btn-ghost btn-block" type="button" data-go="home" style="margin-top:10px">Отмена</button>
          </form>
        </div>
      </div>`;
  }

  function renderTickets() {
    const list = state.tickets
      .filter((t) => t.authorId === state.user.id)
      .map(
        (t) => `
        <article class="ticket">
          <div class="work-top"><strong>${esc(t.title)}</strong><span class="pill">${esc(t.status)}</span></div>
          <p class="muted">${esc(t.description)}</p>
        </article>`,
      )
      .join('');
    return shell('Мои обращения', '', `<div class="pad">${list || '<div class="empty">Пусто</div>'}</div>`, 'profile');
  }

  function render() {
    let html = '';
    switch (state.route) {
      case 'boot':
        html = `<div class="boot"><div class="boot-logo">ND</div><p>Загрузка…</p></div>`;
        break;
      case 'login':
        html = renderLogin();
        break;
      case 'max-gate':
        html = renderMaxGate();
        break;
      case 'select-house':
        html = renderSelectHouse();
        break;
      case 'address':
        html = renderAddress();
        break;
      case 'home':
        html = renderHome();
        break;
      case 'passport':
        html = renderPassport();
        break;
      case 'chats':
      case 'chat':
        html = renderChats();
        break;
      case 'profile':
        html = renderProfile();
        break;
      case 'tickets':
        html = renderTickets();
        break;
      case 'topic-new':
        html = renderHome() + renderTopicNew();
        break;
      default:
        html = renderLogin();
    }
    if (state.toast) html += `<button class="toast" type="button" id="toast">${esc(state.toast)}</button>`;
    app.innerHTML = html;
    bind();
  }

  function bind() {
    $('#toast')?.addEventListener('click', () => {
      state.toast = null;
      render();
    });

    $$('[data-nav]').forEach((el) =>
      el.addEventListener('click', () => {
        haptic('select');
        go(el.dataset.nav === 'home' ? 'home' : el.dataset.nav);
      }),
    );
    $$('[data-go]').forEach((el) =>
      el.addEventListener('click', () => {
        haptic('light');
        go(el.dataset.go);
      }),
    );
    $$('[data-house]').forEach((el) =>
      el.addEventListener('click', async () => {
        try {
          const data = await api('/api/me/house', {
            method: 'POST',
            body: JSON.stringify({ houseId: el.dataset.house }),
          });
          await applyBootstrap(data);
          haptic('success');
          routeAfterAuth();
        } catch (e) {
          haptic('error');
          toast(e.message);
        }
      }),
    );
    $$('[data-entrance]').forEach((el) =>
      el.addEventListener('click', () => {
        haptic('select');
        state.entrance = Number(el.dataset.entrance);
        render();
      }),
    );
    $$('[data-open-chat]').forEach((el) =>
      el.addEventListener('click', () => go('chat', { chatId: el.dataset.openChat })),
    );
    $$('[data-ticket]').forEach((el) =>
      el.addEventListener('click', async () => {
        try {
          const { ticket } = await api(`/api/tickets/${el.dataset.ticket}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: el.dataset.st }),
          });
          state.tickets = state.tickets.map((t) => (t.id === ticket.id ? ticket : t));
          render();
        } catch (e) {
          toast(e.message);
        }
      }),
    );

    const loginForm = $('#login-form');
    if (loginForm) {
      const phoneInput = loginForm.phone;
      phoneInput.addEventListener('input', () => {
        phoneInput.value = formatPhone(phoneInput.value);
      });
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('#login-error');
        try {
          await loginPhone(loginForm.phone.value, loginForm.password.value);
          render();
        } catch (ex) {
          err.textContent = ex.message;
          err.classList.remove('hidden');
        }
      });
    }

    $('#retry-max')?.addEventListener('click', async () => {
      const ok = await initMaxBridge();
      if (!ok && !state.user) go('max-gate');
      else render();
    });
    $('#to-login')?.addEventListener('click', () => go('login'));
    $('#ask-phone')?.addEventListener('click', requestMaxPhone);
    $('#share-house')?.addEventListener('click', shareHouse);
    $('#logout')?.addEventListener('click', async () => {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
      await setToken(null);
      state.user = null;
      haptic('light');
      go(state.max.inside ? 'max-gate' : 'login');
    });

    $('#addr-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const { user } = await api('/api/me/address', {
          method: 'POST',
          body: JSON.stringify({
            street: f.street.value,
            entrance: f.entrance.value,
            flat: f.flat.value,
          }),
        });
        state.user = user;
        go('home');
      } catch (ex) {
        toast(ex.message);
      }
    });
    $('#skip-addr')?.addEventListener('click', async () => {
      const { user } = await api('/api/me/address', {
        method: 'POST',
        body: JSON.stringify({ skip: true }),
      });
      state.user = user;
      go('home');
    });

    $('#msg-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = e.target.text.value.trim();
      if (!text) return;
      try {
        const res = await api(`/api/chats/${state.chatId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ text }),
        });
        state.messages = [...state.messages.filter((m) => m.id !== res.message.id), res.message];
        if (res.chats?.length) state.chats = res.chats;
        e.target.reset();
        render();
      } catch (ex) {
        toast(ex.message);
      }
    });

    $('#topic-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const data = await api('/api/topics', {
          method: 'POST',
          body: JSON.stringify({
            category: f.category.value,
            title: f.title.value,
            description: f.description.value,
          }),
        });
        await applyBootstrap(data);
        haptic('success');
        go('chat', { chatId: data.chatId });
      } catch (ex) {
        haptic('error');
        toast(ex.message);
      }
    });
    $('#topic-back')?.addEventListener('click', (e) => {
      if (e.target.id === 'topic-back') go('home');
    });
  }

  function $$(sel) {
    return [...document.querySelectorAll(sel)];
  }

  boot().then(render).catch((e) => {
    app.innerHTML = `<div class="auth-page"><div class="auth-card"><h1>Ошибка</h1><p class="error">${esc(e.message)}</p><button class="btn btn-primary" onclick="location.reload()">Обновить</button></div></div>`;
  });
})();
