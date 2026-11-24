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
  onSyncMysql?: () => void;
  isSyncingMysql?: boolean;
  extraActions?: React.ReactNode;
}

export function HeaderActions({
  title,
  subtitle,
  newActionLabel,
  newActionHref,
  activeModule,
  hideBadge,
  onSyncMysql,
  isSyncingMysql,
  extraActions,
}: HeaderActionsProps) {
  return (
    <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 lg:gap-4 pb-4 sm:pb-5 border-b-2 border-black">
      <div className="space-y-1.5 min-w-0 flex-1">
        {!hideBadge && (
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/login"
              className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FFD23F] text-black text-xs font-heading font-extrabold border-2 border-black shadow-[2px_2px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform"
            >
              NISSEI OPS
            </Link>
            <span className="text-xs text-black font-mono font-bold px-2 py-0.5 rounded-full bg-[#FFFDF9] border-2 border-black shadow-[2px_2px_0px_#000]">
              CDE · Sucursal Central
            </span>
            {activeModule && (
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#2A9D8F] text-white border-2 border-black shadow-[2px_2px_0px_#000]">
                {activeModule === "recepcion" ? "Módulo Post-Venta" : "Módulo Montajes"}
              </span>
            )}
          </div>
        )}
        <h1 className="text-xl sm:text-2xl xl:text-3xl font-heading font-extrabold tracking-tight text-[#111111]">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-800 font-medium max-w-3xl">
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 self-start lg:self-center lg:justify-end w-full sm:w-auto">
        {extraActions}
        <AuthBadge
          requiredModule={activeModule}
          onSyncMysql={onSyncMysql}
          isSyncingMysql={isSyncingMysql}
        />
        
        {newActionLabel && newActionHref && (
          <Link
            href={newActionHref}
            className="w-full sm:w-auto h-10 sm:h-11 inline-flex items-center justify-center gap-2 bg-[#FFD23F] hover:bg-[#FACC15] text-black text-xs sm:text-sm font-heading font-extrabold px-3.5 sm:px-4 rounded-lg border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{newActionLabel}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
