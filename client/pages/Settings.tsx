import { useMemo, useState } from "react";

export default function Settings() {
  const [apiUrl, setApiUrl] = useState("https://example.com/api/v1");
  const [token, setToken] = useState("optional_token");
  const [copiedQR, setCopiedQR] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const apiConfig = useMemo(() => ({ base_url: apiUrl, token }), [apiUrl, token]);

  const qrData = useMemo(() => JSON.stringify(apiConfig), [apiConfig]);
  const qrUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`,
    [qrData]
  );

  const copyToClipboard = async (text: string, type: "qr" | "url") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "qr") {
        setCopiedQR(true);
        setTimeout(() => setCopiedQR(false), 2000);
      } else {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-6 py-3">
          <h1 className="text-2xl font-bold text-foreground">Настройки</h1>
          <p className="text-xs text-muted-foreground">API и подключения</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4 max-w-4xl">
        {/* API Config */}
        <div className="bg-white rounded-lg shadow-sm border border-border p-4 animate-slide-in">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <span>⚙️</span> API Конфигурация
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Base URL API (для QR-кодов подключения)
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Этот URL будет использоваться в QR-кодах для подключения iOS устройств
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-900 mb-2">💡 Информация:</p>
              <p className="text-xs text-blue-800">
                Для управления QR-кодами и подключением устройств перейдите в раздел <strong>Подключения</strong> в левом меню.
              </p>
            </div>
          </div>
        </div>

        {/* Working Hours */}
        <div className="bg-white rounded-lg shadow-sm border border-border p-4 animate-slide-in">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
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
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Выходной день
              </label>
              <select className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary">
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
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <span>🔌</span> API Эндпоинты
          </h2>
          <div className="space-y-2">
            {[
              { method: "GET", endpoint: "/services", desc: "Список услуг" },
              { method: "GET", endpoint: "/bookings", desc: "Список записей" },
              { method: "POST", endpoint: "/bookings", desc: "Новая запись" },
              { method: "GET", endpoint: "/slots", desc: "Свободные слоты" },
              { method: "GET", endpoint: "/profile", desc: "Профиль" },
              { method: "GET", endpoint: "/users", desc: "Список клиентов" },
            ].map((api, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-gray-50 transition-colors"
              >
                <span
                  className={`px-2 py-0.5 text-xs font-bold text-white rounded ${
                    api.method === "GET" ? "bg-blue-500" : "bg-green-500"
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
      </div>
    </div>
  );
}
