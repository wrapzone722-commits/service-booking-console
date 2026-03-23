import { useEffect, useMemo, useState } from "react";
import type { Candidate, CandidateStatus } from "@shared/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_LABELS: Record<CandidateStatus, string> = {
  new: "Новый",
  reviewed: "Просмотрено",
  interview: "Собеседование",
  accepted: "Принят",
  rejected: "Отклонён",
};

const STATUS_COLORS: Record<CandidateStatus, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  reviewed: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  interview: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  accepted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const ALL_STATUSES: CandidateStatus[] = ["new", "reviewed", "interview", "accepted", "rejected"];

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("session_token");
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export default function Candidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CandidateStatus | "">("");
  const [selected, setSelected] = useState<Candidate | null>(null);

  const fetchCandidates = async () => {
    try {
      setError(null);
      const qs = filter ? `?status=${filter}` : "";
      const res = await fetch(`/api/v1/candidates${qs}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Не удалось загрузить кандидатов");
      setCandidates(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [filter]);

  const setStatus = async (id: string, status: CandidateStatus) => {
    try {
      const res = await fetch(`/api/v1/candidates/${id}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Не удалось обновить статус");
      const updated = await res.json() as Candidate;
      setCandidates((prev) => prev.map((c) => (c._id === id ? { ...c, ...updated } : c)));
      if (selected?._id === id) setSelected((s) => s ? { ...s, ...updated } : s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить кандидата?")) return;
    await fetch(`/api/v1/candidates/${id}`, { method: "DELETE", headers: authHeaders() });
    setCandidates((prev) => prev.filter((c) => c._id !== id));
    if (selected?._id === id) setSelected(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Кандидаты</h1>
            <p className="text-sm text-muted-foreground">Отклики с сайта — раздел «Работа в компании»</p>
          </div>
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value as CandidateStatus | ""); setLoading(true); }}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
          >
            <option value="">Все статусы</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground">Загрузка...</div>
        ) : candidates.length === 0 ? (
          <div className="text-sm text-muted-foreground">Кандидатов пока нет.</div>
        ) : (
          <div className="grid gap-3">
            {candidates.map((c) => (
              <div
                key={c._id}
                className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                onClick={() => setSelected(c)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {c.photo ? (
                      <img src={c.photo} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground flex-shrink-0">
                        {c.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                    {c.desired_role && (
                      <p className="text-xs text-muted-foreground">{c.desired_role}</p>
                    )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.quiz_total > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {c.quiz_score}/{c.quiz_total}
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${STATUS_COLORS[c.status]}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(c.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selected.photo ? (
                    <img src={selected.photo} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground flex-shrink-0">
                      {selected.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span>{selected.full_name}</span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Email</span>
                    <p className="font-medium">{selected.email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Телефон</span>
                    <p className="font-medium">{selected.phone || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Желаемая должность</span>
                    <p className="font-medium">{selected.desired_role || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Дата</span>
                    <p className="font-medium">{new Date(selected.created_at).toLocaleString("ru-RU")}</p>
                  </div>
                </div>

                {selected.about && (
                  <div>
                    <span className="text-sm text-muted-foreground">О себе</span>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{selected.about}</p>
                  </div>
                )}

                {selected.quiz_total > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">
                      Тест: {selected.quiz_score} из {selected.quiz_total}
                    </p>
                    <div className="space-y-2">
                      {selected.quiz_answers.map((a, i) => (
                        <div key={i} className={`p-2.5 rounded-lg border text-sm ${a.correct ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30" : "border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-950/30"}`}>
                          <p className="font-medium text-foreground">{a.question}</p>
                          <p className="text-muted-foreground mt-0.5">
                            {a.correct ? "✓" : "✗"} {a.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="text-sm text-muted-foreground block mb-1.5">Статус</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatus(selected._id, s)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          selected.status === s
                            ? STATUS_COLORS[s] + " ring-2 ring-offset-1 ring-primary/40"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => remove(selected._id)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
                >
                  Удалить кандидата
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
