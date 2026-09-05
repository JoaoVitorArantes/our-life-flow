import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "system";

const STORAGE_KEY = "lifeos-theme";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: "dark" | "light";
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  resolved: "dark",
  setMode: () => {},
});

function systemPrefersDark() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [resolved, setResolved] = useState<"dark" | "light">("dark");

  const apply = useCallback((next: ThemeMode) => {
    const value = next === "system" ? (systemPrefersDark() ? "dark" : "light") : next;
    setResolved(value);
    const root = document.documentElement;
    root.classList.toggle("dark", value === "dark");
    root.style.colorScheme = value;
  }, []);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "dark";
    setModeState(stored);
    apply(stored);
  }, [apply]);

  useEffect(() => {
    if (mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => apply("system");
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [mode, apply]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      localStorage.setItem(STORAGE_KEY, next);
      apply(next);
    },
    [apply],
  );

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
