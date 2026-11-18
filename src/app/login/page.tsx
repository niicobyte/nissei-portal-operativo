"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Terminal,
  ChevronDown,
  ChevronRight,
  Wrench,
  PackageOpen,
  Cpu,
  Database,
  Truck,
  Clock,
  ShieldAlert,
  RefreshCw,
  MessageSquare,
  Building2,
  Layers,
} from "lucide-react";
import { SpeedTruck } from "@/components/common/SpeedTruck";
import { AnimatedReceptionBox } from "@/components/common/AnimatedReceptionBox";
import { AnimatedCpu } from "@/components/common/AnimatedCpu";
import dynamic from "next/dynamic";
import {
  USER_PROFILES,
  UserProfile,
  authenticate,
  verifyAdminPassword,
  logout,
  fetchServerDeployId,
  updateSessionDeployVersion,
  savePendingReturnTo,
  consumePendingReturnTo,
  getPendingReturnTo,
  isValidReturnToPath,
  isAuthorizedForPath,
} from "@/data/authData";

const DatabaseViewerModal = dynamic(
  () => import("@/components/common/DatabaseViewerModal"),
  { ssr: false }
);

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const returnToParam = searchParams.get("returnTo");
  const deployIdRef = React.useRef<string | null>(null);

  // Sector principal seleccionado: "RECEPCION" | "DEPOSITO" | "MONTAJES"
  const [activeSector, setActiveSector] = useState<"RECEPCION" | "DEPOSITO" | "MONTAJES">("RECEPCION");

  // Perfil seleccionado para ingresar contraseña
  const [selectedProfile, setSelectedProfile] = useState<UserProfile>(
    USER_PROFILES.find((p) => p.id === "recepcion") || USER_PROFILES[0]
  );

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isRedirectingRef = React.useRef(false);

  // Estados para el acceso directo al Visor de Base de Datos MySQL
  const [showDbAuthBox, setShowDbAuthBox] = useState(false);
  const [dbPassword, setDbPassword] = useState("");
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);

  // Telemetría en vivo para cada sector operativo (mostrada en los botones de acceso)
  const [telemetry, setTelemetry] = useState({
    recepcion: {
      ingresosHoy: 0,
      ingresosSub: "Hoy en ASU",
      notificaciones: 0,
      notificacionesSub: "Avisos al Cliente",
      listosEntrega: 0,
    },
    deposito: {
      enCamino: 0,
      enCde: 0,
      recibidosAsu: 0,
    },
    montajes: {
      enCola: 0,
      enColaSub: "En espera",
      enBanco: 0,
      finalizados: 0,
    },
  });

  useEffect(() => {
    let cancelled = false;
    try {
      // 1. Intentar leer primero de localStorage si la estación de trabajo ya tiene caché local
      const rawRec = localStorage.getItem("nissei_recepcion_tickets_v9");
      const rawCheckins = localStorage.getItem("nissei_recepcion_cde_checkins_v1");
      const rawCde = localStorage.getItem("nissei_recepcion_cde_tickets_v2");
      const rawMontajes = localStorage.getItem("nissei_taller_montajes_v4_real");

      const recTickets: any[] = rawRec ? JSON.parse(rawRec) : [];
      const checkins: Record<string, any> = rawCheckins ? JSON.parse(rawCheckins) : {};
      const cdeTickets: any[] = rawCde ? JSON.parse(rawCde) : [];
      const montajesList: any[] = rawMontajes ? JSON.parse(rawMontajes) : [];

      if (recTickets.length > 0 || cdeTickets.length > 0 || montajesList.length > 0) {
        const now = new Date();
        const d = String(now.getDate()).padStart(2, "0");
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const y = String(now.getFullYear());
        const todayStr = `${d}/${m}/${y}`;

        const hoyCount = recTickets.filter((t) =>
          String(t.fechaIngreso || "").trim().includes(todayStr)
        ).length;
        const notifCount = recTickets.filter((t) => {
          const isDanesa = String(t.cliente || "").toUpperCase().includes("DANESA");
          const recibido = Boolean(t.recibidoEnDeposito || checkins[t.idOrden]?.recibido);
          return !isDanesa && recibido;
        }).length;
        const listosCount = recTickets.filter((t) => {
          const st = String(t.estado || "").toLowerCase();
          if (st.includes("entregada") || st.includes("entregado")) return false;
          const recibido = Boolean(t.recibidoEnDeposito || checkins[t.idOrden]?.recibido);
          return recibido || st.includes("reparada") || st.includes("listo");
        }).length;

        const enCaminoCount = cdeTickets.filter((t) => {
          const isRecibido = Boolean(checkins[t.idOrden]?.recibido || t.recibidoEnDeposito);
          return !isRecibido && Boolean(t.fechaEntregada && String(t.fechaEntregada).trim() !== "");
        }).length;
        const enCdeCount = cdeTickets.filter(
          (t) => !t.fechaEntregada || String(t.fechaEntregada).trim() === ""
        ).length;
        const recibidosAsuCount =
          Object.values(checkins).filter((c: any) => c?.recibido).length ||
          cdeTickets.filter((t) => Boolean(t.recibidoEnDeposito)).length;

        const enColaCount = montajesList.filter(
          (m) => m.estado === "Pendiente" || m.etapa === "PENDIENTE_PIEZAS"
        ).length;
        const enBancoCount = montajesList.filter(
          (m) =>
            m.estado === "En Proceso" ||
            m.etapa === "ARMADO_MECANICO" ||
            m.etapa === "ESTRES_TERMICO"
        ).length;
        const finCount = montajesList.filter(
          (m) =>
            m.estado === "Entregado" ||
            m.estado === "Rev. Cerrado" ||
            m.etapa === "LISTO_ENTREGA"
        ).length;

        setTelemetry({
          recepcion: {
            ingresosHoy: hoyCount,
            ingresosSub: hoyCount > 0 ? "Registrados hoy" : "Hoy en ASU",
            notificaciones: notifCount,
            notificacionesSub: notifCount > 0 ? "Avisos listos" : "Sin pendientes",
            listosEntrega: listosCount,
          },
          deposito: {
            enCamino: enCaminoCount,
            enCde: enCdeCount,
            recibidosAsu: recibidosAsuCount,
          },
          montajes: {
            enCola: enColaCount,
            enColaSub: enColaCount > 0 ? `${enColaCount} en espera` : "En espera",
            enBanco: enBancoCount,
            finalizados: finCount,
          },
        });
      }
    } catch {
      // Ignorar errores de parseo de caché local
    }

    // 2. Obtener métricas agregadas del servidor sin descargar registros de clientes al bundle público
    fetch("/api/telemetry", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        setTelemetry((prev) => {
          const hasLocalRec =
            prev.recepcion.ingresosHoy > 0 ||
            prev.recepcion.notificaciones > 0 ||
            prev.recepcion.listosEntrega > 0;
          if (hasLocalRec) return prev;
          const hoy = Number(data.recepcion?.ingresosHoy || 0);
          const notif = Number(data.recepcion?.notificaciones || 0);
          const listos = Number(data.recepcion?.listosEntrega || 0);
          const enCola = Number(data.montajes?.enCola || 0);
          return {
            recepcion: {
              ingresosHoy: hoy,
              ingresosSub: hoy > 0 ? "Registrados hoy" : "Hoy en ASU",
              notificaciones: notif,
              notificacionesSub: notif > 0 ? "Avisos listos" : "Sin pendientes",
              listosEntrega: listos,
            },
            deposito: {
              enCamino: Number(data.deposito?.enCamino || 0),
              enCde: Number(data.deposito?.enCde || 0),
              recibidosAsu: Number(data.deposito?.recibidosAsu || 0),
            },
            montajes: {
              enCola,
              enColaSub: enCola > 0 ? `${enCola} en espera` : "En espera",
              enBanco: Number(data.montajes?.enBanco || 0),
              finalizados: Number(data.montajes?.finalizados || 0),
            },
          };
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Limpieza rigurosa de sesiones expiradas al ingresar a Login + precarga de deployId y returnTo
  useEffect(() => {
    logout();
    void fetchServerDeployId(3000).then((id) => {
      deployIdRef.current = id;
    });

    const effectiveReturnTo = isValidReturnToPath(returnToParam)
      ? returnToParam
      : getPendingReturnTo();
    if (effectiveReturnTo) {
      savePendingReturnTo(effectiveReturnTo);
      if (effectiveReturnTo.startsWith("/tecnicos")) {
        setActiveSector("MONTAJES");
        const prof = USER_PROFILES.find((p) => p.id === "montajes");
        if (prof) setSelectedProfile(prof);
      } else if (effectiveReturnTo.startsWith("/recepcion/cde")) {
        setActiveSector("DEPOSITO");
        const prof = USER_PROFILES.find((p) => p.id === "deposito.danesa");
        if (prof) setSelectedProfile(prof);
      } else if (effectiveReturnTo.startsWith("/recepcion")) {
        setActiveSector("RECEPCION");
        const prof = USER_PROFILES.find((p) => p.id === "recepcion");
        if (prof) setSelectedProfile(prof);
      }
    }
  }, [returnToParam]);

  const reasonBanner = (() => {
    if (reason === "updated") {
      return {
        tone: "indigo" as const,
        title: "Sistema actualizado con los últimos ajustes",
        desc: "Por seguridad y para aplicar la nueva versión del portal, se cerró tu sesión y se respaldó tu progreso en curso. Al iniciar sesión volverás automáticamente al mismo apartado.",
      };
    }
    if (reason === "inactivity") {
      return {
        tone: "amber" as const,
        title: "Sesión cerrada por inactividad",
        desc: "Por protocolo de seguridad de la sucursal, la sesión se bloqueó tras un período sin interacción. Ingrese su clave para continuar.",
      };
    }
    if (reason === "expired" || reason === "unauthenticated") {
      return {
        tone: "amber" as const,
        title: "Autenticación requerida",
        desc: "El acceso directo sin contraseña está bloqueado. Ingrese las credenciales de su sector para acceder.",
      };
    }
    return null;
  })();

  const handleSelectSector = (sector: "MONTAJES" | "RECEPCION" | "DEPOSITO") => {
    setActiveSector(sector);
    setPassword("");
    setError(null);

    if (sector === "DEPOSITO") {
      const prof = USER_PROFILES.find((p) => p.id === "deposito.danesa");
      if (prof) setSelectedProfile(prof);
    } else if (sector === "RECEPCION") {
      const prof = USER_PROFILES.find((p) => p.id === "recepcion");
      if (prof) setSelectedProfile(prof);
    } else {
      const prof = USER_PROFILES.find((p) => p.id === "montajes");
      if (prof) setSelectedProfile(prof);
    }
  };

  const completeLoginAndSync = async (authUser: UserProfile) => {
    setError(null);
    setSuccess(`Autenticado como ${authUser.nombre}. Sincronizando con MySQL en la nube...`);

    const serverDeployId = deployIdRef.current || (await fetchServerDeployId(2500));
    if (serverDeployId) {
      updateSessionDeployVersion(serverDeployId);
    }

    try {
      const { syncAllModulesFromMySQL } = await import("@/lib/cloudSync");
      await syncAllModulesFromMySQL(7000).catch(() => {});
    } catch {
      // Ignorar fallo de carga asíncrona
    }

    const candidateReturnTo = isValidReturnToPath(returnToParam)
      ? returnToParam
      : consumePendingReturnTo();
    consumePendingReturnTo();

    const targetRoute =
      candidateReturnTo && isAuthorizedForPath(authUser, candidateReturnTo)
        ? candidateReturnTo
        : authUser.defaultRoute;

    router.push(targetRoute);
  };

  // Validación automática en tiempo real al escribir la contraseña (sin necesidad de pulsar Enter)
  const attemptAutoLogin = (entered: string): boolean => {
    if (isRedirectingRef.current) return true;
    const clean = entered.trim();
    if (!clean) return false;

    const result = authenticate(selectedProfile.id, clean);
    if (result.success) {
      isRedirectingRef.current = true;
      const authUser = result.user || selectedProfile;
      void completeLoginAndSync(authUser);
      return true;
    }

    return false;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (attemptAutoLogin(password)) {
      return;
    }

    const result = authenticate(selectedProfile.id, password);
    if (!result.success) {
      setError(result.message);
      return;
    }

    isRedirectingRef.current = true;
    const authUser = result.user || selectedProfile;
    void completeLoginAndSync(authUser);
  };

  const handleToggleDbAccess = () => {
    setDbError(null);
    if (verifyAdminPassword(password)) {
      setDbPassword("");
      setShowDbAuthBox(false);
      setIsDbModalOpen(true);
      return;
    }
    setShowDbAuthBox(!showDbAuthBox);
  };

  const handleDbAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDbError(null);
    const entered = dbPassword.trim() || password.trim();

    if (!verifyAdminPassword(entered)) {
      setDbError("Contraseña de Admin incorrecta. Acceso restringido a Base de Datos.");
      return;
    }

    setDbPassword("");
    setShowDbAuthBox(false);
    setIsDbModalOpen(true);
  };

  return (
    <main className="min-h-dvh bg-[#fbf9f9] py-6 sm:py-10 2xl:py-16 px-3 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-5xl 2xl:max-w-6xl 3xl:max-w-7xl w-full space-y-6 sm:space-y-8">
        
        {/* Cabecera NISSEI */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-zinc-100 border border-zinc-200 rounded-lg text-xs sm:text-sm font-medium text-zinc-700">
            <Terminal className="w-4 h-4 text-zinc-900" />
            <span>NISSEI S.A. · Control de acceso operativo</span>
          </div>
          <h1 className="text-3xl sm:text-4xl 2xl:text-5xl font-extrabold text-zinc-900 tracking-tight">
            Identificación de Operador y Sector
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 max-w-2xl mx-auto">
            Seleccione el sector operativo correspondiente: Taller de Montajes de PC o Recepción Post-Venta.
          </p>
        </div>

        {/* Banner de Actualización / Sesión Expirada por Seguridad o Inactividad */}
        {reasonBanner && (
          <div
            className={`p-4 sm:p-5 rounded-xl border flex items-start gap-3.5 text-xs sm:text-sm shadow-xs animate-in fade-in duration-300 ${
              reasonBanner.tone === "indigo"
                ? "bg-indigo-50 border-indigo-300 text-indigo-950"
                : "bg-amber-50 border-amber-300 text-amber-950"
            }`}
          >
            {reasonBanner.tone === "indigo" ? (
              <RefreshCw className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            ) : (
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <strong
                className={`block text-sm font-bold ${
                  reasonBanner.tone === "indigo" ? "text-indigo-900" : "text-amber-900"
                }`}
              >
                {reasonBanner.title}
              </strong>
              <p
                className={`text-xs sm:text-sm mt-0.5 ${
                  reasonBanner.tone === "indigo" ? "text-indigo-800" : "text-amber-800"
                }`}
              >
                {reasonBanner.desc}
              </p>
            </div>
          </div>
        )}

        {/* Tarjeta de Autenticación Principal */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Columna Izquierda: Los 3 Sectores Principales (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-8 space-y-4 border-b lg:border-b-0 lg:border-r border-zinc-200">
            <div>
              <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wide">
                1. Seleccione sector operativo
              </h2>
            </div>

            {/* Los 3 Sectores Operativos con Telemetría en Vivo */}
            <div className="space-y-3">
              
              {/* Opción 1: Recepción Post-Venta */}
              <button
                type="button"
                onClick={() => handleSelectSector("RECEPCION")}
                className={`w-full p-4 sm:p-5 rounded-xl border text-left transition-all cursor-pointer ${
                  activeSector === "RECEPCION"
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${activeSector === "RECEPCION" ? "bg-white/10 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                      <AnimatedReceptionBox
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        beamColor={activeSector === "RECEPCION" ? "bg-emerald-300" : "bg-emerald-500"}
                        pingColor={activeSector === "RECEPCION" ? "bg-emerald-300" : "bg-emerald-500"}
                      />
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-base sm:text-lg font-bold truncate">Recepción Post-Venta</strong>
                      <span className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 font-semibold ${activeSector === "RECEPCION" ? "text-emerald-400" : "text-emerald-600"}`}>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        Telemetría en Vivo
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 shrink-0 transition-transform ${activeSector === "RECEPCION" ? "text-white translate-x-1" : "text-zinc-400"}`} />
                </div>

                {/* Telemetría 3 métricas */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <div className={`p-2.5 sm:p-3 rounded-lg border flex flex-col justify-between ${
                    activeSector === "RECEPCION"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "RECEPCION" ? "text-zinc-300" : "text-zinc-600"
                    }`}>
                      <span className="truncate">Ingresos Hoy</span>
                      <PackageOpen className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.recepcion.ingresosHoy}
                    </span>
                    <span className={`text-xs mt-0.5 truncate ${
                      activeSector === "RECEPCION" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      {telemetry.recepcion.ingresosSub}
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border flex flex-col justify-between ${
                    activeSector === "RECEPCION"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "RECEPCION" ? "text-zinc-300" : "text-zinc-600"
                    }`}>
                      <span className="truncate">Notificadas</span>
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.recepcion.notificaciones}
                    </span>
                    <span className={`text-xs mt-0.5 truncate ${
                      activeSector === "RECEPCION" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      {telemetry.recepcion.notificacionesSub}
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border flex flex-col justify-between ${
                    activeSector === "RECEPCION"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "RECEPCION" ? "text-zinc-300" : "text-zinc-600"
                    }`}>
                      <span className="truncate">Listos Retiro</span>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.recepcion.listosEntrega}
                    </span>
                    <span className={`text-xs mt-0.5 truncate ${
                      activeSector === "RECEPCION" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      Balcón ASU
                    </span>
                  </div>
                </div>
              </button>

              {/* Opción 2: SATI ASU - CDE & Taller Central CDE */}
              <button
                type="button"
                onClick={() => handleSelectSector("DEPOSITO")}
                className={`w-full p-4 sm:p-5 rounded-xl border text-left transition-all cursor-pointer ${
                  activeSector === "DEPOSITO"
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${activeSector === "DEPOSITO" ? "bg-white/10 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                      <SpeedTruck
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        smokeColor={activeSector === "DEPOSITO" ? "bg-amber-400" : "bg-amber-500/80"}
                      />
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-base sm:text-lg font-bold truncate">SATI ASU - CDE</strong>
                      <span className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 font-semibold ${activeSector === "DEPOSITO" ? "text-amber-400" : "text-amber-600"}`}>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                        Monitoreo Logístico
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 shrink-0 transition-transform ${activeSector === "DEPOSITO" ? "text-white translate-x-1" : "text-zinc-400"}`} />
                </div>

                {/* Telemetría 3 métricas */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <div className={`p-2.5 sm:p-3 rounded-lg border flex flex-col justify-between ${
                    activeSector === "DEPOSITO"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "DEPOSITO" ? "text-zinc-300" : "text-zinc-600"
                    }`}>
                      <span className="truncate">En Camino</span>
                      <Truck className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.deposito.enCamino}
                    </span>
                    <span className={`text-xs mt-0.5 truncate ${
                      activeSector === "DEPOSITO" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      Transportadora
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border flex flex-col justify-between ${
                    activeSector === "DEPOSITO"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "DEPOSITO" ? "text-zinc-300" : "text-zinc-600"
                    }`}>
                      <span className="truncate">En CDE</span>
                      <Building2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.deposito.enCde}
                    </span>
                    <span className={`text-xs mt-0.5 truncate ${
                      activeSector === "DEPOSITO" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      Taller Matriz
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border flex flex-col justify-between ${
                    activeSector === "DEPOSITO"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "DEPOSITO" ? "text-zinc-300" : "text-zinc-600"
                    }`}>
                      <span className="truncate">Recibidos ASU</span>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.deposito.recibidosAsu}
                    </span>
                    <span className={`text-xs mt-0.5 truncate ${
                      activeSector === "DEPOSITO" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      Depósito Danesa
                    </span>
                  </div>
                </div>
              </button>

              {/* Opción 3: Taller de Montajes de PC */}
              <button
                type="button"
                onClick={() => handleSelectSector("MONTAJES")}
                className={`w-full p-4 sm:p-5 rounded-xl border text-left transition-all cursor-pointer ${
                  activeSector === "MONTAJES"
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${activeSector === "MONTAJES" ? "bg-white/10 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                      <AnimatedCpu
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        coreColor={activeSector === "MONTAJES" ? "bg-cyan-300" : "bg-cyan-500"}
                        auraColor={activeSector === "MONTAJES" ? "bg-cyan-400/25" : "bg-cyan-500/15"}
                      />
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-base sm:text-lg font-bold truncate">Taller de Montajes de PC</strong>
                      <span className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 font-semibold ${activeSector === "MONTAJES" ? "text-cyan-400" : "text-cyan-600"}`}>
                        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shrink-0"></span>
                        Ensambles &amp; Hardware
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 shrink-0 transition-transform ${activeSector === "MONTAJES" ? "text-white translate-x-1" : "text-zinc-400"}`} />
                </div>

                {/* Telemetría 3 métricas */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <div className={`p-2.5 sm:p-3 rounded-lg border flex flex-col justify-between ${
                    activeSector === "MONTAJES"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "MONTAJES" ? "text-zinc-300" : "text-zinc-600"
                    }`}>
                      <span className="truncate">En Cola</span>
                      <Layers className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.montajes.enCola}
                    </span>
                    <span className={`text-xs mt-0.5 truncate ${
                      activeSector === "MONTAJES" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      {telemetry.montajes.enColaSub}
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border flex flex-col justify-between ${
                    activeSector === "MONTAJES"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "MONTAJES" ? "text-zinc-300" : "text-zinc-600"
                    }`}>
                      <span className="truncate">En Banco</span>
                      <Cpu className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.montajes.enBanco}
                    </span>
                    <span className={`text-xs mt-0.5 truncate ${
                      activeSector === "MONTAJES" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      Bench 01 - 04
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border flex flex-col justify-between ${
                    activeSector === "MONTAJES"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "MONTAJES" ? "text-zinc-300" : "text-zinc-600"
                    }`}>
                      <span className="truncate">Finalizados</span>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.montajes.finalizados}
                    </span>
                    <span className={`text-xs mt-0.5 truncate ${
                      activeSector === "MONTAJES" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      Entregados
                    </span>
                  </div>
                </div>
              </button>

            </div>
          </div>

          {/* Columna Derecha: Formulario de Contraseña del Perfil Seleccionado (5 cols) */}
          <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-zinc-50/60">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <h2 className="text-sm font-bold text-zinc-700 uppercase tracking-wide">
                  2. Credencial de acceso
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 mt-1">
                  Ingrese la clave de seguridad para {selectedProfile.nombre}.
                </p>
              </div>

              {/* Ficha Resumen del Perfil */}
              <div className="p-4 sm:p-5 bg-white rounded-xl border border-zinc-200 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <span className="w-12 h-12 rounded-xl bg-zinc-900 text-white font-mono text-base font-bold flex items-center justify-center shrink-0">
                    {selectedProfile.avatar}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">
                      {selectedProfile.nombre}
                    </h3>
                    <span className="text-xs font-semibold text-zinc-500 block">
                      {selectedProfile.badge}
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed pt-2.5 border-t border-zinc-100">
                  {selectedProfile.descripcion}
                </p>
              </div>

              {/* Campo de Contraseña */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm text-zinc-700 font-bold block">
                  Contraseña de seguridad
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPassword(val);
                      setError(null);
                      attemptAutoLogin(val);
                    }}
                    placeholder={`Clave de ${selectedProfile.nombre}...`}
                    className="w-full text-base bg-white border border-zinc-300 rounded-xl px-4 py-3 pr-12 focus:border-zinc-900 outline-none transition-colors shadow-2xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-zinc-400 hover:text-zinc-700 transition-colors p-1"
                    title={showPassword ? "Ocultar" : "Mostrar"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Mensajes de Estado */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{success}</span>
                </div>
              )}

              {/* Botón Ingresar */}
              <button
                type="submit"
                className="w-full py-3.5 bg-zinc-900 hover:bg-black text-white text-sm sm:text-base font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Acceder a {selectedProfile.nombre}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>

            {/* Pie de Página + Acceso a Base de Datos MySQL */}
            <div className="pt-6 border-t border-zinc-200 text-center space-y-2.5">
              <span className="text-xs text-zinc-400 block font-mono">
                Sistema de Asistencia Técnica Integrada
              </span>

              <button
                type="button"
                onClick={handleToggleDbAccess}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 border border-transparent hover:border-zinc-200 transition-colors cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Base de Datos</span>
                <Lock className="w-3 h-3 opacity-70" />
              </button>

              {showDbAuthBox && (
                <form onSubmit={handleDbAuthSubmit} className="mt-2 p-3.5 bg-zinc-100 rounded-xl border border-zinc-300 space-y-2 text-left">
                  <div className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Clave de Administrador</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showDbPassword ? "text" : "password"}
                      value={dbPassword}
                      autoFocus
                      onChange={(e) => {
                        const val = e.target.value;
                        setDbPassword(val);
                      }}
                      placeholder="Ingrese contraseña de admin..."
                      className="w-full text-sm bg-white border border-zinc-300 rounded-lg px-3 py-2 pr-10 focus:border-zinc-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDbPassword(!showDbPassword)}
                      className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700"
                    >
                      {showDbPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {dbError && (
                    <div className="text-xs text-rose-700 font-semibold">{dbError}</div>
                  )}
                  <button
                    type="submit"
                    className="w-full py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Abrir Visor MySQL
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

      </div>

      {isDbModalOpen && (
        <DatabaseViewerModal
          isOpen={isDbModalOpen}
          onClose={() => setIsDbModalOpen(false)}
        />
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fbf9f9] flex items-center justify-center">
          <div className="text-xs font-mono text-zinc-500">Cargando control de acceso...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
