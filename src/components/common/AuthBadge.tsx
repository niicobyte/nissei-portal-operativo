"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, LogOut, Key, ChevronDown, ShieldAlert, ArrowRight, Trash2, RefreshCw } from "lucide-react";
import { getActiveUser, logout, UserProfile } from "@/data/authData";

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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const active = getActiveUser();
    setUser(active);
    if (!active && requiredModule) {
      router.replace("/login");
    }
  }, [requiredModule, router]);

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
      <div className="fixed inset-0 z-[100] bg-[#fbf9f9] flex items-center justify-center p-4">
        <div className="flex items-center gap-2.5 text-xs font-mono text-zinc-500">
          <Lock className="w-4 h-4 text-zinc-800 animate-pulse" />
          <span>Verificando credenciales de seguridad SATI...</span>
        </div>
      </div>
    );
  }

  // Si no hay sesión activa, bloqueamos toda la vista y redirigimos a /login
  if (!user) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#fbf9f9] flex items-center justify-center p-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 max-w-sm w-full shadow-lg text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-zinc-900 text-white flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900">Sesión Requerida</h2>
            <p className="text-xs text-zinc-500">
              Debe autenticarse con su clave de sector para acceder a este módulo operativo.
            </p>
          </div>
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold shadow-sm transition-all"
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
      <div className="fixed inset-0 z-[100] bg-[#fbf9f9] flex items-center justify-center p-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 max-w-md w-full shadow-lg text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center mx-auto">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900">Acceso Restringido por Rol</h2>
            <p className="text-xs text-zinc-600">
              Su perfil activo (<strong>{user.nombre}</strong> · {user.badge}) no cuenta con permisos para visualizar este sector.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Link
              href={user.defaultRoute}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-colors"
            >
              Ir a mi Panel Autorizado
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold transition-colors"
            >
              Cambiar de Perfil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-zinc-200 hover:border-zinc-900 text-xs font-semibold text-zinc-900 shadow-sm transition-colors"
      >
        <span className="w-6 h-6 rounded bg-zinc-900 text-white font-mono text-[11px] font-bold flex items-center justify-center tracking-tight">
          {user.avatar}
        </span>
        <div className="text-left leading-tight hidden sm:block">
          <strong className="block text-xs font-bold text-zinc-900">{user.nombre}</strong>
          <span className="text-[11px] text-zinc-500 font-normal">{user.badge}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-lg shadow-lg border border-zinc-200 p-1.5 z-50 text-xs space-y-1">
          <div className="p-2 border-b border-zinc-100 space-y-0.5">
            <span className="text-[11px] text-zinc-400 block font-normal">Sesión activa</span>
            <div className="font-bold text-zinc-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-zinc-900 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                {user.avatar}
              </span>
              <span>{user.nombre}</span>
            </div>
            <div className="text-[11px] text-zinc-500">{user.badge}</div>
          </div>

          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-zinc-100 text-zinc-700 transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-zinc-500" />
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
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-indigo-50 text-indigo-700 transition-colors text-left cursor-pointer font-medium"
              title="Guarda todos los estados recibidos y cambios de órdenes en la base de datos MySQL online"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncingMysql ? "animate-spin" : ""}`} />
              <span>{isSyncingMysql ? "Sincronizando..." : "Sincronizar con MySQL"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClearLocalData}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-zinc-100 text-zinc-700 transition-colors text-left cursor-pointer"
            title="Borra la memoria temporal de este navegador y fuerza la recarga 100% directa desde MySQL"
          >
            <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
            <span>Limpiar residuos locales</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-rose-50 text-rose-700 transition-colors text-left"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}
    </div>
  );
}
