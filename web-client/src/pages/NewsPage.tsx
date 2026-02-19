import { useEffect, useState } from "react";
import { fetchNews, markNotificationRead } from "@/api/client";
import type { ClientNewsItem } from "@/api/types";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export function NewsPage() {
  const [items, setItems] = useState<ClientNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchNews();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить новости");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <p className="text-sm text-muted-fg">Загрузка новостей...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-ios p-4">
          <p className="text-sm text-fg font-medium">Ошибка</p>
          <p className="text-xs text-muted-fg mt-1">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 w-full py-2 bg-accent text-accent-fg rounded-2xl text-sm shadow-ios2"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold text-fg tracking-tight mb-3">Новости</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted-fg">Пока нет новостей.</p>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <button
              key={n._id}
              type="button"
              onClick={async () => {
                if (!n.read && n.notification_id) {
                  try {
                    await markNotificationRead(n.notification_id);
                    setItems((prev) =>
                      prev.map((x) => (x._id === n._id ? { ...x, read: true } : x))
                    );
                  } catch {
                    // non-blocking
                  }
                }
              }}
              className={[
                "w-full text-left bg-card/70 backdrop-blur-xl border rounded-2xl shadow-ios p-4 transition",
                n.read ? "border-border" : "border-accent/40",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg truncate">{n.title}</p>
                  <p className="text-xs text-muted-fg mt-0.5">{formatDate(n.created_at)}</p>
                </div>
                {!n.read && <span className="text-[10px] px-2 py-1 rounded-full bg-accent/15 text-accent">NEW</span>}
              </div>
              <p className="text-sm text-muted-fg mt-2 whitespace-pre-wrap">{n.body}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

