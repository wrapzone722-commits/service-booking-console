import { useEffect, useMemo, useState } from "react";
import type { Post, PostIntervalMinutes } from "@shared/api";

type DaySlot = { time: string; is_closed: boolean };

function toHHMM(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Posts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedId, setSelectedId] = useState<string>("post_1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayYMD());
  const [daySlots, setDaySlots] = useState<DaySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");

  const selected = useMemo(() => posts.find((p) => p._id === selectedId) ?? null, [posts, selectedId]);

  useEffect(() => {
    document.title = "ServiceBooking — Посты";
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/posts");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as Post[];
      setPosts(data);
      if (data.length && !data.some((p) => p._id === selectedId)) {
        setSelectedId(data[0]._id);
      }
      setError(null);
    } catch (e) {
      console.error(e);
      setError("Ошибка загрузки постов");
    } finally {
      setLoading(false);
    }
  };

  const fetchDaySlots = async (postId: string, ymd: string) => {
    try {
      setSlotsLoading(true);
      const res = await fetch(`/api/v1/posts/${postId}/slots?date=${encodeURIComponent(ymd)}`);
      if (!res.ok) throw new Error("Failed to fetch slots");
      const data = (await res.json()) as DaySlot[];
      setDaySlots(data);
    } catch (e) {
      console.error(e);
      setDaySlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetchDaySlots(selectedId, date);
  }, [selectedId, date]);

  const savePost = async () => {
    if (!selected) return;
    try {
      setSaveStatus("saving");
      const res = await fetch(`/api/v1/posts/${selected._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_enabled: selected.is_enabled,
          use_custom_hours: selected.use_custom_hours,
          start_time: selected.start_time,
          end_time: selected.end_time,
          interval_minutes: selected.interval_minutes,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = (await res.json()) as Post;
      setPosts((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      await fetchDaySlots(updated._id, date);
      setSaveStatus("saved");
    } catch (e) {
      console.error(e);
      setSaveStatus("saved");
    }
  };

  const patchPost = async (patch: Partial<Post>) => {
    if (!selected) return;
    setPosts((prev) => prev.map((p) => (p._id === selectedId ? { ...p, ...patch } : p)));
    
    // Auto-save
    try {
      const updated = { ...selected, ...patch };
      const res = await fetch(`/api/v1/posts/${selected._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_enabled: updated.is_enabled,
          use_custom_hours: updated.use_custom_hours,
          start_time: updated.start_time,
          end_time: updated.end_time,
          interval_minutes: updated.interval_minutes,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const result = (await res.json()) as Post;
      setPosts((prev) => prev.map((p) => (p._id === result._id ? result : p)));
      await fetchDaySlots(result._id, date);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSlotClosed = async (time: string, closed: boolean) => {
    if (!selected) return;
    setDaySlots((prev) => prev.map((s) => (s.time === time ? { ...s, is_closed: closed } : s)));
    try {
      const res = await fetch(`/api/v1/posts/${selected._id}/slots/closed`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time, closed }),
      });
      if (!res.ok) throw new Error("Failed");
    } catch (e) {
      console.error(e);
      setDaySlots((prev) => prev.map((s) => (s.time === time ? { ...s, is_closed: !closed } : s)));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xs text-muted-foreground animate-pulse-soft">Загрузка…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-3 max-w-xs w-full text-xs">
          <div className="font-bold mb-1">Ошибка</div>
          <div className="text-muted-foreground mb-2">{error}</div>
          <button
            onClick={fetchPosts}
            className="w-full px-2 py-1.5 bg-primary text-primary-foreground rounded font-semibold text-xs hover:bg-blue-600"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="px-4 py-2 flex items-center justify-between gap-2">
          <h1 className="text-sm font-bold text-foreground">Посты (4)</h1>
          <div className="text-[11px] text-muted-foreground">Управление временем и слотами</div>
          <span
            className={`text-[10px] font-bold px-2 py-1 rounded ${
              saveStatus === "saving" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
            }`}
          >
            {saveStatus === "saving" ? "Сохраняю…" : "Сохранено"}
          </span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Posts tabs/selector */}
        <div className="flex gap-1.5 bg-white rounded-lg p-1.5 border border-border overflow-x-auto animate-slide-in">
          {posts.map((p) => (
            <button
              key={p._id}
              onClick={() => setSelectedId(p._id)}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded transition-all whitespace-nowrap ${
                selectedId === p._id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-gray-100 text-foreground hover:bg-gray-200"
              }`}
            >
              {p.name}
              <span className={`text-[9px] ml-1 ${selectedId === p._id ? "text-primary-foreground" : "text-muted-foreground"}`}>
                {p.is_enabled ? "✓" : "✕"}
              </span>
            </button>
          ))}
        </div>

        {selected && (
          <>
            {/* Settings in one compact row */}
            <div className="bg-white rounded-lg border border-border p-2.5 animate-slide-in space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {/* Enable toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer p-1.5 rounded hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.is_enabled}
                    onChange={(e) => patchPost({ is_enabled: e.target.checked })}
                    className="h-3 w-3"
                  />
                  <span className="text-[11px] font-semibold">Активен</span>
                </label>

                {/* Custom hours toggle */}
                <label className="flex items-center gap-1.5 cursor-pointer p-1.5 rounded hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.use_custom_hours}
                    onChange={(e) => patchPost({ use_custom_hours: e.target.checked })}
                    className="h-3 w-3"
                  />
                  <span className="text-[11px] font-semibold">Своё время</span>
                </label>

                {/* Start time (if custom hours) */}
                {selected.use_custom_hours && (
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] text-muted-foreground font-bold">Начало</label>
                    <input
                      type="time"
                      value={selected.start_time}
                      onChange={(e) => patchPost({ start_time: e.target.value })}
                      className="px-1.5 py-1 text-xs rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {/* End time (if custom hours) */}
                {selected.use_custom_hours && (
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] text-muted-foreground font-bold">Конец</label>
                    <input
                      type="time"
                      value={selected.end_time}
                      onChange={(e) => patchPost({ end_time: e.target.value })}
                      className="px-1.5 py-1 text-xs rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {/* Interval */}
                <div className="flex flex-col gap-0.5">
                  <label className="text-[10px] text-muted-foreground font-bold">Интервал</label>
                  <select
                    value={selected.interval_minutes}
                    onChange={(e) => patchPost({ interval_minutes: Number(e.target.value) as PostIntervalMinutes })}
                    className="px-1.5 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                  >
                    {[30, 60, 90, 120].map((m) => (
                      <option key={m} value={m}>
                        {m}м
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Info text */}
              {!selected.use_custom_hours && (
                <div className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-1 rounded border border-blue-200">
                  Используется общее время: 09:00 - 18:00
                </div>
              )}
            </div>

            {/* Slots section - ultra compact */}
            <div className="bg-white rounded-lg border border-border p-2.5 animate-slide-in">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-xs font-bold">Слоты {date}</div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-1.5 py-0.5 text-xs rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {slotsLoading ? (
                <div className="text-[11px] text-muted-foreground py-1.5">Загрузка…</div>
              ) : daySlots.length === 0 ? (
                <div className="text-[11px] text-muted-foreground py-1.5">Нет слотов</div>
              ) : (
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-14 gap-1">
                  {daySlots.map((s) => {
                    const closed = s.is_closed;
                    return (
                      <button
                        key={s.time}
                        onClick={() => toggleSlotClosed(s.time, !closed)}
                        className={`px-1 py-1 rounded text-[9px] font-bold transition-all border leading-tight ${
                          closed
                            ? "bg-red-100 border-red-300 text-red-700 hover:bg-red-200"
                            : "bg-green-100 border-green-300 text-green-700 hover:bg-green-200"
                        }`}
                        title={toHHMM(s.time)}
                      >
                        {toHHMM(s.time).split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
