import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Минимальная фиксация согласия/принятия документов (152‑ФЗ/242‑ФЗ).
 * Храним timestamp в localStorage. Это не заменяет юр. консультацию, но закрывает базовый UX.
 */

const ACCEPTED_AT_KEY = "sb_web_legal_accepted_at";
const VERSION_KEY = "sb_web_legal_version";

// bump when legal texts change materially
export const LEGAL_VERSION = "2026-02-15";

interface LegalContextValue {
  acceptedAt: string | null;
  accepted: boolean;
  accept: () => void;
  revoke: () => void;
}

const LegalContext = createContext<LegalContextValue | null>(null);

export function LegalProvider({ children }: { children: React.ReactNode }) {
  const [acceptedAt, setAcceptedAt] = useState<string | null>(() => {
    const v = localStorage.getItem(VERSION_KEY);
    const at = localStorage.getItem(ACCEPTED_AT_KEY);
    if (!at) return null;
    // если версия изменилась — просим принять заново
    if (v !== LEGAL_VERSION) return null;
    return at;
  });

  const accept = useCallback(() => {
    const at = new Date().toISOString();
    localStorage.setItem(ACCEPTED_AT_KEY, at);
    localStorage.setItem(VERSION_KEY, LEGAL_VERSION);
    setAcceptedAt(at);
  }, []);

  const revoke = useCallback(() => {
    localStorage.removeItem(ACCEPTED_AT_KEY);
    localStorage.removeItem(VERSION_KEY);
    setAcceptedAt(null);
  }, []);

  const value = useMemo(
    () => ({ acceptedAt, accepted: !!acceptedAt, accept, revoke }),
    [acceptedAt, accept, revoke]
  );

  return <LegalContext.Provider value={value}>{children}</LegalContext.Provider>;
}

export function useLegal(): LegalContextValue {
  const ctx = useContext(LegalContext);
  if (!ctx) throw new Error("useLegal must be used within LegalProvider");
  return ctx;
}

