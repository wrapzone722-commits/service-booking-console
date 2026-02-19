import { Link, useLocation } from "react-router-dom";
import { LEGAL_VERSION, useLegal } from "@/context/LegalContext";
import { useEffect, useMemo, useState } from "react";
import { fetchCompany } from "@/api/client";
import type { CompanyInfo } from "@/api/types";

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

export function LegalPage() {
  const { accepted, acceptedAt, accept } = useLegal();
  const q = useQuery();
  const doc = q.get("doc") ?? "privacy";
  const [company, setCompany] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    fetchCompany()
      .then(setCompany)
      .catch(() => setCompany(null));
  }, []);

  const operatorLine = useMemo(() => {
    if (!company) return null;
    const bits: string[] = [];
    if (company.inn) bits.push(`ИНН ${company.inn}`);
    if (company.ogrn) bits.push(`ОГРН/ОГРНИП ${company.ogrn}`);
    const contacts = [company.phone, company.email].filter(Boolean).join(", ");
    const addr = company.legal_address || company.address;
    const tail = [addr, contacts].filter(Boolean).join(" • ");
    return `${company.name}${bits.length ? " (" + bits.join(", ") + ")" : ""}${tail ? " — " + tail : ""}`;
  }, [company]);

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-end justify-between mb-4">
        <h1 className="text-2xl font-semibold text-fg tracking-tight">Документы</h1>
        <span className="text-xs text-muted-fg">v{LEGAL_VERSION}</span>
      </div>

      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-ios p-2 flex gap-2 overflow-auto">
        <Tab to="?doc=privacy" active={doc === "privacy"}>Политика</Tab>
        <Tab to="?doc=consent" active={doc === "consent"}>Согласие</Tab>
        <Tab to="?doc=cookies" active={doc === "cookies"}>Cookies</Tab>
      </div>

      <div className="mt-3 bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-ios p-4">
        {doc === "privacy" && <PrivacyText operatorLine={operatorLine} />}
        {doc === "consent" && <ConsentText operatorName={company?.name ?? "Оператор"} />}
        {doc === "cookies" && <CookiesText />}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={accept}
          className="flex-1 py-3 bg-accent text-accent-fg rounded-2xl shadow-ios2 font-semibold"
        >
          Принять
        </button>
        <Link
          to="/connect"
          className="flex-1 py-3 bg-card/60 border border-border rounded-2xl text-center text-fg"
        >
          Назад
        </Link>
      </div>

      <p className="text-xs text-muted-fg mt-3">
        {accepted ? (
          <>Принято: <span className="font-medium">{acceptedAt}</span></>
        ) : (
          "Чтобы пользоваться сервисом, нужно принять Политику и Согласие."
        )}
      </p>
    </div>
  );
}

function Tab({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={[
        "px-3 py-2 rounded-xl text-xs whitespace-nowrap transition",
        active ? "bg-muted text-fg" : "text-muted-fg hover:text-fg",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function PrivacyText({ operatorLine }: { operatorLine: string | null }) {
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-lg font-semibold text-fg">Политика обработки персональных данных</h2>
      <p className="text-muted-fg">
        Политика определяет порядок и условия обработки персональных данных пользователей сервиса в соответствии с
        Федеральным законом РФ №152‑ФЗ «О персональных данных» (а также требованиями локализации №242‑ФЗ — при применимости).
      </p>
      {operatorLine ? (
        <p className="text-[11px] leading-4 text-muted-fg/70">Оператор: {operatorLine}</p>
      ) : (
        <p className="text-[11px] leading-4 text-muted-fg/50">Оператор: данные будут показаны после настройки компании в консоли.</p>
      )}
      <p className="text-muted-fg">
        <span className="font-medium text-fg">Цели обработки</span>: предоставление сервиса записи и управления записями,
        коммуникация и уведомления, поддержка, обеспечение безопасности и улучшение качества сервиса.
      </p>
      <p className="text-muted-fg">
        <span className="font-medium text-fg">Категории данных</span>: имя, контактные данные (телефон/e‑mail — если указаны),
        данные о записях (дата/время/услуга/пост), комментарии, технические идентификаторы устройства; данные Telegram — при входе через Telegram.
      </p>
      <p className="text-muted-fg">
        <span className="font-medium text-fg">Права субъекта</span>: получение сведений, уточнение, блокирование, удаление,
        отзыв согласия (если применимо). Обращения направляются оператору по контактам, указанным выше.
      </p>
      <p className="text-muted-fg">
        <span className="font-medium text-fg">Третьи лица</span>: Telegram (Login Widget/бот) как внешний сервис
        аутентификации/уведомлений. Иные подрядчики — при наличии должны быть перечислены отдельно.
      </p>
    </div>
  );
}

function ConsentText({ operatorName }: { operatorName: string }) {
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-lg font-semibold text-fg">Согласие на обработку персональных данных</h2>
      <p className="text-muted-fg">
        Нажимая «Принять», я выражаю согласие {operatorName} (Оператору) на обработку моих персональных данных
        в целях предоставления сервиса записи и управления записями, включая сбор, запись, систематизацию, хранение,
        уточнение, использование, обезличивание, блокирование и удаление, в соответствии с №152‑ФЗ.
      </p>
      <p className="text-muted-fg">
        Согласие может быть отозвано путём обращения к Оператору по контактам, указанным в Политике.
      </p>
    </div>
  );
}

function CookiesText() {
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-lg font-semibold text-fg">Cookies и локальное хранилище</h2>
      <p className="text-muted-fg">
        Приложение использует localStorage для хранения технических параметров (URL бэкенда, тема, факт принятия
        документов, токен доступа). Это необходимо для работы сервиса.
      </p>
    </div>
  );
}

