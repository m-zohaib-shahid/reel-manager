import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "reel-tracker-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeClass(resolved: "light" | "dark"): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let saved: ThemeMode = "system";
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") {
        saved = raw;
      }
    } catch {
      // Ignore storage read errors
    }

    setThemeState(saved);
    const resolved = saved === "system" ? resolveSystemTheme() : saved;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  useEffect(() => {
    const resolved = theme === "system" ? resolveSystemTheme() : theme;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);

    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      const sys = media.matches ? "dark" : "light";
      setResolvedTheme(sys);
      applyThemeClass(sys);
    };
    media.addEventListener("change", listener);
    return () => {
      media.removeEventListener("change", listener);
    };
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage write errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }
  return ctx;
}
