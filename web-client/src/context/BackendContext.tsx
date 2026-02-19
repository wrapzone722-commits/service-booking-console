import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";
import { setApiBaseUrl } from "@/api/client";

const STORAGE_KEY = "sb_web_api_base_url";

function normalizeBaseUrl(input: string): string {
  let s = input.trim().replace(/\/$/, "");
  if (s.endsWith("/api/v1")) s = s.slice(0, -"/api/v1".length);
  return s;
}

function tryParseFromQr(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  // JSON: {"api_url":"https://.../api/v1"} или {"base_url": "..."}
  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const json = JSON.parse(text) as { api_url?: string; base_url?: string; apiBaseUrl?: string };
      const v = json.api_url ?? json.base_url ?? json.apiBaseUrl;
      if (typeof v === "string" && v.trim()) return normalizeBaseUrl(v);
    } catch {
      // ignore
    }
  }

  // URL строкой
  if (/^https?:\/\//i.test(text)) return normalizeBaseUrl(text);

  return null;
}

interface BackendContextValue {
  apiBaseUrl: string | null;
  setFromManual: (value: string) => void;
  setFromQr: (value: string) => string | null;
  clear: () => void;
}

const BackendContext = createContext<BackendContextValue | null>(null);

export function BackendProvider({ children }: { children: React.ReactNode }) {
  const [apiBaseUrl, setApiBaseUrlState] = useState<string | null>(() => {
    const fromLs = localStorage.getItem(STORAGE_KEY);
    if (fromLs) return normalizeBaseUrl(fromLs);
    const fromWindow =
      typeof window !== "undefined" ? (window as Window & { __API_BASE_URL__?: string }).__API_BASE_URL__ : null;
    return fromWindow ? normalizeBaseUrl(fromWindow) : null;
  });

  // Важно: api/client.ts хранит BASE на уровне модуля.
  // Если URL пришёл из localStorage (а не через setAndPersist), надо синхронизировать BASE при старте.
  useLayoutEffect(() => {
    if (typeof window !== "undefined") {
      if (apiBaseUrl) (window as Window & { __API_BASE_URL__?: string }).__API_BASE_URL__ = apiBaseUrl;
      else delete (window as Window & { __API_BASE_URL__?: string }).__API_BASE_URL__;
    }
    setApiBaseUrl(apiBaseUrl ?? "");
  }, [apiBaseUrl]);

  const setAndPersist = useCallback((value: string) => {
    const normalized = normalizeBaseUrl(value);
    localStorage.setItem(STORAGE_KEY, normalized);
    setApiBaseUrlState(normalized);
    (window as Window & { __API_BASE_URL__?: string }).__API_BASE_URL__ = normalized;
    setApiBaseUrl(normalized);
  }, []);

  const setFromManual = useCallback(
    (value: string) => {
      if (!value.trim()) return;
      setAndPersist(value);
    },
    [setAndPersist]
  );

  const setFromQr = useCallback(
    (value: string) => {
      const parsed = tryParseFromQr(value);
      if (parsed) setAndPersist(parsed);
      return parsed;
    },
    [setAndPersist]
  );

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiBaseUrlState(null);
    if (typeof window !== "undefined") {
      delete (window as Window & { __API_BASE_URL__?: string }).__API_BASE_URL__;
    }
    setApiBaseUrl("");
  }, []);

  const ctx = useMemo(
    () => ({ apiBaseUrl, setFromManual, setFromQr, clear }),
    [apiBaseUrl, setFromManual, setFromQr, clear]
  );

  return <BackendContext.Provider value={ctx}>{children}</BackendContext.Provider>;
}

export function useBackend(): BackendContextValue {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error("useBackend must be used within BackendProvider");
  return ctx;
}

