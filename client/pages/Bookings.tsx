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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between">
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
      <div className="bg-white border-b border-border px-4 md:px-6 py-2 sticky top-14 md:top-16 z-10 flex gap-2 overflow-x-auto">
        {["all", "pending", "confirmed", "in_progress", "completed", "cancelled"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2.5 min-h-[44px] text-xs rounded-lg font-semibold transition-all whitespace-nowrap flex items-center ${
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
      <div className="p-4 md:p-6 space-y-3">
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
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleSendReminder(booking)} disabled={remindingId === booking._id}>{remindingId === booking._id ? "…" : "Напомнить"}</Button>
                    <button onClick={() => handleDelete(booking._id)} className="px-2 py-1 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-semibold shrink-0">✕</button>
                  </div>
                </div>
                {booking.notes && <p className="text-xs text-muted-foreground mt-2 ml-13 pl-2 border-l-2 border-muted">{booking.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <NewBookingModal open={showNewBooking} onClose={() => setShowNewBooking(false)} onCreated={() => { setShowNewBooking(false); fetchBookings(); }} />
    </div>
  );
}

function NewBookingModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [users, setUsers] = useState<{ _id: string; first_name: string; last_name: string }[]>([]);
  const [services, setServices] = useState<{ _id: string; name: string; price: number }[]>([]);
  const [posts, setPosts] = useState<{ _id: string; name: string }[]>([]);
  const [userId, setUserId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [postId, setPostId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    Promise.all([fetch("/api/v1/users").then((r) => r.json()), fetch("/api/v1/services").then((r) => r.json()), fetch("/api/v1/posts").then((r) => r.json())]).then(([u, s, p]) => {
      setUsers(u);
      setServices(s);
      setPosts(p);
      if (u.length) setUserId(u[0]._id);
      if (s.length) setServiceId(s[0]._id);
      if (p.length) setPostId(p[0]._id);
      const t = new Date();
      setDate(t.toISOString().slice(0, 10));
      setTime("10:00");
    });
  }, [open]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceId || !date || !time) { setErr("Укажите услугу, дату и время"); return; }
    setSubmitting(true);
    setErr(null);
    try {
      const token = localStorage.getItem("session_token");
      const dateTime = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ service_id: serviceId, date_time: dateTime, post_id: postId || undefined, notes: notes.trim() || undefined, user_id: userId || undefined }),
      });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.message || "Ошибка"); }
      onCreated();
    } catch (e) { setErr(e instanceof Error ? e.message : "Ошибка"); } finally { setSubmitting(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Новая запись</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div><Label>Клиент</Label><select value={userId} onChange={(e) => setUserId(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{users.map((u) => <option key={u._id} value={u._id}>{u.first_name} {u.last_name}</option>)}</select></div>
          <div><Label>Услуга</Label><select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{services.map((s) => <option key={s._id} value={s._id}>{s.name} — {s.price} ₽</option>)}</select></div>
          <div><Label>Пост</Label><select value={postId} onChange={(e) => setPostId(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{posts.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Дата</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" /></div><div><Label>Время</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" /></div></div>
          <div><Label>Заметки</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" placeholder="Необязательно" /></div>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Отмена</Button><Button type="submit" disabled={submitting}>{submitting ? "Создание…" : "Создать"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
