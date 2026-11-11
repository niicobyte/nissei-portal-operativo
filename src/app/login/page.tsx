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
} from "lucide-react";
import { SpeedTruck } from "@/components/common/SpeedTruck";
import { AnimatedReceptionBox } from "@/components/common/AnimatedReceptionBox";
import { AnimatedCpu } from "@/components/common/AnimatedCpu";
import {
  USER_PROFILES,
  UserProfile,
  authenticate,
  getActiveUser,
  verifyAdminPassword,
  logout,
} from "@/data/authData";
import DatabaseViewerModal from "@/components/common/DatabaseViewerModal";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

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

  // Limpieza rigurosa de sesiones expiradas al ingresar a la pantalla de Login
  useEffect(() => {
    logout();
  }, []);

  const reasonBanner = (() => {
    if (reason === "inactivity") {
      return {
        title: "Sesión cerrada por inactividad (15 min)",
        desc: "Por protocolo de seguridad de la sucursal, la sesión se bloqueó tras 15 minutos sin interacción. Ingrese su clave para continuar.",
      };
    }
    if (reason === "expired" || reason === "unauthenticated") {
      return {
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
      fetch("/api/db", { cache: "no-store" }).catch(() => {});
      setError(null);
      setSuccess(`Autenticado como ${authUser.nombre}. Redirigiendo a su panel...`);
      setTimeout(() => {
        router.push(authUser.defaultRoute);
      }, 300);
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

    const authUser = result.user || selectedProfile;
    // Calentar e inicializar conexión a MySQL inmediatamente en segundo plano
    fetch("/api/db", { cache: "no-store" }).catch(() => {});

    setSuccess(`Autenticado como ${authUser.nombre}. Redirigiendo a su panel...`);
    setTimeout(() => {
      router.push(authUser.defaultRoute);
    }, 500);
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
    <main className="min-h-screen bg-[#fbf9f9] py-8 sm:py-12 2xl:py-20 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-4xl 2xl:max-w-5xl w-full space-y-6 sm:space-y-8">
        
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

        {/* Banner de Sesión Expirada por Seguridad o Inactividad */}
        {reasonBanner && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3 text-xs shadow-xs animate-in fade-in duration-300">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-xs font-bold text-amber-900">{reasonBanner.title}</strong>
              <p className="text-[11px] text-amber-800 mt-0.5">{reasonBanner.desc}</p>
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

            {/* Los 3 Sectores Operativos */}
            <div className="space-y-3">
              
              {/* Opción 1: Recepción Post-Venta */}
              <button
                type="button"
                onClick={() => handleSelectSector("RECEPCION")}
                className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  activeSector === "RECEPCION"
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeSector === "RECEPCION" ? "bg-white/10 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                    <AnimatedReceptionBox
                      className="w-5 h-5"
                      beamColor={activeSector === "RECEPCION" ? "bg-emerald-300" : "bg-emerald-500"}
                      pingColor={activeSector === "RECEPCION" ? "bg-emerald-300" : "bg-emerald-500"}
                    />
                  </span>
                  <div>
                    <strong className="block text-sm font-bold">Recepción Post-Venta</strong>
                    <span className={`text-xs block ${activeSector === "RECEPCION" ? "text-zinc-300" : "text-zinc-500"}`}>
                      Retornos de taller, WhatsApp y entregas a clientes
                    </span>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 ${activeSector === "RECEPCION" ? "text-white" : "text-zinc-400"}`} />
              </button>

              {/* Opción 2: SATI ASU - CDE & Taller Central CDE */}
              <button
                type="button"
                onClick={() => handleSelectSector("DEPOSITO")}
                className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  activeSector === "DEPOSITO"
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeSector === "DEPOSITO" ? "bg-white/10 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                    <SpeedTruck
                      className="w-5 h-5"
                      smokeColor={activeSector === "DEPOSITO" ? "bg-amber-400" : "bg-amber-500/80"}
                    />
                  </span>
                  <div>
                    <strong className="block text-sm font-bold">SATI ASU - CDE</strong>
                    <span className={`text-xs block ${activeSector === "DEPOSITO" ? "text-zinc-300" : "text-zinc-500"}`}>
                      Monitoreo SATI Casa Matriz CDE &amp; Envíos por transportadora
                    </span>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 ${activeSector === "DEPOSITO" ? "text-white" : "text-zinc-400"}`} />
              </button>

              {/* Opción 3: Taller de Montajes de PC */}
              <button
                type="button"
                onClick={() => handleSelectSector("MONTAJES")}
                className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  activeSector === "MONTAJES"
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-900 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeSector === "MONTAJES" ? "bg-white/10 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                    <AnimatedCpu
                      className="w-5 h-5"
                      coreColor={activeSector === "MONTAJES" ? "bg-cyan-300" : "bg-cyan-500"}
                      auraColor={activeSector === "MONTAJES" ? "bg-cyan-400/25" : "bg-cyan-500/15"}
                    />
                  </span>
                  <div>
                    <strong className="block text-sm font-bold">Taller de Montajes de PC</strong>
                    <span className={`text-xs block ${activeSector === "MONTAJES" ? "text-zinc-300" : "text-zinc-500"}`}>
                      Ensamble de computadoras, pruebas y control de calidad
                    </span>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 ${activeSector === "MONTAJES" ? "text-white" : "text-zinc-400"}`} />
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
