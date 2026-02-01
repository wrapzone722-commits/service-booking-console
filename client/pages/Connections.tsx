import { useEffect, useMemo, useState } from "react";

interface DeviceConnection {
  _id: string;
  device_id: string;
  device_name: string;
  client_id?: string;
  api_token: string;
  qr_code_data: string;
  status: "pending" | "connected" | "inactive";
  last_seen: string;
  created_at: string;
}

interface ClientInfo {
  _id: string;
  first_name: string;
  last_name: string;
  phone: string;
}

export default function Connections() {
  const [connections, setConnections] = useState<DeviceConnection[]>([]);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<DeviceConnection | null>(null);
  const [formData, setFormData] = useState({
    device_id: "",
    device_name: "",
  });
  const [linkingConnectionId, setLinkingConnectionId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [deploymentUrl] = useState(() => {
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}`;
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [connRes, clientsRes] = await Promise.all([
        fetch("/api/v1/connections"),
        fetch("/api/v1/users"),
      ]);

      if (!connRes.ok || !clientsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const [connData, clientsData] = await Promise.all([
        connRes.json(),
        clientsRes.json(),
      ]);

      setConnections(connData);
      setClients(clientsData);
      setError(null);
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to create");
      await fetchData();
      setShowForm(false);
      setFormData({ device_id: "", device_name: "" });
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка создания подключения");
    }
  };

  const handleLinkClient = async (connectionId: string, clientId: string) => {
    try {
      const res = await fetch(`/api/v1/connections/${connectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      if (!res.ok) throw new Error("Failed to link");
      await fetchData();
      setLinkingConnectionId(null);
      setSelectedClientId("");
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка привязки клиента");
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm("Удалить подключение?")) return;
    try {
      const res = await fetch(`/api/v1/connections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchData();
      setSelectedConnection(null);
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка удаления");
    }
  };

  const statusEmoji = (s: string) => {
    const map: Record<string, string> = {
      pending: "⏳",
      connected: "✓",
      inactive: "✕",
    };
    return map[s] || "•";
  };

  const statusColor = (s: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-50 border-yellow-200",
      connected: "bg-green-50 border-green-200",
      inactive: "bg-red-50 border-red-200",
    };
    return colors[s] || "bg-gray-50";
  };

  const getClientName = (clientId?: string) => {
    if (!clientId) return "Не привязан";
    const client = clients.find((c) => c._id === clientId);
    return client ? `${client.first_name} ${client.last_name}` : "Неизвестный клиент";
  };

  const getQRUrl = (qrData: string, size: "small" | "large" = "small") => {
    try {
      const data = JSON.parse(qrData);
      const sizeStr = size === "large" ? "400x400" : "250x250";
      return `https://api.qrserver.com/v1/create-qr-code/?size=${sizeStr}&data=${encodeURIComponent(JSON.stringify(data))}`;
    } catch {
      return "";
    }
  };

  const getMainConnectionQRData = () => {
    return JSON.stringify({
      api_url: `${deploymentUrl}/api/v1`,
      type: "service_booking",
    });
  };

  const getMainConnectionQRUrl = () => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getMainConnectionQRData())}`;
  };

  const getManualConnectionLink = () => {
    const params = new URLSearchParams({
      api_url: `${deploymentUrl}/api/v1`,
      type: "service_booking",
    });
    return `${deploymentUrl}?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Подключения iOS</h1>
            <p className="text-xs text-muted-foreground">Управление устройствами и профилями</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setFormData({ device_id: "", device_name: "" });
            }}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            {showForm ? "✕" : "+ Добавить подключение"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm animate-slide-in">
            {error}
          </div>
        )}

        {/* Create Form */}
        {showForm && (
          <form onSubmit={handleCreateConnection} className="bg-white rounded-lg p-4 shadow-sm border border-border space-y-3 animate-slide-in">
            <h3 className="font-semibold text-foreground">Новое подключение</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Device ID (уникальный идентификатор)"
                value={formData.device_id}
                onChange={(e) => setFormData({ ...formData, device_id: e.target.value })}
                required
                className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                placeholder="Название устройства (iPhone 15, iPad и т.д.)"
                value={formData.device_name}
                onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
                required
                className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold"
            >
              Создать подключение
            </button>
          </form>
        )}

        {/* Main Connection QR and Links */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* QR Code Section */}
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-bold text-foreground mb-4">QR-код для подключения</h3>
              <div className="bg-white rounded-lg p-3 border-2 border-primary shadow-md">
                <img
                  src={getMainConnectionQRUrl()}
                  alt="Connection QR"
                  className="w-48 h-48"
                />
              </div>
              <button
                onClick={() => window.open(getMainConnectionQRUrl(), "_blank")}
                className="mt-3 px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold"
              >
                Увеличить QR-код
              </button>
            </div>

            {/* Manual Connection Links */}
            <div className="flex flex-col justify-center">
              <h3 className="text-lg font-bold text-foreground mb-4">Ручное подключение</h3>
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">API URL</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1.5 rounded font-mono text-foreground break-all">
                      {deploymentUrl}/api/v1
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${deploymentUrl}/api/v1`);
                        alert("Скопировано в буфер обмена");
                      }}
                      className="px-2 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-blue-600 transition-colors whitespace-nowrap"
                    >
                      Копировать
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Ссылка для подключения</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-100 px-2 py-1.5 rounded font-mono text-foreground break-all">
                      {deploymentUrl}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(deploymentUrl);
                        alert("Скопировано в буфер обмена");
                      }}
                      className="px-2 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-blue-600 transition-colors whitespace-nowrap"
                    >
                      Копировать
                    </button>
                  </div>
                </div>

                <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                  <p className="text-xs text-blue-900 font-semibold mb-1">💡 Инструкция</p>
                  <p className="text-xs text-blue-800">
                    Отправьте iOS приложению ссылку выше или QR-код. Приложение будет использовать эту информацию для подключения к API сервера.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">
            Загрузка...
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Подключений не найдено
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Connections List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border border-border">
                <div className="px-4 py-3 border-b border-border bg-gray-50 rounded-t-lg">
                  <h2 className="text-sm font-bold text-foreground">
                    Устройства ({connections.length})
                  </h2>
                </div>
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {connections.map((conn, idx) => (
                    <div
                      key={conn._id}
                      onClick={() => setSelectedConnection(conn)}
                      className={`p-3 cursor-pointer transition-all duration-200 hover:bg-blue-50 animate-slide-in ${
                        selectedConnection?._id === conn._id
                          ? "bg-blue-100 border-l-4 border-primary"
                          : "hover:translate-x-1"
                      }`}
                      style={{ animationDelay: `${idx * 20}ms` }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{statusEmoji(conn.status)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{conn.device_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{conn.device_id.slice(0, 12)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getClientName(conn.client_id)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Connection Details */}
            {selectedConnection && (
              <div className="lg:col-span-2 space-y-4">
                {/* Main Info */}
                <div className={`rounded-lg shadow-sm border p-4 animate-slide-in ${statusColor(selectedConnection.status)}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{selectedConnection.device_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {statusEmoji(selectedConnection.status)} {selectedConnection.status === "pending" ? "Ожидает подключения" : selectedConnection.status === "connected" ? "Подключено" : "Неактивно"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteConnection(selectedConnection._id)}
                      className="px-3 py-1 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors font-semibold"
                    >
                      Удалить
                    </button>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Device ID</p>
                      <p className="font-mono text-foreground text-xs break-all">{selectedConnection.device_id}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">API Token</p>
                      <p className="font-mono text-foreground text-xs break-all">{selectedConnection.api_token}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Последний запрос</p>
                      <p className="text-foreground">{new Date(selectedConnection.last_seen).toLocaleString("ru-RU")}</p>
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                {selectedConnection.qr_code_data && (
                  <div className="bg-white rounded-lg shadow-sm border border-border p-4">
                    <h3 className="font-bold text-foreground mb-3">QR-код для подключения</h3>
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={getQRUrl(selectedConnection.qr_code_data)}
                        alt="QR"
                        className="w-40 h-40 border-2 border-primary rounded-lg bg-white p-2"
                      />
                      <button
                        onClick={() => {
                          const url = getQRUrl(selectedConnection.qr_code_data);
                          window.open(url, "_blank");
                        }}
                        className="px-3 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                      >
                        Открыть QR-код
                      </button>
                    </div>
                  </div>
                )}

                {/* Link Client */}
                <div className="bg-white rounded-lg shadow-sm border border-border p-4">
                  <h3 className="font-bold text-foreground mb-3">Привязка клиента</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">
                        Текущий клиент: <span className="text-primary">{getClientName(selectedConnection.client_id)}</span>
                      </p>
                    </div>

                    {linkingConnectionId === selectedConnection._id ? (
                      <div className="space-y-2">
                        <select
                          value={selectedClientId}
                          onChange={(e) => setSelectedClientId(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Выберите клиента...</option>
                          {clients.map((client) => (
                            <option key={client._id} value={client._id}>
                              {client.first_name} {client.last_name} ({client.phone})
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              selectedClientId &&
                              handleLinkClient(selectedConnection._id, selectedClientId)
                            }
                            disabled={!selectedClientId}
                            className="flex-1 px-3 py-2 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors font-semibold"
                          >
                            Привязать
                          </button>
                          <button
                            onClick={() => setLinkingConnectionId(null)}
                            className="flex-1 px-3 py-2 text-xs border border-border rounded-lg text-foreground hover:bg-gray-50 transition-colors font-semibold"
                          >
                            Отменить
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setLinkingConnectionId(selectedConnection._id)}
                        className="w-full px-3 py-2 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-gray-200 transition-colors font-semibold"
                      >
                        Изменить клиента
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!selectedConnection && (
              <div className="lg:col-span-2 flex items-center justify-center bg-white rounded-lg border border-border h-96 text-muted-foreground text-sm">
                Выберите устройство для просмотра деталей
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
