import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setApiKeyGetter } from "@/api/client";
import { registerClient } from "@/api/client";
import { useBackend } from "@/context/BackendContext";

const STORAGE_KEY = "sb_web_api_key";
const DEVICE_ID_KEY = "sb_web_device_id";

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = "web_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

interface AuthContextValue {
  apiKey: string | null;
  isReady: boolean;
  register: () => Promise<void>;
  setToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { apiBaseUrl } = useBackend();
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setApiKeyGetter(() => apiKey);
  }, [apiKey]);

  const register = useCallback(async () => {
    const deviceId = getDeviceId();
    const { api_key } = await registerClient(deviceId);
    localStorage.setItem(STORAGE_KEY, api_key);
    setApiKey(api_key);
    setIsReady(true);
  }, []);

  const setToken = useCallback((token: string) => {
    const t = token.trim();
    if (!t) return;
    localStorage.setItem(STORAGE_KEY, t);
    setApiKey(t);
    setIsReady(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey(null);
    setIsReady(true);
  }, []);

  useEffect(() => {
    // Пока нет URL бэкенда — не регистрируем устройство
    if (!apiBaseUrl) {
      setIsReady(false);
      return;
    }
    if (apiKey) {
      setIsReady(true);
      return;
    }
    register().catch(() => setIsReady(true));
  }, [apiBaseUrl, apiKey, register]);

  const value = useMemo(
    () => ({ apiKey, isReady, register, setToken, logout }),
    [apiKey, isReady, register, setToken, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
