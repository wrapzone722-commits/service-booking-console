import { useEffect, useMemo, useState } from "react";
import { Booking, BookingStatus } from "@shared/api";

const STATUS_OPTIONS: { id: BookingStatus; label: string }[] = [
  { id: "pending", label: "Ожидает" },
  { id: "confirmed", label: "Подтверждена" },
  { id: "in_progress", label: "В процессе" },
  { id: "completed", label: "Завершена" },
  { id: "cancelled", label: "Отменена" },
];

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | BookingStatus>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const token = localStorage.getItem("session_token");
    try {
      setLoading(true);
      const res = await fetch("/api/v1/bookings", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const data = (await res.json()) as Booking[];
      setBookings(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Не удалось загрузить записи");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: BookingStatus) => {
    if (updatingId) return;
    const token = localStorage.getItem("session_token");
    setUpdatingId(id);
    try {
      setError(null);
      const res = await fetch(`/api/v1/bookings/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || "Не удалось обновить статус");
      await fetchBookings();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Не удалось обновить статус");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить запись?")) return;
    const token = localStorage.getItem("session_token");
    try {
      setError(null);
      const res = await fetch(`/api/v1/bookings/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message || "Не удалось удалить запись");
      await fetchBookings();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Не удалось удалить запись");
    }
  };

  const handleOpenAct = async (id: string) => {
    const token = localStorage.getItem("session_token");
    try {
      const res = await fetch(`/api/v1/bookings/${id}/act`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Не удалось загрузить акт");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Не удалось открыть акт");
    }
  };

  const filteredBookings = useMemo(
    () => bookings.filter((b) => filterStatus === "all" || b.status === filterStatus),
    [bookings, filterStatus]
  );

  const stats = useMemo(
    () => ({
      all: bookings.length,
      pending: bookings.filter((b) => b.status === "pending").length,
      inProgress: bookings.filter((b) => b.status === "in_progress").length,
    }),
    [bookings]
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 ios-surface border-b border-border/70">
        <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Записи</h1>
            <p className="text-xs text-muted-foreground">Управление бронированиями и статусами</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground">
              Всего: {stats.all}
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Ожидают: {stats.pending}
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              В процессе: {stats.inProgress}
            </span>
          </div>
        </div>

        <div className="px-4 md:px-6 pb-3 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
              filterStatus === "all"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            Все
          </button>
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setFilterStatus(option.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition whitespace-nowrap ${
                filterStatus === option.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-3">
        {error && (
          <div className="ios-card p-3 text-sm text-rose-700 border-rose-200 bg-rose-50/80">
            {error}
          </div>
        )}

        {loading ? (
          <div className="ios-card p-10 text-center text-sm text-muted-foreground animate-pulse-soft">
            Загружаем записи...
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="ios-card p-10 text-center text-sm text-muted-foreground">
            По выбранному фильтру записей пока нет
          </div>
        ) : (
          filteredBookings.map((booking) => {
            const initials = (booking.user_name || "К")
              .trim()
              .slice(0, 1)
              .toUpperCase();
            const statusClass = STATUS_STYLES[booking.status] || "bg-muted text-foreground border-border";

            return (
              <div key={booking._id} className="ios-card p-4 animate-slide-in">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{booking.service_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {booking.user_name} •{" "}
                        {new Date(booking.date_time).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {booking.notes ? (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {booking.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${statusClass}`}>
                      {STATUS_OPTIONS.find((s) => s.id === booking.status)?.label ?? booking.status}
                    </span>
                    {booking.status === "pending" && (
                      <button
                        type="button"
                        disabled={updatingId === booking._id}
                        onClick={() => handleStatusChange(booking._id, "confirmed")}
                        className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:pointer-events-none"
                      >
                        {updatingId === booking._id ? "…" : "Подтвердить запись"}
                      </button>
                    )}
                    <select
                      aria-label="Статус записи"
                      value={booking.status}
                      disabled={updatingId === booking._id}
                      onChange={(e) => handleStatusChange(booking._id, e.target.value as BookingStatus)}
                      className="px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium disabled:opacity-60"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="text-right px-2">
                      <p className="text-sm font-bold text-primary">{booking.price.toFixed(0)} ₽</p>
                      <p className="text-xs text-muted-foreground">{booking.duration} мин</p>
                    </div>
                    {booking.status === "completed" && (
                      <button
                        onClick={() => handleOpenAct(booking._id)}
                        className="px-3 py-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold hover:bg-sky-100 transition"
                      >
                        Акт
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(booking._id)}
                      className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
