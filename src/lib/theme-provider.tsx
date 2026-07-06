import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type ThemeMode = "light" | "dark" | "system";
type Density = "comfortable" | "compact";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  setMode: (m: ThemeMode) => void;
  density: Density;
  setDensity: (d: Density) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const MODE_KEY = "tc-theme-mode";
const DENSITY_KEY = "tc-theme-density";

function getStored<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  return (v as T) || fallback;
}

function resolveSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => getStored<ThemeMode>(MODE_KEY, "system"));
  const [density, setDensityState] = useState<Density>(() => getStored<Density>(DENSITY_KEY, "comfortable"));
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() =>
    typeof window === "undefined" ? "light" : (mode === "system" ? resolveSystem() : mode),
  );

  // Apply theme class
  useEffect(() => {
    const apply = () => {
      const resolved = mode === "system" ? resolveSystem() : mode;
      setResolvedMode(resolved);
      const root = document.documentElement;
      root.classList.toggle("dark", resolved === "dark");
    };
    apply();
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);

  // Apply density
  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    window.localStorage.setItem(MODE_KEY, m);
  }, []);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    window.localStorage.setItem(DENSITY_KEY, d);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, setMode, density, setDensity }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
