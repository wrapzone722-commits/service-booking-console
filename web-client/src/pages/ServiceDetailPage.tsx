import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchService } from "@/api/client";
import type { Service } from "@/api/types";
import { formatPrice, formatDuration } from "@/lib/format";

export function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchService(id)
      .then((data) => {
        if (!cancelled) setService(data);
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
  }, [id]);

  if (!id) return null;
  if (loading && !service) return <div className="p-4 max-w-md mx-auto text-muted-fg">Загрузка...</div>;
  if (error && !service) return <div className="p-4 text-red-600">{error}</div>;
  if (!service) return <div className="p-4 max-w-md mx-auto text-muted-fg">Услуга не найдена</div>;

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="bg-card/70 backdrop-blur-xl rounded-2xl border border-border shadow-ios p-5 mb-4">
        <p className="text-xs text-muted-fg mb-2">{service.category}</p>
        <h1 className="text-2xl font-semibold text-fg tracking-tight">{service.name}</h1>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-accent font-semibold">{formatPrice(service.price)}</span>
          <span className="text-sm text-muted-fg">·</span>
          <span className="text-sm text-muted-fg">{formatDuration(service.duration)}</span>
        </div>
        <p className="text-sm text-muted-fg mt-4 leading-relaxed">{service.description}</p>
      </div>
      <Link
        to={`/services/${id}/book`}
        className="block w-full py-3.5 text-center bg-accent text-accent-fg font-semibold rounded-2xl shadow-ios2"
      >
        Записаться
      </Link>
    </div>
  );
}
