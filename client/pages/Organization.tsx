import { useEffect, useState } from "react";

interface AccountInfo {
  account_id: string;
  email: string;
  name: string;
  verified: boolean;
  qr_code_data?: string;
}

export default function Organization() {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "ServiceBooking — Организация";
  }, []);

  useEffect(() => {
    fetchAccountInfo();
  }, []);

  const fetchAccountInfo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("session_token");

      const res = await fetch("/api/v1/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch account info");
      }

      const data = await res.json();
      setAccountInfo(data);
    } catch (err) {
      console.error(err);
      setError("Ошибка загрузки информации");
    } finally {
      setLoading(false);
    }
  };

  const getQRUrl = () => {
    if (!accountInfo?.qr_code_data) return "";
    try {
      const data = JSON.parse(accountInfo.qr_code_data);
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(data))}`;
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  if (error || !accountInfo) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
          <div className="px-6 py-3">
            <h1 className="text-2xl font-bold text-foreground">Организация</h1>
            <p className="text-xs text-muted-foreground">Информация об учётной записи</p>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            {error || "Не удалось загрузить информацию"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-6 py-3">
          <h1 className="text-2xl font-bold text-foreground">Организация</h1>
          <p className="text-xs text-muted-foreground">Информация об учётной записи и подключение приложений</p>
        </div>
      </div>

      <div className="p-6 max-w-4xl">
        {/* Account Info */}
        <div className="bg-white rounded-lg shadow-sm border border-border p-6 mb-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Информация об организации</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Название организации</p>
              <p className="text-lg font-semibold text-foreground">{accountInfo.name}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Email администратора</p>
              <p className="text-lg font-semibold text-foreground">{accountInfo.email}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">ID организации</p>
              <p className="text-sm font-mono text-foreground break-all">{accountInfo.account_id}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Статус</p>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${accountInfo.verified ? "bg-green-500" : "bg-yellow-500"}`}></div>
                <p className="text-sm text-foreground">
                  {accountInfo.verified ? "✓ Подтверждена" : "⏳ Ожидает подтверждения"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="bg-white rounded-lg shadow-sm border border-border p-6 mb-6">
          <h2 className="text-lg font-bold text-foreground mb-4">QR-код для подключения iOS</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* QR Code */}
            <div className="flex flex-col items-center">
              <div className="bg-white rounded-lg p-4 border-2 border-primary shadow-md">
                {getQRUrl() && (
                  <img src={getQRUrl()} alt="Organization QR Code" className="w-48 h-48" />
                )}
              </div>
              <button
                onClick={() => {
                  if (getQRUrl()) {
                    window.open(getQRUrl(), "_blank");
                  }
                }}
                className="mt-3 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold"
              >
                Увеличить
              </button>
            </div>

            {/* Instructions */}
            <div className="flex flex-col justify-center">
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">📱 Как подключить приложение</p>
                  <ol className="text-sm text-blue-800 space-y-2">
                    <li>1. Откройте iOS приложение ServiceBooking</li>
                    <li>2. Выберите опцию "Сканировать QR"</li>
                    <li>3. Наведите камеру на этот QR-код</li>
                    <li>4. Приложение автоматически подключится к вашему серверу</li>
                  </ol>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-900 mb-2">✓ Безопасность</p>
                  <p className="text-sm text-green-800">
                    QR-код содержит только URL API вашего сервера. Каждое устройство получает уникальный ключ при регистрации.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <div className="bg-white rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">Конфигурация API</h2>

          {accountInfo.qr_code_data && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">API URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-gray-100 px-3 py-2 rounded font-mono text-foreground break-all">
                    {(() => {
                      try {
                        const data = JSON.parse(accountInfo.qr_code_data);
                        return data.api_url || "N/A";
                      } catch {
                        return "N/A";
                      }
                    })()}
                  </code>
                  <button
                    onClick={() => {
                      try {
                        const data = JSON.parse(accountInfo.qr_code_data);
                        navigator.clipboard.writeText(data.api_url || "");
                        alert("Скопировано в буфер обмена");
                      } catch {
                        alert("Ошибка");
                      }
                    }}
                    className="px-3 py-2 text-xs bg-primary text-primary-foreground rounded hover:bg-blue-600 transition-colors whitespace-nowrap"
                  >
                    Копировать
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 border border-border rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-semibold mb-2">Важно:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Все запросы должны быть по HTTPS</li>
                  <li>Используйте заголовок Authorization: Bearer {'{api_key}'}</li>
                  <li>Временной лимит ответа — 30 секунд</li>
                  <li>Регистрация нового устройства происходит через эндпоинт /clients/register</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
