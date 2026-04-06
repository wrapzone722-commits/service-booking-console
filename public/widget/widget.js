(function () {
  const params = new URLSearchParams(window.location.search);
  const apiBase = (params.get('api') || `${window.location.origin}/api/v1`).replace(/\/$/, '');
  const apiKey = (params.get('key') || '').trim();

  const mainEl = document.getElementById('wgb-main');
  const errEl = document.getElementById('wgb-error');
  const hintEl = document.getElementById('wgb-key-hint');

  function showError(msg) {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }

  function clearError() {
    errEl.classList.add('hidden');
    errEl.textContent = '';
  }

  async function apiFetch(path, opts = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...(opts.headers || {}),
    };
    const res = await fetch(`${apiBase}${path}`, { ...opts, headers });
    if (!res.ok) {
      let t = `Ошибка ${res.status}`;
      try {
        const j = await res.json();
        if (j.error) t = j.error;
      } catch (_) {}
      throw new Error(t);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  function svcId(s) {
    return s && (s._id || s.id);
  }

  function isWashService(s) {
    const id = String(svcId(s) || '').toLowerCase();
    const cat = String(s.category || '').toLowerCase();
    const name = String(s.name || '').toLowerCase();
    return cat.includes('мойк') || name.includes('мойк') || id.includes('wash') || id.includes('moy');
  }

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const state = {
    tab: 'wash',
    services: [],
    posts: [],
    step: 'tabs',
    service: null,
    date: todayISO(),
    postId: '',
    slots: [],
    slotIso: '',
    firstName: '',
    phone: '',
  };

  function splitServices() {
    const active = state.services.filter(s => s.is_active);
    const wash = active.filter(isWashService);
    const other = active.filter(s => !isWashService(s));
    return { wash, other };
  }

  function renderTabs() {
    return `
      <div class="wgb-tabs" role="tablist">
        <button type="button" class="wgb-tab ${state.tab === 'wash' ? 'is-active' : ''}" data-tab="wash">Мойка</button>
        <button type="button" class="wgb-tab ${state.tab === 'other' ? 'is-active' : ''}" data-tab="other">Другие услуги</button>
      </div>
    `;
  }

  function renderServiceList() {
    const { wash, other } = splitServices();
    const list = state.tab === 'wash' ? wash : other;
    if (!list.length) {
      return `<p class="wgb-sub">В этой категории пока нет активных услуг.</p>`;
    }
    return `
      <div class="wgb-services">
        ${list
          .map(
            s => `
          <button type="button" class="wgb-svc" data-svc="${encodeURIComponent(svcId(s))}">
            <div class="wgb-svc-title">${escapeHtml(s.name)}</div>
            <div class="wgb-svc-meta">${escapeHtml(String(s.duration || ''))} мин · ${escapeHtml(String(s.price ?? ''))} ₽</div>
          </button>
        `
          )
          .join('')}
      </div>
    `;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function renderBookingForm() {
    const s = state.service;
    const posts = state.posts.filter(p => p.is_enabled);
    if (!posts.length) {
      return `
      <button type="button" class="wgb-back" data-action="back-list">← К услугам</button>
      <h1>${escapeHtml(s.name)}</h1>
      <p class="wgb-sub">Сейчас нет доступных постов для записи. Позвоните в студию.</p>
    `;
    }
    const postOpts = posts
      .map(p => `<option value="${escapeHtml(p._id)}">${escapeHtml(p.name)}</option>`)
      .join('');
    return `
      <button type="button" class="wgb-back" data-action="back-list">← К услугам</button>
      <h1>${escapeHtml(s.name)}</h1>
      <p class="wgb-sub">${escapeHtml(String(s.duration || ''))} мин · ${escapeHtml(String(s.price ?? ''))} ₽</p>
      <div class="wgb-field">
        <label for="wgb-date">Дата</label>
        <input type="date" id="wgb-date" value="${escapeHtml(state.date)}">
      </div>
      <div class="wgb-field">
        <label for="wgb-post">Пост</label>
        <select id="wgb-post">${postOpts}</select>
      </div>
      <div class="wgb-field">
        <label>Свободное время</label>
        <div class="wgb-slots" id="wgb-slots">${renderSlots()}</div>
      </div>
      <div class="wgb-field">
        <label for="wgb-name">Имя</label>
        <input type="text" id="wgb-name" placeholder="Как к вам обращаться" value="${escapeHtml(state.firstName)}">
      </div>
      <div class="wgb-field">
        <label for="wgb-phone">Телефон</label>
        <input type="tel" id="wgb-phone" placeholder="+7 …" value="${escapeHtml(state.phone)}">
      </div>
      <button type="button" class="wgb-btn" id="wgb-submit" ${!state.slotIso ? 'disabled' : ''}>Записаться</button>
    `;
  }

  function renderSlots() {
    if (!state.slots.length) {
      return '<span class="wgb-sub" style="margin:0">Выберите дату и пост — слоты подгрузятся.</span>';
    }
    return state.slots
      .map(sl => {
        const dis = !sl.is_available;
        const picked = state.slotIso === sl.time;
        return `<button type="button" class="wgb-slot${picked ? ' is-picked' : ''}" data-slot="${escapeHtml(sl.time)}" ${dis ? 'disabled' : ''}>${escapeHtml(sl.display_time)}</button>`;
      })
      .join('');
  }

  function renderSuccess() {
    return `
      <div class="wgb-success">
        <h2>Заявка отправлена</h2>
        <p class="wgb-sub">Мы свяжемся с вами для подтверждения. Спасибо!</p>
        <button type="button" class="wgb-btn" data-action="reset" style="margin-top:1.5rem">Новая запись</button>
      </div>
    `;
  }

  function paint() {
    clearError();
    if (!apiKey) {
      mainEl.innerHTML = `<h1>Нужен ключ API</h1><p class="wgb-sub">Добавьте параметр <strong>key</strong> в адрес страницы (ключ клиента из приложения).</p>`;
      return;
    }
    if (state.step === 'success') {
      mainEl.innerHTML = renderSuccess();
      bindSuccess();
      return;
    }
    if (state.step === 'book' && state.service) {
      mainEl.innerHTML = renderBookingForm();
      bindBookingForm();
      return;
    }
    mainEl.innerHTML = `
      <h1>Запись онлайн</h1>
      <p class="wgb-sub">Сначала выберите категорию, затем услугу.</p>
      ${renderTabs()}
      ${renderServiceList()}
    `;
    bindList();
  }

  function bindList() {
    mainEl.querySelectorAll('.wgb-tab').forEach(btn => {
      btn.onclick = () => {
        state.tab = btn.getAttribute('data-tab');
        paint();
      };
    });
    mainEl.querySelectorAll('.wgb-svc').forEach(btn => {
      btn.onclick = () => {
        const id = decodeURIComponent(btn.getAttribute('data-svc'));
        state.service = state.services.find(x => svcId(x) === id);
        state.step = 'book';
        state.slotIso = '';
        state.slots = [];
        const en = state.posts.find(p => p.is_enabled);
        state.postId = en ? en._id : '';
        paint();
        loadSlots();
      };
    });
  }

  async function loadSlots() {
    if (!state.service || !state.date || !state.postId) return;
    try {
      const q = new URLSearchParams({
        service_id: svcId(state.service),
        date: state.date,
        post_id: state.postId,
      });
      state.slots = await apiFetch(`/slots?${q}`);
      const box = document.getElementById('wgb-slots');
      if (box) box.innerHTML = renderSlots();
      bindSlotClicks();
    } catch (e) {
      showError(e.message);
    }
  }

  function bindSlotClicks() {
    document.querySelectorAll('.wgb-slot:not([disabled])').forEach(b => {
      b.onclick = () => {
        state.slotIso = b.getAttribute('data-slot');
        document.querySelectorAll('.wgb-slot').forEach(x => x.classList.remove('is-picked'));
        b.classList.add('is-picked');
        const sub = document.getElementById('wgb-submit');
        if (sub) sub.disabled = !state.slotIso;
      };
    });
  }

  function bindBookingForm() {
    const backEarly = mainEl.querySelector('[data-action="back-list"]');
    if (backEarly) {
      backEarly.onclick = () => {
        state.step = 'tabs';
        state.service = null;
        paint();
      };
    }
    const dateEl = document.getElementById('wgb-date');
    const postEl = document.getElementById('wgb-post');
    if (!dateEl || !postEl) return;
    if (state.postId) postEl.value = state.postId;
    dateEl.onchange = () => {
      state.date = dateEl.value;
      state.slotIso = '';
      loadSlots();
    };
    postEl.onchange = () => {
      state.postId = postEl.value;
      state.slotIso = '';
      loadSlots();
    };
    bindSlotClicks();
    document.getElementById('wgb-submit').onclick = async () => {
      state.firstName = document.getElementById('wgb-name').value.trim();
      state.phone = document.getElementById('wgb-phone').value.trim();
      if (!state.slotIso) {
        showError('Выберите время');
        return;
      }
      if (!state.firstName || !state.phone) {
        showError('Укажите имя и телефон');
        return;
      }
      try {
        clearError();
        await apiFetch('/bookings', {
          method: 'POST',
          body: JSON.stringify({
            service_id: svcId(state.service),
            date_time: state.slotIso,
            post_id: state.postId,
            first_name: state.firstName,
            phone: state.phone,
            source: 'web',
          }),
        });
        state.step = 'success';
        paint();
      } catch (e) {
        showError(e.message);
      }
    };
    loadSlots();
  }

  function bindSuccess() {
    mainEl.querySelector('[data-action="reset"]').onclick = () => {
      state.step = 'tabs';
      state.service = null;
      state.slotIso = '';
      state.slots = [];
      paint();
    };
  }

  async function boot() {
    if (!apiKey) {
      paint();
      return;
    }
    hintEl.classList.add('hidden');
    mainEl.innerHTML = '<p class="wgb-sub">Загрузка…</p>';
    try {
      const [services, posts] = await Promise.all([apiFetch('/services'), apiFetch('/posts')]);
      state.services = Array.isArray(services) ? services : [];
      state.posts = Array.isArray(posts) ? posts : [];
      const { wash, other } = splitServices();
      if (wash.length && !other.length) state.tab = 'wash';
      else if (!wash.length && other.length) state.tab = 'other';
      paint();
    } catch (e) {
      mainEl.innerHTML = '';
      showError(e.message);
    }
  }

  boot();
})();
