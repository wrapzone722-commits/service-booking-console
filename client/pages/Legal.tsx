import { Link } from "react-router-dom";
import { useMemo, useState } from "react";

const ACCEPTED_AT_KEY = "sb_console_legal_accepted_at";
const VERSION_KEY = "sb_console_legal_version";
const LEGAL_VERSION = "2026-02-15";

export default function Legal() {
  const [acceptedAt, setAcceptedAt] = useState<string | null>(() => {
    const v = localStorage.getItem(VERSION_KEY);
    const at = localStorage.getItem(ACCEPTED_AT_KEY);
    if (!at) return null;
    if (v !== LEGAL_VERSION) return null;
    return at;
  });

  const accepted = useMemo(() => !!acceptedAt, [acceptedAt]);

  const accept = () => {
    const at = new Date().toISOString();
    localStorage.setItem(ACCEPTED_AT_KEY, at);
    localStorage.setItem(VERSION_KEY, LEGAL_VERSION);
    setAcceptedAt(at);
  };

  const revoke = () => {
    localStorage.removeItem(ACCEPTED_AT_KEY);
    localStorage.removeItem(VERSION_KEY);
    setAcceptedAt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl p-6 space-y-4">
        <div className="flex items-end justify-between">
          <h1 className="text-2xl font-bold">Документы и персональные данные</h1>
          <span className="text-xs text-muted-foreground">v{LEGAL_VERSION}</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Политика обработки персональных данных (шаблон)</h2>
          <p className="text-sm text-muted-foreground">
            Документ составлен для соответствия требованиям №152‑ФЗ «О персональных данных» и локализации данных (№242‑ФЗ) при применимости.
            Заполните реквизиты Оператора (юрлицо/ИП, адрес, контакты), цели/состав данных и сроки хранения перед публикацией.
          </p>
          <p className="text-sm text-muted-foreground">
            Оператор: <span className="font-medium text-foreground">&lt;указать организацию, ИНН/ОГРН, адрес, email&gt;</span>
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Согласие на обработку ПДн</h2>
          <p className="text-sm text-muted-foreground">
            Нажимая «Принять», вы подтверждаете согласие на обработку персональных данных в целях работы системы
            (вход, управление записями, уведомления, поддержка) в соответствии с №152‑ФЗ.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={accept}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold"
          >
            Принять
          </button>
          <button
            type="button"
            onClick={revoke}
            className="px-4 py-2 rounded-lg bg-muted text-foreground"
          >
            Отозвать
          </button>
          <Link to="/login" className="ml-auto px-4 py-2 rounded-lg border border-border">
            Назад
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">
          Статус: {accepted ? <>принято ({acceptedAt})</> : "не принято"}
        </p>
      </div>
    </div>
  );
}

