import { useEffect, useState } from "react";
import type { TelegramBotSettings } from "@shared/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type BotInfo = { configured: boolean; bot_username: string | null; bot_link: string | null };

const VAR_HINT = "{{user_name}} {{service_name}} {{date_time}} {{price}} {{notes}}";

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

  // AI assistant
  const [aiContext, setAiContext] = useState("");
  const [aiType, setAiType] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiTargetField, setAiTargetField] = useState<string | null>(null);

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
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setSettings({
          ...s,
          welcome_message: s.welcome_message ?? "👋 Добро пожаловать! Вы подключены к уведомлениям о записях.",
          template_new_booking: s.template_new_booking ?? "",
          template_booking_cancelled: s.template_booking_cancelled ?? "",
          template_booking_confirmed: s.template_booking_confirmed ?? "",
          template_daily_summary: s.template_daily_summary ?? "",
          template_reminder: s.template_reminder ?? "",
        });
      }
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

  const generateWithAi = async (targetField?: string) => {
    try {
      setAiLoading(true);
      setAiResult(null);
      const res = await fetch("/api/v1/telegram/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getHeaders() },
        body: JSON.stringify({
          context: aiContext.trim() || undefined,
          type: aiType || undefined,
          sample: { user_name: "Иван", service_name: "Экспресс-мойка", date_time: "01.02.2026, 10:00", price: "1500" },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Ошибка");
      setAiResult(data.message || "");
      setAiTargetField(targetField ?? null);
    } catch (e) {
      setAiResult("");
      setError(e instanceof Error ? e.message : "Ошибка генерации");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiToField = (field: keyof TelegramBotSettings) => {
    if (!settings || !aiResult) return;
    setSettings({ ...settings, [field]: aiResult });
    setAiTargetField(null);
    setAiResult(null);
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Загрузка…</div>
      </div>
    );
  }

  const card = "bg-white dark:bg-card rounded-lg border border-border p-4";
  const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary dark:bg-card";
  const labelCls = "block text-xs font-semibold text-muted-foreground mb-1";

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-white dark:bg-card border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3">
          <h1 className="text-2xl font-bold text-foreground">Telegram Бот</h1>
          <p className="text-xs text-muted-foreground">Уведомления, шаблоны сообщений, AI-ассистент</p>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-3xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        <Tabs defaultValue="main" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1 mb-4 bg-muted">
            <TabsTrigger value="main" className="flex-1 min-w-[90px]">Основные</TabsTrigger>
            <TabsTrigger value="notify" className="flex-1 min-w-[90px]">Уведомления</TabsTrigger>
            <TabsTrigger value="templates" className="flex-1 min-w-[90px]">Шаблоны</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1 min-w-[90px]">AI-ассистент</TabsTrigger>
            <TabsTrigger value="extra" className="flex-1 min-w-[90px]">Дополнительно</TabsTrigger>
          </TabsList>

          {/* Основные */}
          <TabsContent value="main" className="mt-0 space-y-4">
            <div className={card}>
              <h2 className="text-sm font-bold text-foreground mb-3">Статус бота</h2>
              {botInfo?.configured ? (
                <div className="space-y-2">
                  <p className="text-sm text-green-700 dark:text-green-400 font-semibold">✓ Бот подключен</p>
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
                        className="px-3 py-2 bg-muted text-foreground rounded-lg text-sm font-semibold hover:bg-muted/80 disabled:opacity-50"
                      >
                        {webhookLoading ? "…" : "Подключить webhook"}
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Webhook нужен, чтобы при /start боту ваш Chat ID добавлялся и отправлялось приветствие.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Бот не настроен. Укажите TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME в переменных окружения.
                </p>
              )}
            </div>

            <div className={card}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
                <span className="font-semibold">Включить уведомления</span>
              </label>
            </div>

            <div className={card}>
              <h2 className="text-sm font-bold text-foreground mb-3">Получатели (Chat ID)</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Отправьте <code className="bg-muted px-1 rounded">/start</code> боту — Chat ID добавится автоматически.
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  placeholder="123456789"
                  className={`${inputCls} flex-1`}
                  onKeyDown={(e) => e.key === "Enter" && (addChatId(newChatId), setNewChatId(""))}
                />
                <button
                  onClick={() => {
                    addChatId(newChatId);
                    setNewChatId("");
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm"
                >
                  Добавить
                </button>
              </div>
              {accountTelegramId && !settings.admin_chat_ids.includes(accountTelegramId) && (
                <button
                  onClick={() => addChatId(accountTelegramId)}
                  className="text-sm text-primary hover:underline mb-2"
                >
                  + Добавить мой Chat ID
                </button>
              )}
              <div className="space-y-1">
                {settings.admin_chat_ids.map((id) => (
                  <div key={id} className="flex items-center justify-between py-1 px-2 bg-muted rounded">
                    <span className="font-mono text-sm">{id}</span>
                    <button onClick={() => removeChatId(id)} className="text-red-600 text-xs hover:underline">
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Уведомления */}
          <TabsContent value="notify" className="mt-0 space-y-4">
            <div className={card}>
              <h2 className="text-sm font-bold text-foreground mb-4">Типы уведомлений</h2>
              <div className="space-y-3">
                {[
                  { key: "notify_new_booking", label: "🆕 Новая запись", checked: settings.notify_new_booking },
                  { key: "notify_booking_cancelled", label: "❌ Отмена записи", checked: settings.notify_booking_cancelled },
                  { key: "notify_booking_confirmed", label: "✅ Подтверждение записи", checked: settings.notify_booking_confirmed },
                  { key: "notify_daily_summary", label: "📋 Ежедневная сводка", checked: settings.notify_daily_summary },
                ].map(({ key, label, checked }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                      className="h-4 w-4 rounded"
                    />
                    <span>{label}</span>
                  </label>
                ))}
                {settings.notify_daily_summary && (
                  <div className="ml-6 flex items-center gap-2">
                    <label htmlFor="daily-summary-hour" className="text-sm">
                      Время:
                    </label>
                    <input
                      id="daily-summary-hour"
                      type="number"
                      min={0}
                      max={23}
                      value={settings.daily_summary_hour}
                      onChange={(e) => setSettings({ ...settings, daily_summary_hour: parseInt(e.target.value, 10) || 0 })}
                      className="w-16 px-2 py-1 text-sm rounded border border-border"
                    />
                    <span className="text-sm text-muted-foreground">ч</span>
                  </div>
                )}
              </div>
            </div>

            <div className={card}>
              <h2 className="text-sm font-bold text-foreground mb-2">Напоминания клиентам</h2>
              <p className="text-xs text-muted-foreground mb-2">За сколько часов до записи напоминать (в разработке)</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.reminders_enabled}
                  onChange={(e) => setSettings({ ...settings, reminders_enabled: e.target.checked })}
                  className="h-4 w-4 rounded"
                  disabled
                />
                <span className="text-muted-foreground">Включить</span>
              </label>
              <p className="text-xs text-muted-foreground mt-2">
                Часы: {settings.reminder_hours_before.join(", ")}
              </p>
            </div>
          </TabsContent>

          {/* Шаблоны */}
          <TabsContent value="templates" className="mt-0 space-y-4">
            <p className="text-xs text-muted-foreground">
              Переменные: {VAR_HINT}. Оставьте пустым — используется шаблон по умолчанию.
            </p>
            <div className={card}>
              <label className={labelCls}>Приветствие при /start</label>
              <textarea
                value={settings.welcome_message ?? ""}
                onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                rows={2}
                className={inputCls}
                placeholder="👋 Добро пожаловать! Вы подключены к уведомлениям."
              />
            </div>
            <div className={card}>
              <label className={labelCls}>Новая запись</label>
              <textarea
                value={settings.template_new_booking ?? ""}
                onChange={(e) => setSettings({ ...settings, template_new_booking: e.target.value })}
                rows={4}
                className={inputCls}
                placeholder="🆕 Новая запись&#10;&#10;👤 {{user_name}}&#10;📋 {{service_name}}&#10;📅 {{date_time}}&#10;💰 {{price}} ₽"
              />
            </div>
            <div className={card}>
              <label htmlFor="tpl-cancelled" className={labelCls}>Отмена записи</label>
              <textarea
                id="tpl-cancelled"
                value={settings.template_booking_cancelled ?? ""}
                onChange={(e) => setSettings({ ...settings, template_booking_cancelled: e.target.value })}
                rows={3}
                className={inputCls}
                placeholder="❌ Запись отменена..."
              />
            </div>
            <div className={card}>
              <label htmlFor="tpl-confirmed" className={labelCls}>Подтверждение записи</label>
              <textarea
                id="tpl-confirmed"
                value={settings.template_booking_confirmed ?? ""}
                onChange={(e) => setSettings({ ...settings, template_booking_confirmed: e.target.value })}
                rows={3}
                className={inputCls}
                placeholder="✅ Запись подтверждена..."
              />
            </div>
          </TabsContent>

          {/* AI-ассистент */}
          <TabsContent value="ai" className="mt-0 space-y-4">
            <div className={card}>
              <h2 className="text-sm font-bold text-foreground mb-2">AI — генерация и анализ сообщений</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Опишите задачу или выберите тип — ИИ предложит текст для Telegram.
              </p>
              <div className="space-y-2 mb-3">
                <select
                  value={aiType}
                  onChange={(e) => setAiType(e.target.value)}
                  className={inputCls}
                  aria-label="Тип сообщения для AI"
                >
                  <option value="">— Выберите тип —</option>
                  <option value="new_booking">Уведомление о новой записи</option>
                  <option value="cancelled">Уведомление об отмене</option>
                  <option value="confirmed">Подтверждение записи</option>
                  <option value="reminder">Напоминание о записи</option>
                  <option value="welcome">Приветствие при /start</option>
                </select>
                <textarea
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  rows={2}
                  className={inputCls}
                  placeholder="Или опишите своими словами: например, «дружелюбное уведомление о новой записи с эмодзи»"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => generateWithAi()}
                  disabled={aiLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm disabled:opacity-50"
                >
                  {aiLoading ? "Генерация…" : "🤖 Сгенерировать"}
                </button>
              </div>
              {aiResult && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Результат:</p>
                  <p className="text-sm whitespace-pre-wrap mb-3">{aiResult}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => applyAiToField("welcome_message")}
                      className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded"
                    >
                      → Приветствие
                    </button>
                    <button
                      onClick={() => applyAiToField("template_new_booking")}
                      className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded"
                    >
                      → Новая запись
                    </button>
                    <button
                      onClick={() => applyAiToField("template_booking_cancelled")}
                      className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded"
                    >
                      → Отмена
                    </button>
                    <button
                      onClick={() => applyAiToField("template_booking_confirmed")}
                      className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded"
                    >
                      → Подтверждение
                    </button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Дополнительно */}
          <TabsContent value="extra" className="mt-0 space-y-4">
            <div className={card}>
              <h2 className="text-sm font-bold text-foreground mb-2">Действия</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Сохранение…" : "Сохранить всё"}
                </button>
                <button
                  onClick={sendTest}
                  disabled={testLoading || !settings.admin_chat_ids.length}
                  className="px-5 py-2.5 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/80 disabled:opacity-50"
                >
                  {testLoading ? "Отправка…" : "Отправить тест"}
                </button>
              </div>
            </div>
            <div className={card}>
              <h2 className="text-sm font-bold text-foreground mb-2">Возможности бота</h2>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Уведомления о новых записях, отменах, подтверждениях</li>
                <li>Ежедневная сводка в заданное время</li>
                <li>Настраиваемые шаблоны сообщений</li>
                <li>Приветствие при /start</li>
                <li>AI-ассистент для составления текстов</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
