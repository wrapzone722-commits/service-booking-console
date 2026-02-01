import { useEffect, useState } from "react";
import type { TelegramBotSettings } from "@shared/api";

type BotInfo = { configured: boolean; bot_username: string | null; bot_link: string | null };

export default function TelegramBot() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [settings, setSettings] = useState<TelegramBotSettings | null>(null);
  const [accountTelegramId, setAccountTelegramId] = useState<string | null>(null);
  const [newChatId, setNewChatId] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);

  useEffect(() => {
    document.title = "ServiceBooking — Telegram Бот";
  }, []);

  useEffect(() => {
    fetchAll();
  }, []);

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("session_token")}`,
  });

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("session_token");
      const [botRes, settingsRes, meRes] = await Promise.all([
        fetch("/api/v1/telegram/bot-info"),
        fetch("/api/v1/telegram/settings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (botRes.ok) setBotInfo(await botRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (meRes.ok) {
        const me = await meRes.json();
        setAccountTelegramId(me.telegram_id ?? null);
      }
    } catch (e) {
      console.error(e);
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/v1/telegram/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || "Ошибка сохранения");
      }
      setSettings(await res.json());
      setSuccess("Настройки сохранены");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const addChatId = (chatId: string) => {
    if (!settings || !chatId.trim()) return;
    const id = chatId.trim();
    if (settings.admin_chat_ids.includes(id)) return;
    setSettings({ ...settings, admin_chat_ids: [...settings.admin_chat_ids, id] });
  };

  const removeChatId = (chatId: string) => {
    if (!settings) return;
    setSettings({ ...settings, admin_chat_ids: settings.admin_chat_ids.filter((c) => c !== chatId) });
  };

  const sendTest = async () => {
    try {
      setTestLoading(true);
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/v1/telegram/send-test", { method: "POST", headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Ошибка отправки");
      setSuccess(`Тест отправлен (${data.sent}/${data.total})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setTestLoading(false);
    }
  };

  const setWebhook = async () => {
    try {
      setWebhookLoading(true);
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/v1/telegram/set-webhook", { method: "POST", headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Ошибка");
      setSuccess(`Webhook настроен: ${data.webhook_url}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка настройки webhook");
    } finally {
      setWebhookLoading(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-muted-foreground">Загрузка…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">Telegram Бот</h1>
          <p className="text-xs text-muted-foreground mt-1">Уведомления о записях и настройки бота</p>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-2xl space-y-6">
        {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
        {success && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

        {/* Bot status */}
        <div className="bg-white rounded-lg border border-border p-4">
          <h2 className="text-sm font-bold text-foreground mb-3">Статус бота</h2>
          {botInfo?.configured ? (
            <div className="space-y-2">
              <p className="text-sm text-green-700 font-semibold">✓ Бот подключен</p>
              {botInfo.bot_link && (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={botInfo.bot_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600"
                  >
                    Открыть @{botInfo.bot_username}
                  </a>
                  <button
                    onClick={setWebhook}
                    disabled={webhookLoading}
                    className="px-3 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold hover:bg-gray-300 disabled:opacity-50"
                  >
                    {webhookLoading ? "…" : "Подключить webhook"}
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Webhook нужен, чтобы при отправке /start боту ваш Chat ID добавлялся автоматически.
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-700">Бот не настроен. Укажите TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME в переменных окружения.</p>
          )}
        </div>

        {/* Enable */}
        <div className="bg-white rounded-lg border border-border p-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="font-semibold">Включить уведомления</span>
          </label>
        </div>

        {/* Admin Chat IDs */}
        <div className="bg-white rounded-lg border border-border p-4">
          <h2 className="text-sm font-bold text-foreground mb-3">Получатели уведомлений (Chat ID)</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Отправьте <code className="bg-gray-100 px-1 rounded">/start</code> боту в Telegram — ваш Chat ID добавится автоматически. Или введите вручную.
          </p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newChatId}
              onChange={(e) => setNewChatId(e.target.value)}
              placeholder="123456789"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-border"
              onKeyDown={(e) => e.key === "Enter" && (addChatId(newChatId), setNewChatId(""))}
            />
            <button onClick={() => { addChatId(newChatId); setNewChatId(""); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm">
              Добавить
            </button>
          </div>
          {accountTelegramId && !settings.admin_chat_ids.includes(accountTelegramId) && (
            <button
              onClick={() => addChatId(accountTelegramId)}
              className="text-sm text-blue-600 hover:underline mb-2"
            >
              + Добавить мой Chat ID (войти через Telegram)
            </button>
          )}
          <div className="space-y-1">
            {settings.admin_chat_ids.map((id) => (
              <div key={id} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded">
                <span className="font-mono text-sm">{id}</span>
                <button onClick={() => removeChatId(id)} className="text-red-600 text-xs hover:underline">
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Notification types */}
        <div className="bg-white rounded-lg border border-border p-4">
          <h2 className="text-sm font-bold text-foreground mb-4">Уведомления</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_new_booking}
                onChange={(e) => setSettings({ ...settings, notify_new_booking: e.target.checked })}
                className="h-4 w-4"
              />
              <span>🆕 Новая запись</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_booking_cancelled}
                onChange={(e) => setSettings({ ...settings, notify_booking_cancelled: e.target.checked })}
                className="h-4 w-4"
              />
              <span>❌ Отмена записи</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_booking_confirmed}
                onChange={(e) => setSettings({ ...settings, notify_booking_confirmed: e.target.checked })}
                className="h-4 w-4"
              />
              <span>✅ Подтверждение записи</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notify_daily_summary}
                onChange={(e) => setSettings({ ...settings, notify_daily_summary: e.target.checked })}
                className="h-4 w-4"
              />
              <span>📋 Ежедневная сводка</span>
            </label>
            {settings.notify_daily_summary && (
              <div className="ml-6 flex items-center gap-2">
                <label htmlFor="daily-summary-hour" className="text-sm">Время:</label>
                <input
                  id="daily-summary-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={settings.daily_summary_hour}
                  onChange={(e) => setSettings({ ...settings, daily_summary_hour: parseInt(e.target.value, 10) || 0 })}
                  className="w-16 px-2 py-1 text-sm rounded border border-border"
                  aria-label="Час ежедневной сводки"
                />
                <span className="text-sm text-muted-foreground">ч</span>
              </div>
            )}
          </div>
        </div>

        {/* Reminders (future) */}
        <div className="bg-white rounded-lg border border-border p-4 opacity-75">
          <h2 className="text-sm font-bold text-foreground mb-2">Напоминания клиентам</h2>
          <p className="text-xs text-muted-foreground mb-2">Скоро: автоматические напоминания за 24 ч и 1 ч до записи</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.reminders_enabled}
              onChange={(e) => setSettings({ ...settings, reminders_enabled: e.target.checked })}
              className="h-4 w-4"
              disabled
            />
            <span className="text-muted-foreground">Включить (в разработке)</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
          <button
            onClick={sendTest}
            disabled={testLoading || !settings.admin_chat_ids.length}
            className="px-5 py-2.5 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 disabled:opacity-50"
          >
            {testLoading ? "Отправка…" : "Отправить тест"}
          </button>
        </div>
      </div>
    </div>
  );
}
