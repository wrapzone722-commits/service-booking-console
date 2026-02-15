import { Link } from "react-router-dom";
import { useLegal } from "@/context/LegalContext";

export function LegalBanner() {
  const { accepted, accept } = useLegal();
  if (accepted) return null;

  return (
    <div className="fixed left-0 right-0 bottom-24 z-30">
      <div className="mx-auto max-w-md px-4">
        <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-ios p-3">
          <p className="text-xs text-muted-fg">
            Для работы сервиса нужно принять документы (Политика, Согласие, Соглашение).
          </p>
          <div className="mt-2 flex gap-2">
            <Link
              to="/legal"
              className="flex-1 py-2 text-center rounded-xl border border-border bg-card/60 text-fg text-sm"
            >
              Открыть
            </Link>
            <button
              type="button"
              onClick={accept}
              className="flex-1 py-2 rounded-xl bg-accent text-accent-fg text-sm font-semibold shadow-ios2"
            >
              Принять
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

