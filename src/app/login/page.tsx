"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Database
} from "lucide-react";
import {
  USER_PROFILES,
  UserProfile,
  authenticate,
  getActiveUser,
  verifyAdminPassword
} from "@/data/authData";
import DatabaseViewerModal from "@/components/common/DatabaseViewerModal";

export default function LoginPage() {
  const router = useRouter();

  // Sector principal seleccionado: "RECEPCION" | "MONTAJES" | "TALLER"
  const [activeSector, setActiveSector] = useState<"RECEPCION" | "MONTAJES" | "TALLER">("TALLER");
  // Sub-grupo dentro de Taller: "ADMIN" | "TECNICO"
  const [tallerSubGroup, setTallerSubGroup] = useState<"ADMIN" | "TECNICO">("ADMIN");

  // Perfil seleccionado para ingresar contraseña
  const [selectedProfile, setSelectedProfile] = useState<UserProfile>(
    USER_PROFILES.find((p) => p.id === "admin") || USER_PROFILES[0]
  );

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados para el acceso directo al Visor de Base de Datos MySQL debajo de "Sistema de Asistencia Técnica Integrada"
  const [showDbAuthBox, setShowDbAuthBox] = useState(false);
  const [dbPassword, setDbPassword] = useState("");
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);

  // Inicialización inteligente según sesión previa
  useEffect(() => {
    const active = getActiveUser();
    if (active) {
      setSelectedProfile(active);
      if (active.role === "RECEPCION") {
        setActiveSector("RECEPCION");
      } else if (active.role === "MONTAJES") {
        setActiveSector("MONTAJES");
      } else {
        setActiveSector("TALLER");
        setTallerSubGroup(active.role === "ADMIN" ? "ADMIN" : "TECNICO");
      }
    }
  }, []);

  const handleSelectSector = (sector: "RECEPCION" | "MONTAJES" | "TALLER") => {
    setActiveSector(sector);
    setPassword("");
    setError(null);

    if (sector === "RECEPCION") {
      const prof = USER_PROFILES.find((p) => p.id === "recepcion");
      if (prof) setSelectedProfile(prof);
    } else if (sector === "MONTAJES") {
      const prof = USER_PROFILES.find((p) => p.id === "montajes");
      if (prof) setSelectedProfile(prof);
    } else {
      // Taller: si estaba en admin, selecciona admin; si tecnico, Carlos
      if (tallerSubGroup === "ADMIN") {
        const prof = USER_PROFILES.find((p) => p.id === "admin");
        if (prof) setSelectedProfile(prof);
      } else {
        const prof = USER_PROFILES.find((p) => p.id === "carlos");
        if (prof) setSelectedProfile(prof);
      }
    }
  };

  const handleSelectTallerSubGroup = (sub: "ADMIN" | "TECNICO") => {
    setTallerSubGroup(sub);
    setPassword("");
    setError(null);
    if (sub === "ADMIN") {
      const prof = USER_PROFILES.find((p) => p.id === "admin");
      if (prof) setSelectedProfile(prof);
    } else {
      const prof = USER_PROFILES.find((p) => p.id === "carlos");
      if (prof) setSelectedProfile(prof);
    }
  };

  const handleSelectIndividualProfile = (prof: UserProfile) => {
    setSelectedProfile(prof);
    setPassword("");
    setError(null);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = authenticate(selectedProfile.id, password);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setSuccess(`Autenticado como ${selectedProfile.nombre}. Redirigiendo a su panel...`);
    setTimeout(() => {
      router.push(selectedProfile.defaultRoute);
    }, 700);
  };

  const handleToggleDbAccess = () => {
    setDbError(null);
    // Si ya escribió la contraseña de Admin en el campo principal, abre directo la ventana
    if (verifyAdminPassword(password)) {
      setIsDbModalOpen(true);
      return;
    }
    setShowDbAuthBox((prev) => !prev);
  };

  const handleOpenDatabaseViewer = (e: React.FormEvent) => {
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

  const recepcionProfile = USER_PROFILES.find((p) => p.id === "recepcion")!;
  const montajesProfile = USER_PROFILES.find((p) => p.id === "montajes")!;
  const adminProfiles = USER_PROFILES.filter((p) => p.role === "ADMIN");
  const tecnicoProfiles = USER_PROFILES.filter((p) => p.role === "TECNICO");

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
            Seleccione el sector operativo correspondiente. Para el laboratorio técnico, seleccione perfil de supervisión o banco de trabajo.
          </p>
        </div>

        {/* Tarjeta de Autenticación Principal */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Columna Izquierda: Los 3 Sectores Principales (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-8 space-y-4 border-b lg:border-b-0 lg:border-r border-zinc-200">
            <div>
              <h2 className="text-xs font-semibold text-zinc-500">
                1. Seleccione sector operativo
              </h2>
            </div>

            {/* Los 3 Sectores Principales */}
            <div className="space-y-2.5">
              
              {/* Opción 1: Taller de Reparaciones SATI (DESPLEGABLE INTERACTIVO) */}
              <div
                className={`rounded-xl border transition-colors overflow-hidden ${
                  activeSector === "TALLER"
                    ? "border-zinc-900 bg-zinc-50/50"
                    : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300"
                }`}
              >
                {/* Cabecera del Acordeón Taller */}
                <button
                  type="button"
                  onClick={() => handleSelectSector("TALLER")}
                  className="w-full p-3.5 text-left flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-800">
                      <Wrench className="w-4 h-4" />
                    </span>
                    <div>
                      <strong className="text-sm font-bold text-zinc-900 block">
                        Taller de Reparaciones SATI
                      </strong>
                      <span className="text-xs text-zinc-500 block">
                        Supervisión y asignación de bancos técnicos
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      activeSector === "TALLER" ? "rotate-180 text-zinc-900" : "text-zinc-400"
                    }`}
                  />
                </button>

                {/* Contenido Desplegado de Taller */}
                {activeSector === "TALLER" && (
                  <div className="p-3.5 pt-0 border-t border-zinc-200 space-y-3">
                    
                    {/* Selector de Sub-Área: Admin vs Técnicos */}
                    <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                      <button
                        type="button"
                        onClick={() => handleSelectTallerSubGroup("ADMIN")}
                        className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                          tallerSubGroup === "ADMIN"
                            ? "bg-zinc-900 text-white shadow-sm"
                            : "text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Supervisión Admin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectTallerSubGroup("TECNICO")}
                        className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                          tallerSubGroup === "TECNICO"
                            ? "bg-zinc-900 text-white shadow-sm"
                            : "text-zinc-600 hover:bg-zinc-200"
                        }`}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Técnicos</span>
                      </button>
                    </div>

                    {/* Despliegue de Admin */}
                    {tallerSubGroup === "ADMIN" && (
                      <div className="space-y-1.5">
                        <span className="text-xs text-zinc-500 block font-medium">
                          Perfil de administración
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                          {adminProfiles.map((adm) => {
                            const isSelected = selectedProfile.id === adm.id;
                            return (
                              <button
                                type="button"
                                key={adm.id}
                                onClick={() => handleSelectIndividualProfile(adm)}
                                className={`p-3 rounded-lg border text-left transition-colors flex items-center gap-3 ${
                                  isSelected
                                    ? "border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm"
                                    : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
                                }`}
                              >
                                <span className={`w-7 h-7 rounded font-mono text-xs font-bold flex items-center justify-center ${isSelected ? "bg-white text-zinc-900" : "bg-zinc-100 text-zinc-800"}`}>
                                  {adm.avatar}
                                </span>
                                <div className="overflow-hidden">
                                  <strong className="block text-xs font-bold truncate">{adm.nombre}</strong>
                                  <span className={`text-[11px] block truncate ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
                                    {adm.badge}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Despliegue de los 4 Técnicos */}
                    {tallerSubGroup === "TECNICO" && (
                      <div className="space-y-1.5">
                        <span className="text-xs text-zinc-500 block font-medium">
                          Seleccione técnico
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {tecnicoProfiles.map((tech) => {
                            const isSelected = selectedProfile.id === tech.id;
                            return (
                              <button
                                type="button"
                                key={tech.id}
                                onClick={() => handleSelectIndividualProfile(tech)}
                                className={`p-2.5 rounded-lg border text-left transition-colors flex items-center gap-2.5 ${
                                  isSelected
                                    ? "border-zinc-900 bg-zinc-900 text-white font-bold shadow-sm"
                                    : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"
                                }`}
                              >
                                <span className={`w-6 h-6 rounded font-mono text-xs font-bold flex items-center justify-center ${isSelected ? "bg-white text-zinc-900" : "bg-zinc-100 text-zinc-800"}`}>
                                  {tech.avatar}
                                </span>
                                <div className="overflow-hidden">
                                  <strong className="block text-xs truncate">{tech.nombre}</strong>
                                  <span className={`text-[11px] block truncate ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>
                                    {tech.badge}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* Opción 2: Taller de Montajes de PC */}
              <button
                type="button"
                onClick={() => handleSelectSector("MONTAJES")}
                className={`w-full p-3.5 rounded-xl border text-left transition-colors flex items-center justify-between ${
                  activeSector === "MONTAJES"
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-900 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${activeSector === "MONTAJES" ? "bg-white/10 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                    <Cpu className="w-4 h-4" />
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

              {/* Opción 3: Recepción Post-Venta */}
              <button
                type="button"
                onClick={() => handleSelectSector("RECEPCION")}
                className={`w-full p-3.5 rounded-xl border text-left transition-colors flex items-center justify-between ${
                  activeSector === "RECEPCION"
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-zinc-50/50 text-zinc-900 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${activeSector === "RECEPCION" ? "bg-white/10 text-white" : "bg-white border border-zinc-200 text-zinc-800"}`}>
                    <PackageOpen className="w-4 h-4" />
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
                    onChange={(e) => setPassword(e.target.value)}
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
                className="w-full py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>Acceder a {selectedProfile.nombre}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Pie de Página + Acceso a Base de Datos MySQL debajo de "Sistema de Asistencia Técnica Integrada" */}
            <div className="pt-6 border-t border-zinc-200 text-center space-y-2.5">
              <span className="text-[11px] text-zinc-400 block font-mono">
                Sistema de Asistencia Técnica Integrada
              </span>

              <button
                type="button"
                onClick={handleToggleDbAccess}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-mono text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 border border-transparent hover:border-zinc-200 transition-colors"
              >
                <Database className="w-3 h-3" />
                <span>Base de Datos</span>
                <Lock className="w-2.5 h-2.5 opacity-70" />
              </button>

              {showDbAuthBox && (
                <form
                  onSubmit={handleOpenDatabaseViewer}
                  className="p-3 rounded-xl bg-white border border-zinc-200 shadow-xs text-left space-y-2 mt-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-800 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-zinc-700" />
                      <span>Acceso a Tablas MySQL</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">Solo Admin</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type={showDbPassword ? "text" : "password"}
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                        placeholder="Contraseña de Admin..."
                        autoFocus
                        className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 pr-7 focus:border-zinc-900 focus:bg-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDbPassword(!showDbPassword)}
                        className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-700"
                      >
                        {showDbPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      Ver Datos
                    </button>
                  </div>

                  {dbError && (
                    <p className="text-[11px] text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>{dbError}</span>
                    </p>
                  )}
                </form>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Ventana Modal de Inspección de Base de Datos MySQL */}
      <DatabaseViewerModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
      />
    </main>
  );
}
