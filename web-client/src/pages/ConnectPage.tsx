import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { useBackend } from "@/context/BackendContext";
import { useAuth } from "@/context/AuthContext";
import { fetchTelegramWidgetConfig, loginByTelegramWidget } from "@/api/client";

export function ConnectPage() {
  const { apiBaseUrl, setFromManual, setFromQr } = useBackend();
  const { setToken, apiKey } = useAuth();
  const navigate = useNavigate();
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [tgBot, setTgBot] = useState<string | null>(null);
  const [tgError, setTgError] = useState<string | null>(null);
  const tgContainerRef = useRef<HTMLDivElement | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reader = useMemo(() => new BrowserMultiFormatReader(), []);

  // Telegram config (bot username) — доступно только после выбора бэкенда
  useEffect(() => {
    if (!apiBaseUrl) return;
    setTgError(null);
    fetchTelegramWidgetConfig()
      .then((r) => setTgBot(r.bot_username))
      .catch((e) => {
        // если Telegram не настроен на бэкенде — просто скрываем кнопку
        setTgBot(null);
        if (e instanceof Error) setTgError(e.message);
      });
  }, [apiBaseUrl]);

  // Рендерим Telegram Login Widget в контейнер
  useEffect(() => {
    if (!apiBaseUrl || !tgBot) return;
    if (!tgContainerRef.current) return;

    (window as unknown as { onTelegramAuth?: (user: unknown) => void }).onTelegramAuth = async (user: unknown) => {
      try {
        const resp = await loginByTelegramWidget(user as Record<string, unknown>);
        setToken(resp.session_token);
        navigate("/", { replace: true });
      } catch (e) {
        setTgError(e instanceof Error ? e.message : "Ошибка входа через Telegram");
      }
    };

    // Очищаем контейнер и вставляем скрипт виджета заново
    tgContainerRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", tgBot);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-lang", "ru");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    tgContainerRef.current.appendChild(script);

    return () => {
      delete (window as unknown as { onTelegramAuth?: unknown }).onTelegramAuth;
    };
  }, [apiBaseUrl, tgBot, navigate, setToken]);

  useEffect(() => {
    if (!scanning) return;
    let stopped = false;
    let controls: IScannerControls | null = null;
    setError(null);

    const start = async () => {
      try {
        if (!videoRef.current) throw new Error("Видеоэлемент не найден");
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
          if (stopped) return;
          if (result) {
            const raw = result.getText();
            const parsed = setFromQr(raw);
            if (!parsed) {
              setError("QR-код распознан, но URL бэкенда не найден. Ожидаю формат URL или JSON с api_url.");
              return;
            }
            setScanning(false);
          }
          if (err) {
            // zxing часто кидает NotFoundException пока не нашёл QR — это нормально
          }
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось запустить камеру");
        setScanning(false);
      }
    };

    start();

    return () => {
      stopped = true;
      try { controls?.stop(); } catch { /* ignore */ }
    };
  }, [scanning, reader, navigate, setFromQr]);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-semibold text-fg tracking-tight">Подключение</h1>
        <p className="text-sm text-muted-fg mt-2">
          Отсканируйте QR-код из консоли или введите URL сервера вручную.
        </p>

        <div className="mt-4 bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-ios p-4 space-y-3">
          {apiBaseUrl && (
            <div className="p-3 rounded-2xl bg-accent/10 border border-accent/25">
              <p className="text-sm text-fg">
                Подключено: <span className="font-medium text-fg">{apiBaseUrl}</span>
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/", { replace: true })}
                  className="px-3 py-1.5 bg-accent text-accent-fg rounded-xl text-sm shadow-ios2"
                >
                  Продолжить
                </button>
                {!apiKey && tgBot && (
                  <span className="text-xs text-muted-fg self-center">Можно войти через Telegram ниже</span>
                )}
              </div>
            </div>
          )}
          <label className="block text-sm font-medium text-fg">URL бэкенда</label>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="https://example.com"
            className="w-full border border-border bg-card rounded-2xl px-3 py-2 text-sm text-fg placeholder:text-muted-fg"
            inputMode="url"
          />
          <button
            type="button"
            onClick={() => {
              setError(null);
              if (!manual.trim()) return;
              setFromManual(manual);
            }}
            className="w-full py-2 bg-accent text-accent-fg rounded-2xl text-sm shadow-ios2"
          >
            Сохранить
          </button>

          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setScanning((v) => !v)}
              className="w-full py-2 border border-border bg-card/50 rounded-2xl text-sm text-fg"
            >
              {scanning ? "Остановить сканер" : "Сканировать QR-код"}
            </button>

            {scanning && (
              <div className="mt-3">
                <div className="rounded-2xl overflow-hidden bg-black aspect-video ring-1 ring-border">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                </div>
                <p className="text-xs text-muted-fg mt-2">
                  Камера работает только по HTTPS (или на localhost). Разрешите доступ к камере в браузере.
                </p>
              </div>
            )}
          </div>

          {apiBaseUrl && tgBot && (
            <div className="pt-2 border-t border-border">
              <p className="text-sm font-medium text-fg mb-2">Авторизация</p>
              {apiKey && (
                <p className="text-xs text-muted-fg mb-2">
                  Сейчас токен уже есть. Вход через Telegram заменит его.
                </p>
              )}
              <div ref={tgContainerRef} />
              <p className="text-xs text-muted-fg mt-2">
                Если виджет не появляется — проверьте, что домен добавлен в настройках бота (BotFather) и на бэкенде
                задан `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME`.
              </p>
            </div>
          )}
        </div>

        {(error || tgError) && (
          <div className="mt-3 text-sm text-red-600 bg-card/60 backdrop-blur-xl border border-border rounded-2xl p-3 shadow-ios">
            {error || tgError}
          </div>
        )}
      </div>
    </div>
  );
}

