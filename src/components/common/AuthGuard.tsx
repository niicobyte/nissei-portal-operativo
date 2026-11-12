"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldAlert, Clock, RefreshCw } from "lucide-react";
import {
  getActiveUser,
  getSessionDeployVersion,
  fetchServerDeployId,
  savePendingReturnTo,
  logout,
  touchSession,
  UserProfile,
  SESSION_TIMEOUT_MS,
  AUTH_STORAGE_KEY,
} from "@/data/authData";
import { FLUSH_DRAFTS_EVENT } from "@/lib/workDrafts";

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
  const [isUpdatingDeploy, setIsUpdatingDeploy] = useState(false);

  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTouchRef = useRef<number>(Date.now());
  const deployKickStartedRef = useRef(false);

  const forceSaveAndKickToLogin = useCallback(
    (reason: "updated" | "expired" | "inactivity" | "logged_out", hardReload = false) => {
      if (deployKickStartedRef.current) return;
      deployKickStartedRef.current = true;

      if (typeof window !== "undefined") {
        // 1. Solicitar guardado inmediato de borradores en edición antes de cerrar sesión
        window.dispatchEvent(new CustomEvent(FLUSH_DRAFTS_EVENT));
        const currentPath = `${window.location.pathname}${window.location.search}`;
        savePendingReturnTo(currentPath);

        if (reason === "updated") {
          setIsUpdatingDeploy(true);
        } else {
          setIsExpired(true);
        }

        const targetUrl = `/login?reason=${reason}&returnTo=${encodeURIComponent(currentPath)}`;
        setTimeout(() => {
          logout();
          if (hardReload) {
            window.location.replace(targetUrl);
          } else {
            router.replace(targetUrl);
          }
        }, 120);
        return;
      }

      logout();
      router.replace(`/login?reason=${reason}`);
    },
    [router]
  );

  // 1. Verificación inicial de credenciales al montar la página + validación contra último deploy en Railway
  useEffect(() => {
    let active = true;
    const user = getActiveUser();
    if (!user) {
      setIsChecking(false);
      forceSaveAndKickToLogin("expired", false);
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

    // Validar versión de deploy inmediatamente antes de habilitar interacción
    fetchServerDeployId(3500).then((serverDeployId) => {
      if (!active) return;
      const sessionDeployId = getSessionDeployVersion();
      if (serverDeployId && sessionDeployId !== serverDeployId) {
        setIsChecking(false);
        forceSaveAndKickToLogin("updated", true);
        return;
      }
      setCurrentUser(user);
      setIsChecking(false);
    });

    return () => {
      active = false;
    };
  }, [requiredModule, router, forceSaveAndKickToLogin]);

  // 2. Monitor continuo de nuevos deploys en Railway (polling + focus + visibilidad)
  useEffect(() => {
    if (!currentUser) return;

    let checking = false;
    const checkLatestDeploy = async () => {
      if (checking || deployKickStartedRef.current) return;
      checking = true;
      try {
        const serverDeployId = await fetchServerDeployId(3000);
        const sessionDeployId = getSessionDeployVersion();
        if (serverDeployId && sessionDeployId !== serverDeployId) {
          forceSaveAndKickToLogin("updated", true);
        }
      } finally {
        checking = false;
      }
    };

    const deployInterval = setInterval(() => {
      void checkLatestDeploy();
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkLatestDeploy();
      }
    };
    const handleFocusCheck = () => {
      void checkLatestDeploy();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocusCheck);

    return () => {
      clearInterval(deployInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocusCheck);
    };
  }, [currentUser, forceSaveAndKickToLogin]);

  // 3. Temporizador activo de inactividad (1 hora continua sin interacción)
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
        console.warn("[AUTH GUARD] Tiempo límite de inactividad alcanzado.");
        forceSaveAndKickToLogin("inactivity", false);
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
        forceSaveAndKickToLogin("logged_out", false);
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
  }, [currentUser, forceSaveAndKickToLogin]);

  // Pantalla de actualización automática ante nuevo deploy en Railway
  if (isUpdatingDeploy) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0c0d0e] flex flex-col items-center justify-center p-6 text-white select-none">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center mb-4 shadow-2xl">
          <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
        </div>
        <h2 className="text-lg font-extrabold tracking-tight text-white text-center">
          Nueva actualización del sistema aplicada
        </h2>
        <p className="text-xs text-zinc-400 mt-2 max-w-sm text-center">
          Guardamos tu progreso actual de forma segura. Al volver a iniciar sesión regresarás automáticamente a este mismo apartado con los nuevos ajustes.
        </p>
        <div className="mt-5 text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-400/20">
          Cerrando sesión y cargando nueva versión...
        </div>
      </div>
    );
  }

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
