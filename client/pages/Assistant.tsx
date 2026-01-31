import { useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type AssistantResponse =
  | { type: "message"; message: string }
  | { type: "create_service_result"; message: string; service: any }
  | { type: "error"; message: string };

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function Assistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Я ассистент админ‑панели. Могу подсказать по работе системы и выполнять задачи, например: \"создай услугу\".",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("assistant_settings");
    return saved
      ? JSON.parse(saved)
      : {
          provider: "openai",
          apiEndpoint: "https://api.openai.com/v1",
          apiKey: "",
          model: "gpt-4",
        };
  });

  const PROVIDERS = {
    openai: {
      name: "OpenAI",
      endpoint: "https://api.openai.com/v1",
      models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
      defaultModel: "gpt-4",
      keyFormat: "sk-...",
    },
    timeweb: {
      name: "Timeweb Cloud AI",
      endpoint: "https://agent.timeweb.cloud/api/v1/cloud-ai/agents/bb83069e-f7de-48ac-adf5-5d804ce47381/v1",
      models: ["timeweb-ai"],
      defaultModel: "timeweb-ai",
      keyFormat: "API key from Timeweb",
    },
  };

  const handleProviderChange = (provider: "openai" | "timeweb") => {
    const providerConfig = PROVIDERS[provider];
    setSettings({
      provider,
      apiEndpoint: providerConfig.endpoint,
      apiKey: settings.apiKey, // Keep existing key
      model: providerConfig.defaultModel,
    });
  };

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
    () =>
      messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    [messages]
  );

  const validateSettings = (): boolean => {
    if (!settings.apiEndpoint.trim()) {
      alert("Введите API endpoint");
      return false;
    }
    if (!settings.apiKey.trim()) {
      alert("Введите API key");
      return false;
    }
    if (!settings.model.trim()) {
      alert("Введите название модели");
      return false;
    }
    return true;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (!validateSettings()) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: "Ошибка: не настроены параметры ассистента. Проверьте настройки.",
        },
      ]);
      setShowSettings(true);
      return;
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
          config: {
            apiEndpoint: settings.apiEndpoint,
            apiKey: settings.apiKey,
            model: settings.model,
          },
        }),
      });

      const data = (await res.json()) as AssistantResponse;

      if (!res.ok || data.type === "error") {
        const msg = data.type === "error" ? data.message : "Ошибка ассистента";
        setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: msg }]);
        return;
      }

      if (data.type === "create_service_result") {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: `${data.message}\n\nСоздана услуга: ${data.service?.name ?? ""}`,
          },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { id: uid(), role: "assistant", content: data.message }]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: "Не удалось связаться с сервером ассистента" },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ассистент</h1>
            <p className="text-xs text-muted-foreground">Подсказки и действия через GPT API</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground">{sending ? "думаю…" : "готов"}</div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 py-1.5 text-xs bg-secondary text-secondary-foreground rounded-lg hover:bg-gray-200 transition-colors font-semibold"
            >
              {showSettings ? "✕ Скрыть" : "⚙️ Настройки"}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-4xl">
        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-white rounded-lg shadow-sm border border-border p-4 mb-4 animate-slide-in space-y-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">Настройки AI ассистента</h2>
              <button
                onClick={() => {
                  setSettings({
                    provider: "openai",
                    apiEndpoint: "https://api.openai.com/v1",
                    apiKey: "",
                    model: "gpt-4",
                  });
                }}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Сбросить
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">
                  Поставщик AI
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PROVIDERS).map(([key, provider]) => (
                    <button
                      key={key}
                      onClick={() => handleProviderChange(key as "openai" | "timeweb")}
                      className={`px-3 py-2 text-xs rounded-lg font-semibold transition-all border ${
                        settings.provider === key
                          ? "bg-primary text-primary-foreground border-primary shadow-md"
                          : "bg-gray-50 border-border text-foreground hover:bg-gray-100"
                      }`}
                    >
                      {provider.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  API Endpoint
                </label>
                <input
                  type="text"
                  value={settings.apiEndpoint}
                  onChange={(e) => setSettings({ ...settings, apiEndpoint: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {settings.provider === "timeweb"
                    ? "Timeweb Cloud AI agent endpoint"
                    : "OpenAI-совместимый API endpoint"}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                  placeholder={PROVIDERS[settings.provider as keyof typeof PROVIDERS]?.keyFormat || "sk-..."}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {settings.provider === "timeweb"
                    ? "API ключ от Timeweb Cloud"
                    : "API ключ OpenAI"}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Модель AI
                </label>
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PROVIDERS[settings.provider as keyof typeof PROVIDERS]?.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900 font-semibold mb-1">💡 Подсказка</p>
                <p className="text-xs text-blue-800">
                  Настройки сохраняются локально в браузере. API ключ используется только на сервере и не передается в небезопасном виде.
                </p>
              </div>
            </div>
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
              placeholder='Например: "Создай услугу Экспресс-мойка 1500р 30мин"'
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={sending}
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50"
            >
              Отправить
            </button>
          </div>

          <div className="mt-3 text-[11px] text-muted-foreground">
            Важно: ассистент выполняет действия только на стороне сервера. Для работы GPT нужен ключ OPENAI_API_KEY.
          </div>
        </div>
      </div>
    </div>
  );
}
