import React from "react";
import ReactDOM from "react-dom/client";
import { setApiBaseUrl } from "@/api/client";
import App from "./App";
import "./index.css";

type ThemePref = "light" | "dark" | "system";
const THEME_KEY = "sb_web_theme";

function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  const wantsDark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", wantsDark);
}

function initTheme() {
  const raw = (localStorage.getItem(THEME_KEY) as ThemePref | null) ?? "system";
  const pref: ThemePref = raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
  applyTheme(pref);
}

async function loadRuntimeConfig() {
  try {
    const r = await fetch("/config.json");
    if (!r.ok) return;
    const text = await r.text();
    const trimmed = text.trim();
    // Если сервер отдал HTML (SPA fallback или страница ошибки), не пытаемся парсить как JSON
    if (trimmed.startsWith("<") || trimmed.startsWith("<!")) return;
    const data = JSON.parse(text) as { api_base_url?: string };
    const url = data.api_base_url;
    if (typeof url === "string" && url.trim()) {
      const base = url.trim().replace(/\/$/, "").replace(/\/api\/v1$/, "");
      (window as Window & { __API_BASE_URL__?: string }).__API_BASE_URL__ = base;
      setApiBaseUrl(base);
    }
  } catch {
    // нет config.json или не JSON — используем VITE_API_BASE_URL из сборки
  }
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initTheme();
loadRuntimeConfig().finally(renderApp);
