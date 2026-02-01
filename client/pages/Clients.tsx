import { useEffect, useState } from "react";
import { User } from "@shared/api";

export default function Clients() {
  const [clients, setClients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/users");
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data = await res.json();
      setClients(data);
      setError(null);
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Клиенты</h1>
            <p className="text-xs text-muted-foreground">База и контакты</p>
          </div>
          <div className="text-sm font-semibold text-primary">
            Всего: {clients.length}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm animate-slide-in">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">
            Загрузка...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Clients List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border border-border">
                <div className="px-4 py-3 border-b border-border bg-gray-50 rounded-t-lg">
                  <h2 className="text-sm font-bold text-foreground">
                    Список ({clients.length})
                  </h2>
                </div>
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {clients.map((client, idx) => (
                    <div
                      key={client._id}
                      onClick={() => setSelectedClient(client)}
                      className={`p-3 cursor-pointer transition-all duration-200 hover:bg-blue-50 animate-slide-in ${
                        selectedClient?._id === client._id
                          ? "bg-blue-100 border-l-4 border-primary"
                          : "hover:translate-x-1"
                      }`}
                      style={{ animationDelay: `${idx * 20}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {client.first_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {client.first_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{client.phone}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Client Details */}
            {selectedClient && (
              <div className="lg:col-span-2 space-y-4">
                {/* Main Card */}
                <div className="bg-white rounded-lg shadow-sm border border-border p-4 animate-slide-in">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                      {selectedClient.first_name[0]}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">
                        {selectedClient.first_name} {selectedClient.last_name}
                      </h2>
                      <p className="text-sm text-muted-foreground">ID: {selectedClient._id}</p>
                    </div>
                  </div>

                  {/* Contact Details Grid */}
                  <div className="grid grid-cols-2 gap-3 py-4 border-y border-border">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                      <p className="text-xs text-blue-700 font-semibold">📞 Телефон</p>
                      <p className="text-sm font-bold text-blue-900 truncate">{selectedClient.phone}</p>
                    </div>
                    {selectedClient.email && (
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                        <p className="text-xs text-purple-700 font-semibold">✉️ Email</p>
                        <p className="text-sm font-bold text-purple-900 truncate">{selectedClient.email}</p>
                      </div>
                    )}
                  </div>

                  {/* Registration Info */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">📅 Зарегистрирован</p>
                    <p className="text-sm font-semibold text-foreground">
                      {new Date(selectedClient.created_at).toLocaleDateString("ru-RU", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* Social Links */}
                {selectedClient.social_links &&
                  Object.keys(selectedClient.social_links).length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-border p-4 animate-slide-in">
                      <h3 className="text-sm font-bold text-foreground mb-3">🔗 Социальные сети</h3>
                      <div className="space-y-2">
                        {selectedClient.social_links.telegram && (
                          <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-50 border border-blue-200">
                            <span className="text-xl">📱</span>
                            <div className="min-w-0">
                              <p className="text-xs text-blue-700 font-semibold">Telegram</p>
                              <p className="text-sm font-semibold text-blue-900 truncate">
                                {selectedClient.social_links.telegram}
                              </p>
                            </div>
                          </div>
                        )}
                        {selectedClient.social_links.whatsapp && (
                          <div className="flex items-center gap-3 p-2 rounded-lg bg-green-50 border border-green-200">
                            <span className="text-xl">💬</span>
                            <div className="min-w-0">
                              <p className="text-xs text-green-700 font-semibold">WhatsApp</p>
                              <p className="text-sm font-semibold text-green-900 truncate">
                                {selectedClient.social_links.whatsapp}
                              </p>
                            </div>
                          </div>
                        )}
                        {selectedClient.social_links.instagram && (
                          <div className="flex items-center gap-3 p-2 rounded-lg bg-pink-50 border border-pink-200">
                            <span className="text-xl">📸</span>
                            <div className="min-w-0">
                              <p className="text-xs text-pink-700 font-semibold">Instagram</p>
                              <p className="text-sm font-semibold text-pink-900 truncate">
                                {selectedClient.social_links.instagram}
                              </p>
                            </div>
                          </div>
                        )}
                        {selectedClient.social_links.vk && (
                          <div className="flex items-center gap-3 p-2 rounded-lg bg-indigo-50 border border-indigo-200">
                            <span className="text-xl">🔵</span>
                            <div className="min-w-0">
                              <p className="text-xs text-indigo-700 font-semibold">VK</p>
                              <p className="text-sm font-semibold text-indigo-900 truncate">
                                {selectedClient.social_links.vk}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {!selectedClient && (
              <div className="lg:col-span-2 flex items-center justify-center bg-white rounded-lg border border-border h-96 text-muted-foreground text-sm">
                Выберите клиента
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
