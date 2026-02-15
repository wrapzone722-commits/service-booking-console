import { useCallback, useEffect, useState } from "react";
import {
  fetchProfile,
  updateProfile,
  fetchCars,
  fetchNotifications,
  markNotificationRead,
} from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { User, CarFolder, Notification } from "@/api/types";
import { Link } from "react-router-dom";
import { useLegal } from "@/context/LegalContext";

const clientTierLabel: Record<string, string> = {
  client: "Клиент",
  regular: "Постоянный клиент",
  pride: "Прайд",
};

type ThemePref = "light" | "dark" | "system";
const THEME_KEY = "sb_web_theme";

export function ProfilePage() {
  const { apiKey, logout } = useAuth();
  const { acceptedAt, revoke } = useLegal();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelegram, setEditTelegram] = useState("");
  const [editVk, setEditVk] = useState("");
  const [saving, setSaving] = useState(false);
  const [cars, setCars] = useState<CarFolder[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showCars, setShowCars] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [theme, setTheme] = useState<ThemePref>(() => {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
  });

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    const root = document.documentElement;
    const wantsDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", wantsDark);
  }, [theme]);

  const loadProfile = useCallback(() => {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    fetchProfile()
      .then((u) => {
        setUser(u);
        setEditFirst(u.first_name ?? "");
        setEditLast(u.last_name ?? "");
        setEditEmail(u.email ?? "");
        setEditTelegram(u.social_links?.telegram ?? "");
        setEditVk(u.social_links?.vk ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [apiKey]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadNotifications = useCallback(() => {
    fetchNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, []);

  useEffect(() => {
    if (showNotifications && apiKey) loadNotifications();
  }, [showNotifications, apiKey, loadNotifications]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateProfile({
        first_name: editFirst.trim() || undefined,
        last_name: editLast.trim() || undefined,
        email: editEmail.trim() || null,
        social_links: {
          telegram: editTelegram.trim() || null,
          vk: editVk.trim() || null,
        },
      });
      setUser(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCar = async (car: CarFolder) => {
    if (!user) return;
    const photoUrl = car.profile_preview_url ?? car.images[0]?.url ?? null;
    try {
      const updated = await updateProfile({ profile_photo_url: photoUrl });
      setUser(updated);
      setShowCars(false);
    } catch {
      //
    }
  };

  const loadCars = useCallback(() => {
    fetchCars()
      .then(setCars)
      .catch(() => setCars([]));
  }, []);

  useEffect(() => {
    if (showCars) loadCars();
  }, [showCars, loadCars]);

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "Клиент"
    : "Клиент";
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold text-fg mb-4 tracking-tight">Профиль</h1>
      {loading ? (
        <div className="text-muted-fg">Загрузка...</div>
      ) : error && !user ? (
        <div className="text-red-600">{error}</div>
      ) : user ? (
        <>
          <div className="bg-card/70 backdrop-blur-xl rounded-2xl border border-border shadow-ios p-4 space-y-3">
            <div className="flex items-center gap-3">
              {user.avatar_url || user.profile_photo_url ? (
                <img
                  src={user.avatar_url || user.profile_photo_url || ""}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover bg-muted ring-1 ring-border"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-fg font-medium ring-1 ring-border">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                {!editing ? (
                  <>
                    <p className="font-medium text-fg">{displayName}</p>
                    {user.email && <p className="text-sm text-muted-fg">{user.email}</p>}
                    {user.phone && !String(user.phone).startsWith("device:") && (
                      <p className="text-sm text-muted-fg">{user.phone}</p>
                    )}
                    {user.client_tier && (
                      <p className="text-xs text-muted-fg">
                        {clientTierLabel[user.client_tier] ?? user.client_tier}
                      </p>
                    )}
                    {typeof user.loyalty_points === "number" && (
                      <p className="text-xs text-muted-fg">Баллы: {user.loyalty_points}</p>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Имя"
                      value={editFirst}
                      onChange={(e) => setEditFirst(e.target.value)}
                      className="w-full border border-border bg-card rounded-xl px-3 py-2 text-sm text-fg placeholder:text-muted-fg"
                    />
                    <input
                      type="text"
                      placeholder="Фамилия"
                      value={editLast}
                      onChange={(e) => setEditLast(e.target.value)}
                      className="w-full border border-border bg-card rounded-xl px-3 py-2 text-sm text-fg placeholder:text-muted-fg"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full border border-border bg-card rounded-xl px-3 py-2 text-sm text-fg placeholder:text-muted-fg"
                    />
                    <input
                      type="text"
                      placeholder="Telegram"
                      value={editTelegram}
                      onChange={(e) => setEditTelegram(e.target.value)}
                      className="w-full border border-border bg-card rounded-xl px-3 py-2 text-sm text-fg placeholder:text-muted-fg"
                    />
                    <input
                      type="text"
                      placeholder="VK"
                      value={editVk}
                      onChange={(e) => setEditVk(e.target.value)}
                      className="w-full border border-border bg-card rounded-xl px-3 py-2 text-sm text-fg placeholder:text-muted-fg"
                    />
                  </div>
                )}
              </div>
            </div>
            {!editing ? (
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-sm text-accent font-medium"
                >
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => setShowCars(true)}
                  className="text-sm text-muted-fg"
                >
                  Выбрать авто
                </button>
              </div>
            ) : (
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-accent text-accent-fg text-sm rounded-xl disabled:opacity-50"
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 border border-border bg-card/50 text-fg text-sm rounded-xl"
                >
                  Отмена
                </button>
              </div>
            )}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-full py-3 px-4 bg-card/70 backdrop-blur-xl border border-border rounded-2xl text-left flex items-center justify-between shadow-ios"
            >
              <span className="font-medium text-fg">Уведомления</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <ul className="mt-2 space-y-2">
                {notifications.length === 0 ? (
                  <li className="text-sm text-muted-fg py-2">Нет уведомлений</li>
                ) : (
                  notifications.map((n) => (
                    <li
                      key={n._id}
                      className={`p-3 rounded-2xl border text-sm ${n.read ? "bg-card/60 border-border" : "bg-accent/10 border-accent/30"}`}
                    >
                      {n.title && <p className="font-medium text-fg">{n.title}</p>}
                      <p className="text-muted-fg mt-0.5">{n.body}</p>
                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => {
                            markNotificationRead(n._id).then(loadNotifications);
                          }}
                          className="mt-2 text-xs text-accent font-medium"
                        >
                          Отметить прочитанным
                        </button>
                      )}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <div className="mt-4 bg-card/70 backdrop-blur-xl rounded-2xl border border-border shadow-ios p-4">
            <p className="font-medium text-fg">Тема</p>
            <div className="mt-3 flex rounded-2xl bg-muted p-1">
              {(["light", "system", "dark"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTheme(v)}
                  className={[
                    "flex-1 py-2 text-xs rounded-xl transition",
                    theme === v ? "bg-card text-fg shadow-ios2" : "text-muted-fg hover:text-fg",
                  ].join(" ")}
                >
                  {v === "light" ? "Светлая" : v === "dark" ? "Тёмная" : "Система"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-fg mt-2">Как в iOS: можно привязать к системной.</p>
          </div>

          {showCars && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-10">
              <div className="bg-card rounded-2xl p-4 max-w-sm w-full max-h-[80vh] overflow-auto border border-border shadow-ios">
                <p className="font-medium text-fg mb-3">Выберите автомобиль</p>
                <div className="grid grid-cols-2 gap-2">
                  {cars.map((car) => (
                    <button
                      key={car._id}
                      type="button"
                      onClick={() => handleSelectCar(car)}
                      className="rounded-2xl border border-border bg-card/70 p-2 text-center hover:bg-muted transition"
                    >
                      {(car.profile_preview_url || car.images[0]?.url) ? (
                        <img
                          src={car.profile_preview_url || car.images[0]?.url}
                          alt={car.name}
                          className="w-full h-20 object-contain rounded-xl"
                        />
                      ) : (
                        <span className="text-2xl">🚗</span>
                      )}
                      <p className="text-xs mt-1 text-muted-fg truncate">{car.name}</p>
                    </button>
                  ))}
                </div>
                {cars.length === 0 && (
                  <p className="text-sm text-muted-fg py-4">Нет доступных типов авто</p>
                )}
                <button
                  type="button"
                  onClick={() => setShowCars(false)}
                  className="mt-4 w-full py-2 border border-border rounded-xl text-fg text-sm bg-card/50"
                >
                  Закрыть
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}

      <div className="mt-6">
        <div className="mb-3 bg-card/70 backdrop-blur-xl rounded-2xl border border-border shadow-ios p-4">
          <p className="font-medium text-fg">Документы</p>
          <p className="text-xs text-muted-fg mt-1">
            Принято: {acceptedAt ?? "не принято"}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              to="/legal"
              className="flex-1 py-2 text-center rounded-xl border border-border bg-card/60 text-fg text-sm"
            >
              Открыть
            </Link>
            <button
              type="button"
              onClick={revoke}
              className="flex-1 py-2 rounded-xl bg-muted text-fg text-sm"
            >
              Отозвать
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full py-3 border border-border bg-card/60 text-fg font-medium rounded-2xl shadow-ios"
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
