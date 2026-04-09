(function () {
  const params = new URLSearchParams(window.location.search);

  function pageOriginForApi() {
    try {
      if (window.location.protocol === 'file:') return '';
      const o = window.location.origin;
      return (!o || o === 'null') ? '' : o;
    } catch (_) { return ''; }
  }

  function normalizeApiBase(raw) {
    const po = pageOriginForApi();
    const fallback = po ? `${po}/api/v1` : '';
    const s = String(raw || '').trim();
    if (!s) return fallback;
    let u = s.replace(/\/$/, '');
    try {
      const url = new URL(u);
      let path = url.pathname.replace(/\/$/, '') || '';
      if (!path) { url.pathname = '/api/v1'; return url.toString().replace(/\/$/, ''); }
      if (path.toLowerCase() === '/api') { url.pathname = '/api/v1'; return url.toString().replace(/\/$/, ''); }
      return u;
    } catch (_) { return u; }
  }

  /** Сервер подставляет канонический API (тот же, что и БД консоли). ?api= в URL имеет приоритет (встраивание на чужой домен). */
  const injectedApi =
    typeof window !== 'undefined' && window.__SERVICE_BOOKING_PUBLIC_API_BASE__
      ? String(window.__SERVICE_BOOKING_PUBLIC_API_BASE__).trim()
      : '';
  const apiBase = normalizeApiBase(params.get('api') || injectedApi || '');
  const STORAGE_KEY = 'wgb_web_access_token';
  const urlApiKey = (params.get('key') || '').trim();

  function readStoredWebToken() {
    if (urlApiKey) return urlApiKey;
    let t = localStorage.getItem(STORAGE_KEY) || '';
    if (!t) { const l = sessionStorage.getItem(STORAGE_KEY); if (l) { t = l; localStorage.setItem(STORAGE_KEY, l); sessionStorage.removeItem(STORAGE_KEY); } }
    return t;
  }

  let accessToken = readStoredWebToken();
  const mainEl = document.getElementById('wgb-main');
  const errEl = document.getElementById('wgb-error');
  const tabbar = document.getElementById('wgb-tabbar');

  const state = {
    screen: 'login_pin',
    nav: 'services',
    tab: 'wash',
    services: [], posts: [], profile: null,
    bookings: [], bookingsFilter: 'upcoming',
    notifications: [],
    chatMessages: [],
    step: 'tabs',
    service: null,
    date: todayISO(),
    postId: '', slots: [], slotIso: '',
    firstName: '', phone: '',
    ratingBookingId: null, ratingVal: 0, ratingComment: '',
  };

  /* ── Token ── */
  function setAccessToken(t) { accessToken = (t || '').trim(); if (accessToken && !urlApiKey) { localStorage.setItem(STORAGE_KEY, accessToken); sessionStorage.removeItem(STORAGE_KEY); } }
  function clearAccessToken() { accessToken = ''; if (!urlApiKey) { localStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(STORAGE_KEY); } }
  function getAuthHeaders() { const h = { 'Content-Type': 'application/json' }; if (!accessToken) return h; if (accessToken.startsWith('eyJ')) h.Authorization = `Bearer ${accessToken}`; else h['X-API-Key'] = accessToken; return h; }
  function isWebSession() { return accessToken.startsWith('eyJ'); }

  /* ── Errors ── */
  function showError(msg) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
  function clearError() { errEl.classList.add('hidden'); errEl.textContent = ''; }

  /* ── Fetch ── */
  async function publicFetch(path, opts = {}) {
    const res = await fetch(`${apiBase}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
    if (!res.ok) { let t = `Ошибка ${res.status}`; try { const j = await res.json(); if (j && j.error) t = j.error; } catch (_) {} throw new Error(t); }
    if (res.status === 204) return null;
    return res.json();
  }

  async function apiFetch(path, opts = {}) {
    const res = await fetch(`${apiBase}${path}`, { ...opts, headers: { ...getAuthHeaders(), ...opts.headers } });
    if (res.status === 401) { clearAccessToken(); state.screen = 'login_pin'; state.step = 'tabs'; state.service = null; let t = 'Сессия недействительна — войдите снова'; try { const j = await res.json(); if (j && j.error) t = j.error; } catch (_) {} throw new Error(t); }
    if (!res.ok) { let t = `Ошибка ${res.status}`; try { const j = await res.json(); if (j && j.error) t = j.error; } catch (_) {} throw new Error(t); }
    if (res.status === 204) return null;
    return res.json();
  }

  /* ── Helpers ── */
  function svcId(s) { return s && (s._id || s.id); }
  function isWashService(s) { const id = String(svcId(s) || '').toLowerCase(); const cat = String(s.category || '').toLowerCase(); const name = String(s.name || '').toLowerCase(); return cat.includes('мойк') || name.includes('мойк') || id.includes('wash') || id.includes('moy'); }
  function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function splitServices() { const a = state.services.filter(s => s.is_active); return { wash: a.filter(isWashService), other: a.filter(s => !isWashService(s)) }; }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  /** Пример полного URL с api и key (для подсказки на экране входа). */
  function buildWidgetKeyExampleUrl() {
    const apiParam = apiBase || 'https://ваш-домен/api/v1';
    try {
      const u = new URL(window.location.href);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        let p = u.pathname || '/widget/';
        if (!p.endsWith('/')) p += '/';
        return `${u.origin}${p}?api=${encodeURIComponent(apiParam)}&key=ВАШ_КЛЮЧ_ИЗ_ПРИЛОЖЕНИЯ`;
      }
    } catch (_) {}
    return `https://ваш-домен/widget/?api=${encodeURIComponent(apiParam)}&key=ВАШ_КЛЮЧ_ИЗ_ПРИЛОЖЕНИЯ`;
  }

  function renderApiKeyHintHtml() {
    const apiSample = apiBase || 'https://ваш-домен/api/v1';
    const exampleUrl = buildWidgetKeyExampleUrl();
    return `<aside class="wgb-apikey-hint" aria-label="Как указать ключ API в адресе">
      <p class="wgb-apikey-hint__title">Нужен ключ API</p>
      <p class="wgb-apikey-hint__text">Добавьте параметр <code>key</code> в адрес страницы (ключ клиента из приложения).</p>
      <p class="wgb-apikey-hint__text">Укажите в адресе страницы параметры <code>api</code> (база API, например <code>${escapeHtml(apiSample)}</code>) и <code>key</code> — API-ключ клиента из приложения (тот же, что для записи с телефона).</p>
      <p class="wgb-apikey-hint__example"><span class="wgb-apikey-hint__example-lbl">Пример URL</span><code class="wgb-apikey-hint__code">${escapeHtml(exampleUrl)}</code></p>
    </aside>`;
  }

  function resolveImageUrl(url) {
    if (!url) return '';
    const s = String(url).trim();
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;
    const origin = apiBase.replace(/\/api\/v1$/i, '');
    return origin + (s.startsWith('/') ? s : '/' + s);
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    try { const d = new Date(iso); return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return iso; }
  }
  function fmtDate(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); } catch (_) { return iso; } }
  function fmtChatShort(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return iso; }
  }
  function isChatType(type) { return type === 'admin' || type === 'client'; }
  function notifFeedUnreadCount() { return state.notifications.filter(n => !isChatType(n.type) && !n.read).length; }
  function chatAdminUnreadCount() { return state.notifications.filter(n => n.type === 'admin' && !n.read).length; }

  function statusLabel(s) {
    const m = { pending: 'Ожидает', confirmed: 'Подтверждена', in_progress: 'Выполняется', completed: 'Завершена', cancelled: 'Отменена' };
    return m[s] || s || '—';
  }

  /* ── Tab bar ── */
  function showTabbar() { tabbar.classList.remove('hidden'); }
  function hideTabbar() { tabbar.classList.add('hidden'); }

  function setTabBadge(nav, count) {
    const nb = tabbar.querySelector(`[data-nav="${nav}"]`);
    if (!nb) return;
    let badge = nb.querySelector('.wgb-tabbar__badge');
    if (count > 0) {
      if (!badge) { badge = document.createElement('span'); badge.className = 'wgb-tabbar__badge'; nb.appendChild(badge); }
      badge.textContent = count > 99 ? '99+' : String(count);
    } else if (badge) { badge.remove(); }
  }

  function updateTabbar() {
    tabbar.querySelectorAll('.wgb-tabbar__btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.nav === state.nav);
    });
    setTabBadge('notifications', notifFeedUnreadCount());
    setTabBadge('chat', chatAdminUnreadCount());
  }

  tabbar.querySelectorAll('.wgb-tabbar__btn').forEach(btn => {
    btn.onclick = async () => {
      state.nav = btn.dataset.nav;
      state.step = 'tabs'; state.service = null;
      if (state.nav === 'chat') {
        await loadChatTab();
        return;
      }
      paint();
      if (state.nav === 'bookings') loadBookings();
      if (state.nav === 'notifications') loadNotifications();
      if (state.nav === 'profile') loadProfile();
    };
  });

  /* ── Welcome overlay ── */
  async function runWelcomeThenLoad(isNewUser) {
    const appRoot = document.getElementById('app');
    const overlay = document.createElement('div');
    overlay.className = 'wgb-welcome' + (isNewUser ? ' wgb-welcome--new' : '');
    overlay.innerHTML = `<div class="wgb-welcome__glow" aria-hidden="true"></div><div class="wgb-welcome__card"><h2 class="wgb-welcome__title">${escapeHtml(isNewUser ? 'Добро пожаловать!' : 'С возвращением!')}</h2><p class="wgb-welcome__name" id="wgb-welcome-name"></p></div>`;
    appRoot.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
    const t0 = Date.now();
    let sub = '';
    try { const p = await apiFetch('/profile'); sub = [p.first_name, p.last_name].filter(Boolean).join(' ').trim(); } catch (_) {}
    const nameEl = overlay.querySelector('#wgb-welcome-name');
    if (nameEl && sub) nameEl.textContent = sub;
    const el = Date.now() - t0;
    if (el < 1700) await new Promise(r => setTimeout(r, 1700 - el));
    overlay.classList.remove('is-visible'); overlay.classList.add('is-leaving');
    await new Promise(r => setTimeout(r, 420));
    overlay.remove();
    await loadCatalogAndProfile();
  }

  /* ── Render: Auth screens ── */
  function renderLoginPin() {
    return `<h1>Вход</h1>
      <div class="wgb-field"><label for="wgb-login-phone">Телефон</label><input type="tel" id="wgb-login-phone" class="wgb-input" placeholder="+7 900 123-45-67" autocomplete="tel"></div>
      <div class="wgb-field"><label for="wgb-login-pin">PIN (4 цифры)</label><input type="password" id="wgb-login-pin" class="wgb-input" inputmode="numeric" maxlength="4" pattern="[0-9]*" autocomplete="current-password" placeholder="••••"></div>
      <p class="wgb-forgot"><button type="button" class="wgb-link-btn" id="wgb-forgot-pin">Забыли PIN?</button></p>
      <button type="button" class="wgb-btn" id="wgb-login-submit">Войти</button>
      <button type="button" class="wgb-btn wgb-btn--ghost" id="wgb-go-register">Регистрация</button>
      ${renderApiKeyHintHtml()}`;
  }
  function renderRegisterPin() {
    return `<h1>Регистрация</h1>
      <div class="wgb-field"><label for="wgb-reg-phone">Телефон</label><input type="tel" id="wgb-reg-phone" class="wgb-input" placeholder="+7 900 123-45-67" autocomplete="tel"></div>
      <div class="wgb-field"><label for="wgb-reg-name">Имя (по желанию)</label><input type="text" id="wgb-reg-name" class="wgb-input" placeholder="Как к вам обращаться" autocomplete="given-name"></div>
      <div class="wgb-field"><label for="wgb-reg-pin">PIN (4 цифры)</label><input type="password" id="wgb-reg-pin" class="wgb-input" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••"></div>
      <div class="wgb-field"><label for="wgb-reg-pin2">Повторите PIN</label><input type="password" id="wgb-reg-pin2" class="wgb-input" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••"></div>
      <button type="button" class="wgb-btn" id="wgb-reg-submit">Продолжить</button>
      <button type="button" class="wgb-btn wgb-btn--ghost" id="wgb-go-login">Войти</button>
      ${renderApiKeyHintHtml()}`;
  }
  function renderForgotPin() {
    return `<h1>Забыли PIN?</h1><p class="wgb-sub">Сброс делается в студии по вашему номеру телефона — так аккаунт остаётся защищённым. После сброса откройте «Регистрация» и задайте новый PIN.</p><button type="button" class="wgb-btn wgb-btn--ghost" id="wgb-forgot-back">Назад к входу</button>`;
  }
  function renderChangePin() {
    return `<h1>Сменить PIN</h1>
      <div class="wgb-field"><label for="wgb-old-pin">Текущий PIN</label><input type="password" id="wgb-old-pin" class="wgb-input" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="••••"></div>
      <div class="wgb-field"><label for="wgb-new-pin">Новый PIN</label><input type="password" id="wgb-new-pin" class="wgb-input" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••"></div>
      <div class="wgb-field"><label for="wgb-new-pin2">Повторите новый PIN</label><input type="password" id="wgb-new-pin2" class="wgb-input" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••"></div>
      <button type="button" class="wgb-btn" id="wgb-change-pin-submit">Сохранить</button>
      <button type="button" class="wgb-btn wgb-btn--ghost" id="wgb-change-pin-cancel">Отмена</button>`;
  }

  /* ── Render: Services (tab 1) ── */
  function renderServicesTabs() {
    return `<div class="wgb-tabs" role="tablist"><button type="button" class="wgb-tab ${state.tab==='wash'?'is-active':''}" data-tab="wash">Мойка</button><button type="button" class="wgb-tab ${state.tab==='other'?'is-active':''}" data-tab="other">Другие услуги</button></div>`;
  }
  function renderServiceList() {
    const { wash, other } = splitServices();
    const list = state.tab === 'wash' ? wash : other;
    if (!list.length) return `<div class="wgb-empty"><div class="wgb-empty__icon">📋</div><p class="wgb-empty__text">В этой категории пока нет активных услуг.</p></div>`;
    return `<div class="wgb-services">${list.map(s => {
      const img = s.image_url ? `<div class="wgb-svc-img"><img src="${escapeHtml(resolveImageUrl(s.image_url))}" alt="" loading="lazy"></div>` : '';
      return `<button type="button" class="wgb-svc${s.image_url ? ' wgb-svc--has-img' : ''}" data-svc="${encodeURIComponent(svcId(s))}">${img}<div class="wgb-svc-body"><div class="wgb-svc-title">${escapeHtml(s.name)}</div><div class="wgb-svc-meta">${escapeHtml(String(s.duration||''))} мин · ${escapeHtml(String(s.price??''))} ₽</div></div></button>`;
    }).join('')}</div>`;
  }
  function renderBookingForm() {
    const s = state.service;
    const posts = state.posts.filter(p => p.is_enabled);
    if (!posts.length) return `<button type="button" class="wgb-back" data-action="back-list">← К услугам</button><h1>${escapeHtml(s.name)}</h1><p class="wgb-sub">Сейчас нет доступных постов. Позвоните в студию.</p>`;
    const postCards = posts.map((p, i) => {
      const pid = p._id || p.id;
      const picked = state.postId === pid;
      return `<button type="button" class="wgb-post-chip${picked ? ' is-active' : ''} wgb-post-chip--anim" style="animation-delay:${i * 0.12}s" data-post="${escapeHtml(pid)}">
        <span class="wgb-post-chip__icon">${i === 0 ? '①' : i === 1 ? '②' : '▣'}</span>
        <span class="wgb-post-chip__name">${escapeHtml(p.name)}</span>
      </button>`;
    }).join('');
    return `<button type="button" class="wgb-back" data-action="back-list">← К услугам</button>
      <h1>${escapeHtml(s.name)}</h1><p class="wgb-sub">${escapeHtml(String(s.duration||''))} мин · ${escapeHtml(String(s.price??''))} ₽</p>
      <div class="wgb-field"><label for="wgb-date">Дата</label><input type="date" id="wgb-date" value="${escapeHtml(state.date)}"></div>
      <div class="wgb-field"><label>Выберите пост</label><div class="wgb-post-chips" id="wgb-post-chips">${postCards}</div></div>
      <div class="wgb-field"><label>Свободное время</label><div class="wgb-slots" id="wgb-slots">${renderSlots()}</div></div>
      <div class="wgb-field"><label for="wgb-name">Имя</label><input type="text" id="wgb-name" placeholder="Как к вам обращаться" value="${escapeHtml(state.firstName)}"></div>
      <div class="wgb-field"><label for="wgb-phone">Телефон</label><input type="tel" id="wgb-phone" placeholder="+7 …" value="${escapeHtml(state.phone)}"></div>
      <button type="button" class="wgb-btn" id="wgb-submit" ${!state.slotIso?'disabled':''}>Записаться</button>`;
  }
  function renderSlots() {
    if (!state.slots.length) return '<span class="wgb-sub" style="margin:0">Выберите дату и пост — слоты подгрузятся.</span>';
    return state.slots.map(sl => { const dis = !sl.is_available; const p = state.slotIso === sl.time; return `<button type="button" class="wgb-slot${p?' is-picked':''}" data-slot="${escapeHtml(sl.time)}" ${dis?'disabled':''}>${escapeHtml(sl.display_time)}</button>`; }).join('');
  }
  function renderSuccess() {
    return `<div class="wgb-success"><h2>Заявка отправлена</h2><p class="wgb-sub">Мы свяжемся с вами для подтверждения. Спасибо!</p><button type="button" class="wgb-btn" data-action="reset" style="margin-top:1.5rem">Новая запись</button></div>`;
  }

  /* ── Render: My Bookings (tab 2) ── */
  function renderBookings() {
    const f = state.bookingsFilter;
    const now = new Date();
    let list = state.bookings;
    if (f === 'upcoming') list = list.filter(b => b.status !== 'cancelled' && new Date(b.date_time) >= now);
    else if (f === 'past') list = list.filter(b => b.status !== 'cancelled' && new Date(b.date_time) < now);
    else if (f === 'cancelled') list = list.filter(b => b.status === 'cancelled');

    const filterHtml = `<div class="wgb-tabs" role="tablist">
      <button type="button" class="wgb-tab ${f==='upcoming'?'is-active':''}" data-bfilter="upcoming">Предстоящие</button>
      <button type="button" class="wgb-tab ${f==='past'?'is-active':''}" data-bfilter="past">Прошедшие</button>
      <button type="button" class="wgb-tab ${f==='cancelled'?'is-active':''}" data-bfilter="cancelled">Отменённые</button>
    </div>`;

    if (!list.length) return `<h1>Мои записи</h1>${filterHtml}<div class="wgb-empty"><div class="wgb-empty__icon">📅</div><p class="wgb-empty__text">Здесь пока пусто.</p></div>`;

    const cards = list.map(b => {
      const bId = b._id || b.id;
      const isPast = new Date(b.date_time) < now;
      const canCancel = !isPast && b.status !== 'cancelled' && b.status !== 'completed';
      const canRate = isPast && b.status === 'completed' && !b.rating;
      let actions = '';
      if (canCancel) actions += `<button type="button" class="wgb-btn wgb-btn--sm wgb-btn--danger" data-cancel="${escapeHtml(bId)}">Отменить</button>`;
      if (canRate) actions += `<button type="button" class="wgb-btn wgb-btn--sm" data-rate="${escapeHtml(bId)}">Оценить</button>`;
      if (b.rating) actions += `<span class="wgb-sub" style="margin:0;font-size:.78rem">Оценка: ${'★'.repeat(b.rating)}${'☆'.repeat(5-b.rating)}</span>`;
      return `<div class="wgb-bcard">
        <p class="wgb-bcard__title">${escapeHtml(b.service_name || 'Услуга')}</p>
        <p class="wgb-bcard__meta">${fmtDateTime(b.date_time)}</p>
        ${b.price != null ? `<p class="wgb-bcard__meta">${escapeHtml(String(b.price))} ₽</p>` : ''}
        <span class="wgb-bcard__status wgb-bcard__status--${b.status || 'pending'}">${statusLabel(b.status)}</span>
        ${actions ? `<div class="wgb-bcard__actions">${actions}</div>` : ''}
      </div>`;
    }).join('');

    return `<h1>Мои записи</h1>${filterHtml}${cards}`;
  }

  /* ── Render: Notifications (tab 3) ── */
  function renderNotifications() {
    const feed = state.notifications.filter(n => !isChatType(n.type));
    if (!feed.length) return `<h1>Уведомления</h1><div class="wgb-empty"><div class="wgb-empty__icon">🔔</div><p class="wgb-empty__text">Уведомлений пока нет.</p></div>`;
    const items = feed.map(n => {
      const nId = n._id || n.id;
      return `<div class="wgb-notif${n.read ? '' : ' wgb-notif--unread'}" data-nid="${escapeHtml(nId)}">
        ${n.title ? `<p class="wgb-notif__title">${escapeHtml(n.title)}</p>` : ''}
        <p class="wgb-notif__body">${escapeHtml(n.body || '')}</p>
        <p class="wgb-notif__time">${fmtDate(n.created_at)}</p>
      </div>`;
    }).join('');
    return `<h1>Уведомления</h1>${items}`;
  }

  function renderChat() {
    const msgs = state.chatMessages;
    const bubbles = msgs.length
      ? msgs.map(m => {
        const mine = m.type === 'client';
        return `<div class="wgb-chat-row wgb-chat-row--${mine ? 'mine' : 'them'}">
          <div class="wgb-chat-bubble">${escapeHtml(m.body || '')}</div>
          <div class="wgb-chat-time">${escapeHtml(fmtChatShort(m.created_at))}</div>
        </div>`;
      }).join('')
      : '';
    const empty = !msgs.length ? '<div class="wgb-chat-empty"><p>Напишите нам — ответ появится здесь.</p></div>' : '';
    return `<h1>Чат со студией</h1>
      <p class="wgb-sub">Напишите администратору. Ответ придёт сюда; записи и новости по-прежнему во вкладке «Уведомления».</p>
      <div class="wgb-chat-log" id="wgb-chat-log">${bubbles}${empty}</div>
      <div class="wgb-chat-compose">
        <textarea id="wgb-chat-input" class="wgb-input" rows="2" placeholder="Ваше сообщение…"></textarea>
        <button type="button" class="wgb-btn" id="wgb-chat-send">Отправить</button>
      </div>`;
  }

  /* ── Render: Profile (tab 4) ── */
  function renderProfile() {
    const p = state.profile || {};
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Клиент';
    const pts = Number(p.loyalty_points) || 0;
    const social = p.social_links || {};
    const avatarInner = p.avatar_url ? `<img src="${escapeHtml(p.avatar_url)}" alt="">` : name.charAt(0).toUpperCase();

    let socialRows = '';
    if (social.telegram) socialRows += `<div class="wgb-profile-row"><span class="wgb-profile-row__label">Telegram</span><span class="wgb-profile-row__val">${escapeHtml(social.telegram)}</span></div>`;
    if (social.vk) socialRows += `<div class="wgb-profile-row"><span class="wgb-profile-row__label">VK</span><span class="wgb-profile-row__val">${escapeHtml(social.vk)}</span></div>`;

    return `<h1>Профиль</h1>
      <div class="wgb-profile-card">
        <div class="wgb-profile-avatar">${avatarInner}</div>
        <p class="wgb-profile-name">${escapeHtml(name)}</p>
        <p class="wgb-profile-phone">${escapeHtml(p.phone || '—')}</p>
        <div class="wgb-profile-points">★ ${pts} баллов</div>
      </div>

      <div class="wgb-profile-section">
        <h3>Контакты</h3>
        <div class="wgb-profile-row"><span class="wgb-profile-row__label">Телефон</span><span class="wgb-profile-row__val">${escapeHtml(p.phone || '—')}</span></div>
        ${p.email ? `<div class="wgb-profile-row"><span class="wgb-profile-row__label">Email</span><span class="wgb-profile-row__val">${escapeHtml(p.email)}</span></div>` : ''}
        ${socialRows}
      </div>

      <button type="button" class="wgb-btn wgb-btn--ghost" id="wgb-edit-profile">Редактировать профиль</button>
      ${isWebSession() ? '<button type="button" class="wgb-btn wgb-btn--ghost" id="wgb-go-change-pin">Сменить PIN</button>' : ''}
      <button type="button" class="wgb-btn wgb-btn--danger" id="wgb-logout" style="margin-top:1rem">Выйти</button>`;
  }

  /* ── Render: Edit Profile ── */
  function renderEditProfile() {
    const p = state.profile || {};
    const social = p.social_links || {};
    return `<button type="button" class="wgb-back" id="wgb-edit-back">← Назад</button>
      <h1>Редактировать профиль</h1>
      <div class="wgb-field"><label for="wgb-ep-fn">Имя</label><input type="text" id="wgb-ep-fn" class="wgb-input" value="${escapeHtml(p.first_name||'')}"></div>
      <div class="wgb-field"><label for="wgb-ep-ln">Фамилия</label><input type="text" id="wgb-ep-ln" class="wgb-input" value="${escapeHtml(p.last_name||'')}"></div>
      <div class="wgb-field"><label for="wgb-ep-phone">Телефон</label><input type="tel" id="wgb-ep-phone" class="wgb-input" value="${escapeHtml(p.phone||'')}"></div>
      <div class="wgb-field"><label for="wgb-ep-email">Email</label><input type="email" id="wgb-ep-email" class="wgb-input" value="${escapeHtml(p.email||'')}"></div>
      <div class="wgb-field"><label for="wgb-ep-tg">Telegram</label><input type="text" id="wgb-ep-tg" class="wgb-input" placeholder="@username" value="${escapeHtml(social.telegram||'')}"></div>
      <div class="wgb-field"><label for="wgb-ep-vk">VK</label><input type="text" id="wgb-ep-vk" class="wgb-input" placeholder="id или ссылка" value="${escapeHtml(social.vk||'')}"></div>
      <button type="button" class="wgb-btn" id="wgb-ep-save">Сохранить</button>`;
  }

  /* ── Rating modal ── */
  function renderRatingModal() {
    const stars = [1,2,3,4,5].map(v => `<button type="button" class="wgb-star${v<=state.ratingVal?' is-on':''}" data-star="${v}">★</button>`).join('');
    return `<div class="wgb-modal" id="wgb-rating-modal"><div class="wgb-modal__body">
      <h2 style="margin:0 0 .75rem;font-size:1.1rem">Оценить запись</h2>
      <div class="wgb-stars" id="wgb-stars">${stars}</div>
      <div class="wgb-field" style="margin-top:.75rem"><label for="wgb-rate-comment">Комментарий (необязательно)</label><textarea id="wgb-rate-comment" class="wgb-input" rows="2" placeholder="Ваш отзыв…">${escapeHtml(state.ratingComment)}</textarea></div>
      <button type="button" class="wgb-btn" id="wgb-rate-submit" ${!state.ratingVal?'disabled':''}>Отправить оценку</button>
      <button type="button" class="wgb-btn wgb-btn--ghost" id="wgb-rate-cancel">Отмена</button>
    </div></div>`;
  }

  /* ── PAINT ── */
  function paint() {
    clearError();

    if (state.screen === 'forgot_pin') { hideTabbar(); mainEl.innerHTML = renderForgotPin(); document.getElementById('wgb-forgot-back').onclick = () => { state.screen = 'login_pin'; paint(); }; return; }

    if (state.screen === 'login_pin') {
      hideTabbar();
      mainEl.innerHTML = renderLoginPin();
      document.getElementById('wgb-forgot-pin').onclick = () => { state.screen = 'forgot_pin'; paint(); };
      document.getElementById('wgb-go-register').onclick = () => { state.screen = 'register_pin'; paint(); };
      document.getElementById('wgb-login-submit').onclick = async () => {
        const phone = document.getElementById('wgb-login-phone').value.trim();
        const pin = document.getElementById('wgb-login-pin').value.replace(/\D/g, '');
        if (!phone) { showError('Введите номер телефона'); return; }
        if (pin.length !== 4) { showError('Введите PIN из 4 цифр'); return; }
        try { clearError(); const data = await publicFetch('/web/auth/login-pin', { method: 'POST', body: JSON.stringify({ phone, pin }) }); setAccessToken(data.access_token); await runWelcomeThenLoad(data.first_visit === true); } catch (e) { showError(e.message || String(e)); }
      };
      return;
    }

    if (state.screen === 'register_pin') {
      hideTabbar();
      mainEl.innerHTML = renderRegisterPin();
      document.getElementById('wgb-go-login').onclick = () => { state.screen = 'login_pin'; paint(); };
      document.getElementById('wgb-reg-submit').onclick = async () => {
        const phone = document.getElementById('wgb-reg-phone').value.trim();
        const pin = document.getElementById('wgb-reg-pin').value.replace(/\D/g, '');
        const pin2 = document.getElementById('wgb-reg-pin2').value.replace(/\D/g, '');
        const first_name = document.getElementById('wgb-reg-name').value.trim();
        if (!phone) { showError('Введите номер телефона'); return; }
        if (pin.length !== 4 || pin2.length !== 4) { showError('PIN — ровно 4 цифры в обоих полях'); return; }
        if (pin !== pin2) { showError('PIN и повтор не совпадают'); return; }
        try { clearError(); const data = await publicFetch('/web/auth/register-pin', { method: 'POST', body: JSON.stringify({ phone, pin, pin_confirm: pin2, first_name: first_name || undefined }) }); setAccessToken(data.access_token); await runWelcomeThenLoad(data.first_visit === true); } catch (e) { showError(e.message || String(e)); }
      };
      return;
    }

    if (state.screen === 'change_pin') {
      hideTabbar();
      mainEl.innerHTML = `<div class="wgb-toolbar wgb-toolbar--split"><button type="button" class="wgb-link-btn" id="wgb-pin-back">← Назад</button></div>${renderChangePin()}`;
      document.getElementById('wgb-pin-back').onclick = () => { state.screen = 'app'; state.nav = 'profile'; paint(); };
      document.getElementById('wgb-change-pin-cancel').onclick = () => { state.screen = 'app'; state.nav = 'profile'; paint(); };
      document.getElementById('wgb-change-pin-submit').onclick = async () => {
        const old_pin = document.getElementById('wgb-old-pin').value.replace(/\D/g, '');
        const pin = document.getElementById('wgb-new-pin').value.replace(/\D/g, '');
        const pin2 = document.getElementById('wgb-new-pin2').value.replace(/\D/g, '');
        if (old_pin.length!==4||pin.length!==4||pin2.length!==4) { showError('Все поля PIN — по 4 цифры'); return; }
        if (pin!==pin2) { showError('Новый PIN и повтор не совпадают'); return; }
        try { clearError(); await apiFetch('/profile/web-pin', { method: 'PUT', body: JSON.stringify({ old_pin, pin, pin_confirm: pin2 }) }); state.screen = 'app'; state.nav = 'profile'; paint(); } catch (e) { showError(e.message || String(e)); }
      };
      return;
    }

    if (state.screen === 'edit_profile') {
      hideTabbar();
      mainEl.innerHTML = renderEditProfile();
      document.getElementById('wgb-edit-back').onclick = () => { state.screen = 'app'; state.nav = 'profile'; paint(); };
      document.getElementById('wgb-ep-save').onclick = async () => {
        try {
          clearError();
          const body = {
            first_name: document.getElementById('wgb-ep-fn').value.trim(),
            last_name: document.getElementById('wgb-ep-ln').value.trim(),
            phone: document.getElementById('wgb-ep-phone').value.trim(),
            email: document.getElementById('wgb-ep-email').value.trim(),
            social_links: {
              telegram: document.getElementById('wgb-ep-tg').value.trim() || null,
              vk: document.getElementById('wgb-ep-vk').value.trim() || null,
            },
          };
          state.profile = await apiFetch('/profile', { method: 'PUT', body: JSON.stringify(body) });
          state.firstName = state.profile.first_name || '';
          state.phone = state.profile.phone || '';
          state.screen = 'app'; state.nav = 'profile'; paint();
        } catch (e) { showError(e.message || String(e)); }
      };
      return;
    }

    /* ── App screens ── */
    showTabbar();
    updateTabbar();

    if (state.nav === 'services') {
      if (state.step === 'success') { mainEl.innerHTML = renderSuccess(); mainEl.querySelector('[data-action="reset"]').onclick = () => { state.step = 'tabs'; state.service = null; state.slotIso = ''; state.slots = []; paint(); }; return; }
      if (state.step === 'book' && state.service) { mainEl.innerHTML = renderBookingForm(); bindBookingForm(); return; }
      mainEl.innerHTML = `<h1>Услуги</h1>${renderServicesTabs()}${renderServiceList()}`;
      bindServicesList();
      return;
    }

    if (state.nav === 'bookings') {
      mainEl.innerHTML = renderBookings();
      bindBookings();
      return;
    }

    if (state.nav === 'notifications') {
      mainEl.innerHTML = renderNotifications();
      bindNotifications();
      return;
    }

    if (state.nav === 'chat') {
      mainEl.innerHTML = renderChat();
      bindChat();
      requestAnimationFrame(() => {
        const log = document.getElementById('wgb-chat-log');
        if (log) log.scrollTop = log.scrollHeight;
      });
      return;
    }

    if (state.nav === 'profile') {
      mainEl.innerHTML = renderProfile();
      bindProfile();
      return;
    }
  }

  /* ── Bind: Services list ── */
  function bindServicesList() {
    mainEl.querySelectorAll('.wgb-tab').forEach(btn => { btn.onclick = () => { state.tab = btn.dataset.tab; paint(); }; });
    mainEl.querySelectorAll('.wgb-svc').forEach(btn => {
      btn.onclick = () => {
        const id = decodeURIComponent(btn.getAttribute('data-svc'));
        state.service = state.services.find(x => svcId(x) === id);
        state.step = 'book'; state.slotIso = ''; state.slots = [];
        const en = state.posts.find(p => p.is_enabled);
        state.postId = en ? (en._id || en.id) : '';
        paint(); loadSlots();
      };
    });
  }

  /* ── Bind: Booking form ── */
  function bindBookingForm() {
    const back = mainEl.querySelector('[data-action="back-list"]');
    if (back) back.onclick = () => { state.step = 'tabs'; state.service = null; paint(); };
    const dateEl = document.getElementById('wgb-date');
    if (!dateEl) return;
    dateEl.onchange = () => { state.date = dateEl.value; state.slotIso = ''; loadSlots(); };
    document.querySelectorAll('.wgb-post-chip').forEach(chip => {
      chip.onclick = () => {
        state.postId = chip.dataset.post;
        state.slotIso = '';
        document.querySelectorAll('.wgb-post-chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        loadSlots();
      };
    });
    bindSlotClicks();
    document.getElementById('wgb-submit').onclick = async () => {
      state.firstName = document.getElementById('wgb-name').value.trim();
      state.phone = document.getElementById('wgb-phone').value.trim();
      if (!state.slotIso) { showError('Выберите время'); return; }
      if (!state.firstName || !state.phone) { showError('Укажите имя и телефон'); return; }
      try { clearError(); await apiFetch('/bookings', { method: 'POST', body: JSON.stringify({ service_id: svcId(state.service), date_time: state.slotIso, post_id: state.postId, first_name: state.firstName, phone: state.phone, source: 'web' }) }); state.step = 'success'; paint(); } catch (e) { showError(e.message); }
    };
    loadSlots();
  }

  async function loadSlots() {
    if (!state.service || !state.date || !state.postId) return;
    try { const q = new URLSearchParams({ service_id: svcId(state.service), date: state.date, post_id: state.postId }); state.slots = await apiFetch(`/slots?${q}`); const box = document.getElementById('wgb-slots'); if (box) box.innerHTML = renderSlots(); bindSlotClicks(); } catch (e) { showError(e.message); }
  }

  function bindSlotClicks() {
    document.querySelectorAll('.wgb-slot:not([disabled])').forEach(b => {
      b.onclick = () => { state.slotIso = b.getAttribute('data-slot'); document.querySelectorAll('.wgb-slot').forEach(x => x.classList.remove('is-picked')); b.classList.add('is-picked'); const sub = document.getElementById('wgb-submit'); if (sub) sub.disabled = !state.slotIso; };
    });
  }

  /* ── Bind: Bookings ── */
  function bindBookings() {
    mainEl.querySelectorAll('.wgb-tab').forEach(btn => { btn.onclick = () => { state.bookingsFilter = btn.dataset.bfilter; paint(); }; });
    mainEl.querySelectorAll('[data-cancel]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Отменить запись?')) return;
        try { await apiFetch(`/bookings/${btn.dataset.cancel}`, { method: 'DELETE' }); await loadBookings(); } catch (e) { showError(e.message); }
      };
    });
    mainEl.querySelectorAll('[data-rate]').forEach(btn => {
      btn.onclick = () => { state.ratingBookingId = btn.dataset.rate; state.ratingVal = 0; state.ratingComment = ''; openRatingModal(); };
    });
  }

  function openRatingModal() {
    const existing = document.getElementById('wgb-rating-modal');
    if (existing) existing.remove();
    document.getElementById('app').insertAdjacentHTML('beforeend', renderRatingModal());
    document.querySelectorAll('#wgb-stars .wgb-star').forEach(s => {
      s.onclick = () => { state.ratingVal = parseInt(s.dataset.star, 10); document.querySelectorAll('#wgb-stars .wgb-star').forEach((ss, i) => ss.classList.toggle('is-on', i < state.ratingVal)); document.getElementById('wgb-rate-submit').disabled = !state.ratingVal; };
    });
    document.getElementById('wgb-rate-cancel').onclick = closeRatingModal;
    document.getElementById('wgb-rate-submit').onclick = async () => {
      state.ratingComment = document.getElementById('wgb-rate-comment').value.trim();
      try { await apiFetch(`/bookings/${state.ratingBookingId}/rating`, { method: 'POST', body: JSON.stringify({ rating: state.ratingVal, comment: state.ratingComment || undefined }) }); closeRatingModal(); await loadBookings(); } catch (e) { showError(e.message); closeRatingModal(); }
    };
  }

  function closeRatingModal() { const m = document.getElementById('wgb-rating-modal'); if (m) m.remove(); }

  /* ── Bind: Notifications ── */
  function bindNotifications() {
    mainEl.querySelectorAll('.wgb-notif--unread').forEach(el => {
      el.onclick = async () => {
        const nId = el.dataset.nid;
        try { await apiFetch(`/notifications/${nId}/read`, { method: 'PATCH' }); el.classList.remove('wgb-notif--unread'); const n = state.notifications.find(x => (x._id||x.id) === nId); if (n) n.read = true; updateTabbar(); } catch (_) {}
      };
    });
  }

  /* ── Bind: Profile ── */
  function bindProfile() {
    document.getElementById('wgb-edit-profile').onclick = () => { state.screen = 'edit_profile'; paint(); };
    const cpBtn = document.getElementById('wgb-go-change-pin');
    if (cpBtn) cpBtn.onclick = () => { state.screen = 'change_pin'; paint(); };
    document.getElementById('wgb-logout').onclick = () => { clearAccessToken(); state.screen = 'login_pin'; state.step = 'tabs'; state.service = null; state.profile = null; paint(); };
  }

  /* ── Data loaders ── */
  async function loadCatalogAndProfile() {
    mainEl.innerHTML = '<p class="wgb-sub">Загрузка…</p>';
    try {
      const [services, posts, profile, notifs] = await Promise.all([
        apiFetch('/services'),
        apiFetch('/posts'),
        apiFetch('/profile').catch(() => null),
        apiFetch('/notifications').catch(() => []),
      ]);
      state.services = Array.isArray(services) ? services : [];
      state.posts = Array.isArray(posts) ? posts : [];
      state.notifications = Array.isArray(notifs) ? notifs : [];
      if (profile) { state.profile = profile; state.firstName = profile.first_name || ''; state.phone = profile.phone || ''; }
      const { wash, other } = splitServices();
      if (wash.length && !other.length) state.tab = 'wash';
      else if (!wash.length && other.length) state.tab = 'other';
      state.screen = 'app'; state.nav = 'services'; state.step = 'tabs';
      paint();
    } catch (e) {
      if (!accessToken) { state.screen = 'login_pin'; paint(); showError(e.message || String(e)); return; }
      mainEl.innerHTML = `<p class="wgb-sub">${escapeHtml(e.message || String(e))}</p><button type="button" class="wgb-btn" id="wgb-retry-load">Повторить</button>`;
      document.getElementById('wgb-retry-load').onclick = () => loadCatalogAndProfile();
    }
  }

  async function loadBookings() {
    try { state.bookings = await apiFetch('/bookings'); paint(); } catch (e) { showError(e.message); }
  }

  async function loadNotifications() {
    try { state.notifications = await apiFetch('/notifications'); paint(); } catch (e) { showError(e.message); }
  }

  async function loadChatTab() {
    mainEl.innerHTML = '<p class="wgb-sub">Загрузка чата…</p>';
    showTabbar();
    updateTabbar();
    try {
      clearError();
      const msgs = await apiFetch('/chat/messages');
      state.chatMessages = Array.isArray(msgs) ? msgs : [];
      try { await apiFetch('/chat/mark-admin-read', { method: 'POST' }); } catch (_) {}
      state.notifications.forEach(n => { if (n.type === 'admin') n.read = true; });
      updateTabbar();
      state.screen = 'app';
      paint();
    } catch (e) {
      showError(e.message || String(e));
      state.screen = 'app';
      paint();
    }
  }

  function bindChat() {
    const send = document.getElementById('wgb-chat-send');
    const input = document.getElementById('wgb-chat-input');
    if (!send || !input) return;
    const doSend = async () => {
      const text = input.value.trim();
      if (!text) return;
      send.disabled = true;
      try {
        clearError();
        const created = await apiFetch('/chat/messages', { method: 'POST', body: JSON.stringify({ body: text }) });
        input.value = '';
        if (created && (created._id || created.id)) state.chatMessages.push(created);
        else {
          const again = await apiFetch('/chat/messages');
          state.chatMessages = Array.isArray(again) ? again : [];
        }
        paint();
        requestAnimationFrame(() => {
          const log = document.getElementById('wgb-chat-log');
          if (log) log.scrollTop = log.scrollHeight;
        });
      } catch (e) {
        showError(e.message || String(e));
      } finally {
        send.disabled = false;
      }
    };
    send.onclick = doSend;
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); doSend(); }
    });
  }

  async function loadProfile() {
    try { state.profile = await apiFetch('/profile'); paint(); } catch (e) { showError(e.message); }
  }

  /* ── Boot ── */
  async function boot() {
    if (!apiBase) {
      state.screen = 'login_pin';
      paint();
      showError(
        'Не удалось определить адрес API. Откройте виджет по http(s) с вашего сервера или укажите в URL параметры api и при необходимости key — см. блок ниже.'
      );
      return;
    }
    if (!accessToken) { state.screen = 'login_pin'; paint(); return; }
    state.screen = 'app';
    await loadCatalogAndProfile();
  }

  boot();
})();
