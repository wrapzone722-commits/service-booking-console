import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function YandexCallback() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    document.title = "ServiceBooking — Вход через Яндекс";
  }, []);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      setLoading(true);
      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code) {
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        setError(
          errorDescription || errorParam || "Яндекс не вернул код авторизации"
        );
        return;
      }

      // Send code to backend for token exchange
      const res = await fetch("/api/v1/auth/yandex/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Ошибка входа через Яндекс");
        return;
      }

      // Save token and redirect to dashboard
      localStorage.setItem("session_token", data.session_token);
      localStorage.setItem("account_id", data.account_id);
      localStorage.setItem("account_name", data.name);

      // Redirect to main page
      navigate("/");
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
          <div className="text-center">
            {loading && (
              <>
                <div className="inline-block animate-spin">
                  <div className="text-4xl">⏳</div>
                </div>
                <p className="mt-4 text-foreground font-semibold">
                  Подключение к Яндексу...
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Пожалуйста, подождите
                </p>
              </>
            )}

            {error && !loading && (
              <>
                <div className="text-4xl mb-4">❌</div>
                <h1 className="text-lg font-bold text-foreground mb-3">
                  Ошибка входа
                </h1>
                <p className="text-sm text-red-600 mb-4">{error}</p>
                <button
                  onClick={() => navigate("/login")}
                  className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold text-sm"
                >
                  Вернуться на вход
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
