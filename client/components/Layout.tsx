import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Booking } from "@shared/api";
import { NetworkStatus } from "./NetworkStatus";
import { Switch } from "./ui/switch";
import { useTheme, type ThemeId } from "@/hooks/use-theme";
import { toast } from "@/hooks/use-toast";

interface LayoutProps {
  children: ReactNode;
}

function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  return <span className="tabular-nums font-medium">{time}</span>;
}

const navItems = [
  { path: "/", label: "Главная", icon: "📊" },
  { path: "/company", label: "Компания", icon: "🏢" },
  { path: "/services", label: "Услуги", icon: "💼" },
  { path: "/bookings", label: "Записи", icon: "📅" },
  { path: "/posts", label: "Посты", icon: "🚿" },
  { path: "/telegram-bot", label: "Telegram Бот", icon: "📲" },
  { path: "/clients", label: "Клиенты", icon: "👥" },
  { path: "/cars", label: "Автомобили", icon: "🚗" },
  { path: "/settings", label: "Настройки", icon: "⚙️" },
];

const bottomNavItems = [
  { path: "/", label: "Главная", icon: "📊" },
  { path: "/bookings", label: "Записи", icon: "📅" },
  { path: "/services", label: "Услуги", icon: "💼" },
  { path: "/posts", label: "Посты", icon: "🚿" },
];

const themes: { id: ThemeId; label: string; icon: string }[] = [
  { id: "light", label: "Светлая", icon: "☀️" },
  { id: "gray", label: "Серая", icon: "🌙" },
  { id: "dark", label: "Тёмная", icon: "🌑" },
];
const APP_VERSION = "v2.1 • build 2025-02";

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [accountName, setAccountName] = useState("Admin");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [latestBookingAlert, setLatestBookingAlert] = useState<Booking | null>(null);
  const seenBookingIdsRef = useRef<Set<string>>(new Set());
  const initializedBookingsRef = useRef(false);
  const { data: stats = { bookingsToday: 0 } } = useQuery({
    queryKey: ["stats", "dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/v1/stats/dashboard");
      if (!r.ok) return { bookingsToday: 0 };
      return r.json() as Promise<{ bookingsToday: number }>;
    },
  });

  useEffect(() => {
    const name = localStorage.getItem("account_name");
    if (name) setAccountName(name);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;

    const playNotificationSound = () => {
      try {
        const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0.0001, now);
        gain1.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc1.connect(gain1).connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.2);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(1175, now + 0.1);
        gain2.gain.setValueAtTime(0.0001, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.1, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc2.connect(gain2).connect(ctx.destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.3);

        setTimeout(() => {
          ctx.close().catch(() => undefined);
        }, 350);
      } catch {
        // Ignore audio errors (autoplay policy, unavailable API, etc.)
      }
    };

    const checkNewBookings = async () => {
      try {
        const res = await fetch("/api/v1/bookings");
        if (!res.ok) return;
        const bookings = (await res.json()) as Booking[];

        if (!initializedBookingsRef.current) {
          seenBookingIdsRef.current = new Set(bookings.map((b) => b._id));
          initializedBookingsRef.current = true;
          return;
        }

        const newBookings = bookings
          .filter((b) => !seenBookingIdsRef.current.has(b._id))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        if (!newBookings.length) return;

        for (const booking of newBookings) {
          seenBookingIdsRef.current.add(booking._id);
        }

        const booking = newBookings[newBookings.length - 1];
        if (!isMounted) return;

        setLatestBookingAlert(booking);
        playNotificationSound();
        toast({
          title: "Новая запись",
          description: `${booking.user_name} • ${booking.service_name} • ${new Date(booking.date_time).toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
        });
      } catch {
        // Silent fail for background polling.
      }
    };

    checkNewBookings();
    const timer = window.setInterval(checkNewBookings, 10000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    if (confirm("Вы уверены, что хотите выйти?")) {
      localStorage.removeItem("session_token");
      localStorage.removeItem("account_id");
      localStorage.removeItem("account_name");
      navigate("/login");
    }
  };

  const SidebarContent = () => (
    <>
      <div className="p-3 border-b border-sidebar-border/50">
        <Link to="/company" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-lg bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-bold text-sm flex-shrink-0">
            SB
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm truncate">ServiceBooking</h1>
            <p className="text-xs text-white/60 truncate">{accountName}</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm min-h-[44px] transition-colors ${
              isActive(item.path)
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/90 hover:bg-white/10"
            }`}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            <span className="font-medium truncate flex-1">
              {item.label}
              {item.path === "/settings" && (
                <span className="block text-[10px] font-normal text-white/60 leading-tight mt-0.5">
                  {APP_VERSION}
                </span>
              )}
            </span>
            {item.path === "/bookings" && stats.bookingsToday > 0 && (
              <span className="rounded-full bg-white/20 px-1.5 text-xs font-semibold">{stats.bookingsToday}</span>
            )}
          </Link>
        ))}
      </nav>
      <div className="px-3 py-2 border-t border-sidebar-border/50 space-y-2">
        <p className="text-[11px] text-white/60">
          {APP_VERSION}
        </p>
        <Link
          to="/legal"
          className="block text-[11px] text-white/70 hover:text-white underline underline-offset-2"
        >
          Документы / Персональные данные
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sidebar-foreground hover:bg-white/10 active:bg-white/20 transition-all text-sm font-medium min-h-[44px]"
        >
          <span>🚪</span>
          <span className="truncate">Выход</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="relative flex flex-col min-h-screen bg-background md:flex-row">
      {/* Top bar: theme switcher + clock (desktop) */}
      <div className="hidden md:flex absolute top-0 left-0 right-0 z-30 h-11 px-4 items-center justify-between ios-surface border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                theme === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
          </div>
          <Switch
            checked={theme === "dark" || theme === "gray"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            aria-label="Тёмная тема"
            title="Тёмная тема"
          />
        </div>
        <div className="flex items-center gap-3">
          <Clock />
          <NetworkStatus />
        </div>
      </div>

      {/* Mobile header with theme + clock */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gradient-to-b from-[hsl(var(--sidebar-background))] to-[hsl(230_50%_25%)] text-sidebar-foreground border-b border-sidebar-border/50 sticky top-0 z-40 safe-area-top">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 active:bg-white/20 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Меню"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link to="/" className="flex items-center gap-2 flex-1 justify-center">
          <span className="font-bold text-sm">ServiceBooking</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sidebar-foreground/90 text-sm tabular-nums">
            <Clock />
          </span>
          <div className="flex items-center gap-1">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`p-1.5 rounded text-sm ${theme === t.id ? "bg-white/20" : "opacity-60"}`}
                title={t.label}
              >
                {t.icon}
              </button>
            ))}
            <Switch
              checked={theme === "dark" || theme === "gray"}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              aria-label="Тёмная тема"
              className="data-[state=checked]:bg-white/30"
            />
          </div>
          <NetworkStatus className="md:hidden" />
        </div>
      </header>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - drawer on mobile, fixed on desktop */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-64 max-w-[85vw]
          bg-gradient-to-b from-[hsl(var(--sidebar-background))] to-[hsl(230_50%_25%)] text-sidebar-foreground shadow-lg flex flex-col
          transform transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          pt-[env(safe-area-inset-top)] md:pt-0
        `}
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="md:hidden flex justify-end p-2">
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-white/10 active:bg-white/20 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Закрыть"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <SidebarContent />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-0 md:min-h-screen w-full md:pt-11">
        <div className="flex-1 min-h-0 overflow-auto bg-background pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <div className="min-h-[100dvh]">
            {children}
          </div>
        </div>

        {/* Bottom navigation (mobile only) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 ios-surface border-t border-border/70 shadow-lg z-40 safe-area-bottom flex justify-around items-stretch pb-[env(safe-area-inset-bottom)]">
          {bottomNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-2 min-h-[48px] px-1 ${
                isActive(item.path) ? "text-primary font-semibold" : "text-muted-foreground"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] mt-0.5 truncate max-w-full">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-2 min-h-[48px] px-1 text-muted-foreground"
          >
            <span className="text-xl">☰</span>
            <span className="text-[10px] mt-0.5 truncate max-w-full">Ещё</span>
          </button>
        </nav>
      </main>

      {latestBookingAlert && (
        <div className="fixed right-4 top-16 md:top-16 z-[70] w-[min(92vw,360px)] ios-card p-4 animate-slide-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Новая запись</p>
              <p className="text-xs text-muted-foreground mt-1">{latestBookingAlert.user_name}</p>
              <p className="text-xs text-muted-foreground">{latestBookingAlert.service_name}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(latestBookingAlert.date_time).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <button
              onClick={() => setLatestBookingAlert(null)}
              className="text-muted-foreground hover:text-foreground text-sm"
              aria-label="Закрыть уведомление"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                navigate("/bookings");
                setLatestBookingAlert(null);
              }}
              className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90"
            >
              Открыть записи
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
