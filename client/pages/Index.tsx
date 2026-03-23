import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Service, Booking, User } from "@shared/api";
import { WorkExecutionWidget } from "@/components/WorkExecutionWidget";

export default function Index() {
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "ServiceBooking — Админ-панель";
  }, []);

  const fetchData = async (showLoading = true) => {
    const maxRetries = 3;
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (showLoading) setLoading(true);
        const [servicesRes, bookingsRes, usersRes] = await Promise.all([
          fetch("/api/v1/services"),
          fetch("/api/v1/bookings"),
          fetch("/api/v1/users"),
        ]);
        if (!servicesRes.ok || !bookingsRes.ok || !usersRes.ok) {
          throw new Error("Failed to fetch data");
        }
        const [servicesData, bookingsData, usersData] = await Promise.all([
          servicesRes.json(),
          bookingsRes.json(),
          usersRes.json(),
        ]);
        setServices(servicesData);
        setBookings(bookingsData);
        setClients(usersData);
        setError(null);
        return;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error("Ошибка загрузки");
        console.error("Fetch data attempt", attempt + 1, lastErr);
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    }
    setError(lastErr?.message ?? "Ошибка загрузки данных");
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchData(false);
    };
    const onOnline = () => fetchData(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, []);

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

  const totalRevenue = bookings.reduce((sum, b) => sum + b.price, 0);
  const completedBookings = bookings.filter((b) => b.status === "completed").length;
  const pendingBookings = bookings.filter((b) => b.status === "pending").length;
  const inProgressBookings = bookings.filter((b) => b.status === "in_progress");

  if (error && services.length === 0 && bookings.length === 0 && clients.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Ошибка</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {error && (services.length > 0 || bookings.length > 0 || clients.length > 0) && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-2">
          <span className="text-sm text-amber-800">{error}</span>
          <button
            onClick={() => fetchData()}
            className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg font-semibold shrink-0"
          >
            Обновить
          </button>
        </div>
      )}
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Панель управления</h1>
            <p className="text-xs text-muted-foreground">Обзор сервиса бронирования</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors">
              🔔
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">
            Загрузка данных...
          </div>
        ) : (
          <>
            {/* Key Stats Grid - 6 metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Услуг", value: services.length, icon: "💼", color: "blue" },
                { label: "Записей", value: bookings.length, icon: "📅", color: "green" },
                { label: "Клиентов", value: clients.length, icon: "👥", color: "purple" },
                { label: "Выручка", value: `${(totalRevenue / 1000).toFixed(1)}k ₽`, icon: "💰", color: "yellow" },
                { label: "В процессе", value: inProgressBookings.length, icon: "▶", color: "violet" },
                { label: "Завершено", value: completedBookings, icon: "✓", color: "emerald" },
                { label: "Ожидает", value: pendingBookings, icon: "⏳", color: "orange" },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl p-3 border border-border hover-lift animate-card-reveal"
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-bold text-foreground">{stat.value}</p>
                    <span className="text-2xl">{stat.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Виджет выполнения работы: в процессе + таймер и прогресс */}
            <WorkExecutionWidget inProgressBookings={inProgressBookings} className="animate-slide-in" />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Services - Compact List */}
              <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-border animate-slide-in">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-bold text-foreground">Услуги ({services.length})</h2>
                  <Link to="/services" className="text-xs px-3 py-2 min-h-[36px] bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold flex items-center">
                    + Новая
                  </Link>
                </div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {services.map((s, idx) => (
                    <div
                      key={s._id}
                      className="px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors hover:translate-x-1 duration-200"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.category} • {s.duration} мин</p>
                      </div>
                      <span className="text-sm font-bold text-primary ml-2 flex-shrink-0">{s.price.toFixed(0)} ₽</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                    <p className="text-xs text-blue-700 font-semibold">Активных</p>
                    <p className="text-lg font-bold text-blue-900">{services.filter((s) => s.is_active).length}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                    <p className="text-xs text-purple-700 font-semibold">Новых</p>
                    <p className="text-lg font-bold text-purple-900">{bookings.filter((b) => b.status === "pending").length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bookings - Compact Table */}
            <div className="bg-white rounded-lg shadow-sm border border-border animate-slide-in">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="text-sm font-bold text-foreground">Последние записи</h2>
              </div>
              <div className="divide-y divide-border max-h-56 overflow-y-auto">
                {bookings.slice(0, 10).map((b, idx) => (
                  <div
                    key={b._id}
                    className="px-4 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors text-xs"
                    style={{ animationDelay: `${idx * 20}ms` }}
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                      {b.user_name[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{b.service_name}</p>
                      <p className="text-muted-foreground truncate">{b.user_name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100">
                        {statusEmoji(b.status)} {statusLabel(b.status)}
                      </span>
                      <span className="font-bold text-primary">{b.price.toFixed(0)} ₽</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Клиенты ({clients.length})</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 p-4">
                {clients.map((c) => (
                  <div key={c._id} className="rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                        {c.first_name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{c.first_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.phone?.slice(0, 10) ?? ""}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ru-RU", { month: "short", day: "numeric" })}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
