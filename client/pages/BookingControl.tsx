import { useEffect, useMemo, useState } from "react";
import type { Booking, BookingControlStatus, BookingStatus } from "@shared/api";

const CONTROL_LABEL: Record<BookingControlStatus, string> = {
  pending: "Нужно прозвонить",
  confirmed: "Подтверждено",
  callback: "Связаться позже",
  no_answer: "Не дозвонились",
  cancelled: "Отменено",
};

const CONTROL_STYLE: Record<BookingControlStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-800 border-emerald-200",
  callback: "bg-blue-50 text-blue-800 border-blue-200",
  no_answer: "bg-slate-50 text-slate-800 border-slate-200",
  cancelled: "bg-rose-50 text-rose-800 border-rose-200",
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function BookingControl() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const token = useMemo(() => localStorage.getItem("session_token"), []);

  const fetchBookings = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/bookings");
      if (!res.ok) throw new Error("Не удалось загрузить записи");
      const data = (await res.json()) as Booking[];
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить записи");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const list = useMemo(() => {
    // Контроль логичен в первую очередь для pending/confirmed и ближайших дат
    return items
      .filter((b) => b.status !== ("completed" as BookingStatus))
      .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  }, [items]);

  const applyPreset = (text: string) => {
    setComment((prev) => {
      const base = prev.trim();
      if (!base) return text;
      if (base.includes(text)) return prev;
      return base + (base.endsWith(".") ? " " : ". ") + text;
    });
  };

  const saveControl = async (status: BookingControlStatus) => {
    if (!selected) return;
    const tokenNow = localStorage.getItem("session_token");
    if (!tokenNow) {
      setError("Войдите в аккаунт администратора");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/bookings/${selected._id}/control`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenNow}`,
        },
        body: JSON.stringify({ status, comment: comment.trim() ? comment.trim() : null }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(data.message || "Не удалось сохранить");
      await fetchBookings(false);
      setSelected(null);
      setComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Контроль записи</h1>
            <p className="text-sm text-muted-foreground">Прозвон клиента → быстрые статусы + комментарий.</p>
          </div>
          <button
            type="button"
            onClick={() => fetchBookings()}
            className="px-4 py-2 rounded-lg border border-border bg-card"
          >
            Обновить
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground">Загрузка...</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-semibold text-foreground mb-3">Список</p>
              <div className="space-y-2">
                {list.map((b) => {
                  const st = (b.control_status ?? "pending") as BookingControlStatus;
                  return (
                    <button
                      key={b._id}
                      type="button"
                      onClick={() => {
                        setSelected(b);
                        setComment(b.control_comment ?? "");
                      }}
                      className="w-full text-left rounded-lg border border-border hover:bg-muted/30 transition p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{b.user_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {fmtDate(b.date_time)} • {b.service_name}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-md text-[11px] border ${CONTROL_STYLE[st]}`}>
                          {CONTROL_LABEL[st]}
                        </span>
                      </div>
                      {b.control_comment && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{b.control_comment}</p>
                      )}
                    </button>
                  );
                })}
                {list.length === 0 && <p className="text-sm text-muted-foreground">Пока нет записей.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-semibold text-foreground mb-3">Детали</p>
              {!selected ? (
                <p className="text-sm text-muted-foreground">Выберите запись слева.</p>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-sm font-medium text-foreground">{selected.user_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fmtDate(selected.date_time)} • {selected.service_name}</p>
                    {selected.notes && <p className="text-xs text-muted-foreground mt-2">Комментарий клиента: {selected.notes}</p>}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Комментарий администратора</p>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background min-h-[100px]"
                      placeholder="Например: связаться позже, хотел полировку…"
                      disabled={saving}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Preset text="Связаться позже" onClick={applyPreset} />
                      <Preset text="Хотел полировку" onClick={applyPreset} />
                      <Preset text="Не дозвонились" onClick={applyPreset} />
                      <Preset text="Перенос даты/времени" onClick={applyPreset} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => saveControl("confirmed")}
                      disabled={saving}
                      className="py-2 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50"
                    >
                      Подтверждено
                    </button>
                    <button
                      type="button"
                      onClick={() => saveControl("callback")}
                      disabled={saving}
                      className="py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50"
                    >
                      Связаться позже
                    </button>
                    <button
                      type="button"
                      onClick={() => saveControl("no_answer")}
                      disabled={saving}
                      className="py-2 rounded-lg bg-slate-700 text-white font-semibold disabled:opacity-50"
                    >
                      Не дозвонились
                    </button>
                    <button
                      type="button"
                      onClick={() => saveControl("cancelled")}
                      disabled={saving}
                      className="py-2 rounded-lg bg-rose-600 text-white font-semibold disabled:opacity-50"
                    >
                      Отменено
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setComment("");
                    }}
                    className="w-full py-2 rounded-lg border border-border"
                    disabled={saving}
                  >
                    Закрыть
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Preset({ text, onClick }: { text: string; onClick: (t: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(text)}
      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-muted text-foreground"
    >
      {text}
    </button>
  );
}

