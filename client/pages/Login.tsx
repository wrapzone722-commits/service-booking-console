import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type LoginStep = "method" | "register" | "login" | "verification";

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<LoginStep>("method");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    document.title = "ServiceBooking — Вход";
  }, []);

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (token) {
      navigate("/");
    }
  }, [navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !organizationName) {
      setError("Заполните все поля");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase(),
          password,
          organization_name: organizationName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Ошибка регистрации");
        return;
      }

      // Save token temporarily
      setSessionToken(data.session_token);
      
      // Move to verification step
      setStep("verification");
      setPassword("");
      setVerificationCode("");
    } catch (err) {
      console.error(err);
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Введите email и пароль");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Ошибка входа");
        return;
      }

      if (data.requires_verification) {
        setSessionToken(data.session_token);
        setStep("verification");
        setPassword("");
        setVerificationCode("");
      } else {
        // Save token and redirect
        localStorage.setItem("session_token", data.session_token);
        localStorage.setItem("account_id", data.account_id);
        localStorage.setItem("account_name", data.name);
        navigate("/");
      }
    } catch (err) {
      console.error(err);
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      setError("Введите код подтверждения");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase(),
          code: verificationCode.toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Ошибка верификации");
        return;
      }

      // Save token and redirect
      localStorage.setItem("session_token", data.session_token);
      localStorage.setItem("account_id", data.account_id);
      localStorage.setItem("account_name", data.name);
      navigate("/");
    } catch (err) {
      console.error(err);
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  };

  const handleYandexLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get authorization URL from backend
      const res = await fetch("/api/v1/auth/yandex/url");
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Ошибка подключения Яндекса");
        return;
      }

      // Redirect to Yandex authorization
      window.location.href = data.auth_url;
    } catch (err) {
      console.error(err);
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-block bg-blue-100 rounded-lg p-3 mb-4">
              <div className="text-3xl">🚗</div>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">ServiceBooking</h1>
            <p className="text-sm text-muted-foreground">Система управления автомойкой</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Method Selection */}
          {step === "method" && (
            <div className="space-y-3">
              <button
                onClick={() => {
                  setStep("register");
                  setError(null);
                }}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold text-sm"
              >
                Создать учётную запись
              </button>

              <button
                onClick={() => {
                  setStep("login");
                  setError(null);
                }}
                className="w-full py-2.5 px-4 bg-gray-100 text-foreground rounded-lg hover:bg-gray-200 transition-colors font-semibold text-sm"
              >
                Я уже зарегистрирован
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-muted-foreground">или</span>
                </div>
              </div>

              <button
                onClick={handleYandexLogin}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gray-50 border border-gray-300 text-foreground rounded-lg hover:bg-gray-100 transition-colors font-semibold text-sm disabled:opacity-50"
              >
                {loading ? "Подключение..." : "Вход через Яндекс 🔐"}
              </button>
            </div>
          )}

          {/* Register Form */}
          {step === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Название организации
                </label>
                <input
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Моя автомойка"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Пароль
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50"
              >
                {loading ? "Регистрация..." : "Создать учётную запись"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("method");
                  setError(null);
                  setEmail("");
                  setPassword("");
                  setOrganizationName("");
                }}
                className="w-full text-sm text-primary hover:underline"
              >
                Вернуться назад
              </button>
            </form>
          )}

          {/* Login Form */}
          {step === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Пароль
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ваш пароль"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50"
              >
                {loading ? "Вход..." : "Войти"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("method");
                  setError(null);
                  setEmail("");
                  setPassword("");
                }}
                className="w-full text-sm text-primary hover:underline"
              >
                Вернуться назад
              </button>
            </form>
          )}

          {/* Email Verification */}
          {step === "verification" && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                На почту <strong>{email}</strong> отправлен код подтверждения.
                <br />
                Введите его ниже.
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Код подтверждения
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-center text-lg font-mono tracking-widest"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50"
              >
                {loading ? "Проверка..." : "Подтвердить"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("method");
                  setError(null);
                  setEmail("");
                  setPassword("");
                  setVerificationCode("");
                  setSessionToken(null);
                }}
                className="w-full text-sm text-primary hover:underline"
              >
                Отменить
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-muted-foreground">
            <p>Защищённая система авторизации</p>
            <p className="mt-1">© 2025 ServiceBooking</p>
          </div>
        </div>
      </div>
    </div>
  );
}
