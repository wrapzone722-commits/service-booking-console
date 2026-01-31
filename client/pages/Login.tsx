import { useCallback, useEffect, useRef, useState } from "react";

type LoginStep = "method" | "register" | "login" | "phone" | "phone_sms" | "phone_sms_verify" | "verification";

declare global {
  interface Window {
    onTelegramAuth?: (user: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      auth_date: number;
      hash: string;
    }) => void;
  }
}

export default function Login() {
  const [step, setStep] = useState<LoginStep>("method");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(null);
  const [smsCodeDisplay, setSmsCodeDisplay] = useState<string | null>(null); // код на экране (без затрат на SMS)
  const telegramScriptLoaded = useRef(false);

  useEffect(() => {
    document.title = "ServiceBooking — Вход";
  }, []);

  // If already logged in, go to home (full reload so ProtectedRoute sees token)
  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (token) {
      window.location.replace("/");
    }
  }, []);

  // Fetch Telegram widget config and load script
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/auth/telegram/widget-config");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        setTelegramBotUsername(data.bot_username || null);
      } catch {
        if (!cancelled) setTelegramBotUsername(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load Telegram Login Widget: script tag with data-telegram-login replaces itself with the button
  useEffect(() => {
    if (!telegramBotUsername || telegramScriptLoaded.current) return;
    const container = document.getElementById("telegram-login-container");
    if (!container) return;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", telegramBotUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    container.appendChild(script);
    telegramScriptLoaded.current = true;
  }, [telegramBotUsername]);

  const handleTelegramAuth = useCallback(
    async (user: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      auth_date: number;
      hash: string;
    }) => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/v1/auth/login/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Ошибка входа через Telegram");
          return;
        }
        localStorage.setItem("session_token", data.session_token);
        localStorage.setItem("account_id", data.account_id);
        localStorage.setItem("account_name", data.name);
        window.location.replace("/");
        return;
      } catch (err) {
        console.error(err);
        setError("Ошибка подключения к серверу");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    window.onTelegramAuth = handleTelegramAuth;
    return () => {
      window.onTelegramAuth = undefined;
    };
  }, [handleTelegramAuth]);

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
        localStorage.setItem("session_token", data.session_token);
        localStorage.setItem("account_id", data.account_id);
        localStorage.setItem("account_name", data.name);
        window.location.replace("/");
        return;
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

      localStorage.setItem("session_token", data.session_token);
      localStorage.setItem("account_id", data.account_id);
      localStorage.setItem("account_name", data.name);
      window.location.replace("/");
      return;
    } catch (err) {
      console.error(err);
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginByPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      setError("Введите номер телефона и пароль");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/v1/auth/login/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Ошибка входа");
        return;
      }

      if (data.requires_verification) {
        setSessionToken(data.session_token);
        setStep("verification");
        setEmail(data.email || "");
        setPassword("");
        setVerificationCode("");
      } else {
        localStorage.setItem("session_token", data.session_token);
        localStorage.setItem("account_id", data.account_id);
        localStorage.setItem("account_name", data.name);
        window.location.replace("/");
        return;
      }
    } catch (err) {
      console.error(err);
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  };

  const handleSendSmsCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Введите номер телефона");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/auth/send-sms-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Ошибка отправки кода");
        return;
      }
      setSmsCodeDisplay(data.code ?? null);
      setStep("phone_sms_verify");
      setVerificationCode("");
    } catch (err) {
      console.error(err);
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setError("Введите код из SMS");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/auth/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: verificationCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Неверный или истёкший код");
        return;
      }
      localStorage.setItem("session_token", data.session_token);
      localStorage.setItem("account_id", data.account_id);
      localStorage.setItem("account_name", data.name);
      window.location.replace("/");
      return;
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

              <button
                onClick={() => {
                  setStep("phone");
                  setError(null);
                  setPassword("230000");
                }}
                className="w-full py-2.5 px-4 bg-gray-100 text-foreground rounded-lg hover:bg-gray-200 transition-colors font-semibold text-sm"
              >
                Вход по номеру телефона
              </button>

              <button
                onClick={() => {
                  setStep("phone_sms");
                  setError(null);
                  setPhone("");
                  setVerificationCode("");
                  setSmsCodeDisplay(null);
                }}
                className="w-full py-2.5 px-4 bg-gray-100 text-foreground rounded-lg hover:bg-gray-200 transition-colors font-semibold text-sm"
              >
                Вход по коду (без SMS — код на экране)
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-muted-foreground">или</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-center text-sm font-medium text-foreground">Вход через Telegram</p>
                {telegramBotUsername ? (
                  <div id="telegram-login-container" className="flex justify-center min-h-[44px]" />
                ) : (
                  <p className="text-center text-xs text-muted-foreground">(не настроен на сервере — укажите TELEGRAM_BOT_USERNAME)</p>
                )}
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

          {/* Phone Login Form */}
          {step === "phone" && (
            <form onSubmit={handleLoginByPhone} className="space-y-4">
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
                  placeholder="По умолчанию: 230000"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50"
              >
                {loading ? "Вход..." : "Войти по телефону"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("method");
                  setError(null);
                  setPhone("");
                  setPassword("");
                }}
                className="w-full text-sm text-primary hover:underline"
              >
                Вернуться назад
              </button>
            </form>
          )}

          {/* Вход по SMS: ввод телефона */}
          {step === "phone_sms" && (
            <form onSubmit={handleSendSmsCode} className="space-y-4">
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
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50"
              >
                {loading ? "Отправка..." : "Отправить код в SMS"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("method");
                  setError(null);
                  setPhone("");
                }}
                className="w-full text-sm text-primary hover:underline"
              >
                Вернуться назад
              </button>
            </form>
          )}

          {/* Вход по SMS: ввод кода */}
          {step === "phone_sms_verify" && (
            <form onSubmit={handleVerifyPhoneSms} className="space-y-4">
              {smsCodeDisplay ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
                  <p className="font-medium">Верификация без SMS (бесплатно)</p>
                  <p className="mt-1">Ваш код: <strong className="text-lg font-mono tracking-wider">{smsCodeDisplay}</strong></p>
                  <p className="mt-1 text-amber-700">Введите его ниже.</p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
                  Код отправлен на номер <strong>{phone}</strong>. Введите его ниже.
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">
                  Код из SMS
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
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
                {loading ? "Проверка..." : "Войти"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("phone_sms");
                  setError(null);
                  setVerificationCode("");
                  setSmsCodeDisplay(null);
                }}
                className="w-full text-sm text-primary hover:underline"
              >
                Другой номер
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
            <p className="mt-1">© 2019 ServiceBooking</p>
            <p className="mt-1 opacity-70">v2.1 • build 2025-02</p>
          </div>
        </div>
      </div>
    </div>
  );
}
