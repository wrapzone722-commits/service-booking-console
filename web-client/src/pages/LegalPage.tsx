import { Link, useLocation } from "react-router-dom";
import { LEGAL_VERSION, useLegal } from "@/context/LegalContext";

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

export function LegalPage() {
  const { accepted, acceptedAt, accept } = useLegal();
  const q = useQuery();
  const doc = q.get("doc") ?? "privacy";

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
        {doc === "privacy" && <PrivacyText />}
        {doc === "consent" && <ConsentText />}
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

function PrivacyText() {
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-lg font-semibold text-fg">Политика обработки персональных данных</h2>
      <p className="text-muted-fg">
        Настоящая политика составлена во исполнение требований Федерального закона РФ №152‑ФЗ
        «О персональных данных», а также требований локализации (№242‑ФЗ) при применимости.
      </p>
      <p className="text-[11px] leading-4 text-muted-fg/80">
        Оператор: <span className="text-muted-fg/80">&lt;название, реквизиты, контакты&gt;</span>
      </p>
      <p className="text-muted-fg">
        <span className="font-medium text-fg">Цели</span>: предоставление сервиса записи, управление записями,
        уведомления, поддержка, улучшение качества, выполнение требований законодательства.
      </p>
      <p className="text-muted-fg">
        <span className="font-medium text-fg">Состав данных</span>: имя, телефон/e-mail (если указаны), данные о
        записях, комментарии, технические идентификаторы устройства, данные Telegram (если вход через Telegram).
      </p>
      <p className="text-muted-fg">
        <span className="font-medium text-fg">Права субъекта</span>: запрос сведений, уточнение, блокирование,
        удаление, отзыв согласия. Обращения направлять оператору по контактам выше.
      </p>
      <p className="text-muted-fg">
        <span className="font-medium text-fg">Третьи лица</span>: Telegram (Login Widget/бот) как внешний сервис
        аутентификации/уведомлений. Иные подрядчики — при наличии должны быть перечислены отдельно.
      </p>
      <p className="text-[11px] leading-4 text-muted-fg/70">
        Шаблон. Перед публикацией заполните реквизиты оператора и актуализируйте разделы.
      </p>
    </div>
  );
}

function ConsentText() {
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-lg font-semibold text-fg">Согласие на обработку персональных данных</h2>
      <p className="text-muted-fg">
        Нажимая «Принять», я даю согласие Оператору на обработку моих персональных данных в целях использования
        сервиса записи, включая сбор, запись, систематизацию, хранение, уточнение, использование, обезличивание,
        блокирование и удаление, в соответствии с №152‑ФЗ.
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

