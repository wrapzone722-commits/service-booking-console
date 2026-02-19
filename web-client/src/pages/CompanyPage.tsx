import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCompany } from "@/api/client";
import type { CompanyInfo } from "@/api/types";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/60 last:border-b-0">
      <span className="text-xs text-muted-fg">{label}</span>
      <span className="text-sm text-fg text-right whitespace-pre-wrap">{value}</span>
    </div>
  );
}

export function CompanyPage() {
  const [data, setData] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await fetchCompany());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить данные компании");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-end justify-between mb-4">
        <h1 className="text-2xl font-semibold text-fg tracking-tight">О компании</h1>
        <Link to="/profile" className="text-sm text-accent font-medium">
          Назад
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted-fg">Загрузка...</p>
      ) : error ? (
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
      ) : (
        <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-ios p-4">
          <p className="text-sm font-semibold text-fg">{data?.name}</p>
          <div className="mt-3">
            <Field label="Телефон" value={data?.phone} />
            <Field label="Доп. телефон" value={data?.phone_extra} />
            <Field label="Email" value={data?.email} />
            <Field label="Сайт" value={data?.website} />
            <Field label="Адрес" value={data?.address} />
            <Field label="Юр. адрес" value={data?.legal_address} />
            <Field label="ИНН" value={data?.inn} />
            <Field label="ОГРН/ОГРНИП" value={data?.ogrn} />
            <Field label="КПП" value={data?.kpp} />
            <Field label="Руководитель" value={data?.director_name} />
          </div>
        </div>
      )}
    </div>
  );
}

