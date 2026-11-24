"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  variant?: "default" | "compact";
  className?: string;
}

export function ThemeToggle({ variant = "default", className = "" }: ThemeToggleProps) {
  const { isDark, isExcludedRoute, mounted, toggleTheme } = useTheme();

  if (isExcludedRoute) {
    return null;
  }

  const activeDark = mounted && isDark;
  const sizeClass =
    variant === "compact"
      ? "h-8 px-2.5 text-[11px] gap-1.5 shrink-0"
      : "h-10 sm:h-11 px-2.5 sm:px-3 text-xs gap-1.5 shrink-0";
  const colorClass = activeDark
    ? "bg-[#FFD23F] hover:bg-[#FACC15] text-black"
    : "bg-[#FFFDF9] hover:bg-[#FFD23F] text-black";
  const label = activeDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={activeDark}
      title={label}
      className={`inline-flex items-center justify-center rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer select-none font-heading font-extrabold ${sizeClass} ${colorClass} ${className}`.trim()}
    >
      {activeDark ? (
        <Sun className="w-4 h-4 shrink-0 text-black" />
      ) : (
        <Moon className="w-4 h-4 shrink-0 text-black" />
      )}
      <span className={variant === "compact" ? "inline" : "hidden sm:inline"}>
        {activeDark ? "Claro" : "Oscuro"}
      </span>
    </button>
  );
}
