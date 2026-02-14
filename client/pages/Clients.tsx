import { useEffect, useMemo, useRef, useState } from "react";
import { User, type ClientTier } from "@shared/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const statusLabelMap: Record<string, string> = {
  active: "Активный",
  inactive: "Неактивный",
  vip: "VIP",
};

const tierLabelMap: Record<ClientTier, string> = {
  client: "Клиент",
  regular: "Постоянный клиент",
  pride: "Прайд",
};

function getClientTier(user: User): ClientTier {
  return user.client_tier ?? (user.status === "vip" ? "pride" : "client");
}

function toCsvValue(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (/[;"\n]/.test(str)) return `"${str.replace(/"/g, "\"\"")}"`;
  return str;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export default function Clients() {
  const [clients, setClients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [editingTier, setEditingTier] = useState<ClientTier | null>(null);
  const [savingTier, setSavingTier] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    setEditingTier(null);
  }, [selectedClient?._id]);

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

  const saveClientTier = async () => {
    if (!selectedClient || editingTier === null) return;
    const token = localStorage.getItem("session_token");
    if (!token) {
      setError("Нужна авторизация для изменения типа клиента");
      return;
    }
    try {
      setSavingTier(true);
      const res = await fetch(`/api/v1/users/${selectedClient._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ client_tier: editingTier }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Ошибка сохранения");
      }
      const updated = await res.json();
      setClients((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
      setSelectedClient(updated);
      setEditingTier(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingTier(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedClient || !messageBody.trim()) return;
    try {
      setMessageSending(true);
      const token = localStorage.getItem("session_token");
      const res = await fetch("/api/v1/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          client_id: selectedClient._id,
          body: messageBody.trim(),
          title: messageTitle.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Ошибка отправки");
      }
      setShowSendMessage(false);
      setMessageTitle("");
      setMessageBody("");
    } catch (err) {
      console.error("Error:", err);
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setMessageSending(false);
    }
  };

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) =>
      [client.first_name, client.last_name, client.phone, client.email || "", client._id]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [clients, search]);

  const exportClientsToExcel = () => {
    if (!clients.length) {
      setError("Список клиентов пуст, экспортировать нечего");
      return;
    }
    const headers = [
      "ID",
      "Имя",
      "Фамилия",
      "Телефон",
      "Email",
      "Статус",
      "Тип клиента",
      "Накопительные баллы",
      "Telegram",
      "WhatsApp",
      "Instagram",
      "VK",
      "Дата регистрации",
    ];
    const rows = clients.map((c) => [
      c._id,
      c.first_name,
      c.last_name,
      c.phone,
      c.email || "",
      c.status || "active",
      tierLabelMap[getClientTier(c)],
      Number.isFinite(Number(c.loyalty_points)) ? Number(c.loyalty_points) : 0,
      c.social_links?.telegram || "",
      c.social_links?.whatsapp || "",
      c.social_links?.instagram || "",
      c.social_links?.vk || "",
      c.created_at,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => toCsvValue(cell)).join(";"))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `clients-export-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImporting(true);
      setError(null);
      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) throw new Error("Файл пуст или содержит только заголовок");

      const delimiter = lines[0].includes(";") ? ";" : ",";
      const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());

      const indexOfAny = (...keys: string[]) => headers.findIndex((h) => keys.includes(h));

      const idx = {
        first_name: indexOfAny("имя", "first_name", "firstname"),
        last_name: indexOfAny("фамилия", "last_name", "lastname"),
        phone: indexOfAny("телефон", "phone"),
        email: indexOfAny("email", "e-mail"),
        status: indexOfAny("статус", "status"),
        client_tier: indexOfAny("тип клиента", "client_tier", "tier", "тип"),
        loyalty_points: indexOfAny("накопительные баллы", "баллы", "loyalty_points", "points"),
        telegram: indexOfAny("telegram"),
        whatsapp: indexOfAny("whatsapp"),
        instagram: indexOfAny("instagram"),
        vk: indexOfAny("vk"),
        created_at: indexOfAny("дата регистрации", "created_at"),
      };

      if (idx.first_name < 0 || idx.phone < 0) {
        throw new Error("В файле обязательно должны быть столбцы: Имя и Телефон");
      }

      const clientsPayload = lines.slice(1).map((line) => {
        const cells = parseCsvLine(line, delimiter);
        const get = (i: number) => (i >= 0 ? (cells[i] || "").trim() : "");
        const statusRaw = get(idx.status).toLowerCase();
        const status = statusRaw === "inactive" || statusRaw === "vip" ? statusRaw : "active";
        const tierRaw = get(idx.client_tier).toLowerCase();
        const client_tier: ClientTier =
          tierRaw === "regular" || tierRaw === "постоянный клиент" || tierRaw === "постоянный"
            ? "regular"
            : tierRaw === "pride" || tierRaw === "прайд"
              ? "pride"
              : "client";
        const points = Number(get(idx.loyalty_points) || "0");

        return {
          first_name: get(idx.first_name),
          last_name: get(idx.last_name) || "-",
          phone: get(idx.phone),
          email: get(idx.email) || null,
          status,
          client_tier,
          loyalty_points: Number.isFinite(points) ? points : 0,
          social_links: {
            telegram: get(idx.telegram) || null,
            whatsapp: get(idx.whatsapp) || null,
            instagram: get(idx.instagram) || null,
            vk: get(idx.vk) || null,
          },
          created_at: get(idx.created_at) || undefined,
        };
      });

      const res = await fetch("/api/v1/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clients: clientsPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Ошибка импорта");

      await fetchClients();
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Клиенты</h1>
            <p className="text-xs text-muted-foreground">База, контакты, импорт и экспорт</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportClientsToExcel}
              className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90"
            >
              Экспорт Excel
            </button>
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card text-foreground font-semibold hover:bg-muted disabled:opacity-60"
            >
              {importing ? "Импорт..." : "Импорт Excel"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-label="Импорт клиентов из CSV"
              onChange={handleImportFile}
            />
            <div className="text-sm font-semibold text-primary">
              Всего: {clients.length}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 space-y-3">
        <div className="ios-card p-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск: имя, телефон, email, ID"
            aria-label="Поиск клиента"
          />
        </div>

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
                    Список ({filteredClients.length})
                  </h2>
                </div>
                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {filteredClients.map((client) => (
                    <div
                      key={client._id}
                      onClick={() => setSelectedClient(client)}
                      className={`p-3 cursor-pointer transition-all duration-200 hover:bg-blue-50 animate-slide-in ${
                        selectedClient?._id === client._id
                          ? "bg-blue-100 border-l-4 border-primary"
                          : "hover:translate-x-1"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {client.first_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {client.first_name} {client.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {client.phone} • {tierLabelMap[getClientTier(client)]} • {client.loyalty_points ?? 0} бал.
                          </p>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4 border-y border-border">
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
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-3 border border-emerald-200">
                      <p className="text-xs text-emerald-700 font-semibold">🏷️ Тип клиента</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <select
                          aria-label="Тип клиента"
                          value={editingTier ?? getClientTier(selectedClient)}
                          onChange={(e) => setEditingTier(e.target.value as ClientTier)}
                          className="text-sm font-bold text-emerald-900 bg-white/80 border border-emerald-200 rounded-md px-2 py-1"
                        >
                          {(Object.keys(tierLabelMap) as ClientTier[]).map((t) => (
                            <option key={t} value={t}>
                              {tierLabelMap[t]}
                            </option>
                          ))}
                        </select>
                        {editingTier !== null && editingTier !== getClientTier(selectedClient) && (
                          <Button
                            size="sm"
                            onClick={saveClientTier}
                            disabled={savingTier}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {savingTier ? "Сохранение…" : "Сохранить"}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200">
                      <p className="text-xs text-amber-700 font-semibold">⭐ Накопительные баллы</p>
                      <p className="text-sm font-bold text-amber-900">
                        {selectedClient.loyalty_points ?? 0}
                      </p>
                    </div>
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

                  {/* Send Message */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <Button
                      onClick={() => {
                        setShowSendMessage(true);
                        setMessageTitle("");
                        setMessageBody("");
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      📩 Отправить сообщение клиенту
                    </Button>
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

      {/* Send Message Dialog */}
      <Dialog open={showSendMessage} onOpenChange={setShowSendMessage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отправить сообщение</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Заголовок (опционально)</label>
              <Input
                value={messageTitle}
                onChange={(e) => setMessageTitle(e.target.value)}
                placeholder="Например: Услуга завершена"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Текст сообщения</label>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Сообщение появится в приложении в разделе «Сообщения»"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendMessage(false)}>
              Отмена
            </Button>
            <Button onClick={handleSendMessage} disabled={!messageBody.trim() || messageSending}>
              {messageSending ? "Отправка..." : "Отправить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
