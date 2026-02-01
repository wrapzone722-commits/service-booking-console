import { useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type AssistantResponse =
  | { type: "message"; message: string }
  | { type: "create_service_result"; message: string; service?: { name?: string } }
  | { type: "create_post_result"; message: string; post?: { name?: string } }
  | { type: "error"; message: string };

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function Assistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: 'Я ассистент. Могу создать услугу или пост — напишите, например: "создай услугу Экспресс-мойка 1500₽ 30мин" или "создай пост Бокс А".',
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("assistant_settings");
      const p = saved ? JSON.parse(saved) : null;
      if (p?.mode === "custom")
        return { mode: "custom" as const, apiEndpoint: p.apiEndpoint ?? "", apiKey: p.apiKey ?? "", model: p.model ?? "" };
      if (p?.mode === "builtin")
        return { mode: "builtin" as const, apiEndpoint: "", apiKey: "", model: "" };
    } catch {}
    return { mode: "builtin" as const, apiEndpoint: "", apiKey: "", model: "" };
  });

  useEffect(() => {
    document.title = "ServiceBooking — Ассистент";
  }, []);

  useEffect(() => {
    localStorage.setItem("assistant_settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const payloadMessages = useMemo(
    () => messages.map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  const getConfig = () => {
    if (settings.mode === "builtin") return {};
    return {
      apiEndpoint: settings.apiEndpoint.trim() || undefined,
      apiKey: settings.apiKey.trim() || undefined,
      model: settings.model.trim() || undefined,
    };
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (settings.mode === "custom") {
      if (!settings.apiEndpoint.trim() || !settings.apiKey.trim()) {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: "Укажите API Endpoint и API Key в настройках." },
        ]);
        setShowSettings(true);
        return;
      }
    }

    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      setSending(true);
      const res = await fetch("/api/v1/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...payloadMessages, { role: "user", content: text }],
          config: getConfig(),
        }),
      });

      const data = (await res.json()) as AssistantResponse;

      if (!res.ok || data.type === "error") {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: data.type === "error" ? data.message : "Ошибка ассистента" },
        ]);
        return;
      }

      if (data.type === "create_service_result") {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: `${data.message}${data.service?.name ? ` — «${data.service.name}»` : ""}`,
          },
        ]);
        return;
      }

      if (data.type === "create_post_result") {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: `${data.message}${data.post?.name ? ` — «${data.post.name}»` : ""}`,
          },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: data.message }]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: "Не удалось связаться с сервером" },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ассистент</h1>
            <p className="text-xs text-muted-foreground">Создание услуг и постов</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{sending ? "думаю…" : "готов"}</span>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-gray-200 transition-colors font-semibold"
            >
              {showSettings ? "✕" : "⚙️"}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-4xl">
        {showSettings && (
          <div className="bg-white rounded-lg shadow-sm border border-border p-4 mb-4 space-y-4">
            <h2 className="text-sm font-bold text-foreground">Настройки AI</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSettings((s) => ({ ...s, mode: "builtin" }))}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border ${
                  settings.mode === "builtin" ? "bg-primary text-primary-foreground border-primary" : "bg-gray-50 border-border"
                }`}
              >
                Встроенный (Timeweb)
              </button>
              <button
                onClick={() => setSettings((s) => ({ ...s, mode: "custom" }))}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border ${
                  settings.mode === "custom" ? "bg-primary text-primary-foreground border-primary" : "bg-gray-50 border-border"
                }`}
              >
                Свой API
              </button>
            </div>

            {settings.mode === "custom" && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">API Endpoint</label>
                  <input
                    type="text"
                    value={settings.apiEndpoint}
                    onChange={(e) => setSettings((s) => ({ ...s, apiEndpoint: e.target.value }))}
                    placeholder="https://openrouter.ai/api/v1"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">API Key</label>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
                    placeholder="sk-or-v1-..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Модель (опционально)</label>
                  <input
                    type="text"
                    value={settings.model}
                    onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                    placeholder="google/gemma-3-4b-it:free"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-border p-4">
          <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap border ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-gray-50 text-foreground border-border"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder='Например: "создай услугу полировка кузова 5000₽ 2ч"'
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 font-semibold disabled:opacity-50"
            >
              Отправить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
