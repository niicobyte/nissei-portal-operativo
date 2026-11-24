"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, LogOut, Key, ChevronDown, ShieldAlert, ArrowRight, Trash2, RefreshCw } from "lucide-react";
import { getActiveUser, logout, UserProfile } from "@/data/authData";
import { useClampedPopover } from "@/lib/popoverPosition";
import { ThemeToggle } from "./ThemeToggle";

interface AuthBadgeProps {
  requiredModule?: "recepcion" | "reparaciones" | "montajes" | "tecnicos" | "deposito.danesa" | "sati-cde";
  onSyncMysql?: () => void;
  isSyncingMysql?: boolean;
}

function isAuthorizedForModule(
  user: UserProfile,
  requiredModule?: "recepcion" | "reparaciones" | "montajes" | "tecnicos" | "deposito.danesa" | "sati-cde"
): boolean {
  if (!requiredModule) return true;
  if (user.role === "ADMIN") return true;
  if (requiredModule === "recepcion") {
    return user.role === "RECEPCION" || user.role === "DEPOSITO";
  }
  if (requiredModule === "deposito.danesa" || requiredModule === "sati-cde") {
    return user.role === "DEPOSITO" || user.role === "RECEPCION";
  }
  if (requiredModule === "reparaciones") return user.role === "TECNICO";
  if (requiredModule === "montajes" || requiredModule === "tecnicos") {
    return user.role === "MONTAJES";
  }
  return false;
}

export function AuthBadge({ requiredModule, onSyncMysql, isSyncingMysql }: AuthBadgeProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { layout: menuLayout, update: updateMenuPosition } = useClampedPopover(containerRef, menuOpen, {
    preferredWidth: 240,
    preferAlign: "right",
    maxPreferredHeight: 380,
  });

  useEffect(() => {
    setMounted(true);
    const active = getActiveUser();
    setUser(active);
    if (!active && requiredModule) {
      router.replace("/login");
    }
  }, [requiredModule, router]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    setUser(null);
    setMenuOpen(false);
    router.replace("/login");
  };

  const handleClearLocalData = () => {
    if (typeof window !== "undefined") {
      logout();
      const keys = [
        "nissei_recepcion_data_v2",
        "nissei_recepcion_cde_data_v3",
        "nissei_deposito_cde_checkins_v1",
        "nissei_sati_ticket_overrides_v1",
        "nissei_reparaciones_data",
        "nissei_montajes_data",
        "nissei_taller_montajes_v4_real",
        "nissei_taller_montajes_dirty_ids_v1",
        "nissei_vendedores_montajes_v1",
        "nissei_usuarios_data",
        "nissei_taller_data",
        "nissei_active_session_v1",
        "nissei_active_session_v2",
        "nissei_active_session_v3",
        "nissei_active_session_v4",
      ];
      keys.forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
      setMenuOpen(false);
      window.location.href = "/login";
    }
  };

  // Mientras se verifica la sesión en el cliente, cubrimos la pantalla para evitar filtración visual (flash of unauthenticated content)
  if (!mounted) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#FAF6EE] flex items-center justify-center p-4">
        <div className="flex items-center gap-2.5 text-xs font-mono text-black font-bold">
          <Lock className="w-4 h-4 text-black animate-pulse" />
          <span>Verificando credenciales de seguridad SATI...</span>
        </div>
      </div>
    );
  }

  // Si no hay sesión activa, bloqueamos toda la vista y redirigimos a /login
  if (!user) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#FAF6EE] flex items-center justify-center p-4">
        <div className="bg-[#FFFDF9] border-3 border-black rounded-xl p-6 max-w-sm w-full shadow-[6px_6px_0px_#000] text-center space-y-4">
          <div className="w-12 h-12 rounded-lg bg-[#FFD23F] border-2 border-black shadow-[3px_3px_0px_#000] text-black flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-black" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-heading font-extrabold text-black">Sesión Requerida</h2>
            <p className="text-xs text-neutral-700">
              Debe autenticarse con su clave de sector para acceder a este módulo operativo.
            </p>
          </div>
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#FFD23F] hover:bg-[#FACC15] text-black text-xs font-heading font-extrabold border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            <span>Ir al Control de Acceso</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Si el usuario está autenticado pero intenta entrar a un módulo ajeno a su rol
  if (!isAuthorizedForModule(user, requiredModule)) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#FAF6EE] flex items-center justify-center p-4">
        <div className="bg-[#FFFDF9] border-3 border-black rounded-xl p-6 max-w-md w-full shadow-[6px_6px_0px_#000] text-center space-y-4">
          <div className="w-12 h-12 rounded-lg bg-[#E76F51] border-2 border-black shadow-[3px_3px_0px_#000] text-white flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-heading font-extrabold text-black">Acceso Restringido por Rol</h2>
            <p className="text-xs text-neutral-800">
              Su perfil activo (<strong>{user.nombre}</strong> · {user.badge}) no cuenta con permisos para visualizar este sector.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Link
              href={user.defaultRoute}
              className="px-4 py-2 rounded-lg bg-black text-white text-xs font-bold border-2 border-black shadow-[2px_2px_0px_#000] transition-colors"
            >
              Ir a mi Panel Autorizado
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-lg border-2 border-black bg-[#FAF6EE] hover:bg-[#F4EFE6] text-black text-xs font-bold shadow-[2px_2px_0px_#000] transition-colors"
            >
              Cambiar de Perfil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 shrink-0 max-w-full">
      <ThemeToggle />
      <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => {
          if (!menuOpen) updateMenuPosition();
          setMenuOpen((prev) => !prev);
        }}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="inline-flex items-center gap-2 px-2.5 sm:px-3 h-10 sm:h-11 min-w-0 sm:min-w-[168px] xl:min-w-[185px] max-w-[240px] rounded-lg bg-[#FFFDF9] hover:bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-xs font-bold text-black transition-all cursor-pointer select-none whitespace-nowrap"
      >
        <span className="w-7 h-7 rounded-md bg-black text-[#FFD23F] font-mono text-[11px] font-extrabold flex items-center justify-center tracking-tight shrink-0 border border-black">
          {user.avatar}
        </span>
        <div className="text-left leading-tight hidden sm:block truncate flex-1 min-w-0">
          <strong className="block text-xs font-heading font-extrabold text-black truncate">{user.nombre}</strong>
          <span className="text-[10px] text-neutral-700 font-mono font-bold block truncate">{user.badge}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-black shrink-0 transition-transform duration-150 ${menuOpen ? "rotate-180" : ""}`} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          style={
            menuLayout
              ? {
                  left: `${menuLayout.left}px`,
                  width: `${menuLayout.width}px`,
                  maxHeight: `${menuLayout.maxHeight}px`,
                }
              : undefined
          }
          className="absolute top-full mt-1.5 w-60 max-w-[calc(100vw-1.5rem)] bg-[#FFFDF9] rounded-xl shadow-[4px_4px_0px_#000] border-2 border-black p-2 z-50 text-xs space-y-1.5 max-h-[min(24rem,calc(100dvh-5rem))] overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="p-2 border-b-2 border-black bg-[#FAF6EE] rounded-lg space-y-0.5">
            <span className="text-[10px] text-neutral-600 block font-mono font-bold uppercase">Sesión activa</span>
            <div className="font-heading font-extrabold text-black flex items-center gap-1.5 min-w-0">
              <span className="w-5 h-5 rounded bg-black text-[#FFD23F] font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                {user.avatar}
              </span>
              <span className="truncate">{user.nombre}</span>
            </div>
            <div className="text-[11px] text-neutral-800 font-medium truncate">{user.badge}</div>
          </div>

          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700 transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>Cambiar de perfil</span>
          </Link>

          {onSyncMysql && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onSyncMysql();
              }}
              disabled={isSyncingMysql}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-indigo-50 text-indigo-700 transition-colors text-left cursor-pointer font-medium"
              title="Guarda todos los estados recibidos y cambios de órdenes en la base de datos MySQL online"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 shrink-0 ${isSyncingMysql ? "animate-spin" : ""}`} />
              <span>{isSyncingMysql ? "Sincronizando..." : "Sincronizar con MySQL"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClearLocalData}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700 transition-colors text-left cursor-pointer"
            title="Borra la memoria temporal de este navegador y fuerza la recarga 100% directa desde MySQL"
          >
            <Trash2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>Limpiar residuos locales</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-rose-50 text-rose-700 transition-colors text-left cursor-pointer font-medium"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
