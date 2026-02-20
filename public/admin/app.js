const API_BASE = '/admin/api';
let adminKey = localStorage.getItem('adminKey') || '';

const PROTECTED_PAGES = new Set(['settings']);

function headers() {
  const h = {
    'Content-Type': 'application/json',
  };
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

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  const el = document.getElementById(name + 'Screen');
  if (el) el.classList.remove('hidden');
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  if (name === 'services') loadServices();
  if (name === 'bookings') loadBookings();
  if (name === 'posts') loadPosts();
  if (name === 'news') loadNews();
  if (name === 'control') loadControl();
  if (name === 'clients') loadClients();
  if (name === 'settings') loadSettings();
}

async function loadServices() {
  try {
    const list = await api('/services');
    const html = list.map(s => `
      <div class="card" data-id="${s.id}">
        <div class="card-header">
          <h4>${escapeHtml(s.name)}</h4>
          <span class="status ${s.is_active ? '' : 'cancelled'}">${s.is_active ? 'Активна' : 'Неактивна'}</span>
        </div>
        <p>${escapeHtml(s.description || '')} · ${s.price} ₽ · ${s.duration} мин · ${escapeHtml(s.category || '')}</p>
        <div class="btn-group">
          <button onclick="editService('${s.id}')">Изменить</button>
          <button class="danger" onclick="deleteService('${s.id}')">Удалить</button>
        </div>
      </div>
    `).join('');
    document.getElementById('servicesList').innerHTML = html || '<p>Нет услуг</p>';
  } catch (e) {
    document.getElementById('servicesList').innerHTML = '<p class="error">' + escapeHtml(e.message) + '</p>';
  }
}

async function loadBookings() {
  const status = document.getElementById('filterStatus').value;
  const date = document.getElementById('filterDate').value;
  let path = '/bookings?';
  if (status) path += 'status=' + encodeURIComponent(status) + '&';
  if (date) path += 'date=' + encodeURIComponent(date) + '&';
  try {
    const list = await api(path);
    const html = list.map(b => `
      <div class="card">
        <div class="card-header">
          <h4>${escapeHtml(b.service_name)}</h4>
          <span class="status ${b.status}">${statusLabel(b.status)}</span>
        </div>
        <p>${escapeHtml(b.first_name || '')} ${escapeHtml(b.last_name || '')} · ${escapeHtml(b.phone || '')}</p>
        <p>${formatDateTime(b.date_time)} · ${b.price} ₽</p>
        <div class="btn-group">
          ${['pending','confirmed','in_progress','completed'].includes(b.status) ? `
            ${b.status !== 'confirmed' ? `<button class="primary" onclick="setStatus('${escapeAttr(b.id)}','confirmed')">Подтвердить</button>` : ''}
            ${b.status !== 'in_progress' ? `<button class="primary" onclick="setStatus('${escapeAttr(b.id)}','in_progress')">В процессе</button>` : ''}
            ${b.status !== 'completed' ? `<button onclick="setStatus('${escapeAttr(b.id)}','completed')">Завершить</button>` : ''}
            ${!['cancelled','completed'].includes(b.status) ? `<button class="danger" onclick="setStatus('${escapeAttr(b.id)}','cancelled')">Отменить</button>` : ''}
          ` : ''}
          ${b.status === 'completed' ? `<a class="btnlink" href="/admin/api/bookings/${encodeURIComponent(b.id)}/act" target="_blank" rel="noopener">Акт</a>` : ''}
          <button onclick="openNotify('${b.user_id}')">Сообщение</button>
        </div>
      </div>
    `).join('');
    document.getElementById('bookingsList').innerHTML = html || '<p>Нет записей</p>';
  } catch (e) {
    document.getElementById('bookingsList').innerHTML = '<p class="error">' + escapeHtml(e.message) + '</p>';
  }
}

async function loadClients() {
  try {
    const list = await api('/clients');
    const html = list.map(c => `
      <div class="card">
        <div class="card-header">
          <h4>${escapeHtml(c.first_name || '')} ${escapeHtml(c.last_name || '') || 'Клиент'}</h4>
        </div>
        <p>${escapeHtml(c.phone || '')} · ${escapeHtml(c.email || '')}</p>
        <p class="hint">ID: ${escapeHtml(c.id)} · ${c.created_at?.slice(0,10)}</p>
        <div class="btn-group">
          <button onclick="openNotify('${c.id}')">Отправить сообщение</button>
        </div>
      </div>
    `).join('');
    document.getElementById('clientsList').innerHTML = html || '<p>Нет клиентов</p>';
  } catch (e) {
    document.getElementById('clientsList').innerHTML = '<p class="error">' + escapeHtml(e.message) + '</p>';
  }
}

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
    document.getElementById('qrcodeContainer').innerHTML = '<p class="error">' + escapeHtml(e.message) + '</p>';
  }
}

async function loadPosts() {
  try {
    const list = await api('/posts');
    const html = list.map(p => `
      <div class="card" data-id="${p.id}">
        <div class="card-header">
          <h4>${escapeHtml(p.name)}</h4>
          <span class="status ${p.is_enabled ? '' : 'cancelled'}">${p.is_enabled ? 'Включен' : 'Выключен'}</span>
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
          <button class="primary" onclick="savePost('${p.id}')">Сохранить</button>
        </div>
      </div>
    `).join('');
    document.getElementById('postsList').innerHTML = html || '<p>Нет постов</p>';
  } catch (e) {
    document.getElementById('postsList').innerHTML = '<p class="error">' + escapeHtml(e.message) + '</p>';
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

async function loadNews() {
  try {
    const list = await api('/news');
    const html = list.map(n => `
      <div class="card" data-id="${n.id}">
        <div class="card-header">
          <h4>${escapeHtml(n.title)}</h4>
          <span class="status ${n.published ? 'confirmed' : 'pending'}">${n.published ? 'Опубликовано' : 'Черновик'}</span>
        </div>
        <p class="hint">${(n.created_at || '').slice(0,19).replace('T',' ')}</p>
        <p>${escapeHtml((n.body || '').slice(0, 200))}${(n.body || '').length > 200 ? '…' : ''}</p>
        <div class="btn-group">
          <button onclick="editNews('${n.id}')">Изменить</button>
          <button class="danger" onclick="deleteNews('${n.id}')">Удалить</button>
        </div>
      </div>
    `).join('');
    document.getElementById('newsList').innerHTML = html || '<p>Нет новостей</p>';
  } catch (e) {
    document.getElementById('newsList').innerHTML = '<p class="error">' + escapeHtml(e.message) + '</p>';
  }
}

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
    if (!n) return;
    openNewsModal(n);
  });
}

async function deleteNews(id) {
  if (!confirm('Удалить новость?')) return;
  await api('/news/' + encodeURIComponent(id), { method: 'DELETE' });
  loadNews();
}

async function loadControl() {
  const date = document.getElementById('controlDate').value;
  const status = document.getElementById('controlStatus').value;
  let path = '/bookings?';
  if (status) path += 'status=' + encodeURIComponent(status) + '&';
  if (date) path += 'date=' + encodeURIComponent(date) + '&';
  try {
    const list = await api(path);
    const html = list.map(b => `
      <div class="card">
        <div class="card-header">
          <h4>${escapeHtml(b.service_name)}</h4>
          <span class="status ${b.status}">${statusLabel(b.status)}</span>
        </div>
        <p>${escapeHtml(b.first_name || '')} ${escapeHtml(b.last_name || '')} · ${escapeHtml(b.phone || '')}</p>
        <p>${formatDateTime(b.date_time)} · ${b.price} ₽</p>
        <div class="btn-group">
          ${['pending','confirmed','in_progress','completed'].includes(b.status) ? `
            ${b.status !== 'confirmed' ? `<button class="primary" onclick="setStatus('${escapeAttr(b.id)}','confirmed')">Подтвердить</button>` : ''}
            ${b.status !== 'in_progress' ? `<button class="primary" onclick="setStatus('${escapeAttr(b.id)}','in_progress')">В процессе</button>` : ''}
            ${b.status !== 'completed' ? `<button onclick="setStatus('${escapeAttr(b.id)}','completed')">Завершить</button>` : ''}
            ${!['cancelled','completed'].includes(b.status) ? `<button class="danger" onclick="setStatus('${escapeAttr(b.id)}','cancelled')">Отменить</button>` : ''}
          ` : ''}
          ${b.status === 'completed' ? `<a class="btnlink" href="/admin/api/bookings/${encodeURIComponent(b.id)}/act" target="_blank" rel="noopener">Акт</a>` : ''}
          <button onclick="openNotify('${b.user_id}')">Сообщение</button>
        </div>
      </div>
    `).join('');
    document.getElementById('controlList').innerHTML = html || '<p>Нет записей</p>';
  } catch (e) {
    document.getElementById('controlList').innerHTML = '<p class="error">' + escapeHtml(e.message) + '</p>';
  }
}

function statusLabel(s) {
  const m = { pending:'Ожидает', confirmed:'Подтверждена', in_progress:'В процессе', completed:'Завершена', cancelled:'Отменена' };
  return m[s] || s;
}

function formatDateTime(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleString('ru-RU');
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

function openAdminModal() {
  document.getElementById('adminPass').value = '';
  document.getElementById('adminError').classList.add('hidden');
  document.getElementById('adminError').textContent = '';
  document.getElementById('adminModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('adminPass').focus(), 50);
}

document.querySelectorAll('.nav button').forEach(b => {
  b.onclick = async () => {
    const page = b.dataset.page;
    if (PROTECTED_PAGES.has(page)) {
      try {
        await ensureAdmin();
        showScreen(page);
      } catch (_) {
        // stay
      }
      return;
    }
    showScreen(page);
  };
});

document.getElementById('btnAddService').onclick = () => {
  document.getElementById('serviceId').value = '';
  document.getElementById('serviceModalTitle').textContent = 'Добавить услугу';
  document.getElementById('serviceName').value = '';
  document.getElementById('serviceDescription').value = '';
  document.getElementById('servicePrice').value = '0';
  document.getElementById('serviceDuration').value = '60';
  document.getElementById('serviceCategory').value = 'Автоуслуги';
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

document.getElementById('btnCancelService').onclick = () => {
  document.getElementById('serviceModal').classList.add('hidden');
};

document.getElementById('filterStatus').onchange = loadBookings;
document.getElementById('filterDate').onchange = loadBookings;

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

document.getElementById('btnCancelNotify').onclick = () => {
  document.getElementById('notifyModal').classList.add('hidden');
};

document.getElementById('btnSaveSettings').onclick = async () => {
  const url = document.getElementById('apiBaseUrl').value.trim();
  await api('/settings', { method: 'PUT', body: JSON.stringify({ api_base_url: url }) });
  loadSettings();
};

document.getElementById('btnAddNews').onclick = () => openNewsModal(null);

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

document.getElementById('btnCancelNews').onclick = () => {
  document.getElementById('newsModal').classList.add('hidden');
};

document.getElementById('btnControlRefresh').onclick = loadControl;

// default control date = today
document.getElementById('controlDate').value = new Date().toISOString().slice(0,10);
document.getElementById('controlStatus').onchange = loadControl;
document.getElementById('controlDate').onchange = loadControl;

document.getElementById('adminForm').onsubmit = async (e) => {
  e.preventDefault();
  const pass = document.getElementById('adminPass').value;
  await trySetAdminKey(pass);
  document.getElementById('adminModal').classList.add('hidden');
};

document.getElementById('btnCancelAdmin').onclick = () => {
  document.getElementById('adminModal').classList.add('hidden');
};

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
    errEl.textContent = 'Ошибка';
    errEl.classList.remove('hidden');
    throw new Error('EMPTY');
  }
  // validate against protected endpoint
  try {
    await api('/settings');
    localStorage.setItem('adminKey', adminKey);
  } catch (e) {
    adminKey = '';
    localStorage.removeItem('adminKey');
    errEl.textContent = 'Ошибка';
    errEl.classList.remove('hidden');
    openAdminModal();
    throw e;
  }
}

showScreen('services');
