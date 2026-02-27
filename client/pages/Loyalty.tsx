import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { User, LoyaltyRules, LoyaltyTransaction, type ClientTier } from "@shared/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const tierLabelMap: Record<ClientTier, string> = {
  client: "Клиент",
  regular: "Постоянный клиент",
  pride: "Прайд",
};

function getClientTier(user: User): ClientTier {
  return user.client_tier ?? (user.status === "vip" ? "pride" : "client");
}

export default function Loyalty() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientIdFromUrl = searchParams.get("client");

  const [clients, setClients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<User | null>(null);

  const [loyaltyRules, setLoyaltyRules] = useState<LoyaltyRules | null>(null);
  const [loyaltyRulesLoading, setLoyaltyRulesLoading] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesDraft, setRulesDraft] = useState<LoyaltyRules | null>(null);
  const [savingRules, setSavingRules] = useState(false);

  const [loyaltyTx, setLoyaltyTx] = useState<LoyaltyTransaction[]>([]);
  const [loyaltyTxLoading, setLoyaltyTxLoading] = useState(false);
  const [adjustPointsText, setAdjustPointsText] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const apiAuth = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
    const token = localStorage.getItem("session_token");
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(url, { ...init, headers });
    if (res.status === 401) {
      localStorage.removeItem("session_token");
      localStorage.removeItem("account_id");
      localStorage.removeItem("account_name");
      window.location.replace("/login");
      throw new Error("Unauthorized");
    }
    const data = (await res.json().catch(() => ({}))) as unknown;
    if (!res.ok) {
      const message = (data as { message?: string })?.message || "Ошибка запроса";
      throw new Error(message);
    }
    return data as T;
  };

  useEffect(() => {
    document.title = "Бонусная система — ServiceBooking";
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/users", {
        headers: { Authorization: `Bearer ${localStorage.getItem("session_token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as User[];
      setClients(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      setError("Не удалось загрузить клиентов");
    } finally {
      setLoading(false);
    }
  };

  const fetchLoyaltyRules = async () => {
    setLoyaltyRulesLoading(true);
    try {
      const data = await apiAuth<LoyaltyRules>("/api/v1/loyalty/rules");
      setLoyaltyRules(data);
      setRulesDraft(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoyaltyRulesLoading(false);
    }
  };

  const fetchLoyaltyTransactions = async (userId: string) => {
    setLoyaltyTxLoading(true);
    try {
      const data = await apiAuth<LoyaltyTransaction[]>(`/api/v1/users/${userId}/loyalty/transactions?limit=30`);
      setLoyaltyTx(Array.isArray(data) ? data : []);
    } catch (e) {
      setLoyaltyTx([]);
    } finally {
      setLoyaltyTxLoading(false);
    }
  };

  useEffect(() => {
    void fetchClients();
    void fetchLoyaltyRules();
  }, []);

  useEffect(() => {
    if (clientIdFromUrl && clients.length) {
      const c = clients.find((u) => u._id === clientIdFromUrl);
      if (c) setSelectedClient(c);
    }
  }, [clientIdFromUrl, clients]);

  useEffect(() => {
    if (!selectedClient?._id) {
      setLoyaltyTx([]);
      return;
    }
    void fetchLoyaltyTransactions(selectedClient._id);
    setAdjustPointsText("");
    setAdjustReason("");
  }, [selectedClient?._id]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.trim().toLowerCase();
    return clients.filter(
      (c) =>
        (c.first_name + " " + c.last_name).toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }, [clients, search]);

  const saveLoyaltyRules = async () => {
    if (!rulesDraft) return;
    setSavingRules(true);
    try {
      setError(null);
      const data = await apiAuth<LoyaltyRules>("/api/v1/loyalty/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          earn_percent: Number(rulesDraft.earn_percent),
          min_earn_points: Number(rulesDraft.min_earn_points),
          bonuses: rulesDraft.bonuses,
        }),
      });
      setLoyaltyRules(data);
      setRulesModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения правил");
    } finally {
      setSavingRules(false);
    }
  };

  const applyAdjustPoints = async (delta: number, reason: string) => {
    if (!selectedClient) return;
    setAdjusting(true);
    try {
      setError(null);
      const data = await apiAuth<{ user: User }>(`/api/v1/users/${selectedClient._id}/loyalty/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, reason }),
      });
      setClients((prev) => prev.map((c) => (c._id === data.user._id ? data.user : c)));
      setSelectedClient(data.user);
      await fetchLoyaltyTransactions(data.user._id);
      setAdjustPointsText("");
      setAdjustReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка операции");
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 ios-surface border-b border-border/70 px-4 md:px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Бонусная система</h1>
        <p className="text-xs text-muted-foreground">Баллы лояльности, правила начисления и списания</p>
      </div>

      <div className="p-4 md:p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Правила лояльности — общие */}
          <div className="lg:col-span-1 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold text-foreground">Правила лояльности</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRulesDraft(loyaltyRules);
                  setRulesModalOpen(true);
                }}
                disabled={loyaltyRulesLoading || !loyaltyRules}
              >
                Редактировать
              </Button>
            </div>
            {loyaltyRules ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Начисление после услуги: <span className="font-semibold text-foreground">{loyaltyRules.earn_percent}%</span> от
                  суммы, минимум <span className="font-semibold text-foreground">{loyaltyRules.min_earn_points}</span> баллов.
                </p>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Бонусы за действия</p>
                  <div className="flex flex-wrap gap-2">
                    {(loyaltyRules.bonuses || []).filter((b) => b.enabled).map((b) => (
                      <span key={b.id} className="text-xs px-2 py-1 rounded bg-muted">
                        +{b.points} • {b.title}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Загрузка…</p>
            )}
          </div>

          {/* Список клиентов */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-foreground mb-2">Клиенты</h2>
            <Input
              type="search"
              placeholder="Поиск по имени, телефону..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3"
              aria-label="Поиск клиентов"
            />
            {loading ? (
              <p className="text-xs text-muted-foreground">Загрузка…</p>
            ) : (
              <div className="space-y-1 max-h-[320px] overflow-y-auto">
                {filteredClients.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => {
                      setSelectedClient(c);
                      setSearchParams((p) => {
                        p.set("client", c._id);
                        return p;
                      });
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                      selectedClient?._id === c._id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium truncate block">{c.first_name} {c.last_name}</span>
                    <span className="text-xs opacity-80">
                      {tierLabelMap[getClientTier(c)]} • {c.loyalty_points ?? 0} бал.
                    </span>
                  </button>
                ))}
                {filteredClients.length === 0 && <p className="text-xs text-muted-foreground">Нет клиентов</p>}
              </div>
            )}
          </div>

          {/* Выбранный клиент: баллы, начисление, история */}
          <div className="rounded-xl border border-border bg-card p-4">
            {!selectedClient ? (
              <p className="text-sm text-muted-foreground">Выберите клиента слева</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="text-sm font-bold text-foreground">
                    {selectedClient.first_name} {selectedClient.last_name}
                  </h2>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-3 border border-amber-200 mb-4">
                  <p className="text-xs text-amber-700 font-semibold">⭐ Накопительные баллы</p>
                  <p className="text-xl font-bold text-amber-900">{selectedClient.loyalty_points ?? 0}</p>
                  <p className="text-[11px] text-amber-800/70 mt-0.5">1 балл = 1 ₽</p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-foreground">Начислить / списать</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Баллы</label>
                      <Input
                        inputMode="numeric"
                        aria-label="Баллы"
                        placeholder="100"
                        value={adjustPointsText}
                        onChange={(e) => setAdjustPointsText(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Причина</label>
                      <Input
                        aria-label="Причина"
                        placeholder="Например: ручная корректировка"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        const n = Number(String(adjustPointsText).trim().replace(",", "."));
                        if (!Number.isFinite(n) || n <= 0) return;
                        void applyAdjustPoints(Math.trunc(n), adjustReason.trim() || "Начисление");
                      }}
                      disabled={adjusting}
                    >
                      Начислить
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const n = Number(String(adjustPointsText).trim().replace(",", "."));
                        if (!Number.isFinite(n) || n <= 0) return;
                        void applyAdjustPoints(-Math.trunc(n), adjustReason.trim() || "Списание");
                      }}
                      disabled={adjusting}
                    >
                      Списать
                    </Button>
                  </div>
                </div>

                {loyaltyRules && (loyaltyRules.bonuses || []).filter((b) => b.enabled).length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Быстрые бонусы</p>
                    <div className="flex flex-wrap gap-2">
                      {(loyaltyRules.bonuses || [])
                        .filter((b) => b.enabled)
                        .map((b) => (
                          <Button
                            key={b.id}
                            size="sm"
                            variant="secondary"
                            onClick={() => void applyAdjustPoints(Math.trunc(Number(b.points) || 0), b.title)}
                            disabled={adjusting || !b.points}
                            title={b.description}
                          >
                            +{b.points} • {b.title}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-foreground">История операций</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => selectedClient._id && void fetchLoyaltyTransactions(selectedClient._id)}
                      disabled={loyaltyTxLoading}
                    >
                      Обновить
                    </Button>
                  </div>
                  {loyaltyTxLoading ? (
                    <p className="text-xs text-muted-foreground">Загрузка…</p>
                  ) : loyaltyTx.length ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {loyaltyTx.slice(0, 15).map((t) => (
                        <div key={t._id} className="flex justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{t.reason}</p>
                            <p className="text-muted-foreground">{new Date(t.created_at).toLocaleString("ru-RU")}</p>
                          </div>
                          <span className={`font-bold tabular-nums shrink-0 ${t.delta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {t.delta >= 0 ? `+${t.delta}` : t.delta}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Операций пока нет</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Диалог правил лояльности */}
      <Dialog open={rulesModalOpen} onOpenChange={setRulesModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Правила лояльности</DialogTitle>
          </DialogHeader>
          {!rulesDraft ? (
            <div className="text-sm text-muted-foreground">Загрузка…</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Начисление после услуги (%)</label>
                  <Input
                    inputMode="numeric"
                    value={String(rulesDraft.earn_percent)}
                    onChange={(e) =>
                      setRulesDraft((s) =>
                        s ? { ...s, earn_percent: Math.max(0, Number(e.target.value || "0")) } : s
                      )
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Минимум баллов за услугу</label>
                  <Input
                    inputMode="numeric"
                    value={String(rulesDraft.min_earn_points)}
                    onChange={(e) =>
                      setRulesDraft((s) =>
                        s ? { ...s, min_earn_points: Math.max(0, Number(e.target.value || "0")) } : s
                      )
                    }
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2">Бонусы</p>
                <div className="space-y-3">
                  {(rulesDraft.bonuses || []).map((b) => (
                    <div key={b.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{b.title}</p>
                          <p className="text-xs text-muted-foreground">{b.id}</p>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!b.enabled}
                            onChange={(e) =>
                              setRulesDraft((s) =>
                                s
                                  ? {
                                      ...s,
                                      bonuses: (s.bonuses || []).map((x) =>
                                        x.id === b.id ? { ...x, enabled: e.target.checked } : x
                                      ),
                                    }
                                  : s
                              )
                            }
                          />
                          Включено
                        </label>
                      </div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold mb-1">Баллы</label>
                          <Input
                            inputMode="numeric"
                            value={String(b.points)}
                            onChange={(e) => {
                              const n = Math.max(0, Number(e.target.value || "0"));
                              setRulesDraft((s) =>
                                s ? { ...s, bonuses: (s.bonuses || []).map((x) => (x.id === b.id ? { ...x, points: n } : x)) } : s
                              );
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Заголовок</label>
                          <Input
                            value={b.title}
                            onChange={(e) =>
                              setRulesDraft((s) =>
                                s ? { ...s, bonuses: (s.bonuses || []).map((x) => (x.id === b.id ? { ...x, title: e.target.value } : x)) } : s
                              )
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="block text-xs font-semibold mb-1">Описание</label>
                        <Textarea
                          value={b.description}
                          onChange={(e) =>
                            setRulesDraft((s) =>
                              s
                                ? { ...s, bonuses: (s.bonuses || []).map((x) => (x.id === b.id ? { ...x, description: e.target.value } : x)) } : s
                            )
                          }
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRulesModalOpen(false)} disabled={savingRules}>
              Отмена
            </Button>
            <Button onClick={() => void saveLoyaltyRules()} disabled={savingRules || !rulesDraft}>
              {savingRules ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
