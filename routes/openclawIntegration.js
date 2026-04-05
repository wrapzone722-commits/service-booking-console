/**
 * Манифест интеграции с OpenClaw (https://openclaw.ai) — REST-админка как «инструменты» ассистента.
 * Агент на машине администратора вызывает curl/fetch с заголовком X-Admin-Key.
 */
export function getOpenclawManifest(req, res) {
  const xfProto = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(xfProto) ? xfProto[0] : xfProto) || req.protocol || 'https';
  const host = req.get('host') || 'localhost:3000';
  const origin = `${proto}://${host}`;
  const adminApi = `${origin}/admin/api`;
  const clientApi = `${origin}/api/v1`;

  const adminEndpoints = [
    {
      id: 'services_list',
      method: 'GET',
      path: '/services',
      description: 'Список услуг (каталог)',
    },
    {
      id: 'services_create',
      method: 'POST',
      path: '/services',
      body: { name: 'string', description: 'string', price: 'number', duration: 'number', category: 'string', image_url: 'string|null', is_active: 'boolean' },
    },
    {
      id: 'services_update',
      method: 'PUT',
      path: '/services/:id',
      body: { name: 'string', description: 'string', price: 'number', duration: 'number', category: 'string', image_url: 'string|null', is_active: 'boolean' },
    },
    {
      id: 'services_delete',
      method: 'DELETE',
      path: '/services/:id',
      query: { force: '1 optional — удалить вместе с записями' },
    },
    {
      id: 'bookings_list',
      method: 'GET',
      path: '/bookings',
      query: { status: 'pending|confirmed|in_progress|completed|cancelled', date: 'YYYY-MM-DD', client_id: 'uuid', sort: 'created', limit: 'number' },
    },
    {
      id: 'booking_status',
      method: 'PATCH',
      path: '/bookings/:id/status',
      body: { status: 'pending|confirmed|in_progress|completed|cancelled' },
    },
    {
      id: 'booking_act',
      method: 'GET',
      path: '/bookings/:id/act',
      description: 'PDF/HTML акта',
    },
    {
      id: 'clients_list',
      method: 'GET',
      path: '/clients',
    },
    {
      id: 'client_get',
      method: 'GET',
      path: '/clients/:id',
    },
    {
      id: 'posts_list',
      method: 'GET',
      path: '/posts',
    },
    {
      id: 'posts_update',
      method: 'PUT',
      path: '/posts/:id',
      body: {
        name: 'string',
        is_enabled: 'boolean',
        use_custom_hours: 'boolean',
        start_time: 'HH:MM',
        end_time: 'HH:MM',
        interval_minutes: 'number',
        disabled_slot_times: 'string[] HH:MM',
      },
    },
    {
      id: 'car_folders_list',
      method: 'GET',
      path: '/car-folders',
      requires_admin_key: true,
    },
    {
      id: 'car_folders_crud',
      method: 'POST|PUT|DELETE',
      path: '/car-folders',
      requires_admin_key: true,
    },
    {
      id: 'news_crud',
      method: 'GET|POST|PUT|DELETE',
      path: '/news',
    },
    {
      id: 'rewards_crud',
      method: 'GET|POST|PUT|DELETE',
      path: '/rewards',
    },
    {
      id: 'notifications_send',
      method: 'POST',
      path: '/notifications',
      body: { client_id: 'uuid', body: 'string', title: 'string|null' },
    },
    {
      id: 'invite_codes',
      method: 'GET|POST|PATCH|DELETE',
      path: '/invite-codes',
      requires_admin_key: true,
    },
    {
      id: 'candidates',
      method: 'GET|PATCH|DELETE',
      path: '/candidates',
    },
    {
      id: 'settings',
      method: 'GET|PUT',
      path: '/settings',
      requires_admin_key: true,
    },
    {
      id: 'upload_image',
      method: 'POST',
      path: '/upload/image',
      requires_admin_key: true,
      description: 'multipart/form-data, field image',
    },
    {
      id: 'image_preview',
      method: 'GET',
      path: '/image/preview',
      requires_admin_key: true,
      query: { src: 'url', w: 'width px' },
    },
  ];

  res.json({
    name: 'service-booking-console',
    version: '1.0.0',
    description:
      'Интеграция веб-консоли записи (Другое место) с OpenClaw: администрирование через HTTP и заголовок X-Admin-Key.',
    openclaw: {
      website: 'https://openclaw.ai',
      docs: 'https://docs.openclaw.ai',
      install_hint: 'npm i -g openclaw@latest && openclaw onboard --install-daemon',
    },
    connection: {
      admin_api_base: adminApi,
      client_api_base: clientApi,
      admin_authentication: {
        type: 'http_header',
        header: 'X-Admin-Key',
        value_note: 'Тот же пароль, что для защищённых разделов админки (Настройки, Автомобили, Приглашения). Храните только в OpenClaw workspace / .env, не коммитьте.',
      },
      client_authentication: {
        type: 'http_header',
        header: 'X-API-Key',
        note: 'Ключ устройства из приложения iOS (для отладки клиентского API).',
      },
    },
    environment_template: {
      SERVICE_BOOKING_ADMIN_URL: adminApi,
      SERVICE_BOOKING_ADMIN_KEY: '<paste-admin-password>',
    },
    admin_endpoints: adminEndpoints,
    curl_examples: {
      fetch_manifest: `curl -sS -H "X-Admin-Key: YOUR_KEY" "${adminApi}/integration/openclaw"`,
      list_bookings: `curl -sS -H "X-Admin-Key: YOUR_KEY" "${adminApi}/bookings"`,
      list_bookings_newest: `curl -sS -H "X-Admin-Key: YOUR_KEY" "${adminApi}/bookings?sort=created&limit=5"`,
      patch_booking: `curl -sS -X PATCH -H "X-Admin-Key: YOUR_KEY" -H "Content-Type: application/json" -d '{"status":"confirmed"}' "${adminApi}/bookings/BOOKING_ID/status"`,
      list_services: `curl -sS -H "X-Admin-Key: YOUR_KEY" "${adminApi}/services"`,
      list_posts: `curl -sS -H "X-Admin-Key: YOUR_KEY" "${adminApi}/posts"`,
      get_settings: `curl -sS -H "X-Admin-Key: YOUR_KEY" "${adminApi}/settings"`,
    },
    public_client_api: {
      invite_preview_no_auth: `GET ${clientApi}/invites/preview?code=CODE`,
      note: 'Остальные /api/v1/* требуют X-API-Key клиента.',
    },
    skill_file_in_repo: 'web-console/openclaw/SKILL.md',
  });
}
