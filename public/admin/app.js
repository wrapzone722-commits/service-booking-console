const API_BASE = '/admin/api';
let adminKey = localStorage.getItem('adminKey') || '';

const PROTECTED_PAGES = new Set(['settings', 'cars', 'invites', 'openclaw', 'posts', 'clients', 'cashRegister', 'chat']);

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (adminKey) h['X-Admin-Key'] = adminKey;
  return h;
}

async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, { ...opts, headers: { ...headers(), ...opts.headers } });
  if (res.status === 401) {
    adminKey = '';
    localStorage.removeItem('adminKey');
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j && j.error) msg = j.error;
    } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

/* ── Navigation ── */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  const el = document.getElementById(name + 'Screen');
  if (el) el.classList.remove('hidden');
  document.querySelectorAll('.sidebar__btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));

  const loaders = {
    services: loadServices,
    bookings: loadBookings,
    posts: loadPosts,
    news: loadNews,
    rewards: loadRewards,
    control: loadControl,
    clients: loadClients,
    cars: loadCarFolders,
    candidates: loadCandidates,
    settings: loadSettings,
    invites: loadInviteCodes,
    openclaw: loadOpenclaw,
    cashRegister: loadCashRegister,
    chat: loadChatScreen,
  };
  if (loaders[name]) loaders[name]();
}

async function loadCashRegister() {
  const statusEl = document.getElementById('printerStatusLine');
  if (statusEl) statusEl.textContent = '';
  try {
    const p = await api('/printer');
    const en = document.getElementById('printerLanEnabled');
    const host = document.getElementById('printerLanHost');
    const port = document.getElementById('printerLanPort');
    const head = document.getElementById('receiptHeaderLine');
    if (en) en.checked = !!p.enabled;
    if (host) host.value = p.host || '';
    if (port) port.value = p.port != null ? p.port : 9100;
    if (head) head.value = p.header_line || '';
  } catch (e) {
    if (statusEl) statusEl.innerHTML = errorHtml(e);
  }
}

let chatSelectedClientId = null;

function formatChatListTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return iso;
  }
}

function renderChatThreadList(threads) {
  const listEl = document.getElementById('chatThreadsList');
  if (!listEl) return;
  if (!threads.length) {
    listEl.innerHTML =
      '<p class="hint">Пока нет диалогов — клиент может написать из виджета онлайн-записи.</p>';
    return;
  }
  listEl.innerHTML = threads
    .map((t) => {
      const active = chatSelectedClientId === t.client_id ? ' is-active' : '';
      const unread = t.unread_from_client ? ' admin-chat-thread--unread' : '';
      const name = [t.first_name, t.last_name].filter(Boolean).join(' ') || 'Клиент';
      const prev = (t.last_preview || '').slice(0, 140);
      const badge =
        t.unread_from_client > 0
          ? `<span class="admin-chat-thread__badge">${t.unread_from_client > 99 ? '99+' : t.unread_from_client}</span>`
          : '';
      return `<button type="button" class="admin-chat-thread${active}${unread}" data-client-id="${escapeHtml(t.client_id)}">
        <span class="admin-chat-thread__name">${escapeHtml(name)}</span>
        <span class="admin-chat-thread__phone">${escapeHtml(t.phone || '')}</span>
        <span class="admin-chat-thread__preview">${escapeHtml(prev)}</span>
        ${badge}
      </button>`;
    })
    .join('');
  listEl.querySelectorAll('.admin-chat-thread').forEach((btn) => {
    btn.onclick = () => openChatThread(btn.dataset.clientId);
  });
}

function renderAdminChatMessages(msgs) {
  const box = document.getElementById('chatMessagesList');
  if (!box) return;
  box.innerHTML = msgs
    .map((m) => {
      const mine = m.type === 'admin';
      return `<div class="admin-chat-msg${mine ? ' admin-chat-msg--admin' : ' admin-chat-msg--client'}">
        <div class="admin-chat-msg__bubble">${escapeHtml(m.body || '')}</div>
        <div class="admin-chat-msg__meta">${escapeHtml(formatChatListTime(m.created_at))}</div>
      </div>`;
    })
    .join('');
  box.scrollTop = box.scrollHeight;
}

async function loadChatScreen() {
  chatSelectedClientId = null;
  const empty = document.getElementById('chatPaneEmpty');
  const active = document.getElementById('chatPaneActive');
  if (empty) empty.classList.remove('hidden');
  if (active) active.classList.add('hidden');
  const hid = document.getElementById('chatComposeClientId');
  if (hid) hid.value = '';
  const ta = document.getElementById('chatComposeBody');
  if (ta) ta.value = '';
  try {
    const threads = await api('/chat/threads');
    renderChatThreadList(threads);
  } catch (e) {
    const listEl = document.getElementById('chatThreadsList');
    if (listEl) listEl.innerHTML = errorHtml(e);
  }
}

async function openChatThread(clientId) {
  if (!clientId) return;
  chatSelectedClientId = clientId;
  const hid = document.getElementById('chatComposeClientId');
  if (hid) hid.value = clientId;
  const empty = document.getElementById('chatPaneEmpty');
  const active = document.getElementById('chatPaneActive');
  if (empty) empty.classList.add('hidden');
  if (active) active.classList.remove('hidden');
  try {
    await api(`/chat/threads/${encodeURIComponent(clientId)}/read-client`, { method: 'PATCH' });
  } catch (_) {}
  let threads = [];
  try {
    threads = await api('/chat/threads');
    renderChatThreadList(threads);
  } catch (e) {
    const listEl = document.getElementById('chatThreadsList');
    if (listEl) listEl.innerHTML = errorHtml(e);
    return;
  }
  const th = threads.find((x) => x.client_id === clientId);
  const head = document.getElementById('chatPaneHead');
  if (head && th) {
    const nm = [th.first_name, th.last_name].filter(Boolean).join(' ') || 'Клиент';
    head.textContent = `${nm}${th.phone ? ' · ' + th.phone : ''}`;
  } else if (head) head.textContent = 'Диалог';
  try {
    const msgs = await api(`/chat/threads/${encodeURIComponent(clientId)}/messages`);
    renderAdminChatMessages(msgs);
  } catch (e) {
    const box = document.getElementById('chatMessagesList');
    if (box) box.innerHTML = errorHtml(e);
  }
}

async function savePrinterSettings() {
  const statusEl = document.getElementById('printerStatusLine');
  try {
    const body = {
      enabled: document.getElementById('printerLanEnabled')?.checked === true,
      host: document.getElementById('printerLanHost')?.value ?? '',
      port: parseInt(document.getElementById('printerLanPort')?.value || '9100', 10),
      header_line: document.getElementById('receiptHeaderLine')?.value ?? '',
    };
    const p = await api('/printer', { method: 'PUT', body: JSON.stringify(body) });
    if (statusEl) statusEl.textContent = 'Сохранено.';
    const en = document.getElementById('printerLanEnabled');
    const host = document.getElementById('printerLanHost');
    const port = document.getElementById('printerLanPort');
    const head = document.getElementById('receiptHeaderLine');
    if (en) en.checked = !!p.enabled;
    if (host) host.value = p.host || '';
    if (port) port.value = p.port != null ? p.port : 9100;
    if (head) head.value = p.header_line || '';
  } catch (e) {
    if (statusEl) statusEl.innerHTML = errorHtml(e);
  }
}

async function testPrinterPrint() {
  const statusEl = document.getElementById('printerStatusLine');
  try {
    await api('/print/test', { method: 'POST', body: '{}' });
    if (statusEl) statusEl.textContent = 'Тестовая полоска отправлена на принтер.';
  } catch (e) {
    if (statusEl) statusEl.innerHTML = errorHtml(e);
  }
}

async function printBookingReceipt(bookingId) {
  try {
    await api('/print/receipt', { method: 'POST', body: JSON.stringify({ booking_id: bookingId }) });
    alert('Чек отправлен на принтер');
  } catch (e) {
    alert(e.message || String(e));
  }
}

/* ── Services (по категориям; мойка — первая в списке API) ── */
async function loadServices() {
  try {
    const list = await api('/services');
    const byCat = new Map();
    for (const s of list) {
      const cat = (s.category && String(s.category).trim()) || 'Без категории';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(s);
    }
    const catOrder = [...byCat.keys()].sort((a, b) => {
      const wa = a.toLowerCase().includes('мойк');
      const wb = b.toLowerCase().includes('мойк');
      if (wa !== wb) return wa ? -1 : 1;
      return a.localeCompare(b, 'ru');
    });
    const serviceCardHtml = s => `
      <div class="card service-card-admin" data-id="${s.id}">
        <div class="card-row">
          ${s.image_url
            ? `<img class="service-thumb" src="${escapeAttr(resolveAdminAssetUrl(s.image_url))}" alt="" width="80" height="80" loading="lazy" decoding="async" onerror="this.style.display='none'">`
            : '<div class="service-thumb-ph">🔧</div>'}
          <div class="card-row-body">
            <div class="card-header">
              <h4>${escapeHtml(s.name)}</h4>
              <span class="status ${s.is_active ? 'in_progress' : 'cancelled'}">${s.is_active ? 'Активна' : 'Скрыта'}</span>
            </div>
            <p class="card-meta">${escapeHtml(s.description || '')} · ${s.price} ₽ · ${s.duration} мин</p>
            <div class="btn-group">
              <button class="btn btn--sm" onclick="editService('${s.id}')">Изменить</button>
              <button class="btn btn--sm btn--danger" onclick="deleteService('${s.id}')">Удалить</button>
            </div>
          </div>
        </div>
      </div>
    `;
    let html = '';
    for (const cat of catOrder) {
      html += `<section class="services-cat-block"><h3 class="services-cat-title">${escapeHtml(cat)}</h3><div class="services-cat-list">${byCat.get(cat).map(serviceCardHtml).join('')}</div></section>`;
    }
    document.getElementById('servicesList').innerHTML = html || emptyState('Нет услуг');
  } catch (e) {
    document.getElementById('servicesList').innerHTML = errorHtml(e);
  }
}

/* ── Bookings ── */
async function loadBookings() {
  const status = document.getElementById('filterStatus').value;
  const date = document.getElementById('filterDate').value;
  let path = '/bookings?';
  if (status) path += 'status=' + encodeURIComponent(status) + '&';
  if (date) path += 'date=' + encodeURIComponent(date) + '&';
  try {
    const list = await api(path);
    lastBookingsCache = list;
    document.getElementById('bookingsList').innerHTML = list.length
      ? list.map(renderBookingCard).join('')
      : emptyState('Нет записей');
  } catch (e) {
    document.getElementById('bookingsList').innerHTML = errorHtml(e);
  }
}

function bookingClientName(b) {
  const n = `${escapeHtml(b.first_name || '')} ${escapeHtml(b.last_name || '')}`.trim();
  return n || '—';
}

function bookingHasContact(b) {
  const p = b.phone && String(b.phone).trim();
  const e = b.email && String(b.email).trim();
  return !!(p || e);
}

/** Кэш последней загрузки списка записей (для модалки клиента) */
let lastBookingsCache = [];

function bookingChannelShortLabel(b) {
  const src = (b.booking_source || '').toLowerCase();
  if (src === 'web') return 'сайт';
  if (src === 'ios') return 'приложение iOS';
  if (src === 'android') return 'приложение Android';
  const p = (b.client_platform || '').toLowerCase();
  if (p.includes('web')) return 'сайт';
  if (p.startsWith('ios') || p.includes('iphone') || p.includes('ipad')) return 'приложение iOS';
  if (p.includes('android')) return 'приложение Android';
  return 'канал не указан';
}

function bookingChannelLongLabel(b) {
  const src = (b.booking_source || '').toLowerCase();
  if (src === 'web') return 'Сайт (онлайн-запись / виджет)';
  if (src === 'ios') return 'Приложение iOS';
  if (src === 'android') return 'Приложение Android';
  const p = (b.client_platform || '').toLowerCase();
  if (p.includes('web')) return 'Сайт (по данным регистрации клиента)';
  if (p.startsWith('ios') || p.includes('iphone') || p.includes('ipad')) return 'Приложение iOS (по регистрации)';
  if (p.includes('android')) return 'Приложение Android (по регистрации)';
  return 'Не указано — уточните у клиента';
}

function closeBookingClientModal() {
  document.getElementById('bookingClientModal').classList.add('hidden');
}

function openBookingClientModal(bookingId) {
  const b = lastBookingsCache.find(x => x.id === bookingId);
  if (!b) return;

  const profileName = `${(b.first_name || '').trim()} ${(b.last_name || '').trim()}`.trim() || '—';
  const snapName = (b.booking_snapshot_first_name || '').trim();
  const snapPhone = (b.booking_snapshot_phone || '').trim();
  const regLine = [b.client_platform, b.client_app_version].filter(Boolean).join(' · ') || '—';

  let html = `
    <h3>Клиент по записи</h3>
    <p class="booking-client-modal__service hint">${escapeHtml(b.service_name)} · ${formatDateTime(b.date_time)}</p>
    <dl class="candidate-detail booking-client-detail">
      <dt>Имя в профиле</dt>
      <dd>${escapeHtml(profileName)}</dd>
      <dt>Как записался</dt>
      <dd>${escapeHtml(bookingChannelLongLabel(b))}</dd>
      <dt>Платформа при регистрации</dt>
      <dd>${escapeHtml(regLine)}</dd>
      <dt>Телефон (профиль)</dt>
      <dd>${b.phone ? (buildTelHref(b.phone) ? `<a href="${escapeAttr(buildTelHref(b.phone))}" style="color:var(--lime)">${escapeHtml(b.phone)}</a>` : escapeHtml(b.phone)) : '—'}</dd>
      <dt>E-mail</dt>
      <dd>${b.email ? `<a href="mailto:${encodeURIComponent(String(b.email).trim())}" style="color:var(--lime)">${escapeHtml(b.email)}</a>` : '—'}</dd>
      <dt>Мессенджеры</dt>
      <dd>${renderContactLine(null, null, b.social_links)}</dd>
    `;

  if (snapName || snapPhone) {
    html += `
      <dt class="booking-client-detail__snap">Передано при создании записи</dt>
      <dd class="booking-client-detail__snap">
        ${snapName ? `<div><strong>Имя:</strong> ${escapeHtml(snapName)}</div>` : ''}
        ${snapPhone ? `<div><strong>Телефон:</strong> ${buildTelHref(snapPhone) ? `<a href="${escapeAttr(buildTelHref(snapPhone))}" style="color:var(--lime)">${escapeHtml(snapPhone)}</a>` : escapeHtml(snapPhone)}</div>` : ''}
      </dd>`;
  }

  html += `
      <dt>ID клиента</dt>
      <dd><code style="word-break:break-all">${escapeHtml(b.user_id)}</code></dd>
    </dl>`;

  const contactBtns = renderContactButtons(b.phone, b.email, b.social_links);
  if (contactBtns) {
    html += `<div class="btn-group" style="margin-top:1rem">${contactBtns}</div>`;
  }

  html += `
    <div class="modal-actions">
      <button type="button" class="btn" onclick="closeBookingClientModal()">Закрыть</button>
    </div>`;

  document.getElementById('bookingClientDetail').innerHTML = html;
  document.getElementById('bookingClientModal').classList.remove('hidden');
}

function renderBookingCard(b) {
  return `
    <div class="card">
      <div class="card-header">
        <h4>${escapeHtml(b.service_name)}</h4>
        <span class="status ${b.status}">${statusLabel(b.status)}</span>
      </div>
      <div class="booking-client booking-client--row">
        <button type="button" class="booking-client__avatar-btn" onclick="openBookingClientModal('${escapeAttr(b.id)}')" title="Карточка клиента: имя, канал записи, телефон" aria-label="Открыть карточку клиента">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
        <div class="booking-client__main">
          <div class="booking-client__label">Клиент · ${escapeHtml(bookingChannelShortLabel(b))}</div>
          <p class="booking-client__name">${bookingClientName(b)}</p>
          <p class="booking-client__contacts">${renderContactLine(b.phone, b.email, b.social_links)}</p>
          ${!bookingHasContact(b) ? `<p class="booking-client__hint">Телефон/e-mail в профиле не указаны · ID: <code>${escapeHtml(b.user_id)}</code> · нажмите иконку для деталей</p>` : `<p class="booking-client__hint booking-client__hint--subtle">Нажмите иконку слева — канал записи и контакты при создании</p>`}
        </div>
      </div>
      ${b.notes ? `<p class="card-meta booking-notes"><strong>Комментарий клиента:</strong> ${escapeHtml(b.notes)}</p>` : ''}
      <p class="card-meta">${formatDateTime(b.date_time)} · ${b.invite_code_id ? '<span class="badge-invite">Приглашение</span> · ' : ''}${b.price} ₽</p>
      <div class="btn-group">
        ${['pending','confirmed','in_progress','completed'].includes(b.status) ? `
          ${b.status !== 'confirmed' ? `<button class="btn btn--sm btn--primary" onclick="setStatus('${escapeAttr(b.id)}','confirmed')">Подтвердить</button>` : ''}
          ${b.status !== 'in_progress' ? `<button class="btn btn--sm" onclick="setStatus('${escapeAttr(b.id)}','in_progress')">В процессе</button>` : ''}
          ${b.status !== 'completed' ? `<button class="btn btn--sm" onclick="setStatus('${escapeAttr(b.id)}','completed')">Завершить</button>` : ''}
          ${!['cancelled','completed'].includes(b.status) ? `<button class="btn btn--sm btn--danger" onclick="setStatus('${escapeAttr(b.id)}','cancelled')">Отменить</button>` : ''}
        ` : ''}
        ${renderContactButtons(b.phone, b.email, b.social_links)}
        ${b.status === 'completed' ? `<a class="btn btn--sm" href="/admin/api/bookings/${encodeURIComponent(b.id)}/act?key=${encodeURIComponent(adminKey)}" target="_blank" rel="noopener">Акт</a>` : ''}
        ${b.status !== 'cancelled' ? `<button type="button" class="btn btn--sm" onclick="printBookingReceipt('${escapeAttr(b.id)}')">Чек</button>` : ''}
        <button class="btn btn--sm" onclick="openNotify('${b.user_id}')">Сообщение</button>
      </div>
    </div>`;
}

/* ── Control ── */
async function loadControl() {
  const date = document.getElementById('controlDate').value;
  const status = document.getElementById('controlStatus').value;
  let path = '/bookings?';
  if (status) path += 'status=' + encodeURIComponent(status) + '&';
  if (date) path += 'date=' + encodeURIComponent(date) + '&';
  try {
    const list = await api(path);
    lastBookingsCache = list;
    document.getElementById('controlList').innerHTML = list.length
      ? list.map(renderBookingCard).join('')
      : emptyState('Нет записей');
  } catch (e) {
    document.getElementById('controlList').innerHTML = errorHtml(e);
  }
}

/* ── Candidates ── */
async function loadCandidates() {
  const status = document.getElementById('filterCandidateStatus').value;
  let path = '/candidates';
  if (status) path += '?status=' + encodeURIComponent(status);
  try {
    const list = await api(path);
    if (!list.length) {
      document.getElementById('candidatesList').innerHTML = emptyState('Нет кандидатов');
      return;
    }
    const html = list.map(c => {
      const scoreClass = c.quiz_total > 0
        ? (c.quiz_score / c.quiz_total >= 0.7 ? 'quiz-score--good' : c.quiz_score / c.quiz_total >= 0.4 ? 'quiz-score--ok' : 'quiz-score--low')
        : '';
      return `
        <div class="card" data-id="${c.id}">
          <div class="card-header">
            <h4>${escapeHtml(c.full_name)}</h4>
            <span class="status ${c.status}">${candidateStatusLabel(c.status)}</span>
          </div>
          <p class="card-meta">
            ${escapeHtml(c.email)}${c.phone ? ' · ' + escapeHtml(c.phone) : ''}
            ${c.desired_role ? ' · ' + escapeHtml(c.desired_role) : ''}
          </p>
          ${c.quiz_total > 0 ? `<p class="card-meta">Тест: <span class="${scoreClass} quiz-score">${c.quiz_score} / ${c.quiz_total}</span></p>` : ''}
          <p class="hint">${formatDateTime(c.created_at)}</p>
          <div class="btn-group">
            ${renderCandidateContactButtons(c.phone, c.email)}
            <button class="btn btn--sm" onclick="viewCandidate('${escapeAttr(c.id)}')">Подробнее</button>
            ${c.status === 'new' ? `<button class="btn btn--sm btn--primary" onclick="setCandidateStatus('${escapeAttr(c.id)}','reviewed')">Просмотрено</button>` : ''}
            ${c.status !== 'interview' && c.status !== 'accepted' && c.status !== 'rejected' ? `<button class="btn btn--sm" onclick="setCandidateStatus('${escapeAttr(c.id)}','interview')">На собеседование</button>` : ''}
            ${c.status !== 'accepted' ? `<button class="btn btn--sm" style="color:var(--green)" onclick="setCandidateStatus('${escapeAttr(c.id)}','accepted')">Принять</button>` : ''}
            ${c.status !== 'rejected' ? `<button class="btn btn--sm btn--danger" onclick="setCandidateStatus('${escapeAttr(c.id)}','rejected')">Отклонить</button>` : ''}
            <button class="btn btn--sm btn--danger" onclick="deleteCandidate('${escapeAttr(c.id)}')">Удалить</button>
          </div>
        </div>`;
    }).join('');
    document.getElementById('candidatesList').innerHTML = html;
  } catch (e) {
    document.getElementById('candidatesList').innerHTML = errorHtml(e);
  }
}

let candidatesCache = [];

async function viewCandidate(id) {
  try {
    const list = await api('/candidates');
    candidatesCache = list;
    const c = list.find(x => x.id === id);
    if (!c) return;

    const answers = Array.isArray(c.quiz_answers) ? c.quiz_answers : [];
    const scoreClass = c.quiz_total > 0
      ? (c.quiz_score / c.quiz_total >= 0.7 ? 'quiz-score--good' : c.quiz_score / c.quiz_total >= 0.4 ? 'quiz-score--ok' : 'quiz-score--low')
      : '';

    let html = `
      <h3>${escapeHtml(c.full_name)}</h3>
      <dl class="candidate-detail">
        <dt>Статус</dt>
        <dd><span class="status ${c.status}">${candidateStatusLabel(c.status)}</span></dd>
        <dt>Email</dt>
        <dd><a href="mailto:${escapeAttr(c.email)}" style="color:var(--lime)">${escapeHtml(c.email)}</a></dd>
        ${c.phone ? `<dt>Телефон</dt><dd><a href="${escapeAttr(buildTelHref(c.phone))}" style="color:var(--lime)">${escapeHtml(c.phone)}</a></dd>` : ''}
        ${c.desired_role ? `<dt>Желаемая позиция</dt><dd>${escapeHtml(c.desired_role)}</dd>` : ''}
        ${c.about ? `<dt>О себе</dt><dd>${escapeHtml(c.about)}</dd>` : ''}
        <dt>Дата отклика</dt>
        <dd>${formatDateTime(c.created_at)}</dd>
      </dl>`;

    const contactButtons = renderCandidateContactButtons(c.phone, c.email);
    if (contactButtons) {
      html += `
        <div class="btn-group" style="margin-top:1rem">
          ${contactButtons}
        </div>`;
    }

    if (c.quiz_total > 0) {
      html += `
        <hr>
        <h4 style="margin:0.75rem 0 0.5rem;color:#fff;font-size:0.95rem">Результаты теста <span class="${scoreClass} quiz-score">${c.quiz_score} / ${c.quiz_total}</span></h4>
        <div class="quiz-answers">
          ${answers.map(a => `
            <div class="quiz-answer">
              <span class="quiz-answer__icon ${a.correct ? 'correct' : 'wrong'}">${a.correct ? '✓' : '✗'}</span>
              <span>${escapeHtml(a.question)}</span>
            </div>`).join('')}
        </div>`;
    }

    html += `
      <div class="modal-actions">
        <button class="btn" onclick="document.getElementById('candidateModal').classList.add('hidden')">Закрыть</button>
      </div>`;

    document.getElementById('candidateDetail').innerHTML = html;
    document.getElementById('candidateModal').classList.remove('hidden');
  } catch (e) {
    alert('Ошибка: ' + e.message);
  }
}

async function setCandidateStatus(id, status) {
  await api('/candidates/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
  loadCandidates();
}

async function deleteCandidate(id) {
  if (!confirm('Удалить кандидата?')) return;
  await api('/candidates/' + encodeURIComponent(id), { method: 'DELETE' });
  loadCandidates();
}

function candidateStatusLabel(s) {
  const m = { new: 'Новый', reviewed: 'Просмотрено', interview: 'Собеседование', accepted: 'Принят', rejected: 'Отклонён' };
  return m[s] || s;
}

function renderCandidateContactButtons(phone, email) {
  const btns = [];
  const tel = buildTelHref(phone);
  if (tel) btns.push(`<a class="btn btn--sm" href="${escapeAttr(tel)}">Позвонить</a>`);
  const wa = buildWhatsAppHref(phone);
  if (wa) btns.push(`<a class="btn btn--sm" href="${escapeAttr(wa)}" target="_blank" rel="noopener">WhatsApp</a>`);
  if (email) btns.push(`<a class="btn btn--sm" href="mailto:${encodeURIComponent(String(email).trim())}">Email</a>`);
  return btns.join('');
}

function clientSourceLabel(platform) {
  const p = String(platform || '').toLowerCase();
  if (p === 'web') return 'Онлайн-запись (сайт)';
  if (p === 'ios') return 'iOS-приложение';
  return platform ? escapeHtml(platform) : '—';
}

/* ── Clients ── */
async function loadClients() {
  try {
    const list = await api('/clients');
    const html = list.map(c => `
      <div class="card client-card" data-client-id="${escapeAttr(c.id)}" role="button" tabindex="0">
        <div class="card-header">
          <h4>${escapeHtml(c.first_name || '')} ${escapeHtml(c.last_name || '') || 'Клиент'}</h4>
          <span class="hint client-card__hint">Нажмите карточку — баллы и история</span>
        </div>
        <p class="card-meta">${renderContactLine(c.phone, c.email, c.social_links)}</p>
        <p class="hint">Источник: <strong>${clientSourceLabel(c.platform)}</strong></p>
        ${typeof c.loyalty_points === 'number' ? `<p class="hint">Баллы: <strong>${c.loyalty_points}</strong></p>` : ''}
        <p class="hint">ID: ${escapeHtml(c.id)} · ${c.created_at?.slice(0,10)}</p>
        <div class="btn-group">
          ${renderContactButtons(c.phone, c.email, c.social_links)}
          <button type="button" class="btn btn--sm" onclick="event.stopPropagation(); openNotify('${escapeAttr(c.id)}')">Сообщение</button>
        </div>
      </div>
    `).join('');
    document.getElementById('clientsList').innerHTML = html || emptyState('Нет клиентов');
  } catch (e) {
    document.getElementById('clientsList').innerHTML = errorHtml(e);
  }
}

function closeClientHubModal() {
  document.getElementById('clientHubModal')?.classList.add('hidden');
}

async function openClientHub(clientId) {
  const modal = document.getElementById('clientHubModal');
  const body = document.getElementById('clientHubBody');
  if (!modal || !body) return;
  body.innerHTML = '<p class="hint">Загрузка…</p>';
  modal.classList.remove('hidden');
  try {
    const data = await api('/clients/' + encodeURIComponent(clientId) + '/crm');
    body.innerHTML = renderClientHubBody(data);
    const clearPinBtn = document.getElementById('clientClearWebPin');
    if (clearPinBtn) {
      clearPinBtn.onclick = async () => {
        if (!confirm('Сбросить PIN онлайн-записи? Клиент сможет снова задать PIN на сайте (вкладка «Регистрация»).')) return;
        try {
          await api('/clients/' + encodeURIComponent(clientId) + '/clear-web-pin', { method: 'POST' });
          await openClientHub(clientId);
          loadClients();
        } catch (err) {
          alert(err.message || String(err));
        }
      };
    }
    const form = document.getElementById('clientLoyaltyForm');
    if (form) {
      form.onsubmit = async ev => {
        ev.preventDefault();
        const delta = parseInt(document.getElementById('clientLoyaltyDelta').value, 10);
        const note = document.getElementById('clientLoyaltyNote').value.trim();
        if (!Number.isFinite(delta) || delta === 0) {
          alert('Укажите ненулевое число баллов');
          return;
        }
        try {
          await api('/clients/' + encodeURIComponent(clientId) + '/loyalty', {
            method: 'POST',
            body: JSON.stringify({ delta, note: note || null }),
          });
          await openClientHub(clientId);
          loadClients();
        } catch (err) {
          alert(err.message || String(err));
        }
      };
    }
  } catch (e) {
    body.innerHTML = errorHtml(e);
  }
}

function renderClientHubBody(data) {
  const c = data.client || {};
  const hasWebPin = !!c.has_web_pin;
  const name = `${escapeHtml(c.first_name || '')} ${escapeHtml(c.last_name || '')}`.trim() || 'Клиент';
  const pts = Number(c.loyalty_points) || 0;
  const bookings = data.bookings || [];
  const hist = data.loyalty_history || [];
  const bookRows = bookings
    .map(
      b => `<tr>
      <td>${escapeHtml(formatDateTime(b.date_time))}</td>
      <td>${escapeHtml(b.service_name || '')}</td>
      <td>${escapeHtml(b.status || '')}</td>
      <td>${b.price != null ? escapeHtml(String(b.price)) + ' ₽' : '—'}</td>
    </tr>`
    )
    .join('');
  const histRows = hist
    .map(
      h => `<tr>
      <td>${escapeHtml((h.created_at || '').slice(0, 19).replace('T', ' '))}</td>
      <td class="${h.delta > 0 ? 'client-hub-pos' : 'client-hub-neg'}">${h.delta > 0 ? '+' : ''}${h.delta}</td>
      <td>${escapeHtml(h.note || '—')}</td>
    </tr>`
    )
    .join('');
  return `
    <div class="client-hub-head">
      <div>
        <h3 class="client-hub-title">${name}</h3>
        <p class="hint">${renderContactLine(c.phone, c.email, c.social_links)}</p>
        <p class="hint">Источник: ${clientSourceLabel(c.platform)} · с ${escapeHtml((c.created_at || '').slice(0, 10))}</p>
      </div>
      <div class="client-hub-points"><span class="client-hub-points__label">Баллы</span><span class="client-hub-points__val">${pts}</span></div>
    </div>
    <form id="clientLoyaltyForm" class="client-hub-loyalty">
      <label>Начислить / списать баллы</label>
      <div class="client-hub-loyalty__row">
        <input type="number" id="clientLoyaltyDelta" required placeholder="+10 или -5" step="1">
        <input type="text" id="clientLoyaltyNote" placeholder="Комментарий (необязательно)">
        <button type="submit" class="btn btn--primary">Применить</button>
      </div>
      <p class="hint">Положительное число — начисление, отрицательное — списание.</p>
    </form>
    <div class="client-hub-webpin">
      <h4 class="client-hub-section-title">Вход на сайте (телефон + PIN)</h4>
      ${
        hasWebPin
          ? `<p class="hint">PIN задан. Если клиент забыл PIN — сбросьте здесь; затем он задаст новый на сайте.</p>
             <button type="button" class="btn btn--sm" id="clientClearWebPin">Сбросить PIN</button>`
          : `<p class="hint">PIN для виджета не задан (клиент ещё не регистрировался на сайте или PIN сброшен).</p>`
      }
    </div>
    <h4 class="client-hub-section-title">Записи и работы</h4>
    <div class="client-hub-table-wrap">
      <table class="client-hub-table">
        <thead><tr><th>Дата</th><th>Услуга</th><th>Статус</th><th>Цена</th></tr></thead>
        <tbody>${bookRows || '<tr><td colspan="4" class="hint">Нет записей</td></tr>'}</tbody>
      </table>
    </div>
    <h4 class="client-hub-section-title">История баллов</h4>
    <div class="client-hub-table-wrap">
      <table class="client-hub-table">
        <thead><tr><th>Когда</th><th>Изменение</th><th>Комментарий</th></tr></thead>
        <tbody>${histRows || '<tr><td colspan="3" class="hint">Только ручные операции из админки</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

document.getElementById('clientsList')?.addEventListener('click', e => {
  const card = e.target.closest('.client-card');
  const list = document.getElementById('clientsList');
  if (!card || !list || !list.contains(card)) return;
  if (e.target.closest('a, button')) return;
  const id = card.dataset.clientId;
  if (id) openClientHub(id);
});

document.getElementById('clientsList')?.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('.client-card');
  const list = document.getElementById('clientsList');
  if (!card || !list || !list.contains(card)) return;
  e.preventDefault();
  const id = card.dataset.clientId;
  if (id) openClientHub(id);
});

/* ── Пригласительные коды (QR) ── */
function invitePublicUrl(code) {
  return `${window.location.origin}/invite/${encodeURIComponent(code)}`;
}

async function loadInviteCodes() {
  try {
    const [list, services, posts] = await Promise.all([api('/invite-codes'), api('/services'), api('/posts')]);
    const postMap = Object.fromEntries(posts.map(p => [p.id, p.name]));
    const html = list
      .map(ic => {
        const link = invitePublicUrl(ic.code);
        const used = ic.redemption_count ?? 0;
        const exp = ic.expires_at ? new Date(ic.expires_at).toLocaleString('ru-RU') : '—';
        return `
      <div class="card invite-card" data-id="${escapeAttr(ic.id)}">
        <div class="card-header">
          <h4 class="invite-code-title">${escapeHtml(ic.code)}</h4>
          <span class="status ${ic.active ? 'in_progress' : 'cancelled'}">${ic.active ? 'Активен' : 'Выключен'}</span>
        </div>
        <p class="card-meta">${escapeHtml(ic.service_name || ic.service_id)} · пост: ${escapeHtml(postMap[ic.post_id] || ic.post_id)}</p>
        ${ic.label ? `<p class="hint">${escapeHtml(ic.label)}</p>` : ''}
        <p class="hint">Использовано: ${used} / ${ic.max_uses} · окончание: ${escapeHtml(String(exp))}</p>
        <div class="btn-group invite-btn-group">
          <button type="button" class="btn btn--sm btn--primary" onclick="openInviteQrModal(${JSON.stringify(ic.code)})">QR</button>
          <button type="button" class="btn btn--sm" onclick="copyText(${JSON.stringify(ic.code)}, ${JSON.stringify('Код скопирован')})">Копировать код</button>
          <button type="button" class="btn btn--sm" onclick="copyText(${JSON.stringify(link)}, ${JSON.stringify('Ссылка скопирована')})">Копировать ссылку</button>
          <button type="button" class="btn btn--sm" onclick="toggleInviteActive(${JSON.stringify(ic.id)}, ${!ic.active})">${ic.active ? 'Выключить' : 'Включить'}</button>
          <button type="button" class="btn btn--sm btn--danger" onclick="deleteInviteCode(${JSON.stringify(ic.id)})">Удалить</button>
        </div>
      </div>`;
      })
      .join('');
    document.getElementById('invitesList').innerHTML = html || emptyState('Нет приглашений');
    window.__inviteServicesForModal = services;
    window.__invitePostsForModal = posts;
  } catch (e) {
    document.getElementById('invitesList').innerHTML = errorHtml(e);
  }
}

function copyText(text, okMsg) {
  navigator.clipboard.writeText(text).then(() => alert(okMsg)).catch(() => alert('Не удалось скопировать'));
}

/** QR через Admin API (пакет qrcode на сервере), работает без CDN и canvas в браузере */
async function renderAdminQr(containerEl, text, width = 200) {
  if (!containerEl) return;
  containerEl.innerHTML = '<p class="hint">Генерация QR-кода…</p>';
  try {
    const { data_url } = await api('/qr', {
      method: 'POST',
      body: JSON.stringify({ text, width }),
    });
    containerEl.innerHTML = '';
    const img = document.createElement('img');
    img.src = data_url;
    img.width = width;
    img.height = width;
    img.alt = 'QR-код';
    img.className = 'admin-qr-img';
    img.decoding = 'async';
    containerEl.appendChild(img);
  } catch (e) {
    containerEl.innerHTML = errorHtml(e);
  }
}

async function openInviteQrModal(code) {
  const url = invitePublicUrl(code);
  document.getElementById('inviteQrModalTitle').textContent = 'QR: ' + code;
  const box = document.getElementById('inviteQrCanvasWrap');
  document.getElementById('inviteQrLink').textContent = url;
  document.getElementById('inviteQrModal').classList.remove('hidden');
  await renderAdminQr(box, url, 280);
}

async function toggleInviteActive(id, nextActive) {
  await api('/invite-codes/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify({ active: !!nextActive }),
  });
  loadInviteCodes();
}

async function deleteInviteCode(id) {
  if (!confirm('Удалить код? Если уже были активации — код только отключится.')) return;
  const res = await fetch(API_BASE + '/invite-codes/' + encodeURIComponent(id), { method: 'DELETE', headers: headers() });
  if (res.status === 401) {
    adminKey = '';
    localStorage.removeItem('adminKey');
    alert('Нужен пароль администратора');
    return;
  }
  if (res.status === 204) {
    loadInviteCodes();
    return;
  }
  if (res.status === 200) {
    let j = {};
    try {
      j = await res.json();
    } catch (_) {}
    alert(j.message || 'Код отключён');
    loadInviteCodes();
    return;
  }
  let msg = `HTTP ${res.status}`;
  try {
    const j = await res.json();
    msg = j.error || msg;
  } catch (_) {}
  alert(msg);
}

document.getElementById('btnAddInvite').onclick = async () => {
  let services = window.__inviteServicesForModal;
  let posts = window.__invitePostsForModal;
  if (!services || !posts) {
    try {
      [services, posts] = await Promise.all([api('/services'), api('/posts')]);
    } catch (e) {
      alert(e.message || String(e));
      return;
    }
  }
  const selSvc = document.getElementById('inviteServiceId');
  const selPost = document.getElementById('invitePostId');
  const activeSvcs = services.filter(s => s.is_active);
  selSvc.innerHTML = activeSvcs.length
    ? activeSvcs.map(s => `<option value="${escapeAttr(s.id)}">${escapeHtml(s.name)}</option>`).join('')
    : '<option value="">Нет активных услуг</option>';
  selPost.innerHTML = posts.map(p => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`).join('');
  document.getElementById('inviteCustomCode').value = '';
  document.getElementById('inviteLabel').value = '';
  document.getElementById('inviteMaxUses').value = '100';
  document.getElementById('inviteExpires').value = '';
  document.getElementById('inviteModal').classList.remove('hidden');
};

document.getElementById('inviteForm').onsubmit = async e => {
  e.preventDefault();
  const sid = document.getElementById('inviteServiceId').value;
  if (!sid) {
    alert('Выберите услугу');
    return;
  }
  const custom = document.getElementById('inviteCustomCode').value.trim();
  const body = {
    service_id: sid,
    post_id: document.getElementById('invitePostId').value,
    label: document.getElementById('inviteLabel').value.trim() || null,
    max_uses: parseInt(document.getElementById('inviteMaxUses').value, 10) || 100,
    expires_at: document.getElementById('inviteExpires').value || null,
  };
  if (custom) body.code = custom;
  await api('/invite-codes', { method: 'POST', body: JSON.stringify(body) });
  document.getElementById('inviteModal').classList.add('hidden');
  loadInviteCodes();
};

document.getElementById('btnCancelInvite').onclick = () => document.getElementById('inviteModal').classList.add('hidden');
document.getElementById('btnCloseInviteQr').onclick = () => document.getElementById('inviteQrModal').classList.add('hidden');

/* ── Settings ── */
function fillSettingsLinks(s) {
  const links = s._links || {};
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  };
  set('settingsAdminUrl', links.admin_console_url);
  set('settingsWidgetUrl', links.widget_url);
  set('settingsWidgetEmbedUrl', links.widget_embed_url);
  set('settingsSiteUrl', links.site_url);

  const site = String(links.site_url || '').trim();
  const siteOk = !!site && site !== '—';
  const openSiteL = document.getElementById('settingsSiteOpenLink');
  if (openSiteL) {
    if (siteOk) {
      openSiteL.href = site;
      openSiteL.classList.remove('settings-widget-link--off');
      openSiteL.setAttribute('aria-disabled', 'false');
    } else {
      openSiteL.href = '#';
      openSiteL.classList.add('settings-widget-link--off');
      openSiteL.setAttribute('aria-disabled', 'true');
    }
  }

  const w = String(links.widget_url || '').trim();
  const ok = !!w && w !== '—';
  const openL = document.getElementById('settingsWidgetOpenLink');
  if (openL) {
    if (ok) {
      openL.href = w;
      openL.classList.remove('settings-widget-link--off');
      openL.setAttribute('aria-disabled', 'false');
    } else {
      openL.href = '#';
      openL.classList.add('settings-widget-link--off');
      openL.setAttribute('aria-disabled', 'true');
    }
  }
  const shareBtn = document.getElementById('btnShareWidgetUrl');
  if (shareBtn) shareBtn.disabled = !ok;
}

function wireSettingsCopyButtons() {
  const pairs = [
    ['btnCopySiteUrl', 'settingsSiteUrl'],
    ['btnCopyAdminUrl', 'settingsAdminUrl'],
    ['btnCopyWidgetUrl', 'settingsWidgetUrl'],
    ['btnCopyWidgetEmbedUrl', 'settingsWidgetEmbedUrl'],
  ];
  for (const [btnId, codeId] of pairs) {
    const btn = document.getElementById(btnId);
    if (!btn || btn.dataset.wired === '1') continue;
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      const code = document.getElementById(codeId);
      const text = code && code.textContent && code.textContent !== '—' ? code.textContent : '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const prev = btn.textContent;
        btn.textContent = 'Скопировано';
        setTimeout(() => {
          btn.textContent = prev;
        }, 1500);
      } catch (_) {
        alert(text);
      }
    });
  }
}

function wireWidgetShareButton() {
  const btn = document.getElementById('btnShareWidgetUrl');
  if (!btn || btn.dataset.wired === '1') return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', async () => {
    const code = document.getElementById('settingsWidgetUrl');
    const url = code && code.textContent && code.textContent !== '—' ? code.textContent.trim() : '';
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Онлайн-запись',
          text: 'Запишитесь к нам онлайн',
          url,
        });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      const prev = btn.textContent;
      btn.textContent = 'Ссылка скопирована';
      setTimeout(() => {
        btn.textContent = prev;
      }, 1800);
    } catch (_) {
      window.prompt('Скопируйте ссылку на виджет:', url);
    }
  });
}

async function loadSettings() {
  const qrBox = document.getElementById('qrcodeContainer');
  wireSettingsCopyButtons();
  wireWidgetShareButton();
  try {
    const s = await api('/settings');
    document.getElementById('apiBaseUrl').value = s.api_base_url || '';
    fillSettingsLinks(s);
    const baseUrl = (s._links && s._links.effective_api_base) || s.api_base_url || window.location.origin + '/api/v1';
    document.getElementById('localUrl').textContent = window.location.origin + '/api/v1';
    await renderAdminQr(qrBox, baseUrl, 200);
  } catch (e) {
    if (qrBox) qrBox.innerHTML = errorHtml(e);
  }
}

/* ── OpenClaw: манифест интеграции с Admin API ── */
async function loadOpenclaw() {
  const meta = document.getElementById('openclawManifestJson');
  const box = document.getElementById('openclawConnectionBox');
  if (!meta) return;
  meta.textContent = 'Загрузка…';
  if (box) box.innerHTML = '';
  try {
    const m = await api('/integration/openclaw');
    meta.textContent = JSON.stringify(m, null, 2);
    if (box) {
      const u = m.connection?.admin_api_base || '';
      const manifestUrl = u ? `${u}/integration/openclaw` : '';
      box.innerHTML = `
        <p class="hint"><strong>Admin API:</strong> <code>${escapeHtml(u)}</code></p>
        <p class="hint"><strong>Точка манифеста (GET, заголовок X-Admin-Key):</strong> <code>${escapeHtml(manifestUrl)}</code></p>
        <p class="hint"><strong>SKILL (без секретов):</strong> <a href="/openclaw/SKILL.md" target="_blank" rel="noopener">/openclaw/SKILL.md</a> — скопируйте в workspace OpenClaw.</p>
      `;
    }
  } catch (e) {
    meta.textContent = e.message || String(e);
  }
}

document.getElementById('btnCashGoBookings')?.addEventListener('click', () => showScreen('bookings'));
document.getElementById('btnSavePrinter')?.addEventListener('click', () => savePrinterSettings());
document.getElementById('btnTestPrinter')?.addEventListener('click', () => testPrinterPrint());

document.getElementById('btnDownloadOpenClawManifest')?.addEventListener('click', async () => {
  try {
    const m = await api('/integration/openclaw');
    const blob = new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'service-booking-openclaw-manifest.json';
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    alert(e.message || String(e));
  }
});

/* ── Car folders: папки с фото → GET /api/v1/cars в приложении ── */
async function loadCarFolders() {
  const mount = document.getElementById('carFoldersList');
  try {
    const list = await api('/car-folders');
    const html = list.map(c => {
      const imgUrl = c.image_url ? resolveAdminAssetUrl(c.image_url) : '';
      const media = imgUrl
        ? `<div class="car-folder-card__media"><img src="${escapeAttr(imgUrl)}" alt="" loading="lazy" decoding="async"></div>`
        : `<div class="car-folder-card__media"><span class="car-folder-card__ph" aria-hidden="true">🚗</span></div>`;
      return `
      <div class="car-folder-card" data-id="${escapeAttr(c.id)}">
        ${media}
        <div class="car-folder-card__body">
          <h4>${escapeHtml(c.name)}</h4>
          <p class="car-folder-card__sort">Порядок: ${c.sort_order ?? 0}</p>
          <div class="btn-group">
            <button type="button" class="btn btn--sm" onclick="editCarFolder('${escapeAttr(c.id)}')">Изменить</button>
            <button type="button" class="btn btn--sm btn--danger" onclick="deleteCarFolder('${escapeAttr(c.id)}')">Удалить</button>
          </div>
        </div>
      </div>`;
    }).join('');
    mount.innerHTML = html || emptyState('Нет папок — нажмите «Добавить папку»');
  } catch (e) {
    mount.innerHTML = errorHtml(e);
  }
}

function updateCarFolderImagePreview(url) {
  const box = document.getElementById('carFolderImagePreview');
  const src = url ? resolveAdminAssetUrl(String(url).trim()) : '';
  if (src) {
    box.innerHTML = `<img src="${escapeAttr(src)}" alt="" onerror="this.parentNode.innerHTML='📷'">`;
  } else {
    box.innerHTML = '📷';
  }
}

function openCarFolderModal(item = null) {
  document.getElementById('carFolderId').value = item?.id || '';
  document.getElementById('carFolderModalTitle').textContent = item ? 'Изменить папку' : 'Новая папка автомобиля';
  document.getElementById('carFolderName').value = item?.name || '';
  document.getElementById('carFolderSort').value = item?.sort_order ?? 0;
  document.getElementById('carFolderImageUrl').value = item?.image_url || '';
  updateCarFolderImagePreview(item?.image_url || '');
  document.getElementById('carFolderModal').classList.remove('hidden');
}

function editCarFolder(id) {
  api('/car-folders').then(list => {
    const c = list.find(x => x.id === id);
    if (c) openCarFolderModal(c);
  });
}

async function deleteCarFolder(id) {
  if (!confirm('Удалить эту папку? Если она выбрана у клиентов в приложении, сервер не даст удалить — сначала смените тип у клиентов.')) return;
  try {
    await api('/car-folders/' + encodeURIComponent(id), { method: 'DELETE' });
    loadCarFolders();
  } catch (e) {
    alert(e.message || String(e));
  }
}

/* ── Posts (сетка слотов: вкл/выкл по времени) ── */
function generateSlotTimesForPost(startStr, endStr, intervalMinutes) {
  const slots = [];
  const [sh, sm] = String(startStr || '09:00').split(':').map(x => parseInt(x, 10) || 0);
  const [eh, em] = String(endStr || '18:00').split(':').map(x => parseInt(x, 10) || 0);
  let h = sh,
    mi = sm;
  const endTotal = eh * 60 + em;
  const step = Math.max(5, parseInt(intervalMinutes, 10) || 30);
  while (h * 60 + mi < endTotal) {
    slots.push(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`);
    mi += step;
    while (mi >= 60) {
      mi -= 60;
      h++;
    }
  }
  return slots;
}

function renderPostSlotChipsMarkup(postId, times, disabledArr) {
  const dis = new Set(Array.isArray(disabledArr) ? disabledArr : []);
  return times
    .map(t => {
      const off = dis.has(t);
      return `<button type="button" class="post-slot-chip${off ? ' is-off' : ''}" data-post="${escapeAttr(postId)}" data-time="${escapeAttr(t)}" aria-pressed="${off ? 'false' : 'true'}">${escapeHtml(t)}</button>`;
    })
    .join('');
}

function rebuildPostSlotsFromCard(card) {
  const studio = {
    start: card.dataset.studioStart || '09:00',
    end: card.dataset.studioEnd || '18:00',
    interval: parseInt(card.dataset.studioInterval, 10) || 30,
  };
  const id = card.dataset.id;
  const useOwn = !!(card.querySelector('[data-field="use_custom_hours"]') && card.querySelector('[data-field="use_custom_hours"]').checked);
  const st = useOwn
    ? card.querySelector('[data-field="start_time"]')?.value || studio.start
    : studio.start;
  const en = useOwn
    ? card.querySelector('[data-field="end_time"]')?.value || studio.end
    : studio.end;
  const ivRaw = parseInt(card.querySelector('[data-field="interval_minutes"]')?.value, 10) || studio.interval;
  const effIv = useOwn ? ivRaw : studio.interval;
  const prevOff = new Set([...card.querySelectorAll('.post-slot-chip.is-off')].map(b => b.dataset.time));
  const times = generateSlotTimesForPost(st, en, effIv);
  const keptOff = times.filter(t => prevOff.has(t));
  const wrap = card.querySelector('[data-slot-chips]');
  if (wrap) wrap.innerHTML = renderPostSlotChipsMarkup(id, times, keptOff);
}

function postSlotsAllOn(postId) {
  const card = document.querySelector(`#postsList .post-card[data-id="${postId}"]`);
  if (!card) return;
  card.querySelectorAll('.post-slot-chip').forEach(b => {
    b.classList.remove('is-off');
    b.setAttribute('aria-pressed', 'true');
  });
}

function postSlotsAllOff(postId) {
  const card = document.querySelector(`#postsList .post-card[data-id="${postId}"]`);
  if (!card) return;
  card.querySelectorAll('.post-slot-chip').forEach(b => {
    b.classList.add('is-off');
    b.setAttribute('aria-pressed', 'false');
  });
}

function rebuildStudioGlobalChips() {
  const wrap = document.getElementById('studioGlobalChips');
  if (!wrap) return;
  const st = document.getElementById('studioScheduleStart')?.value?.trim() || '09:00';
  const en = document.getElementById('studioScheduleEnd')?.value?.trim() || '18:00';
  const iv = parseInt(document.getElementById('studioScheduleInterval')?.value, 10) || 30;
  const prevOff = new Set([...wrap.querySelectorAll('.post-slot-chip.is-off')].map(b => b.dataset.time));
  const times = generateSlotTimesForPost(st, en, iv);
  const keptOff = times.filter(t => prevOff.has(t));
  wrap.innerHTML = renderPostSlotChipsMarkup('studio', times, keptOff);
}

window.saveStudioSchedule = async function () {
  const wrap = document.getElementById('studioGlobalChips');
  if (!wrap) return;
  const disabled = [...wrap.querySelectorAll('.post-slot-chip.is-off')].map(b => b.dataset.time);
  try {
    await api('/schedule/studio', {
      method: 'PUT',
      body: JSON.stringify({
        studio_slot_start: document.getElementById('studioScheduleStart').value.trim() || '09:00',
        studio_slot_end: document.getElementById('studioScheduleEnd').value.trim() || '18:00',
        studio_slot_interval_minutes: String(parseInt(document.getElementById('studioScheduleInterval').value, 10) || 30),
        disabled_slot_times: disabled,
      }),
    });
    alert('Общее расписание студии сохранено');
    loadPosts();
  } catch (e) {
    alert(e.message || String(e));
  }
};

function bindStudioScheduleInputs() {
  ['studioScheduleStart', 'studioScheduleEnd', 'studioScheduleInterval'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', rebuildStudioGlobalChips);
    el.addEventListener('input', rebuildStudioGlobalChips);
  });
}

async function loadPosts() {
  let studioData = {
    studio_slot_start: '09:00',
    studio_slot_end: '18:00',
    studio_slot_interval_minutes: '30',
    disabled_slot_times: [],
  };
  try {
    studioData = await api('/schedule/studio');
  } catch (_) {}

  const studio = {
    start: studioData.studio_slot_start || '09:00',
    end: studioData.studio_slot_end || '18:00',
    interval: parseInt(studioData.studio_slot_interval_minutes, 10) || 30,
  };
  const studioDisabledArr = Array.isArray(studioData.disabled_slot_times) ? studioData.disabled_slot_times : [];
  const studioTimes = generateSlotTimesForPost(studio.start, studio.end, studio.interval);
  const studioChips = renderPostSlotChipsMarkup('studio', studioTimes, studioDisabledArr);
  const ivStudio = studio.interval;
  const intervalOptsStudio = [15, 20, 30, 45, 60]
    .map(n => `<option value="${n}" ${ivStudio === n ? 'selected' : ''}>${n} мин</option>`)
    .join('');

  const studioBlock = `
    <div class="card studio-schedule-card" id="studioScheduleCard">
      <div class="studio-schedule-card__head">
        <h3 class="services-cat-title studio-schedule-card__title">Общее расписание студии</h3>
        <p class="hint studio-schedule-card__lead">Для постов <strong>без</strong> «своего расписания»: интервал, часы работы и закрытые слоты настраиваются здесь (не в «Настройках»).</p>
      </div>
      <div class="post-card__grid studio-schedule-card__grid">
        <label>Начало дня</label>
        <input type="text" id="studioScheduleStart" value="${escapeAttr(studio.start)}" placeholder="09:00" autocomplete="off">
        <label>Конец дня</label>
        <input type="text" id="studioScheduleEnd" value="${escapeAttr(studio.end)}" placeholder="18:00" autocomplete="off">
        <label>Интервал слотов</label>
        <select id="studioScheduleInterval">${intervalOptsStudio}</select>
      </div>
      <div class="post-slot-panel">
        <div class="post-slot-panel__head">
          <span class="post-slot-panel__title">Слоты (кнопки): зелёные — открыты, серые — выключены</span>
          <div class="btn-group">
            <button type="button" class="btn btn--sm" onclick="(function(){var w=document.getElementById('studioGlobalChips');if(w)w.querySelectorAll('.post-slot-chip').forEach(function(b){b.classList.remove('is-off');b.setAttribute('aria-pressed','true');});})()">Все открыть</button>
            <button type="button" class="btn btn--sm" onclick="(function(){var w=document.getElementById('studioGlobalChips');if(w)w.querySelectorAll('.post-slot-chip').forEach(function(b){b.classList.add('is-off');b.setAttribute('aria-pressed','false');});})()">Все закрыть</button>
          </div>
        </div>
        <p class="hint post-slot-legend"><span class="post-slot-legend__on">●</span> доступно &nbsp; <span class="post-slot-legend__off">●</span> закрыто</p>
        <div class="post-slot-chips" id="studioGlobalChips">${studioChips}</div>
      </div>
      <button type="button" class="btn btn--primary" onclick="saveStudioSchedule()">Сохранить общее расписание</button>
    </div>`;

  try {
    const list = await api('/posts');
    const html = list
      .map(p => {
        const useOwn = p.use_custom_hours;
        const effStart = useOwn ? p.start_time || studio.start : studio.start;
        const effEnd = useOwn ? p.end_time || studio.end : studio.end;
        const effIv = useOwn ? p.interval_minutes || studio.interval : studio.interval;
        const times = generateSlotTimesForPost(effStart, effEnd, effIv);
        const chips = renderPostSlotChipsMarkup(p.id, times, p.disabled_slot_times);
        const iv = parseInt(p.interval_minutes, 10) || 30;
        const intervalOpts = [15, 20, 30, 45, 60]
          .map(
            n =>
              `<option value="${n}" ${iv === n ? 'selected' : ''}>${n} мин</option>`
          )
          .join('');
        return `
      <div class="card post-card" data-id="${escapeAttr(p.id)}" data-studio-start="${escapeAttr(studio.start)}" data-studio-end="${escapeAttr(studio.end)}" data-studio-interval="${studio.interval}">
        <div class="post-card__head">
          <div class="post-card__title">
            <h4>${escapeHtml(p.name)}</h4>
            <span class="status ${p.is_enabled ? 'in_progress' : 'cancelled'}">${p.is_enabled ? 'Пост включён' : 'Пост выключен'}</span>
          </div>
          <label class="post-card__toggle"><input type="checkbox" data-field="is_enabled" data-rebuild-slots="1" ${p.is_enabled ? 'checked' : ''}> <span>Запись на этот пост</span></label>
        </div>
        <p class="hint post-card__hint">Без «своего расписания» используются часы и шаг из блока <strong>«Общее расписание студии»</strong> выше; закрытые слоты суммируются (студия + пост).</p>
        <div class="post-card__grid">
          <label>Название</label>
          <input type="text" data-field="name" value="${escapeAttr(p.name)}">
          <label>Своё расписание</label>
          <input type="checkbox" data-field="use_custom_hours" data-rebuild-slots="1" ${p.use_custom_hours ? 'checked' : ''}>
          <label>Начало</label>
          <input type="text" data-field="start_time" data-rebuild-slots="1" value="${escapeAttr(p.start_time || '')}" placeholder="09:00">
          <label>Конец</label>
          <input type="text" data-field="end_time" data-rebuild-slots="1" value="${escapeAttr(p.end_time || '')}" placeholder="18:00">
          <label>Интервал слотов</label>
          <select data-field="interval_minutes" data-rebuild-slots="1">${intervalOpts}</select>
        </div>
        <div class="post-slot-panel">
          <div class="post-slot-panel__head">
            <span class="post-slot-panel__title">Слоты времени</span>
            <div class="btn-group">
              <button type="button" class="btn btn--sm" onclick="postSlotsAllOn('${escapeAttr(p.id)}')">Все открыть</button>
              <button type="button" class="btn btn--sm" onclick="postSlotsAllOff('${escapeAttr(p.id)}')">Все закрыть</button>
            </div>
          </div>
          <p class="hint post-slot-legend"><span class="post-slot-legend__on">●</span> можно записаться &nbsp; <span class="post-slot-legend__off">●</span> перерыв / недоступно</p>
          <div class="post-slot-chips" data-slot-chips>${chips}</div>
        </div>
        <div class="btn-group">
          <button type="button" class="btn btn--sm btn--primary" onclick="savePost('${escapeAttr(p.id)}')">Сохранить пост</button>
        </div>
      </div>`;
      })
      .join('');
    document.getElementById('postsList').innerHTML = studioBlock + (html || emptyState('Нет постов'));
    bindStudioScheduleInputs();
  } catch (e) {
    document.getElementById('postsList').innerHTML = errorHtml(e);
  }
}

async function savePost(id) {
  const card = document.querySelector(`#postsList .post-card[data-id="${id}"]`);
  if (!card) return;
  const body = {};
  card.querySelectorAll('[data-field]').forEach(el => {
    const f = el.dataset.field;
    if (el.type === 'checkbox') body[f] = el.checked;
    else if (el.tagName === 'SELECT') body[f] = parseInt(el.value, 10) || 30;
    else if (el.type === 'number') body[f] = parseInt(el.value) || 0;
    else body[f] = el.value;
  });
  body.disabled_slot_times = [...card.querySelectorAll('.post-slot-chip.is-off')].map(b => b.dataset.time);
  await api('/posts/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(body) });
  loadPosts();
}

document.getElementById('postsList')?.addEventListener('click', e => {
  const chip = e.target.closest('.post-slot-chip');
  const list = document.getElementById('postsList');
  if (!chip || !list || !list.contains(chip)) return;
  e.preventDefault();
  chip.classList.toggle('is-off');
  chip.setAttribute('aria-pressed', chip.classList.contains('is-off') ? 'false' : 'true');
});

document.getElementById('postsList')?.addEventListener('change', e => {
  const t = e.target;
  if (!t.matches || !t.matches('[data-rebuild-slots]')) return;
  const card = t.closest('.post-card');
  if (card) rebuildPostSlotsFromCard(card);
});

/* ── News ── */
async function loadNews() {
  try {
    const list = await api('/news');
    const html = list.map(n => `
      <div class="card" data-id="${n.id}">
        <div class="card-header">
          <h4>${escapeHtml(n.title)}</h4>
          <span class="status ${n.published ? 'completed' : 'pending'}">${n.published ? 'Опубликовано' : 'Черновик'}</span>
        </div>
        <p class="hint">${(n.created_at || '').slice(0,19).replace('T',' ')}</p>
        <p class="card-meta">${escapeHtml((n.body || '').slice(0, 200))}${(n.body || '').length > 200 ? '…' : ''}</p>
        <div class="btn-group">
          <button class="btn btn--sm" onclick="editNews('${n.id}')">Изменить</button>
          <button class="btn btn--sm btn--danger" onclick="deleteNews('${n.id}')">Удалить</button>
        </div>
      </div>
    `).join('');
    document.getElementById('newsList').innerHTML = html || emptyState('Нет новостей');
  } catch (e) {
    document.getElementById('newsList').innerHTML = errorHtml(e);
  }
}

/* ── Rewards ── */
async function loadRewards() {
  try {
    const list = await api('/rewards');
    const html = list.map(r => `
      <div class="card" data-id="${r.id}">
        <div class="card-row">
          ${r.image_url
            ? `<img class="service-thumb" src="${escapeAttr(r.image_url)}" alt="" width="80" height="80" loading="lazy" decoding="async" onerror="this.style.display='none'">`
            : '<div class="service-thumb-ph">🎁</div>'}
          <div class="card-row-body">
            <div class="card-header">
              <h4>${escapeHtml(r.name)}</h4>
              <span class="status ${r.is_active ? 'in_progress' : 'cancelled'}">${r.is_active ? 'Доступно' : 'Скрыто'}</span>
            </div>
            <p class="card-meta">${escapeHtml(r.description || '')}</p>
            <p class="hint">Стоимость: <strong>${r.points_cost} баллов</strong> · Порядок: ${r.sort_order ?? 0}</p>
            <div class="btn-group">
              <button class="btn btn--sm" onclick="editReward('${escapeAttr(r.id)}')">Изменить</button>
              <button class="btn btn--sm btn--danger" onclick="deleteReward('${escapeAttr(r.id)}')">Удалить</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    document.getElementById('rewardsList').innerHTML = html || emptyState('Нет товаров за баллы');
  } catch (e) {
    document.getElementById('rewardsList').innerHTML = errorHtml(e);
  }
}

/* ── Modals: Reward ── */
function openRewardModal(item = null) {
  document.getElementById('rewardId').value = item?.id || '';
  document.getElementById('rewardModalTitle').textContent = item ? 'Редактировать товар/услугу' : 'Добавить товар или услугу за баллы';
  document.getElementById('rewardName').value = item?.name || '';
  document.getElementById('rewardDescription').value = item?.description || '';
  document.getElementById('rewardPointsCost').value = item?.points_cost ?? 0;
  document.getElementById('rewardImageUrl').value = item?.image_url || '';
  document.getElementById('rewardSortOrder').value = item?.sort_order ?? 0;
  document.getElementById('rewardActive').checked = item ? !!item.is_active : true;
  document.getElementById('rewardModal').classList.remove('hidden');
}

function editReward(id) {
  api('/rewards').then(list => {
    const r = list.find(x => x.id === id);
    if (r) openRewardModal(r);
  });
}

async function deleteReward(id) {
  if (!confirm('Удалить этот товар/услугу за баллы?')) return;
  await api('/rewards/' + encodeURIComponent(id), { method: 'DELETE' });
  loadRewards();
}

/* ── Modals: News ── */
function openNewsModal(item = null) {
  document.getElementById('newsId').value = item?.id || '';
  document.getElementById('newsModalTitle').textContent = item ? 'Редактировать новость' : 'Добавить новость';
  document.getElementById('newsTitle').value = item?.title || '';
  document.getElementById('newsBody').value = item?.body || '';
  document.getElementById('newsPublished').checked = item ? !!item.published : true;
  document.getElementById('newsModal').classList.remove('hidden');
}

function editNews(id) {
  api('/news').then(list => {
    const n = list.find(x => x.id === id);
    if (n) openNewsModal(n);
  });
}

async function deleteNews(id) {
  if (!confirm('Удалить новость?')) return;
  await api('/news/' + encodeURIComponent(id), { method: 'DELETE' });
  loadNews();
}

/* ── Helpers ── */
function statusLabel(s) {
  const m = { pending:'Ожидает', confirmed:'Подтверждена', in_progress:'В процессе', completed:'Завершена', cancelled:'Отменена' };
  return m[s] || s;
}

function formatDateTime(s) {
  if (!s) return '';
  return new Date(s).toLocaleString('ru-RU');
}

function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/\"/g, '&quot;');
}

function emptyState(msg) {
  return `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg><p>${msg}</p></div>`;
}

function errorHtml(e) {
  return '<p class="error">' + escapeHtml(e.message) + '</p>';
}

function parseSocialLinks(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { const o = JSON.parse(v); return o && typeof o === 'object' ? o : {}; } catch (_) { return {}; }
}

function phoneDigits(raw) { return String(raw || '').replace(/\D/g, ''); }

function phoneToE164DigitsRU(raw) {
  const d = phoneDigits(raw);
  if (!d) return '';
  if (d.length === 11 && d.startsWith('8')) return '7' + d.slice(1);
  if (d.length === 10) return '7' + d;
  if (d.length === 11 && d.startsWith('7')) return d;
  return d;
}

function buildTelHref(rawPhone) {
  const d = phoneToE164DigitsRU(rawPhone);
  return d ? 'tel:+' + d : '';
}

function buildWhatsAppHref(rawPhone) {
  const d = phoneToE164DigitsRU(rawPhone);
  return d ? 'https://wa.me/' + d : '';
}

function extractTelegramHandle(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  const withoutAt = s.startsWith('@') ? s.slice(1) : s;
  const m = withoutAt.match(/(?:t\.me\/)?([A-Za-z0-9_]{3,})/);
  return m ? m[1] : '';
}

function buildTelegramHref(socialLinks) {
  const social = parseSocialLinks(socialLinks);
  const handle = extractTelegramHandle(social.telegram);
  return handle ? 'https://t.me/' + handle : '';
}

function renderContactLine(phone, email, socialLinks) {
  const parts = [];
  const telHref = buildTelHref(phone);
  if (phone) parts.push(telHref ? `<a href="${escapeAttr(telHref)}" style="color:var(--lime)">${escapeHtml(phone)}</a>` : escapeHtml(phone));
  if (email) parts.push(`<a href="mailto:${encodeURIComponent(String(email).trim())}" style="color:var(--lime)">${escapeHtml(email)}</a>`);
  const tgHref = buildTelegramHref(socialLinks);
  if (tgHref) {
    const handle = extractTelegramHandle(parseSocialLinks(socialLinks).telegram);
    parts.push(`<a href="${escapeAttr(tgHref)}" target="_blank" rel="noopener" style="color:var(--lime)">@${escapeHtml(handle)}</a>`);
  }
  return parts.join(' · ') || '—';
}

function renderContactButtons(phone, email, socialLinks) {
  const btns = [];
  const tel = buildTelHref(phone);
  if (tel) btns.push(`<a class="btn btn--sm" href="${escapeAttr(tel)}">Позвонить</a>`);
  const wa = buildWhatsAppHref(phone);
  if (wa) btns.push(`<a class="btn btn--sm" href="${escapeAttr(wa)}" target="_blank" rel="noopener">WhatsApp</a>`);
  const tg = buildTelegramHref(socialLinks);
  if (tg) btns.push(`<a class="btn btn--sm" href="${escapeAttr(tg)}" target="_blank" rel="noopener">Telegram</a>`);
  if (email) btns.push(`<a class="btn btn--sm" href="mailto:${encodeURIComponent(String(email).trim())}">Email</a>`);
  return btns.join('');
}

/* ── Admin modal ── */
function openAdminModal() {
  document.getElementById('adminPass').value = '';
  document.getElementById('adminError').classList.add('hidden');
  document.getElementById('adminError').textContent = '';
  document.getElementById('adminModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('adminPass').focus(), 50);
}

/* ── Event bindings ── */
document.querySelectorAll('.sidebar__btn').forEach(b => {
  b.onclick = async () => {
    const page = b.dataset.page;
    if (PROTECTED_PAGES.has(page)) {
      try { await ensureAdmin(); showScreen(page); } catch (_) {}
      return;
    }
    showScreen(page);
  };
});

/** Превью: относительные пути (/uploads, /site-assets) с текущего хоста */
function resolveAdminAssetUrl(raw) {
  if (raw == null || !String(raw).trim()) return '';
  const u = String(raw).trim();
  if (/^https?:\/\//i.test(u) || u.startsWith('//')) return u;
  if (u.startsWith('/')) return window.location.origin + u;
  return u;
}

function updateServiceImagePreview(url) {
  const box = document.getElementById('serviceImagePreview');
  const src = resolveAdminAssetUrl(url);
  if (src) {
    box.innerHTML = `<img src="${escapeAttr(src)}" alt="" onerror="this.parentNode.innerHTML='📷'">`;
  } else {
    box.innerHTML = '📷';
  }
}

/** Загрузка на сервер требует X-Admin-Key */
async function ensureAdminKeyForUpload() {
  if (adminKey) {
    try {
      await api('/settings');
      return true;
    } catch (_) {
      adminKey = '';
      localStorage.removeItem('adminKey');
    }
  }
  const p = window.prompt('Введите пароль администратора для загрузки фото на сервер:');
  if (!p) return false;
  const prev = adminKey;
  adminKey = String(p).trim();
  try {
    await api('/settings');
    localStorage.setItem('adminKey', adminKey);
    return true;
  } catch (_) {
    adminKey = prev;
    alert('Неверный пароль');
    return false;
  }
}

document.getElementById('serviceImageFile').onchange = async function () {
  const file = this.files?.[0];
  if (!file) return;
  if (!(await ensureAdminKeyForUpload())) {
    this.value = '';
    return;
  }
  const fd = new FormData();
  fd.append('image', file);
  try {
    const res = await fetch(API_BASE + '/upload/image', {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey },
      body: fd,
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    const data = await res.json();
    document.getElementById('serviceImageUrl').value = data.url;
    updateServiceImagePreview(data.url);
  } catch (e) {
    alert('Ошибка загрузки: ' + e.message);
  }
  this.value = '';
};

document.getElementById('serviceImageUrl').addEventListener('input', function () {
  updateServiceImagePreview(this.value.trim());
});

document.getElementById('btnServiceImageClear').onclick = function () {
  document.getElementById('serviceImageUrl').value = '';
  document.getElementById('serviceImageFile').value = '';
  updateServiceImagePreview(null);
};

document.getElementById('btnAddService').onclick = () => {
  document.getElementById('serviceId').value = '';
  document.getElementById('serviceModalTitle').textContent = 'Добавить услугу';
  document.getElementById('serviceName').value = '';
  document.getElementById('serviceDescription').value = '';
  document.getElementById('servicePrice').value = '0';
  document.getElementById('serviceDuration').value = '60';
  document.getElementById('serviceCategory').value = 'Автоуслуги';
  document.getElementById('serviceImageUrl').value = '';
  updateServiceImagePreview(null);
  document.getElementById('serviceActive').checked = true;
  document.getElementById('serviceModal').classList.remove('hidden');
};

function editService(id) {
  api('/services').then(list => {
    const s = list.find(x => x.id === id);
    if (!s) return;
    document.getElementById('serviceId').value = s.id;
    document.getElementById('serviceModalTitle').textContent = 'Редактировать услугу';
    document.getElementById('serviceName').value = s.name;
    document.getElementById('serviceDescription').value = s.description || '';
    document.getElementById('servicePrice').value = s.price;
    document.getElementById('serviceDuration').value = s.duration;
    document.getElementById('serviceCategory').value = s.category || '';
    document.getElementById('serviceImageUrl').value = s.image_url || '';
    updateServiceImagePreview(s.image_url);
    document.getElementById('serviceActive').checked = s.is_active;
    document.getElementById('serviceModal').classList.remove('hidden');
  });
}

async function deleteService(id) {
  if (!confirm('Удалить эту услугу из каталога?')) return;
  const path = '/services/' + encodeURIComponent(id);
  const url = API_BASE + path;
  let res = await fetch(url, { method: 'DELETE', headers: headers() });
  if (res.status === 409) {
    let j = {};
    try {
      j = await res.json();
    } catch (_) {}
    const n = j.bookings_count != null ? j.bookings_count : '?';
    if (
      !confirm(
        `У этой услуги есть записи в журнале: ${n}. Удалить услугу и все связанные записи? Действие необратимо.`
      )
    ) {
      return;
    }
    res = await fetch(url + '?force=1', { method: 'DELETE', headers: headers() });
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.error || j.message || msg;
    } catch (_) {}
    alert(msg);
    return;
  }
  loadServices();
}

document.getElementById('serviceForm').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('serviceId').value;
  const body = {
    name: document.getElementById('serviceName').value,
    description: document.getElementById('serviceDescription').value,
    price: parseFloat(document.getElementById('servicePrice').value) || 0,
    duration: parseInt(document.getElementById('serviceDuration').value) || 60,
    category: document.getElementById('serviceCategory').value || '',
    image_url: document.getElementById('serviceImageUrl').value.trim() || null,
    is_active: document.getElementById('serviceActive').checked,
  };
  if (id) {
    await api('/services/' + id, { method: 'PUT', body: JSON.stringify(body) });
  } else {
    await api('/services', { method: 'POST', body: JSON.stringify(body) });
  }
  document.getElementById('serviceModal').classList.add('hidden');
  loadServices();
};

document.getElementById('btnCancelService').onclick = () => document.getElementById('serviceModal').classList.add('hidden');
document.getElementById('filterStatus').onchange = loadBookings;
document.getElementById('filterDate').onchange = loadBookings;
document.getElementById('btnClearBookingFilters')?.addEventListener('click', () => {
  const st = document.getElementById('filterStatus');
  const dt = document.getElementById('filterDate');
  if (st) st.value = '';
  if (dt) dt.value = '';
  loadBookings();
});
document.getElementById('filterCandidateStatus').onchange = loadCandidates;

async function setStatus(bookingId, status) {
  await api('/bookings/' + bookingId + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
  loadBookings();
  loadControl();
}

function openNotify(clientId) {
  document.getElementById('notifyClientId').value = clientId;
  document.getElementById('notifyTitle').value = '';
  document.getElementById('notifyBody').value = '';
  document.getElementById('notifyModal').classList.remove('hidden');
}

document.getElementById('notifyForm').onsubmit = async (e) => {
  e.preventDefault();
  await api('/notifications', {
    method: 'POST',
    body: JSON.stringify({
      client_id: document.getElementById('notifyClientId').value,
      title: document.getElementById('notifyTitle').value || null,
      body: document.getElementById('notifyBody').value,
    }),
  });
  document.getElementById('notifyModal').classList.add('hidden');
};

document.getElementById('btnCancelNotify').onclick = () => document.getElementById('notifyModal').classList.add('hidden');

document.getElementById('btnChatRefresh')?.addEventListener('click', async () => {
  if (chatSelectedClientId) await openChatThread(chatSelectedClientId);
  else await loadChatScreen();
});

document.getElementById('chatComposeForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const clientId = document.getElementById('chatComposeClientId')?.value || '';
  const body = document.getElementById('chatComposeBody')?.value.trim() || '';
  if (!clientId || !body) return;
  try {
    await api('/notifications', { method: 'POST', body: JSON.stringify({ client_id: clientId, body }) });
    document.getElementById('chatComposeBody').value = '';
    await openChatThread(clientId);
  } catch (err) {
    alert(err.message || String(err));
  }
});

document.getElementById('btnCloseClientHub')?.addEventListener('click', closeClientHubModal);

document.getElementById('btnSaveSettings').onclick = async () => {
  const url = document.getElementById('apiBaseUrl').value.trim();
  await api('/settings', {
    method: 'PUT',
    body: JSON.stringify({ api_base_url: url }),
  });
  loadSettings();
};

document.getElementById('btnAddNews').onclick = () => openNewsModal(null);
document.getElementById('btnAddReward').onclick = () => openRewardModal(null);
document.getElementById('btnAddCarFolder').onclick = () => openCarFolderModal(null);

document.getElementById('carFolderImageUrl').addEventListener('input', function () {
  updateCarFolderImagePreview(this.value.trim());
});

document.getElementById('carFolderImageFile').onchange = async function () {
  const file = this.files?.[0];
  if (!file) return;
  if (!(await ensureAdminKeyForUpload())) {
    this.value = '';
    return;
  }
  const fd = new FormData();
  fd.append('image', file);
  try {
    const res = await fetch(API_BASE + '/upload/image', {
      method: 'POST',
      headers: { 'X-Admin-Key': adminKey },
      body: fd,
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    const data = await res.json();
    document.getElementById('carFolderImageUrl').value = data.url;
    updateCarFolderImagePreview(data.url);
  } catch (e) {
    alert('Ошибка загрузки: ' + e.message);
  }
  this.value = '';
};

document.getElementById('carFolderForm').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('carFolderId').value;
  const body = {
    name: document.getElementById('carFolderName').value.trim(),
    image_url: document.getElementById('carFolderImageUrl').value.trim() || null,
    sort_order: parseInt(document.getElementById('carFolderSort').value, 10) || 0,
  };
  if (!body.name) return;
  if (id) {
    await api('/car-folders/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(body) });
  } else {
    await api('/car-folders', { method: 'POST', body: JSON.stringify(body) });
  }
  document.getElementById('carFolderModal').classList.add('hidden');
  loadCarFolders();
};

document.getElementById('btnCancelCarFolder').onclick = () =>
  document.getElementById('carFolderModal').classList.add('hidden');

document.getElementById('rewardForm').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('rewardId').value;
  const body = {
    name: document.getElementById('rewardName').value,
    description: document.getElementById('rewardDescription').value,
    points_cost: parseInt(document.getElementById('rewardPointsCost').value) || 0,
    image_url: document.getElementById('rewardImageUrl').value.trim() || null,
    sort_order: parseInt(document.getElementById('rewardSortOrder').value) || 0,
    is_active: document.getElementById('rewardActive').checked,
  };
  if (id) {
    await api('/rewards/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(body) });
  } else {
    await api('/rewards', { method: 'POST', body: JSON.stringify(body) });
  }
  document.getElementById('rewardModal').classList.add('hidden');
  loadRewards();
};

document.getElementById('btnCancelReward').onclick = () => document.getElementById('rewardModal').classList.add('hidden');

document.getElementById('newsForm').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('newsId').value;
  const body = {
    title: document.getElementById('newsTitle').value,
    body: document.getElementById('newsBody').value,
    published: document.getElementById('newsPublished').checked,
  };
  if (id) {
    await api('/news/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(body) });
  } else {
    await api('/news', { method: 'POST', body: JSON.stringify(body) });
  }
  document.getElementById('newsModal').classList.add('hidden');
  loadNews();
};

document.getElementById('btnCancelNews').onclick = () => document.getElementById('newsModal').classList.add('hidden');

document.getElementById('btnControlRefresh').onclick = loadControl;
document.getElementById('controlDate').value = new Date().toISOString().slice(0,10);
document.getElementById('controlStatus').onchange = loadControl;
document.getElementById('controlDate').onchange = loadControl;

document.getElementById('adminForm').onsubmit = async (e) => {
  e.preventDefault();
  const pass = document.getElementById('adminPass').value;
  await trySetAdminKey(pass);
  document.getElementById('adminModal').classList.add('hidden');
  
  // Если мы только что вошли при старте приложения
  const cancelBtn = document.getElementById('btnCancelAdmin');
  if (cancelBtn && cancelBtn.classList.contains('hidden')) {
    cancelBtn.classList.remove('hidden');
    initAdminNotifyStrip();
    showScreen('services');
  }
};

document.getElementById('btnCancelAdmin').onclick = () => document.getElementById('adminModal').classList.add('hidden');

async function ensureAdmin() {
  if (adminKey) return;
  openAdminModal();
  throw new Error('NEED_ADMIN');
}

async function trySetAdminKey(pass) {
  const errEl = document.getElementById('adminError');
  errEl.classList.add('hidden');
  errEl.textContent = '';
  adminKey = (pass || '').trim();
  if (!adminKey) {
    errEl.textContent = 'Введите пароль';
    errEl.classList.remove('hidden');
    throw new Error('EMPTY');
  }
  try {
    await api('/settings');
    localStorage.setItem('adminKey', adminKey);
  } catch (e) {
    adminKey = '';
    localStorage.removeItem('adminKey');
    errEl.textContent = 'Неверный пароль';
    errEl.classList.remove('hidden');
    openAdminModal();
    throw e;
  }
}

/* ── Браузерные уведомления о новых записях (опрос API) ── */
const ADMIN_NOTIFY_LS = 'adminBrowserNotify_v1';
let adminNotifyBootstrapped = false;
let adminNotifyTimer = null;

function adminNotifyPollUrl() {
  return API_BASE + '/bookings?sort=created&limit=1';
}

async function adminNotifyTick() {
  try {
    const res = await fetch(adminNotifyPollUrl(), { headers: headers() });
    if (!res.ok) return;
    const list = await res.json();
    if (!list.length) return;
    const row = list[0];
    const key = 'adminNotifyLastBookingId';
    const prev = sessionStorage.getItem(key);
    if (!adminNotifyBootstrapped) {
      sessionStorage.setItem(key, row.id);
      adminNotifyBootstrapped = true;
      return;
    }
    if (row.id !== prev) {
      sessionStorage.setItem(key, row.id);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const body =
          (row.service_name || 'Услуга') + ' · ' + formatDateTime(row.date_time);
        new Notification('Другое место — новая запись', {
          body,
          tag: 'dm-booking-' + row.id,
        });
      }
    }
  } catch (_) {}
}

function stopAdminNotifyPolling() {
  if (adminNotifyTimer) {
    clearInterval(adminNotifyTimer);
    adminNotifyTimer = null;
  }
}

function startAdminNotifyPolling() {
  stopAdminNotifyPolling();
  adminNotifyBootstrapped = false;
  adminNotifyTimer = setInterval(adminNotifyTick, 26000);
  adminNotifyTick();
}

function updateAdminNotifyStripUI() {
  const hint = document.getElementById('adminNotifyStripHint');
  const btn = document.getElementById('btnAdminBrowserNotify');
  if (!hint || !btn) return;
  if (typeof Notification === 'undefined') {
    hint.textContent = 'Браузер не поддерживает уведомления.';
    btn.disabled = true;
    return;
  }
  if (Notification.permission === 'denied') {
    hint.textContent = 'Разрешите уведомления для этого сайта в настройках браузера.';
    btn.disabled = true;
    return;
  }
  btn.disabled = false;
  if (localStorage.getItem(ADMIN_NOTIFY_LS) === '1' && Notification.permission === 'granted') {
    btn.textContent = 'Уведомления включены';
    btn.classList.remove('btn--primary');
    hint.textContent = 'Проверка каждые ~26 с. Вкладка может быть в фоне.';
  } else {
    btn.textContent = 'Включить о новых записях';
    btn.classList.add('btn--primary');
    hint.textContent = '';
  }
}

function initAdminNotifyStrip() {
  const btn = document.getElementById('btnAdminBrowserNotify');
  if (!btn) return;
  btn.onclick = async () => {
    if (typeof Notification === 'undefined') return;
    const p = await Notification.requestPermission();
    updateAdminNotifyStripUI();
    if (p !== 'granted') return;
    localStorage.setItem(ADMIN_NOTIFY_LS, '1');
    startAdminNotifyPolling();
    updateAdminNotifyStripUI();
  };
  updateAdminNotifyStripUI();
  if (localStorage.getItem(ADMIN_NOTIFY_LS) === '1' && Notification.permission === 'granted') {
    startAdminNotifyPolling();
  }
}

async function initApp() {
  try {
    if (!adminKey) throw new Error('UNAUTHORIZED');
    await api('/settings'); // Проверяем валидность ключа
    initAdminNotifyStrip();
    showScreen('services');
  } catch (e) {
    // Если ключ неверный или отсутствует, показываем модалку входа
    document.getElementById('adminModal').classList.remove('hidden');
    const cancelBtn = document.getElementById('btnCancelAdmin');
    if (cancelBtn) cancelBtn.classList.add('hidden'); // Отмена невозможна, пока не войдём
  }
}

initApp();
