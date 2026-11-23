"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export const THEME_STORAGE_KEY = "nissei_portal_theme_v1";
export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  isExcludedRoute: boolean;
  mounted: boolean;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  isDark: false,
  isExcludedRoute: false,
  mounted: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isExcludedRoute = Boolean(pathname?.startsWith("/armar-pc"));

  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  // Leer preferencia inicial de localStorage al montar
  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "dark" || saved === "light") {
        setThemeState(saved);
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }, []);

  // Aplicar / remover clase .dark en <html> respetando ruta excluida (/armar-pc)
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isExcludedRoute) {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme, isExcludedRoute]);

  // Sincronizar cambios de tema entre pestañas abiertas
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      if (e.newValue === "dark" || e.newValue === "light") {
        setThemeState(e.newValue);
      } else if (e.newValue === null) {
        setThemeState("light");
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignorar errores de almacenamiento
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Ignorar errores de almacenamiento
      }
      return next;
    });
  }, []);

  const isDark = !isExcludedRoute && theme === "dark";

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        isExcludedRoute,
        mounted,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
