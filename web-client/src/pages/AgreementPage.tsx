import { Link } from "react-router-dom";

export function AgreementPage() {
  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-end justify-between mb-4">
        <h1 className="text-2xl font-semibold text-fg tracking-tight">Пользовательское соглашение</h1>
        <Link to="/profile" className="text-sm text-accent font-medium">
          Назад
        </Link>
      </div>

      <div className="bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-ios p-4 space-y-3 text-sm">
        <p className="text-muted-fg">
          Сервис предоставляет возможность записаться на услуги и управлять своими записями. Пользователь обязуется
          предоставлять достоверные данные и не нарушать права третьих лиц.
        </p>
        <p className="text-muted-fg">
          Оператор вправе изменять функциональность и документы сервиса. Актуальная версия доступна в приложении.
        </p>
      </div>
    </div>
  );
}

