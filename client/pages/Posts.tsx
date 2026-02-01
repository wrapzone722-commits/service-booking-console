import { useEffect, useMemo, useState } from "react";
import type { Post, PostIntervalMinutes } from "@shared/api";

type DaySlot = { time: string; is_closed: boolean };
type WorkingHours = { start: number; end: number; start_time: string; end_time: string };

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
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayYMD());
  const [daySlots, setDaySlots] = useState<DaySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPostName, setNewPostName] = useState("");
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

  const [showAiForm, setShowAiForm] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

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
      if (!data.length) setSelectedId("");
      setLoadError(null);
    } catch (e) {
      console.error(e);
      setLoadError("Ошибка загрузки постов");
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkingHours = async () => {
    try {
      const res = await fetch("/api/v1/working-hours");
      if (res.ok) {
        const wh = (await res.json()) as WorkingHours;
        setWorkingHours(wh);
      }
    } catch {
      setWorkingHours({ start: 9, end: 18, start_time: "09:00", end_time: "18:00" });
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
    fetchWorkingHours();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetchDaySlots(selectedId, date);
  }, [selectedId, date]);

  const patchPost = async (patch: Partial<Post>) => {
    if (!selected) return;
    setPosts((prev) => prev.map((p) => (p._id === selectedId ? { ...p, ...patch } : p)));
    try {
      const updated = { ...selected, ...patch };
      const res = await fetch(`/api/v1/posts/${selected._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updated.name,
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

  const createPost = async (name?: string) => {
    try {
      const res = await fetch("/api/v1/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name?.trim() || newPostName.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const post = (await res.json()) as Post;
      setPosts((prev) => [...prev, post]);
      setSelectedId(post._id);
      setShowCreateForm(false);
      setNewPostName("");
      await fetchDaySlots(post._id, date);
    } catch (e) {
      console.error(e);
      setError("Ошибка создания поста");
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm("Удалить пост?")) return;
    try {
      const res = await fetch(`/api/v1/posts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setPosts((prev) => prev.filter((p) => p._id !== id));
      if (selectedId === id) setSelectedId(posts.find((p) => p._id !== id)?._id ?? "");
    } catch (e) {
      console.error(e);
      setError("Ошибка удаления");
    }
  };

  const savePostName = async () => {
    if (!editingNameId || !editingNameValue.trim()) {
      setEditingNameId(null);
      return;
    }
    const post = posts.find((p) => p._id === editingNameId);
    if (post) {
      setPosts((prev) => prev.map((p) => (p._id === editingNameId ? { ...p, name: editingNameValue.trim() } : p)));
      try {
        const res = await fetch(`/api/v1/posts/${editingNameId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...post, name: editingNameValue.trim() }),
        });
        if (res.ok) {
          const result = (await res.json()) as Post;
          setPosts((prev) => prev.map((p) => (p._id === result._id ? result : p)));
        }
      } catch (e) {
        console.error(e);
      }
    }
    setEditingNameId(null);
  };

  const updateWorkingHours = async (start: number, end: number) => {
    try {
      const res = await fetch("/api/v1/working-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end }),
      });
      if (!res.ok) throw new Error("Failed");
      const wh = (await res.json()) as WorkingHours;
      setWorkingHours(wh);
      if (selected && !selected.use_custom_hours) {
        await fetchDaySlots(selected._id, date);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAiCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    try {
      setAiLoading(true);
      setAiMessage(null);
      setError(null);
      const res = await fetch("/api/v1/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Создай пост: ${aiPrompt}` }],
        }),
      });
      const data = await res.json();
      if (data.type === "error") {
        setError(data.message);
        return;
      }
      if (data.type === "create_post_result") {
        setAiMessage(`✓ ${data.message}: "${data.post.name}"`);
        await fetchPosts();
        setAiPrompt("");
      } else {
        setAiMessage(data.message || "Не удалось создать пост");
      }
    } catch (err) {
      console.error(err);
      setError("Ошибка подключения к ассистенту");
    } finally {
      setAiLoading(false);
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
      <div className="min-h-[50vh] bg-background flex items-center justify-center">
        <div className="text-xs text-muted-foreground animate-pulse-soft">Загрузка…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[50vh] bg-background flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-3 max-w-xs w-full text-xs">
          <div className="font-bold mb-1">Ошибка</div>
          <div className="text-muted-foreground mb-2">{loadError}</div>
          <button
            onClick={() => { setLoadError(null); fetchPosts(); }}
            className="w-full px-2 py-1.5 bg-primary text-primary-foreground rounded font-semibold text-xs hover:bg-blue-600"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-foreground">Посты ({posts.length})</h1>
            <p className="text-xs text-muted-foreground">Управление временем и слотами</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAiForm(!showAiForm); setShowCreateForm(false); setAiMessage(null); }}
              className="px-3 py-2.5 min-h-[44px] text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:bg-purple-800 transition-colors font-semibold"
            >
              {showAiForm ? "✕" : "🤖 Создать с ИИ"}
            </button>
            <button
              onClick={() => { setShowCreateForm(!showCreateForm); setShowAiForm(false); }}
              className="px-3 py-2.5 min-h-[44px] text-sm bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors font-semibold"
            >
              {showCreateForm ? "✕" : "+ Добавить"}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {/* AI Form */}
        {showAiForm && (
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 space-y-3">
            <h3 className="font-semibold text-purple-900">🤖 Создать пост с ИИ</h3>
            <form onSubmit={handleAiCreate} className="flex gap-2">
              <input
                type="text"
                placeholder='Например: "Пост 1", "Бокс А", "Эстакада"'
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-purple-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={aiLoading}
              />
              <button
                type="submit"
                disabled={aiLoading || !aiPrompt.trim()}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold disabled:opacity-50"
              >
                {aiLoading ? "Создание..." : "Создать"}
              </button>
            </form>
            {aiMessage && <div className="p-2 bg-white rounded border border-purple-200 text-sm text-purple-800">{aiMessage}</div>}
          </div>
        )}

        {/* Manual Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg p-4 border border-border flex gap-2">
            <input
              type="text"
              placeholder="Название поста"
              value={newPostName}
              onChange={(e) => setNewPostName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPost()}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button onClick={() => createPost()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-blue-600">
              Создать
            </button>
          </div>
        )}

        {/* Global Working Hours */}
        {workingHours && (
          <div className="bg-white rounded-lg border border-border p-4">
            <h2 className="text-sm font-bold text-foreground mb-3">Общее рабочее время</h2>
            <p className="text-xs text-muted-foreground mb-2">Используется постами без индивидуального расписания</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold">Начало</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={workingHours.start}
                  onChange={(e) => updateWorkingHours(parseInt(e.target.value, 10) || 0, workingHours.end)}
                  className="w-16 px-2 py-1 text-sm rounded border border-border"
                />
                <span className="text-xs text-muted-foreground">ч</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold">Конец</label>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={workingHours.end}
                  onChange={(e) => updateWorkingHours(workingHours.start, parseInt(e.target.value, 10) || 0)}
                  className="w-16 px-2 py-1 text-sm rounded border border-border"
                />
                <span className="text-xs text-muted-foreground">ч</span>
              </div>
              <span className="text-xs text-muted-foreground">({workingHours.start_time} – {workingHours.end_time})</span>
            </div>
          </div>
        )}

        {/* Posts tabs */}
        {posts.length === 0 ? (
          <div className="bg-white rounded-lg border border-border p-8 text-center">
            <p className="text-muted-foreground mb-4">Нет постов. Создайте первый — вручную или с помощью ИИ.</p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => { setShowCreateForm(true); setShowAiForm(false); }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold"
              >
                + Добавить
              </button>
              <button
                onClick={() => { setShowAiForm(true); setShowCreateForm(false); }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold"
              >
                🤖 Создать с ИИ
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 bg-white rounded-lg p-2 border border-border">
              {posts.map((p) => (
                <div key={p._id} className="flex items-center gap-1">
                  {editingNameId === p._id ? (
                    <input
                      type="text"
                      value={editingNameValue}
                      onChange={(e) => setEditingNameValue(e.target.value)}
                      onBlur={savePostName}
                      onKeyDown={(e) => e.key === "Enter" && savePostName()}
                      autoFocus
                      className="px-2 py-1 text-xs rounded border border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <button
                      onClick={() => setSelectedId(p._id)}
                      onDoubleClick={() => { setEditingNameId(p._id); setEditingNameValue(p.name); }}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded whitespace-nowrap ${
                        selectedId === p._id ? "bg-primary text-primary-foreground" : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {p.name}
                      <span className={`text-[9px] ml-1 ${selectedId === p._id ? "text-primary-foreground opacity-80" : "text-muted-foreground"}`}>
                        {p.is_enabled ? "✓" : "✕"}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePost(p._id); }}
                    className="p-1 text-red-500 hover:bg-red-50 rounded text-[10px]"
                    title="Удалить пост"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>

            {selected && (
              <>
                <div className="bg-white rounded-lg border border-border p-4 space-y-3">
                  <h2 className="text-sm font-bold text-foreground">{selected.name} — настройки</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.is_enabled}
                        onChange={(e) => patchPost({ is_enabled: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-semibold">Активен</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.use_custom_hours}
                        onChange={(e) => patchPost({ use_custom_hours: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-semibold">Своё время</span>
                    </label>
                    {selected.use_custom_hours && (
                      <>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Начало</label>
                          <input
                            type="time"
                            value={selected.start_time}
                            onChange={(e) => patchPost({ start_time: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm rounded border border-border"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Конец</label>
                          <input
                            type="time"
                            value={selected.end_time}
                            onChange={(e) => patchPost({ end_time: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm rounded border border-border"
                          />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Интервал (мин)</label>
                      <select
                        value={selected.interval_minutes}
                        onChange={(e) => patchPost({ interval_minutes: Number(e.target.value) as PostIntervalMinutes })}
                        className="w-full px-2 py-1.5 text-sm rounded border border-border"
                      >
                        {[30, 60, 90, 120].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {!selected.use_custom_hours && workingHours && (
                    <p className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                      Используется общее время: {workingHours.start_time} – {workingHours.end_time}
                    </p>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h2 className="text-sm font-bold">Слоты на {date}</h2>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="px-2 py-1 text-sm rounded border border-border"
                    />
                  </div>
                  {slotsLoading ? (
                    <p className="text-sm text-muted-foreground">Загрузка…</p>
                  ) : daySlots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет слотов (возможно, дата в прошлом)</p>
                  ) : (
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1">
                      {daySlots.map((s) => (
                        <button
                          key={s.time}
                          onClick={() => toggleSlotClosed(s.time, !s.is_closed)}
                          className={`px-2 py-1.5 rounded text-xs font-bold border ${
                            s.is_closed
                              ? "bg-red-100 border-red-300 text-red-700 hover:bg-red-200"
                              : "bg-green-100 border-green-300 text-green-700 hover:bg-green-200"
                          }`}
                          title={toHHMM(s.time)}
                        >
                          {toHHMM(s.time)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
