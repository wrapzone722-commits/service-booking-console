import { useEffect, useMemo, useState } from "react";
import type { NewsItem } from "@shared/api";

type FormState = {
  title: string;
  body: string;
  published: boolean;
};

export default function News() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({ title: "", body: "", published: true });

  const token = useMemo(() => localStorage.getItem("session_token"), []);

  const fetchNews = async (showLoading = true) => {
    const token = localStorage.getItem("session_token");
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/news", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Не удалось загрузить новости");
      }
      const data = (await res.json()) as NewsItem[];
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить новости");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({ title: "", body: "", published: true });
  };

  const startEdit = (item: NewsItem) => {
    setEditingId(item._id);
    setForm({ title: item.title, body: item.body, published: item.published });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("session_token");
    if (!token) {
      setError("Войдите в аккаунт администратора");
      return;
    }
    if (!form.title.trim() || !form.body.trim()) {
      setError("Заполните заголовок и текст");
      return;
    }

    setSubmitting(true);
    try {
      setError(null);
      const res = await fetch(editingId ? `/api/v1/news/${editingId}` : "/api/v1/news", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          body: form.body.trim(),
          published: form.published,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(data.message || "Не удалось сохранить новость");
      await fetchNews(false);
      setShowForm(false);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить новость");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePublished = async (item: NewsItem) => {
    const token = localStorage.getItem("session_token");
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/news/${item._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ published: !item.published }),
      });
      if (!res.ok) return;
      await fetchNews(false);
    } catch {
      // silent
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Новости</h1>
            <p className="text-sm text-muted-foreground">Администратор публикует — клиенты видят в уведомлениях и вкладке «Новости».</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              if (!showForm) resetForm();
            }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold"
          >
            {showForm ? "Закрыть" : "Добавить"}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground">{editingId ? "Редактирование" : "Новая новость"}</p>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm((s) => ({ ...s, published: e.target.checked }))}
                />
                Опубликовано
              </label>
            </div>
            <input
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              placeholder="Заголовок"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background"
              disabled={submitting}
            />
            <textarea
              value={form.body}
              onChange={(e) => setForm((s) => ({ ...s, body: e.target.value }))}
              placeholder="Текст новости"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background min-h-[120px]"
              disabled={submitting}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50"
              >
                {submitting ? "Сохранение..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="px-4 py-2 rounded-lg border border-border"
              >
                Отмена
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground">Загрузка...</div>
        ) : (
          <div className="grid gap-3">
            {items.map((n) => (
              <div key={n._id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ru-RU")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => togglePublished(n)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                        n.published ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}
                      title="Переключить публикацию"
                    >
                      {n.published ? "Опубликовано" : "Черновик"}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(n)}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold bg-muted text-foreground"
                    >
                      Изм.
                    </button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{n.body}</p>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-muted-foreground">Новостей пока нет.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

