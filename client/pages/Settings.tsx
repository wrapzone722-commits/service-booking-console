import { useEffect, useMemo, useState } from "react";
import type { DisplayPhotoRule } from "@shared/api";

export default function Settings() {
  const [apiUrl, setApiUrl] = useState("");
  const [apiUrlLoaded, setApiUrlLoaded] = useState(false);
  const [token, setToken] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [displayRule, setDisplayRule] = useState<DisplayPhotoRule>({ days_01: 3, days_02: 2, days_03: 1 });
  const [displayRuleLoaded, setDisplayRuleLoaded] = useState(false);
  const [displayRuleSaving, setDisplayRuleSaving] = useState(false);

  useEffect(() => {
    fetch("/api/v1/settings/api-url")
      .then((r) => r.json())
      .then((data) => {
        if (data?.api_url) setApiUrl(data.api_url);
        else setApiUrl(`${window.location.origin}/api/v1`);
      })
      .catch(() => setApiUrl(`${window.location.origin}/api/v1`))
      .finally(() => setApiUrlLoaded(true));
  }, []);

  useEffect(() => {
    fetch("/api/v1/settings/display-photo-rule")
      .then((r) => r.json())
      .then((data) => {
        if (data?.days_01 != null) setDisplayRule({
          days_01: Number(data.days_01) || 3,
          days_02: Number(data.days_02) || 2,
          days_03: Number(data.days_03) || 1,
        });
      })
      .catch(() => {})
      .finally(() => setDisplayRuleLoaded(true));
  }, []);

  const saveDisplayRule = async () => {
    const token = localStorage.getItem("session_token");
    if (!token) return;
    setDisplayRuleSaving(true);
    try {
      const res = await fetch("/api/v1/settings/display-photo-rule", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(displayRule),
      });
      if (res.ok) {
        const data = await res.json();
        setDisplayRule(data);
      }
    } finally {
      setDisplayRuleSaving(false);
    }
  };

  const qrPayloadUrl = useMemo(
    () => apiUrl?.trim() || (apiUrlLoaded ? `${window.location.origin}/api/v1` : ""),
    [apiUrl, apiUrlLoaded]
  );
  const qrPayloadJson = useMemo(
    () => JSON.stringify({ base_url: qrPayloadUrl, ...(token ? { token } : {}) }),
    [qrPayloadUrl, token]
  );
  const qrImageUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrPayloadUrl)}`,
    [qrPayloadUrl]
  );

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3">
          <h1 className="text-2xl font-bold text-foreground">Настройки</h1>
          <p className="text-xs text-muted-foreground">API и подключения</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 space-y-4 max-w-4xl">
        {/* Подключение мобильного приложения */}
        <div className="bg-white rounded-lg shadow-sm border border-border p-4 animate-slide-in">
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <span>📱</span> Подключение мобильного приложения
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            QR-код генерируется на основе URL API текущего сервера. Покажите его клиенту при первом
            запуске iOS-приложения — после сканирования приложение подключится и зарегистрирует устройство.
          </p>

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-shrink-0">
              {qrPayloadUrl ? (
                <img
                  src={qrImageUrl}
                  alt="QR для подключения"
                  className="w-[280px] h-[280px] border border-border rounded-lg bg-white"
                />
              ) : (
                <div className="w-[280px] h-[280px] border border-border rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-sm">
                  Загрузка...
                </div>
              )}
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Базовый URL API
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://your-domain.com/api/v1"
                    aria-label="Базовый URL API"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={() => copyToClipboard(qrPayloadUrl)}
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  >
                    {copiedUrl ? "Скопировано" : "Копировать"}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Токен (опционально)
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Оставьте пустым для автоматической регистрации"
                  aria-label="Токен подключения"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-900 mb-1">Инструкция для клиента:</p>
                <ol className="text-xs text-amber-800 list-decimal list-inside space-y-1">
                  <li>Откройте iOS-приложение при первом запуске</li>
                  <li>Наведите камеру на QR-код</li>
                  <li>Приложение подключится и зарегистрирует устройство</li>
                  <li>После этого доступны услуги, запись и профиль</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Настройки отображения авто (01 → 02 → 03 → 04 по дням после услуги) */}
        <div className="bg-white dark:bg-card rounded-lg shadow-sm border border-border p-4 animate-slide-in">
          <h2 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
            <span>🚗</span> Настройки отображения авто
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            После посещения у клиента всегда показывается файл 01. Далее по дням: 02, 03, 04. Если в папке нет 03 или 04 — показываются имеющиеся файлы с соблюдением порядка.
          </p>
          {displayRuleLoaded && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Дней показывать 01 (после посещения)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={displayRule.days_01}
                  onChange={(e) => setDisplayRule((r) => ({ ...r, days_01: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                  aria-label="Дней 01"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Дней показывать 02</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={displayRule.days_02}
                  onChange={(e) => setDisplayRule((r) => ({ ...r, days_02: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                  aria-label="Дней 02"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Дней показывать 03 (затем 04)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={displayRule.days_03}
                  onChange={(e) => setDisplayRule((r) => ({ ...r, days_03: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background"
                  aria-label="Дней 03"
                />
              </div>
            </div>
          )}
          {displayRuleLoaded && (
            <button
              type="button"
              onClick={saveDisplayRule}
              disabled={displayRuleSaving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {displayRuleSaving ? "Сохранение…" : "Сохранить правило"}
            </button>
          )}
        </div>

        {/* API Config (legacy) */}
        <div className="bg-white rounded-lg shadow-sm border border-border p-4 animate-slide-in">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span>⚙️</span> API Конфигурация
          </h2>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>Формат QR (JSON): <code className="bg-gray-100 px-1 rounded">{qrPayloadJson}</code></p>
            <p>Эндпоинт регистрации: <code className="bg-gray-100 px-1 rounded">POST /clients/register</code></p>
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-white rounded-lg shadow-sm border border-border p-4 animate-slide-in">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span>🕐</span> Рабочее время
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Начало работы
              </label>
              <input
                type="time"
                defaultValue="09:00"
                aria-label="Начало работы"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Конец работы
              </label>
              <input
                type="time"
                defaultValue="18:00"
                aria-label="Конец работы"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Длительность слота (мин)
              </label>
              <input
                type="number"
                defaultValue="30"
                aria-label="Длительность слота"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Выходной день
              </label>
              <select aria-label="Выходной день" className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Не выбрано</option>
                <option>Понедельник</option>
                <option>Вторник</option>
                <option>Среда</option>
                <option>Четверг</option>
                <option>Пятница</option>
                <option>Суббота</option>
                <option>Воскресенье</option>
              </select>
            </div>
          </div>
          <button className="mt-3 w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold">
            Сохранить рабочее время
          </button>
        </div>

        {/* API Docs */}
        <div className="bg-white rounded-lg shadow-sm border border-border p-4 animate-slide-in">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span>🔌</span> API Эндпоинты
          </h2>
          <div className="space-y-2">
            {[
              { method: "GET", endpoint: "/services", desc: "Список услуг" },
              { method: "GET", endpoint: "/bookings", desc: "Список записей" },
              { method: "POST", endpoint: "/bookings", desc: "Новая запись" },
              { method: "DELETE", endpoint: "/bookings/:id", desc: "Отменить запись" },
              { method: "GET", endpoint: "/slots", desc: "Свободные слоты" },
              { method: "GET", endpoint: "/profile", desc: "Профиль" },
              { method: "PUT", endpoint: "/profile", desc: "Обновить профиль" },
              { method: "GET", endpoint: "/notifications", desc: "Уведомления клиента" },
              { method: "PATCH", endpoint: "/notifications/:id/read", desc: "Отметить прочитанным" },
              { method: "GET", endpoint: "/users", desc: "Список клиентов" },
            ].map((api, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-gray-50 transition-colors"
              >
                <span
                  className={`px-2 py-0.5 text-xs font-bold text-white rounded ${
                    api.method === "GET" ? "bg-blue-500" : api.method === "POST" ? "bg-green-500" : api.method === "PUT" || api.method === "PATCH" ? "bg-amber-500" : "bg-red-500"
                  }`}
                >
                  {api.method}
                </span>
                <div className="flex-1 min-w-0">
                  <code className="text-xs font-mono text-muted-foreground truncate block">
                    {api.endpoint}
                  </code>
                  <p className="text-xs text-muted-foreground">{api.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ios-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Версия приложения</p>
          <p className="mt-1 text-sm font-semibold text-foreground">v2.1 • build 2025-02</p>
        </div>
      </div>
    </div>
  );
}
