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
import { syncAllModulesFromMySQL } from "@/lib/cloudSync";
import { getStoredTickets } from "@/data/recepcionData";
import { getStoredCdeTickets, getStoredCdeCheckins } from "@/data/recepcionCdeData";
import { getStoredMontajes } from "@/data/montajesData";
import {
  USER_PROFILES,
  UserProfile,
  authenticate,
  getActiveUser,
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
import DatabaseViewerModal from "@/components/common/DatabaseViewerModal";

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
      notificacionesSub: "Whapi WhatsApp",
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
    try {
      // 1. Recepción Post-Venta (Métricas reales y transparentes sin topes ficticios)
      const recTickets = getStoredTickets();
      const checkins = getStoredCdeCheckins();
      let hoyCount = 0;
      let notifCount = 0;
      let listosCount = 0;

      if (Array.isArray(recTickets) && recTickets.length > 0) {
        const now = new Date();
        const d = String(now.getDate()).padStart(2, "0");
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const y = String(now.getFullYear());
        const todayStr = `${d}/${m}/${y}`;

        // Ingresos reales registrados con fecha de hoy
        hoyCount = recTickets.filter((t) => {
          const f = (t.fechaIngreso || "").trim();
          return f.includes(todayStr);
        }).length;

        // Notificaciones reales enviadas por WhatsApp a clientes (órdenes que no son stock Danesa y fueron notificadas/recibidas en sucursal)
        notifCount = recTickets.filter((t) => {
          const isDanesa = (t.cliente || "").toUpperCase().includes("DANESA");
          const recibido = Boolean(t.recibidoEnDeposito || checkins[t.idOrden]?.recibido);
          return !isDanesa && recibido;
        }).length;

        // Listos para retiro en sucursal (recibidos y sin entregar al cliente aún)
        listosCount = recTickets.filter((t) => {
          const st = (t.estado || "").toLowerCase();
          if (st.includes("entregada") || st.includes("entregado")) return false;
          const recibido = Boolean(t.recibidoEnDeposito || checkins[t.idOrden]?.recibido);
          return recibido || st.includes("reparada") || st.includes("listo");
        }).length;
      }

      // 2. SATI CDE
      const cdeTickets = getStoredCdeTickets();
      let enCaminoCount = 0;
      let enCdeCount = 0;
      let recibidosAsuCount = 0;

      if (Array.isArray(cdeTickets) && cdeTickets.length > 0) {
        enCaminoCount = cdeTickets.filter((t) => {
          const isRecibido = Boolean(checkins[t.idOrden]?.recibido || t.recibidoEnDeposito);
          return !isRecibido && Boolean(t.fechaEntregada && t.fechaEntregada.trim() !== "");
        }).length;
        enCdeCount = cdeTickets.filter((t) => !t.fechaEntregada || t.fechaEntregada.trim() === "").length;
        recibidosAsuCount = Object.values(checkins).filter((c) => c?.recibido).length || cdeTickets.filter((t) => Boolean(t.recibidoEnDeposito)).length;
      }

      // 3. Montajes
      const montajesList = getStoredMontajes();
      let enColaCount = 0;
      let enBancoCount = 0;
      let finCount = 0;

      if (Array.isArray(montajesList) && montajesList.length > 0) {
        enColaCount = montajesList.filter((m) => m.estado === "Pendiente" || m.etapa === "PENDIENTE_PIEZAS").length;
        enBancoCount = montajesList.filter((m) => m.estado === "En Proceso" || m.etapa === "ARMADO_MECANICO" || m.etapa === "ESTRES_TERMICO").length;
        finCount = montajesList.filter((m) => m.estado === "Entregado" || m.estado === "Rev. Cerrado" || m.etapa === "LISTO_ENTREGA").length;
      }

      setTelemetry({
        recepcion: {
          ingresosHoy: hoyCount,
          ingresosSub: hoyCount > 0 ? "Registrados hoy" : "Hoy en ASU",
          notificaciones: notifCount,
          notificacionesSub: notifCount > 0 ? "Enviadas Whapi" : "Sin pendientes",
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
    } catch (e) {
      console.warn("No se pudo calcular la telemetría local de login:", e);
    }
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

    await syncAllModulesFromMySQL(7000).catch(() => {});

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

    let profileToAuth = selectedProfile.id;
    const cleanLower = clean.toLowerCase();
    if (cleanLower === "deposito.danesa" || cleanLower === "danesa") {
      profileToAuth = "deposito.danesa";
    }

    const result = authenticate(profileToAuth, clean);
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

    let profileToAuth = selectedProfile.id;
    if (password.trim() === "deposito.danesa" || password.trim() === "danesa") {
      profileToAuth = "deposito.danesa";
    }

    const result = authenticate(profileToAuth, password);
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
      <div className="max-w-4xl 2xl:max-w-5xl 3xl:max-w-6xl w-full space-y-6 sm:space-y-8">
        
        {/* Cabecera NISSEI */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 border border-zinc-200 rounded-md text-xs font-medium text-zinc-700">
            <Terminal className="w-3.5 h-3.5 text-zinc-900" />
            <span>NISSEI S.A. · Control de acceso operativo</span>
          </div>
          <h1 className="text-3xl sm:text-4xl 2xl:text-5xl font-extrabold text-zinc-900 tracking-tight">
            Identificación de Operador y Sector
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 max-w-xl mx-auto">
            Seleccione el sector operativo correspondiente: Taller de Montajes de PC o Recepción Post-Venta.
          </p>
        </div>

        {/* Banner de Actualización / Sesión Expirada por Seguridad o Inactividad */}
        {reasonBanner && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 text-xs shadow-xs animate-in fade-in duration-300 ${
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
                className={`block text-xs font-bold ${
                  reasonBanner.tone === "indigo" ? "text-indigo-900" : "text-amber-900"
                }`}
              >
                {reasonBanner.title}
              </strong>
              <p
                className={`text-[11px] mt-0.5 ${
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
              <h2 className="text-xs font-semibold text-zinc-500">
                1. Seleccione sector operativo
              </h2>
            </div>

            {/* Los 3 Sectores Operativos con Telemetría en Vivo */}
            <div className="space-y-3">
              
              {/* Opción 1: Recepción Post-Venta */}
              <button
                type="button"
                onClick={() => handleSelectSector("RECEPCION")}
                className={`w-full p-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  activeSector === "RECEPCION"
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${activeSector === "RECEPCION" ? "bg-white/10 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                      <AnimatedReceptionBox
                        className="w-5 h-5"
                        beamColor={activeSector === "RECEPCION" ? "bg-emerald-300" : "bg-emerald-500"}
                        pingColor={activeSector === "RECEPCION" ? "bg-emerald-300" : "bg-emerald-500"}
                      />
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-sm font-bold truncate">Recepción Post-Venta</strong>
                      <span className={`text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 font-semibold ${activeSector === "RECEPCION" ? "text-emerald-400" : "text-emerald-600"}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        Telemetría en Vivo
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${activeSector === "RECEPCION" ? "text-white translate-x-0.5" : "text-zinc-400"}`} />
                </div>

                {/* Telemetría 3 métricas */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                    activeSector === "RECEPCION"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "RECEPCION" ? "text-zinc-300" : "text-zinc-500"
                    }`}>
                      <span className="truncate">Ingresos Hoy</span>
                      <PackageOpen className="w-3 h-3 shrink-0 opacity-70" />
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono mt-0.5">
                      {telemetry.recepcion.ingresosHoy}
                    </span>
                    <span className={`text-[8.5px] sm:text-[10px] mt-0.5 truncate ${
                      activeSector === "RECEPCION" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      {telemetry.recepcion.ingresosSub}
                    </span>
                  </div>

                  <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                    activeSector === "RECEPCION"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "RECEPCION" ? "text-zinc-300" : "text-zinc-500"
                    }`}>
                      <span className="truncate">Notificadas</span>
                      <MessageSquare className="w-3 h-3 shrink-0 opacity-70" />
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono mt-0.5">
                      {telemetry.recepcion.notificaciones}
                    </span>
                    <span className={`text-[8.5px] sm:text-[10px] mt-0.5 truncate ${
                      activeSector === "RECEPCION" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      {telemetry.recepcion.notificacionesSub}
                    </span>
                  </div>

                  <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                    activeSector === "RECEPCION"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "RECEPCION" ? "text-zinc-300" : "text-zinc-500"
                    }`}>
                      <span className="truncate">Listos Retiro</span>
                      <CheckCircle2 className="w-3 h-3 shrink-0 opacity-70" />
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono mt-0.5">
                      {telemetry.recepcion.listosEntrega}
                    </span>
                    <span className={`text-[8.5px] sm:text-[10px] mt-0.5 truncate ${
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
                className={`w-full p-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  activeSector === "DEPOSITO"
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${activeSector === "DEPOSITO" ? "bg-white/10 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                      <SpeedTruck
                        className="w-5 h-5"
                        smokeColor={activeSector === "DEPOSITO" ? "bg-amber-400" : "bg-amber-500/80"}
                      />
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-sm font-bold truncate">SATI ASU - CDE</strong>
                      <span className={`text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 font-semibold ${activeSector === "DEPOSITO" ? "text-amber-400" : "text-amber-600"}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                        Monitoreo Logístico
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${activeSector === "DEPOSITO" ? "text-white translate-x-0.5" : "text-zinc-400"}`} />
                </div>

                {/* Telemetría 3 métricas */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                    activeSector === "DEPOSITO"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "DEPOSITO" ? "text-zinc-300" : "text-zinc-500"
                    }`}>
                      <span className="truncate">En Camino</span>
                      <Truck className="w-3 h-3 shrink-0 opacity-70" />
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono mt-0.5">
                      {telemetry.deposito.enCamino}
                    </span>
                    <span className={`text-[8.5px] sm:text-[10px] mt-0.5 truncate ${
                      activeSector === "DEPOSITO" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      Transportadora
                    </span>
                  </div>

                  <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                    activeSector === "DEPOSITO"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "DEPOSITO" ? "text-zinc-300" : "text-zinc-500"
                    }`}>
                      <span className="truncate">En CDE</span>
                      <Building2 className="w-3 h-3 shrink-0 opacity-70" />
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono mt-0.5">
                      {telemetry.deposito.enCde}
                    </span>
                    <span className={`text-[8.5px] sm:text-[10px] mt-0.5 truncate ${
                      activeSector === "DEPOSITO" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      Taller Matriz
                    </span>
                  </div>

                  <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                    activeSector === "DEPOSITO"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "DEPOSITO" ? "text-zinc-300" : "text-zinc-500"
                    }`}>
                      <span className="truncate">Recibidos ASU</span>
                      <CheckCircle2 className="w-3 h-3 shrink-0 opacity-70" />
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono mt-0.5">
                      {telemetry.deposito.recibidosAsu}
                    </span>
                    <span className={`text-[8.5px] sm:text-[10px] mt-0.5 truncate ${
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
                className={`w-full p-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  activeSector === "MONTAJES"
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${activeSector === "MONTAJES" ? "bg-white/10 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                      <AnimatedCpu
                        className="w-5 h-5"
                        coreColor={activeSector === "MONTAJES" ? "bg-cyan-300" : "bg-cyan-500"}
                        auraColor={activeSector === "MONTAJES" ? "bg-cyan-400/25" : "bg-cyan-500/15"}
                      />
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-sm font-bold truncate">Taller de Montajes de PC</strong>
                      <span className={`text-[10px] font-mono uppercase tracking-wider flex items-center gap-1 font-semibold ${activeSector === "MONTAJES" ? "text-cyan-400" : "text-cyan-600"}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shrink-0"></span>
                        Ensambles &amp; Hardware
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${activeSector === "MONTAJES" ? "text-white translate-x-0.5" : "text-zinc-400"}`} />
                </div>

                {/* Telemetría 3 métricas */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                    activeSector === "MONTAJES"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "MONTAJES" ? "text-zinc-300" : "text-zinc-500"
                    }`}>
                      <span className="truncate">En Cola</span>
                      <Layers className="w-3 h-3 shrink-0 opacity-70" />
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono mt-0.5">
                      {telemetry.montajes.enCola}
                    </span>
                    <span className={`text-[8.5px] sm:text-[10px] mt-0.5 truncate ${
                      activeSector === "MONTAJES" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      {telemetry.montajes.enColaSub}
                    </span>
                  </div>

                  <div className={`p-2 rounded-lg border flex flex-col justify-between ${
                    activeSector === "MONTAJES"
                      ? "bg-white/10 border-white/10 text-white"
                      : "bg-white border-zinc-200/90 text-zinc-900 shadow-2xs"
                  }`}>
                    <span className={`text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "MONTAJES" ? "text-zinc-300" : "text-zinc-500"
                    }`}>
                      <span className="truncate">En Banco</span>
                      <Cpu className="w-3 h-3 shrink-0 opacity-70" />
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono mt-0.5">
                      {telemetry.montajes.enBanco}
                    </span>
                    <span className={`text-[8.5px] sm:text-[10px] mt-0.5 truncate ${
                      activeSector === "MONTAJES" ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      Bench 01 - 04
                    </span>
                  </div>

                  {/* Acceso Directo: Armar PC & Presupuestos Compatibles para Vendedores */}
                  <Link
                    href="/armar-pc"
                    onClick={(e) => e.stopPropagation()}
                    className={`p-2 rounded-lg border flex flex-col justify-between transition-all group/armar cursor-pointer ${
                      activeSector === "MONTAJES"
                        ? "bg-gradient-to-br from-cyan-950/80 to-zinc-900 border-cyan-400/50 text-white hover:border-cyan-300 hover:bg-cyan-900/60 shadow-sm"
                        : "bg-gradient-to-br from-cyan-50/80 to-white border-cyan-300 text-zinc-900 hover:border-cyan-500 hover:bg-cyan-100/40 shadow-2xs"
                    }`}
                    title="Abrir Configurador & Presupuestador de PC con Hardware Compatible"
                  >
                    <span className={`text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center justify-between gap-1 ${
                      activeSector === "MONTAJES" ? "text-cyan-300" : "text-cyan-700"
                    }`}>
                      <span className="truncate flex items-center gap-1 font-extrabold">
                        <Wrench className="w-3 h-3 text-cyan-400 shrink-0" />
                        Armar PC
                      </span>
                      <ArrowRight className={`w-3 h-3 shrink-0 transition-transform group-hover/armar:translate-x-0.5 ${
                        activeSector === "MONTAJES" ? "text-cyan-300" : "text-cyan-600"
                      }`} />
                    </span>
                    <span className="text-xs sm:text-[13px] font-black font-mono mt-0.5 text-cyan-400 leading-tight">
                      Presupuestos
                    </span>
                    <span className={`text-[8px] sm:text-[9.5px] mt-0.5 truncate font-semibold flex items-center gap-1 ${
                      activeSector === "MONTAJES" ? "text-zinc-300" : "text-cyan-800"
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0"></span>
                      Compatibilidad OK
                    </span>
                  </Link>
                </div>
              </button>

            </div>
          </div>

          {/* Columna Derecha: Formulario de Contraseña del Perfil Seleccionado (5 cols) */}
          <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-zinc-50/60">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <h2 className="text-xs font-semibold text-zinc-500">
                  2. Credencial de acceso
                </h2>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Ingrese la clave de seguridad para {selectedProfile.nombre}.
                </p>
              </div>

              {/* Ficha Resumen del Perfil */}
              <div className="p-4 bg-white rounded-xl border border-zinc-200 space-y-2 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-zinc-900 text-white font-mono text-sm font-bold flex items-center justify-center">
                    {selectedProfile.avatar}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">
                      {selectedProfile.nombre}
                    </h3>
                    <span className="text-xs text-zinc-500 block">
                      {selectedProfile.badge}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed pt-2 border-t border-zinc-100">
                  {selectedProfile.descripcion}
                </p>
              </div>

              {/* Campo de Contraseña */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-700 font-semibold block">
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
                    className="w-full text-sm bg-white border border-zinc-200 rounded-lg px-3.5 py-2.5 pr-10 focus:border-zinc-900 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-700 transition-colors"
                    title={showPassword ? "Ocultar" : "Mostrar"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mensajes de Estado */}
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{success}</span>
                </div>
              )}

              {/* Botón Ingresar */}
              <button
                type="submit"
                className="w-full py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Acceder a {selectedProfile.nombre}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Pie de Página + Acceso a Base de Datos MySQL */}
            <div className="pt-6 border-t border-zinc-200 text-center space-y-2.5">
              <span className="text-[11px] text-zinc-400 block font-mono">
                Sistema de Asistencia Técnica Integrada
              </span>

              <button
                type="button"
                onClick={handleToggleDbAccess}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 border border-transparent hover:border-zinc-200 transition-colors cursor-pointer"
              >
                <Database className="w-3 h-3" />
                <span>Base de Datos</span>
                <Lock className="w-2.5 h-2.5 opacity-70" />
              </button>

              {showDbAuthBox && (
                <form onSubmit={handleDbAuthSubmit} className="mt-2 p-3 bg-zinc-100 rounded-lg border border-zinc-300 space-y-2 text-left">
                  <div className="text-[11px] font-bold text-zinc-700 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-zinc-600" />
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
                        setDbError(null);
                        if (verifyAdminPassword(val)) {
                          setDbPassword("");
                          setShowDbAuthBox(false);
                          setIsDbModalOpen(true);
                        }
                      }}
                      placeholder="Ingrese clave de Admin..."
                      className="w-full text-xs bg-white border border-zinc-300 rounded px-2.5 py-1.5 pr-8 outline-none focus:border-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDbPassword(!showDbPassword)}
                      className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600"
                    >
                      {showDbPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  {dbError && (
                    <div className="text-[11px] text-rose-600 font-medium">
                      {dbError}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-zinc-900 hover:bg-black text-white text-[11px] font-bold rounded transition-colors cursor-pointer"
                  >
                    Abrir Visor MySQL
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

      </div>

      <DatabaseViewerModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
      />
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
