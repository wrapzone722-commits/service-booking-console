import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchServices } from "@/api/client";
import type { Service } from "@/api/types";
import { formatPrice, formatDuration } from "@/lib/format";

export function HomePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchServices()
      .then((data) => {
        if (!cancelled) setServices(data.filter((s) => s.is_active));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = search.trim()
    ? services.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.category.toLowerCase().includes(search.toLowerCase())
      )
    : services;

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-end justify-between mb-4">
        <h1 className="text-3xl font-semibold text-fg tracking-tight">Услуги</h1>
      </div>
      <div className="relative mb-4">
        <input
          type="search"
          placeholder="Поиск услуг"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-border rounded-2xl bg-card/70 backdrop-blur-xl text-fg placeholder:text-muted-fg shadow-ios"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg">🔍</span>
      </div>
      {loading && services.length === 0 ? (
        <div className="text-center py-10 text-muted-fg">Загрузка услуг...</div>
      ) : error && services.length === 0 ? (
        <div className="text-center py-8 text-red-600">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-fg">Нет услуг</div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((s) => (
            <li key={s._id}>
              <Link
                to={`/services/${s._id}`}
                className="block p-4 bg-card/70 backdrop-blur-xl rounded-2xl border border-border shadow-ios hover:shadow-ios2 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-medium text-fg">{s.name}</h2>
                    <p className="text-sm text-muted-fg mt-0.5">{s.category}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-accent font-semibold">{formatPrice(s.price)}</span>
                    <p className="text-xs text-muted-fg mt-0.5">{formatDuration(s.duration)}</p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
