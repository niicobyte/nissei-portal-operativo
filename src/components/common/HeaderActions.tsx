import Link from "next/link";
import React from "react";
import { AuthBadge } from "./AuthBadge";

interface HeaderActionsProps {
  title: string;
  subtitle: string;
  newActionLabel?: string;
  newActionHref?: string;
  logoutHref?: string;
  activeModule?: "recepcion" | "tecnicos" | "reparaciones" | "montajes";
  hideBadge?: boolean;
}

export function HeaderActions({
  title,
  subtitle,
  newActionLabel,
  newActionHref,
  activeModule,
  hideBadge,
}: HeaderActionsProps) {
  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-zinc-200">
      <div className="space-y-1">
        {!hideBadge && (
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/login"
              className="inline-flex items-center px-2 py-0.5 rounded bg-zinc-900 text-white text-xs font-mono font-medium hover:bg-black transition-colors"
            >
              NISSEI OPS
            </Link>
            <span className="text-xs text-zinc-500 font-mono">CDE · Sucursal Central</span>
            {activeModule && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                {activeModule === "recepcion" ? "Módulo Post-Venta" : "Módulo Montajes"}
              </span>
            )}
          </div>
        )}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 max-w-3xl">
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        <AuthBadge requiredModule={activeModule} />
        
        {newActionLabel && newActionHref && (
          <Link
            href={newActionHref}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-black text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <span>{newActionLabel}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
