"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldAlert, Clock } from "lucide-react";
import {
  getActiveUser,
  logout,
  touchSession,
  UserProfile,
  SESSION_TIMEOUT_MS,
  AUTH_STORAGE_KEY,
} from "@/data/authData";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredModule?: "recepcion" | "reparaciones" | "montajes" | "deposito.danesa" | "sati-cde";
}

function isAuthorized(
  user: UserProfile,
  requiredModule?: "recepcion" | "reparaciones" | "montajes" | "deposito.danesa" | "sati-cde"
): boolean {
  if (!requiredModule) return true;
  if (user.role === "ADMIN") return true;
  if (requiredModule === "recepcion") {
    return user.role === "RECEPCION" || user.role === "DEPOSITO";
  }
  if (requiredModule === "deposito.danesa" || requiredModule === "sati-cde") {
    return user.role === "DEPOSITO" || user.role === "RECEPCION";
  }
  if (requiredModule === "reparaciones") {
    return user.role === "TECNICO";
  }
  if (requiredModule === "montajes") {
    return user.role === "MONTAJES";
  }
  return false;
}

export function AuthGuard({ children, requiredModule }: AuthGuardProps) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isDenied, setIsDenied] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTouchRef = useRef<number>(Date.now());

  // 1. Verificación inicial de credenciales al montar la página
  useEffect(() => {
    const user = getActiveUser();
    if (!user) {
      setIsChecking(false);
      setIsExpired(true);
      router.replace("/login?reason=expired");
      return;
    }

    if (!isAuthorized(user, requiredModule)) {
      setIsChecking(false);
      setIsDenied(true);
      setTimeout(() => {
        router.replace(user.defaultRoute);
      }, 1200);
      return;
    }

    setCurrentUser(user);
    setIsChecking(false);
  }, [requiredModule, router]);

  // 2. Temporizador activo de inactividad (15 minutos continuos sin interacción)
  useEffect(() => {
    if (!currentUser) return;

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      const now = Date.now();
      // Debounce: renovar timestamp en almacenamiento máximo una vez cada 20 segundos
      if (now - lastTouchRef.current > 20000) {
        lastTouchRef.current = now;
        touchSession();
      }

      inactivityTimerRef.current = setTimeout(() => {
        console.warn("[AUTH GUARD] Tiempo límite de 15 minutos alcanzado por inactividad.");
        logout();
        setIsExpired(true);
        router.replace("/login?reason=inactivity");
      }, SESSION_TIMEOUT_MS);
    };

    resetInactivityTimer();

    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart"];
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, resetInactivityTimer, { passive: true });
    });

    // Escuchar cambios de sesión en otras pestañas
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY && !e.newValue) {
        logout();
        setIsExpired(true);
        router.replace("/login?reason=logged_out");
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, resetInactivityTimer);
      });
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [currentUser, router]);

  // Pantalla de bloqueo intrusivo durante la verificación o si no está autenticado
  if (isChecking) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0c0d0e] flex flex-col items-center justify-center p-6 text-white select-none">
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 shadow-xl">
          <Lock className="w-6 h-6 text-amber-400 animate-pulse" />
        </div>
        <h2 className="text-base font-bold tracking-tight">Verificando Credenciales SATI...</h2>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs text-center font-mono">
          Validando token de seguridad y tiempo de sesión activa...
        </p>
      </div>
    );
  }

  // Si la sesión expiró o no existe: Bloqueo total instantáneo
  if (isExpired || !currentUser) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0c0d0e] flex flex-col items-center justify-center p-6 text-white select-none">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 shadow-2xl">
          <Clock className="w-7 h-7 text-amber-400 animate-bounce" />
        </div>
        <h2 className="text-lg font-extrabold tracking-tight text-white">Sesión Bloqueada por Seguridad</h2>
        <p className="text-xs text-zinc-400 mt-2 max-w-sm text-center">
          El acceso directo sin clave está restringido. Por protocolo de seguridad de la sucursal, debe ingresar su contraseña autorizada.
        </p>
        <div className="mt-5 text-[11px] font-mono text-amber-400/80 bg-amber-400/10 px-3 py-1.5 rounded-lg border border-amber-400/20">
          Redirigiendo a pantalla de acceso...
        </div>
      </div>
    );
  }

  // Si no tiene permisos para el módulo
  if (isDenied) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0c0d0e] flex flex-col items-center justify-center p-6 text-white select-none">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7 text-rose-500" />
        </div>
        <h2 className="text-lg font-bold text-white">Acceso No Autorizado</h2>
        <p className="text-xs text-zinc-400 mt-2 max-w-sm text-center">
          Su perfil ({currentUser.nombre}) no cuenta con permisos para este sector. Redirigiendo a su panel...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
