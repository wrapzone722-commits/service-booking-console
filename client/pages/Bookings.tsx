import { useEffect, useMemo, useRef, useState } from "react";
import { Booking, BookingStatus, Employee, User, Service, Post, TimeSlot } from "@shared/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | BookingStatus>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const refreshInFlightRef = useRef(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteBookingId, setDeleteBookingId] = useState<string | null>(null);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerPasswordError, setOwnerPasswordError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Модальное окно «Новая запись»
  const [createOpen, setCreateOpen] = useState(false);
  const [clients, setClients] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [createUserId, setCreateUserId] = useState("");
  const [createServiceId, setCreateServiceId] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [createSlotTime, setCreateSlotTime] = useState("");
  const [createPostId, setCreatePostId] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const token = localStorage.getItem("session_token");
    if (!token) return;
    try {
      const res = await fetch("/api/v1/employees?all=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("session_token");
          localStorage.removeItem("account_id");
          localStorage.removeItem("account_name");
          window.location.replace("/login");
          return;
        }
        throw new Error("Failed to fetch employees");
      }
      const data = (await res.json()) as Employee[];
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      // не блокируем страницу записей, если сотрудники временно не доступны
    }
  };

  const fetchBookings = async (showLoading = true) => {
    if (refreshInFlightRef.current) return;
    const token = localStorage.getItem("session_token");
    refreshInFlightRef.current = true;
    try {
      if (showLoading) setLoading(true);
      const res = await fetch("/api/v1/bookings", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch bookings");
      const data = (await res.json()) as Booking[];
      setBookings(data);
      setError(null);
    } catch (err) {
      console.error(err);
      // Не “шумим” ошибками при тихом фоне, чтобы не ломать UI
      if (showLoading) setError("Не удалось загрузить записи");
    } finally {
      refreshInFlightRef.current = false;
      if (showLoading) setLoading(false);
    }
  };

  // Авто-обновление списка каждые 30 секунд
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (!navigator.onLine) return;
      void fetchBookings(false);
    };

    const t = window.setInterval(tick, 30_000);
    const onVisibility = () => tick();
    const onOnline = () => tick();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const handleAssignEmployee = async (id: string, employeeId: string | null) => {
    if (updatingId) return;
    const token = localStorage.getItem("session_token");
    if (!token) {
      setError("Войдите в аккаунт для назначения сотрудника");
      return;
    }
    setUpdatingId(id);
    try {
      setError(null);
      const res = await fetch(`/api/v1/bookings/${id}/employee`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("session_token");
          localStorage.removeItem("account_id");
          localStorage.removeItem("account_name");
          window.location.replace("/login");
          return;
        }
        throw new Error(data.message || "Не удалось назначить сотрудника");
      }
      await fetchBookings();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Не удалось назначить сотрудника");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (id: string, newStatus: BookingStatus) => {
    if (updatingId) return;
    const token = localStorage.getItem("session_token");
    if (!token) {
      setError("Войдите в аккаунт для изменения статуса");
      return;
    }
    setUpdatingId(id);
    try {
      setError(null);
      const res = await fetch(`/api/v1/bookings/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("session_token");
          localStorage.removeItem("account_id");
          localStorage.removeItem("account_name");
          window.location.replace("/login");
          return;
        }
        throw new Error(data.message || "Не удалось обновить статус");
      }
      await fetchBookings();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Не удалось обновить статус");
    } finally {
      setUpdatingId(null);
    }
  };

  const openCreateModal = async () => {
    const token = localStorage.getItem("session_token");
    if (!token) {
      setError("Войдите в аккаунт для создания записи");
      return;
    }
    setCreateOpen(true);
    setCreateError(null);
    setCreateUserId("");
    setCreateServiceId("");
    setCreateDate("");
    setSlots([]);
    setCreateSlotTime("");
    setCreatePostId("");
    setCreateNotes("");
    try {
      const [usersRes, servicesRes, postsRes] = await Promise.all([
        fetch("/api/v1/users", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/v1/services", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/v1/posts", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (usersRes.ok) setClients((await usersRes.json()) as User[]);
      if (servicesRes.ok) setServices((await servicesRes.json()) as Service[]);
      if (postsRes.ok) setPosts((await postsRes.json()) as Post[]);
    } catch (e) {
      setCreateError("Не удалось загрузить клиентов и услуги");
    }
  };

  useEffect(() => {
    if (!createOpen || !createServiceId || !createDate) {
      setSlots([]);
      setCreateSlotTime("");
      return;
    }
    const postId = createPostId || "post_1";
    setSlotsLoading(true);
    setSlots([]);
    setCreateSlotTime("");
    fetch(
      `/api/v1/slots?service_id=${encodeURIComponent(createServiceId)}&date=${encodeURIComponent(createDate)}&post_id=${encodeURIComponent(postId)}`
    )
      .then((r) => r.json())
      .then((data: TimeSlot[]) => setSlots(Array.isArray(data) ? data : []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [createOpen, createServiceId, createDate, createPostId]);

  const submitCreate = async () => {
    const token = localStorage.getItem("session_token");
    if (!token || !createUserId || !createServiceId || !createSlotTime) {
      setCreateError("Выберите клиента, услугу и время");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/v1/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: createUserId,
          service_id: createServiceId,
          date_time: createSlotTime,
          post_id: createPostId || undefined,
          notes: createNotes.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("session_token");
          localStorage.removeItem("account_id");
          localStorage.removeItem("account_name");
          window.location.replace("/login");
          return;
        }
        throw new Error(data.message || "Не удалось создать запись");
      }
      setCreateOpen(false);
      await fetchBookings();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Не удалось создать запись");
    } finally {
      setCreating(false);
    }
  };

  const requestDelete = (id: string) => {
    const token = localStorage.getItem("session_token");
    if (!token) {
      setError("Войдите в аккаунт для удаления записи");
      return;
    }
    setDeleteBookingId(id);
    setOwnerPassword("");
    setOwnerPasswordError(null);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteBookingId) return;
    const token = localStorage.getItem("session_token");
    if (!token) {
      setError("Войдите в аккаунт для удаления записи");
      setDeleteModalOpen(false);
      return;
    }
    const pw = ownerPassword.trim();
    if (!pw) {
      setOwnerPasswordError("Введите пароль");
      return;
    }

    setDeleting(true);
    try {
      setError(null);
      setOwnerPasswordError(null);
      const res = await fetch(`/api/v1/bookings/${deleteBookingId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Owner-Password": pw,
        },
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("session_token");
          localStorage.removeItem("account_id");
          localStorage.removeItem("account_name");
          window.location.replace("/login");
          return;
        }
        if (res.status === 403) {
          setOwnerPasswordError("Неверный пароль");
          return;
        }
        throw new Error(data.message || "Не удалось удалить запись");
      }
      setDeleteModalOpen(false);
      setDeleteBookingId(null);
      setOwnerPassword("");
      await fetchBookings(false);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Не удалось удалить запись");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenAct = async (id: string) => {
    const token = localStorage.getItem("session_token");
    try {
      setError(null);
      const res = await fetch(`/api/v1/bookings/${id}/act?format=html`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || "Не удалось загрузить акт");
      }
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        // Fallback if popups are blocked
        window.location.href = url;
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
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
    <>
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 ios-surface border-b border-border/70">
        <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Записи</h1>
            <p className="text-xs text-muted-foreground">Управление бронированиями и статусами</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              onClick={() => void openCreateModal()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              + Новая запись
            </Button>
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
            <p>По выбранному фильтру записей пока нет</p>
            {filterStatus === "completed" && (
              <p className="mt-2 text-xs">Акт выполненных работ доступен для каждой записи со статусом «Завершена» — выберите «Все» или нажмите на завершённую запись и кнопку «Акт».</p>
            )}
          </div>
        ) : (
          filteredBookings.map((booking) => {
            const initials = (booking.user_name || "К")
              .trim()
              .slice(0, 1)
              .toUpperCase();
            const statusClass = STATUS_STYLES[booking.status] || "bg-muted text-foreground border-border";

            return (
              <div key={booking._id} className="ios-card p-4 animate-card-reveal hover-lift">
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
                    <select
                      aria-label="Сотрудник"
                      value={booking.employee_id ?? ""}
                      disabled={updatingId === booking._id || employees.length === 0}
                      onChange={(e) => {
                        const v = e.target.value;
                        void handleAssignEmployee(booking._id, v ? v : null);
                      }}
                      className="px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium disabled:opacity-60"
                      title="Назначить сотрудника (для подсчёта выполненных работ)"
                    >
                      <option value="">{employees.length ? "— сотрудник —" : "Нет сотрудников"}</option>
                      {employees
                        .filter((e) => e.is_active)
                        .map((e) => (
                          <option key={e._id} value={e._id}>
                            {e.name}
                          </option>
                        ))}
                      {employees.some((e) => !e.is_active) && (
                        <optgroup label="Неактивные">
                          {employees
                            .filter((e) => !e.is_active)
                            .map((e) => (
                              <option key={e._id} value={e._id}>
                                {e.name}
                              </option>
                            ))}
                        </optgroup>
                      )}
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
                      onClick={() => requestDelete(booking._id)}
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateError(null);
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новая запись</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {createError && (
              <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}
            <div className="space-y-2">
              <Label>Клиент</Label>
              <select
                aria-label="Клиент"
                value={createUserId}
                onChange={(e) => setCreateUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">— выберите клиента —</option>
                {clients.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.first_name} {u.last_name} {u.phone ? `• ${u.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Услуга</Label>
              <select
                aria-label="Услуга"
                value={createServiceId}
                onChange={(e) => setCreateServiceId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">— выберите услугу —</option>
                {services.filter((s) => s.is_active).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} — {s.price.toFixed(0)} ₽, {s.duration} мин
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Дата</Label>
              <Input
                type="date"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full"
              />
            </div>
            {posts.length > 0 && (
              <div className="space-y-2">
                <Label>Пост (опционально)</Label>
                <select
                  aria-label="Пост"
                  value={createPostId}
                  onChange={(e) => setCreatePostId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                >
                  <option value="">post_1</option>
                  {posts.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {createServiceId && createDate && (
              <div className="space-y-2">
                <Label>Время</Label>
                {slotsLoading ? (
                  <p className="text-sm text-muted-foreground">Загрузка слотов…</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots
                      .filter((s) => s.is_available)
                      .map((s) => {
                        const timeStr = new Date(s.time).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setCreateSlotTime(s.time)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                              createSlotTime === s.time
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card border-border hover:bg-muted"
                            }`}
                          >
                            {timeStr}
                          </button>
                        );
                      })}
                    {!slotsLoading && slots.filter((s) => s.is_available).length === 0 && (
                      <p className="text-sm text-muted-foreground">Нет свободных слотов на эту дату</p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Комментарий (опционально)</Label>
              <Textarea
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="Заметка к записи"
                className="min-h-[80px] resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Отмена
            </Button>
            <Button type="button" onClick={() => void submitCreate()} disabled={creating}>
              {creating ? "Создание…" : "Создать запись"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteModalOpen}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) {
            setOwnerPassword("");
            setOwnerPasswordError(null);
            setDeleteBookingId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Пароль</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Input
              type="password"
              aria-label="Пароль владельца"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void confirmDelete();
              }}
            />
            {ownerPasswordError && (
              <div className="text-sm text-rose-700">
                {ownerPasswordError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? "Удаление…" : "Удалить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
