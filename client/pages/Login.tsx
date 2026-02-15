import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const ACCEPTED_AT_KEY = "sb_console_legal_accepted_at";
const VERSION_KEY = "sb_console_legal_version";
const LEGAL_VERSION = "2026-02-15";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(() => {
    const v = localStorage.getItem(VERSION_KEY);
    const at = localStorage.getItem(ACCEPTED_AT_KEY);
    return !!at && v === LEGAL_VERSION;
  });

  useEffect(() => {
    document.title = "ServiceBooking — Вход";
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (token) {
      window.location.replace("/");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Введите номер телефона");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/v1/auth/login/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Ошибка входа");
        return;
      }

      localStorage.setItem("session_token", data.session_token);
      localStorage.setItem("account_id", data.account_id);
      localStorage.setItem("account_name", data.name);
      window.location.replace("/");
    } catch (err) {
      console.error(err);
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-black"
      style={{
        backgroundImage: "url(/login-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="w-full max-w-md flex-shrink-0">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <div className="inline-block bg-blue-100 rounded-lg p-3 mb-4">
              <div className="text-3xl">🚗</div>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">ServiceBooking</h1>
            <p className="text-sm text-muted-foreground">Вход в систему</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Номер телефона
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 900 123 45 67"
                className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={loading}
                autoComplete="tel"
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={accepted}
                onChange={(e) => {
                  const next = e.target.checked;
                  setAccepted(next);
                  if (next) {
                    localStorage.setItem(ACCEPTED_AT_KEY, new Date().toISOString());
                    localStorage.setItem(VERSION_KEY, LEGAL_VERSION);
                  } else {
                    localStorage.removeItem(ACCEPTED_AT_KEY);
                    localStorage.removeItem(VERSION_KEY);
                  }
                }}
                disabled={loading}
              />
              <span>
                Принимаю{" "}
                <Link to="/legal" className="underline text-primary">
                  документы по персональным данным
                </Link>{" "}
                (152‑ФЗ/242‑ФЗ).
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !accepted}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50"
            >
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-muted-foreground">
            <p>Аккаунт создаётся по номеру телефона</p>
            <p className="mt-1">© ServiceBooking</p>
          </div>
        </div>
      </div>
    </div>
  );
}
