const API_BASE = '/admin/api';
let adminKey = localStorage.getItem('adminKey') || '';

const PROTECTED_PAGES = new Set(['settings']);

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
  if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
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
    candidates: loadCandidates,
    settings: loadSettings,
  };
  if (loaders[name]) loaders[name]();
}

/* ── Services ── */
async function loadServices() {
  try {
    const list = await api('/services');
    const html = list.map(s => `
      <div class="card" data-id="${s.id}">
        <div class="card-row">
          ${s.image_url
            ? `<img class="service-thumb" src="${escapeAttr(s.image_url)}" alt="" width="80" height="80" loading="lazy" decoding="async" onerror="this.style.display='none'">`
            : '<div class="service-thumb-ph">🔧</div>'}
          <div class="card-row-body">
            <div class="card-header">
              <h4>${escapeHtml(s.name)}</h4>
              <span class="status ${s.is_active ? 'in_progress' : 'cancelled'}">${s.is_active ? 'Активна' : 'Скрыта'}</span>
            </div>
            <p class="card-meta">${escapeHtml(s.description || '')} · ${s.price} ₽ · ${s.duration} мин · ${escapeHtml(s.category || '')}</p>
            <div class="btn-group">
              <button class="btn btn--sm" onclick="editService('${s.id}')">Изменить</button>
              <button class="btn btn--sm btn--danger" onclick="deleteService('${s.id}')">Удалить</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
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
      <p class="card-meta">${formatDateTime(b.date_time)} · ${b.price} ₽</p>
      <div class="btn-group">
        ${['pending','confirmed','in_progress','completed'].includes(b.status) ? `
          ${b.status !== 'confirmed' ? `<button class="btn btn--sm btn--primary" onclick="setStatus('${escapeAttr(b.id)}','confirmed')">Подтвердить</button>` : ''}
          ${b.status !== 'in_progress' ? `<button class="btn btn--sm" onclick="setStatus('${escapeAttr(b.id)}','in_progress')">В процессе</button>` : ''}
          ${b.status !== 'completed' ? `<button class="btn btn--sm" onclick="setStatus('${escapeAttr(b.id)}','completed')">Завершить</button>` : ''}
          ${!['cancelled','completed'].includes(b.status) ? `<button class="btn btn--sm btn--danger" onclick="setStatus('${escapeAttr(b.id)}','cancelled')">Отменить</button>` : ''}
        ` : ''}
        ${renderContactButtons(b.phone, b.email, b.social_links)}
        ${b.status === 'completed' ? `<a class="btn btn--sm" href="/admin/api/bookings/${encodeURIComponent(b.id)}/act" target="_blank" rel="noopener">Акт</a>` : ''}
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

/* ── Clients ── */
async function loadClients() {
  try {
    const list = await api('/clients');
    const html = list.map(c => `
      <div class="card">
        <div class="card-header">
          <h4>${escapeHtml(c.first_name || '')} ${escapeHtml(c.last_name || '') || 'Клиент'}</h4>
        </div>
        <p class="card-meta">${renderContactLine(c.phone, c.email, c.social_links)}</p>
        ${typeof c.loyalty_points === 'number' ? `<p class="hint">Баллы: ${c.loyalty_points}</p>` : ''}
        <p class="hint">ID: ${escapeHtml(c.id)} · ${c.created_at?.slice(0,10)}</p>
        <div class="btn-group">
          ${renderContactButtons(c.phone, c.email, c.social_links)}
          <button class="btn btn--sm" onclick="openNotify('${c.id}')">Сообщение</button>
        </div>
      </div>
    `).join('');
    document.getElementById('clientsList').innerHTML = html || emptyState('Нет клиентов');
  } catch (e) {
    document.getElementById('clientsList').innerHTML = errorHtml(e);
  }
}

/* ── Settings ── */
async function loadSettings() {
  try {
    const s = await api('/settings');
    document.getElementById('apiBaseUrl').value = s.api_base_url || '';
    const baseUrl = s.api_base_url || (window.location.origin + '/api/v1');
    document.getElementById('localUrl').textContent = window.location.origin + '/api/v1';
    QRCode.toCanvas(document.createElement('canvas'), baseUrl, { width: 200 }, (err, canvas) => {
      if (!err) {
        document.getElementById('qrcodeContainer').innerHTML = '';
        document.getElementById('qrcodeContainer').appendChild(canvas);
      }
    });
  } catch (e) {
    document.getElementById('qrcodeContainer').innerHTML = errorHtml(e);
  }
}

/* ── Posts ── */
async function loadPosts() {
  try {
    const list = await api('/posts');
    const html = list.map(p => `
      <div class="card" data-id="${p.id}">
        <div class="card-header">
          <h4>${escapeHtml(p.name)}</h4>
          <span class="status ${p.is_enabled ? 'in_progress' : 'cancelled'}">${p.is_enabled ? 'Включен' : 'Выключен'}</span>
        </div>
        <div class="grid">
          <label>Название</label>
          <input type="text" data-field="name" value="${escapeAttr(p.name)}">
          <label>Включен</label>
          <input type="checkbox" data-field="is_enabled" ${p.is_enabled ? 'checked' : ''}>
          <label>Начало</label>
          <input type="text" data-field="start_time" value="${escapeAttr(p.start_time || '')}">
          <label>Конец</label>
          <input type="text" data-field="end_time" value="${escapeAttr(p.end_time || '')}">
          <label>Интервал (мин)</label>
          <input type="number" data-field="interval_minutes" value="${p.interval_minutes || 30}">
        </div>
        <div class="btn-group">
          <button class="btn btn--sm btn--primary" onclick="savePost('${p.id}')">Сохранить</button>
        </div>
      </div>
    `).join('');
    document.getElementById('postsList').innerHTML = html || emptyState('Нет постов');
  } catch (e) {
    document.getElementById('postsList').innerHTML = errorHtml(e);
  }
}

async function savePost(id) {
  const card = document.querySelector(`#postsList .card[data-id="${id}"]`);
  if (!card) return;
  const body = {};
  card.querySelectorAll('[data-field]').forEach(el => {
    const f = el.dataset.field;
    if (el.type === 'checkbox') body[f] = el.checked;
    else if (el.type === 'number') body[f] = parseInt(el.value) || 0;
    else body[f] = el.value;
  });
  await api('/posts/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(body) });
  loadPosts();
}

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

function updateServiceImagePreview(url) {
  const box = document.getElementById('serviceImagePreview');
  if (url) {
    box.innerHTML = `<img src="${escapeAttr(url)}" alt="" onerror="this.parentNode.innerHTML='📷'">`;
  } else {
    box.innerHTML = '📷';
  }
}

document.getElementById('serviceImageFile').onchange = async function () {
  const file = this.files?.[0];
  if (!file) return;
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

document.getElementById('serviceImageUrl').onchange = function () {
  updateServiceImagePreview(this.value.trim());
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
  if (!confirm('Удалить услугу?')) return;
  await api('/services/' + id, { method: 'DELETE' });
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

document.getElementById('btnSaveSettings').onclick = async () => {
  const url = document.getElementById('apiBaseUrl').value.trim();
  await api('/settings', { method: 'PUT', body: JSON.stringify({ api_base_url: url }) });
  loadSettings();
};

document.getElementById('btnAddNews').onclick = () => openNewsModal(null);
document.getElementById('btnAddReward').onclick = () => openRewardModal(null);

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

showScreen('services');
