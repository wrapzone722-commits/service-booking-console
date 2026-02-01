import { useEffect, useState } from "react";

export type ThemeId = "light" | "gray" | "dark";

const STORAGE_KEY = "sb_theme";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(STORAGE_KEY) as ThemeId) || "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute("data-theme");
    if (theme !== "light") {
      root.setAttribute("data-theme", theme);
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (t: ThemeId) => setThemeState(t);

  return { theme, setTheme };
}
