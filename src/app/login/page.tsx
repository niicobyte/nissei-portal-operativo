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
    <main className="min-h-dvh bg-[#FAF6EE] py-6 sm:py-10 2xl:py-16 px-3 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-5xl 2xl:max-w-6xl 3xl:max-w-7xl w-full space-y-6 sm:space-y-8">
        
        {/* Cabecera NISSEI Retro */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#FFD23F] border-2 border-black rounded-full text-xs sm:text-sm font-heading font-extrabold text-black shadow-[2px_2px_0px_#000]">
            <Terminal className="w-4 h-4 text-black" />
            <span>NISSEI S.A. · CONTROL DE ACCESO OPERATIVO</span>
          </div>
          <h1 className="text-3xl sm:text-4xl 2xl:text-5xl font-heading font-extrabold text-black tracking-tight">
            Identificación de Operador y Sector
          </h1>
          <p className="text-sm sm:text-base text-neutral-800 font-medium max-w-2xl mx-auto">
            Seleccione el sector operativo correspondiente: Taller de Montajes de PC o Recepción Post-Venta.
          </p>
        </div>

        {/* Banner de Actualización / Sesión Expirada por Seguridad o Inactividad */}
        {reasonBanner && (
          <div
            className={`p-4 sm:p-5 rounded-xl border-2 border-black flex items-start gap-3.5 text-xs sm:text-sm shadow-[4px_4px_0px_#000] animate-in fade-in duration-300 ${
              reasonBanner.tone === "indigo"
                ? "bg-[#2A9D8F] text-white"
                : "bg-[#FFD23F] text-black"
            }`}
          >
            <span className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
              {reasonBanner.tone === "indigo" ? (
                <RefreshCw className="w-4 h-4 text-black" />
              ) : (
                <Clock className="w-4 h-4 text-black" />
              )}
            </span>
            <div>
              <strong className="block text-sm font-heading font-extrabold">
                {reasonBanner.title}
              </strong>
              <p className="text-xs sm:text-sm mt-0.5 font-medium opacity-90">
                {reasonBanner.desc}
              </p>
            </div>
          </div>
        )}

        {/* Tarjeta de Autenticación Principal - Ventana Retro Neo-Brutalista */}
        <div className="bg-[#FFFDF9] rounded-xl border-3 border-black shadow-[6px_6px_0px_#000] overflow-hidden">
          
          {/* Barra Superior Estilo Ventana Retro */}
          <div className="bg-[#FFD23F] border-b-3 border-black px-4 py-2.5 flex items-center gap-2 select-none">
            <span className="w-3.5 h-3.5 rounded-full bg-[#E76F51] border-2 border-black inline-block"></span>
            <span className="w-3.5 h-3.5 rounded-full bg-[#FFFDF9] border-2 border-black inline-block"></span>
            <span className="w-3.5 h-3.5 rounded-full bg-[#2A9D8F] border-2 border-black inline-block"></span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Columna Izquierda: Los 3 Sectores Principales (7 cols) */}
            <div className="lg:col-span-7 p-6 sm:p-8 space-y-4 border-b lg:border-b-0 lg:border-r-3 border-black bg-[#FAF6EE]">
              <div>
                <h2 className="text-xs font-mono font-bold text-black uppercase tracking-wider bg-[#FFD23F] inline-block px-2 py-0.5 border border-black rounded shadow-[1px_1px_0px_#000]">
                  1. Seleccione sector operativo
                </h2>
              </div>

            {/* Los 3 Sectores Operativos con Telemetría en Vivo */}
            <div className="space-y-3">
              
              {/* Opción 1: Recepción Post-Venta */}
              <button
                type="button"
                onClick={() => handleSelectSector("RECEPCION")}
                className={`w-full p-4 sm:p-5 rounded-xl border-2 border-black text-left transition-all cursor-pointer ${
                  activeSector === "RECEPCION"
                    ? "bg-black text-[#FFD23F] shadow-[4px_4px_0px_#000]"
                    : "bg-[#FFFDF9] text-black shadow-[3px_3px_0px_#000] hover:bg-[#FAF6EE] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border-2 border-black ${activeSector === "RECEPCION" ? "bg-[#FFD23F] text-black shadow-[2px_2px_0px_#000]" : "bg-white text-black shadow-[1px_1px_0px_#000]"}`}>
                      <AnimatedReceptionBox
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        beamColor={activeSector === "RECEPCION" ? "bg-black" : "bg-emerald-500"}
                        pingColor={activeSector === "RECEPCION" ? "bg-black" : "bg-emerald-500"}
                      />
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-base sm:text-lg font-heading font-extrabold truncate">Recepción Post-Venta</strong>
                      <span className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 font-bold ${activeSector === "RECEPCION" ? "text-[#FFD23F]" : "text-[#2A9D8F]"}`}>
                        <span className="w-2 h-2 rounded-full bg-[#2A9D8F] animate-pulse shrink-0"></span>
                        Telemetría en Vivo
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 shrink-0 transition-transform ${activeSector === "RECEPCION" ? "text-[#FFD23F] translate-x-1" : "text-black"}`} />
                </div>

                {/* Telemetría 3 métricas */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <div className={`p-2.5 sm:p-3 rounded-lg border-2 border-black flex flex-col justify-between ${
                    activeSector === "RECEPCION"
                      ? "bg-neutral-900 border-neutral-700 text-[#FFD23F]"
                      : "bg-[#FAF6EE] text-black shadow-[1px_1px_0px_#000]"
                  }`}>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between gap-1">
                      <span className="truncate">Ingresos Hoy</span>
                      <PackageOpen className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.recepcion.ingresosHoy}
                    </span>
                    <span className="text-[10px] font-mono mt-0.5 truncate opacity-80">
                      {telemetry.recepcion.ingresosSub}
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border-2 border-black flex flex-col justify-between ${
                    activeSector === "RECEPCION"
                      ? "bg-neutral-900 border-neutral-700 text-[#FFD23F]"
                      : "bg-[#FAF6EE] text-black shadow-[1px_1px_0px_#000]"
                  }`}>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between gap-1">
                      <span className="truncate">Notificadas</span>
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.recepcion.notificaciones}
                    </span>
                    <span className="text-[10px] font-mono mt-0.5 truncate opacity-80">
                      {telemetry.recepcion.notificacionesSub}
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border-2 border-black flex flex-col justify-between ${
                    activeSector === "RECEPCION"
                      ? "bg-neutral-900 border-neutral-700 text-[#FFD23F]"
                      : "bg-[#FAF6EE] text-black shadow-[1px_1px_0px_#000]"
                  }`}>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between gap-1">
                      <span className="truncate">Listos Retiro</span>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.recepcion.listosEntrega}
                    </span>
                    <span className="text-[10px] font-mono mt-0.5 truncate opacity-80">
                      Balcón CDE
                    </span>
                  </div>
                </div>
              </button>

              {/* Opción 2: SATI ASU - CDE & Taller Central CDE */}
              <button
                type="button"
                onClick={() => handleSelectSector("DEPOSITO")}
                className={`w-full p-4 sm:p-5 rounded-xl border-2 border-black text-left transition-all cursor-pointer ${
                  activeSector === "DEPOSITO"
                    ? "bg-black text-[#FFD23F] shadow-[4px_4px_0px_#000]"
                    : "bg-[#FFFDF9] text-black shadow-[3px_3px_0px_#000] hover:bg-[#FAF6EE] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border-2 border-black ${activeSector === "DEPOSITO" ? "bg-[#FFD23F] text-black shadow-[2px_2px_0px_#000]" : "bg-white text-black shadow-[1px_1px_0px_#000]"}`}>
                      <SpeedTruck
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        smokeColor={activeSector === "DEPOSITO" ? "bg-black" : "bg-amber-500/80"}
                      />
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-base sm:text-lg font-heading font-extrabold truncate">SATI ASU - CDE</strong>
                      <span className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 font-bold ${activeSector === "DEPOSITO" ? "text-[#FFD23F]" : "text-[#E76F51]"}`}>
                        <span className="w-2 h-2 rounded-full bg-[#E76F51] animate-pulse shrink-0"></span>
                        Monitoreo Logístico
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 shrink-0 transition-transform ${activeSector === "DEPOSITO" ? "text-[#FFD23F] translate-x-1" : "text-black"}`} />
                </div>

                {/* Telemetría 3 métricas */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <div className={`p-2.5 sm:p-3 rounded-lg border-2 border-black flex flex-col justify-between ${
                    activeSector === "DEPOSITO"
                      ? "bg-neutral-900 border-neutral-700 text-[#FFD23F]"
                      : "bg-[#FAF6EE] text-black shadow-[1px_1px_0px_#000]"
                  }`}>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between gap-1">
                      <span className="truncate">En Camino</span>
                      <Truck className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.deposito.enCamino}
                    </span>
                    <span className="text-[10px] font-mono mt-0.5 truncate opacity-80">
                      Transportadora
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border-2 border-black flex flex-col justify-between ${
                    activeSector === "DEPOSITO"
                      ? "bg-neutral-900 border-neutral-700 text-[#FFD23F]"
                      : "bg-[#FAF6EE] text-black shadow-[1px_1px_0px_#000]"
                  }`}>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between gap-1">
                      <span className="truncate">En CDE</span>
                      <Building2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.deposito.enCde}
                    </span>
                    <span className="text-[10px] font-mono mt-0.5 truncate opacity-80">
                      Taller Matriz
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border-2 border-black flex flex-col justify-between ${
                    activeSector === "DEPOSITO"
                      ? "bg-neutral-900 border-neutral-700 text-[#FFD23F]"
                      : "bg-[#FAF6EE] text-black shadow-[1px_1px_0px_#000]"
                  }`}>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between gap-1">
                      <span className="truncate">Recibidos ASU</span>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.deposito.recibidosAsu}
                    </span>
                    <span className="text-[10px] font-mono mt-0.5 truncate opacity-80">
                      Depósito Danesa
                    </span>
                  </div>
                </div>
              </button>

              {/* Opción 3: Taller de Montajes de PC */}
              <button
                type="button"
                onClick={() => handleSelectSector("MONTAJES")}
                className={`w-full p-4 sm:p-5 rounded-xl border-2 border-black text-left transition-all cursor-pointer ${
                  activeSector === "MONTAJES"
                    ? "bg-black text-[#FFD23F] shadow-[4px_4px_0px_#000]"
                    : "bg-[#FFFDF9] text-black shadow-[3px_3px_0px_#000] hover:bg-[#FAF6EE] hover:translate-x-[-1px] hover:translate-y-[-1px]"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border-2 border-black ${activeSector === "MONTAJES" ? "bg-[#FFD23F] text-black shadow-[2px_2px_0px_#000]" : "bg-white text-black shadow-[1px_1px_0px_#000]"}`}>
                      <AnimatedCpu
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        coreColor={activeSector === "MONTAJES" ? "bg-black" : "bg-cyan-500"}
                        auraColor={activeSector === "MONTAJES" ? "bg-black/25" : "bg-cyan-500/15"}
                      />
                    </span>
                    <div className="min-w-0">
                      <strong className="block text-base sm:text-lg font-heading font-extrabold truncate">Taller de Montajes de PC</strong>
                      <span className={`text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 font-bold ${activeSector === "MONTAJES" ? "text-[#FFD23F]" : "text-[#2A9D8F]"}`}>
                        <span className="w-2 h-2 rounded-full bg-[#2A9D8F] animate-pulse shrink-0"></span>
                        Ensambles &amp; Hardware
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 shrink-0 transition-transform ${activeSector === "MONTAJES" ? "text-[#FFD23F] translate-x-1" : "text-black"}`} />
                </div>

                {/* Telemetría 3 métricas */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <div className={`p-2.5 sm:p-3 rounded-lg border-2 border-black flex flex-col justify-between ${
                    activeSector === "MONTAJES"
                      ? "bg-neutral-900 border-neutral-700 text-[#FFD23F]"
                      : "bg-[#FAF6EE] text-black shadow-[1px_1px_0px_#000]"
                  }`}>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between gap-1">
                      <span className="truncate">En Cola</span>
                      <Layers className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.montajes.enCola}
                    </span>
                    <span className="text-[10px] font-mono mt-0.5 truncate opacity-80">
                      {telemetry.montajes.enColaSub}
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border-2 border-black flex flex-col justify-between ${
                    activeSector === "MONTAJES"
                      ? "bg-neutral-900 border-neutral-700 text-[#FFD23F]"
                      : "bg-[#FAF6EE] text-black shadow-[1px_1px_0px_#000]"
                  }`}>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between gap-1">
                      <span className="truncate">En Banco</span>
                      <Cpu className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.montajes.enBanco}
                    </span>
                    <span className="text-[10px] font-mono mt-0.5 truncate opacity-80">
                      Bench 01 - 04
                    </span>
                  </div>

                  <div className={`p-2.5 sm:p-3 rounded-lg border-2 border-black flex flex-col justify-between ${
                    activeSector === "MONTAJES"
                      ? "bg-neutral-900 border-neutral-700 text-[#FFD23F]"
                      : "bg-[#FAF6EE] text-black shadow-[1px_1px_0px_#000]"
                  }`}>
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider flex items-center justify-between gap-1">
                      <span className="truncate">Finalizados</span>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </span>
                    <span className="text-xl sm:text-2xl font-black font-mono mt-1">
                      {telemetry.montajes.finalizados}
                    </span>
                    <span className="text-[10px] font-mono mt-0.5 truncate opacity-80">
                      Entregados
                    </span>
                  </div>
                </div>
              </button>

            </div>
          </div>

          {/* Columna Derecha: Formulario de Contraseña del Perfil Seleccionado (5 cols) */}
          <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-[#FFFDF9]">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <h2 className="text-xs font-mono font-bold text-black uppercase tracking-wider bg-[#FFD23F] inline-block px-2 py-0.5 border border-black rounded shadow-[1px_1px_0px_#000]">
                  2. Credencial de acceso
                </h2>
                <p className="text-xs sm:text-sm text-neutral-800 font-medium mt-1.5">
                  Ingrese la clave de seguridad autorizada para <strong>{selectedProfile.nombre}</strong>.
                </p>
              </div>

              {/* Ficha Resumen del Perfil */}
              <div className="p-4 sm:p-5 bg-[#FAF6EE] rounded-xl border-2 border-black space-y-2.5 shadow-[3px_3px_0px_#000]">
                <div className="flex items-center gap-3.5">
                  <span className="w-12 h-12 rounded-xl bg-black text-[#FFD23F] font-mono text-base font-bold flex items-center justify-center shrink-0 border-2 border-black shadow-[2px_2px_0px_#000]">
                    {selectedProfile.avatar}
                  </span>
                  <div>
                    <h3 className="text-base font-heading font-extrabold text-black">
                      {selectedProfile.nombre}
                    </h3>
                    <span className="text-xs font-mono font-bold text-neutral-700 block">
                      {selectedProfile.badge}
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-neutral-800 leading-relaxed pt-2.5 border-t-2 border-dashed border-black font-medium">
                  {selectedProfile.descripcion}
                </p>
              </div>

              {/* Campo de Contraseña */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm text-black font-heading font-extrabold block">
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
                    className="w-full text-base bg-white border-2 border-black rounded-lg px-4 py-3 pr-12 focus:outline-none focus:bg-[#FAF6EE] transition-colors shadow-[2px_2px_0px_#000] font-mono text-black font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-black hover:text-neutral-700 transition-colors p-1 cursor-pointer"
                    title={showPassword ? "Ocultar" : "Mostrar"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5 text-black" /> : <Eye className="w-5 h-5 text-black" />}
                  </button>
                </div>
              </div>

              {/* Mensajes de Estado */}
              {error && (
                <div className="p-3.5 rounded-lg bg-[#E76F51] border-2 border-black text-white text-xs sm:text-sm flex items-center gap-3 shadow-[3px_3px_0px_#000] animate-in fade-in">
                  <span className="w-7 h-7 rounded-md bg-[#FFFDF9] border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                    <AlertCircle className="w-4 h-4 text-black stroke-[2.5]" />
                  </span>
                  <span className="font-heading font-extrabold text-white text-xs sm:text-sm leading-snug">
                    {error}
                  </span>
                </div>
              )}

              {success && (
                <div className="p-3.5 rounded-lg bg-[#2A9D8F] border-2 border-black text-white text-xs sm:text-sm flex items-center gap-3 shadow-[3px_3px_0px_#000] animate-in fade-in">
                  <span className="w-7 h-7 rounded-md bg-[#FFFDF9] border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                    <CheckCircle2 className="w-4 h-4 text-black stroke-[2.5]" />
                  </span>
                  <span className="font-heading font-extrabold text-white text-xs sm:text-sm leading-snug">
                    {success}
                  </span>
                </div>
              )}

              {/* Botón Ingresar */}
              <button
                type="submit"
                className="w-full py-3.5 bg-[#FFD23F] hover:bg-[#FACC15] text-black text-sm sm:text-base font-heading font-extrabold rounded-lg border-2 border-black shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Acceder a {selectedProfile.nombre}</span>
                <ArrowRight className="w-5 h-5 text-black" />
              </button>
            </form>

            {/* Pie de Página + Acceso a Base de Datos MySQL */}
            <div className="pt-6 border-t-2 border-black text-center space-y-2.5">
              <button
                type="button"
                onClick={handleToggleDbAccess}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-black bg-[#FAF6EE] hover:bg-[#FFD23F] border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-black" />
                <span>Base de Datos MySQL</span>
                <Lock className="w-3 h-3 text-black" />
              </button>

              {showDbAuthBox && (
                <form onSubmit={handleDbAuthSubmit} className="mt-2 p-3.5 bg-[#FAF6EE] rounded-xl border-2 border-black space-y-2 text-left shadow-[3px_3px_0px_#000]">
                  <div className="text-xs font-heading font-extrabold text-black flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-black" />
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
                      className="w-full text-sm bg-white border-2 border-black rounded-lg px-3 py-2 pr-10 focus:outline-none font-mono text-black"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDbPassword(!showDbPassword)}
                      className="absolute right-2.5 top-2.5 text-black hover:text-neutral-700"
                    >
                      {showDbPassword ? <EyeOff className="w-4 h-4 text-black" /> : <Eye className="w-4 h-4 text-black" />}
                    </button>
                  </div>
                  {dbError && (
                    <div className="text-xs text-[#E76F51] font-bold">{dbError}</div>
                  )}
                  <button
                    type="submit"
                    className="w-full py-2 bg-black text-[#FFD23F] hover:bg-neutral-800 text-xs font-heading font-extrabold rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
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
      </div>
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
