import { useEffect, useState } from "react";
import { Booking, BookingStatus } from "@shared/api";

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/bookings");
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const data = await res.json();
      setBookings(data);
      setError(null);
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: BookingStatus) => {
    try {
      const res = await fetch(`/api/v1/bookings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchBookings();
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка обновления");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить?")) return;
    try {
      const res = await fetch(`/api/v1/bookings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchBookings();
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка удаления");
    }
  };

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      pending: "ожидает",
      confirmed: "подтверждена",
      in_progress: "процесс",
      completed: "завершена",
      cancelled: "отменена",
    };
    return labels[s] || s;
  };

  const statusEmoji = (s: string) => {
    const emojis: Record<string, string> = {
      pending: "⏳",
      confirmed: "✓",
      in_progress: "▶",
      completed: "✓✓",
      cancelled: "✕",
    };
    return emojis[s] || "•";
  };

  const statusBg = (s: string) => {
    const bg: Record<string, string> = {
      pending: "bg-yellow-50 border-yellow-200",
      confirmed: "bg-blue-50 border-blue-200",
      in_progress: "bg-purple-50 border-purple-200",
      completed: "bg-green-50 border-green-200",
      cancelled: "bg-red-50 border-red-200",
    };
    return bg[s] || "bg-gray-50";
  };

  const filteredBookings = bookings.filter((b) => filterStatus === "all" || b.status === filterStatus);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Записи</h1>
            <p className="text-xs text-muted-foreground">Управление бронированиями</p>
          </div>
          <div className="text-sm font-semibold text-primary">
            Всего: {bookings.length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-border px-6 py-2 sticky top-16 z-10 flex gap-2 overflow-x-auto">
        {["all", "pending", "confirmed", "in_progress", "completed", "cancelled"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all whitespace-nowrap ${
              filterStatus === status
                ? "bg-primary text-primary-foreground"
                : "bg-gray-100 text-foreground hover:bg-gray-200"
            }`}
          >
            {status === "all" ? "Все" : statusLabel(status)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6 space-y-3">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm animate-slide-in">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">
            Загрузка...
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Записей не найдено
          </div>
        ) : (
          <div className="space-y-2">
            {filteredBookings.map((booking, idx) => (
              <div
                key={booking._id}
                className={`rounded-lg p-3 shadow-sm border transition-all duration-300 hover:shadow-md animate-slide-in ${statusBg(booking.status)}`}
                style={{ animationDelay: `${idx * 20}ms` }}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {booking.user_name[0]}
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{booking.service_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {booking.user_name} • {new Date(booking.date_time).toLocaleString("ru-RU", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* Status & Price */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={booking.status}
                      onChange={(e) => handleStatusChange(booking._id, e.target.value as BookingStatus)}
                      className="px-2 py-1 text-xs rounded-lg border border-current bg-transparent font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <option value="pending">ожидает</option>
                      <option value="confirmed">подтверждена</option>
                      <option value="in_progress">процесс</option>
                      <option value="completed">завершена</option>
                      <option value="cancelled">отменена</option>
                    </select>

                    <div className="text-right min-w-fit">
                      <p className="text-sm font-bold text-primary">{booking.price.toFixed(0)} ₽</p>
                      <p className="text-xs text-muted-foreground">{booking.duration} мин</p>
                    </div>

                    <button
                      onClick={() => handleDelete(booking._id)}
                      className="px-2 py-1 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors font-semibold flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {booking.notes && (
                  <p className="text-xs text-muted-foreground mt-2 ml-13 pl-2 border-l-2 border-muted">
                    {booking.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
