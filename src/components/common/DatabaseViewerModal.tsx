"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Database,
  X,
  Search,
  RefreshCw,
  Download,
  Table2,
  CheckCircle2,
  HardDrive,
  Code2,
  ChevronLeft,
  ChevronRight,
  Users,
  Wrench,
  PackageOpen,
  Cpu,
  Truck,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Lock,
  Clock,
  Eye,
  EyeOff,
  Key,
  ShieldAlert,
} from "lucide-react";
import { SpeedTruck } from "@/components/common/SpeedTruck";
import { AnimatedReceptionBox } from "@/components/common/AnimatedReceptionBox";
import { AnimatedCpu } from "@/components/common/AnimatedCpu";
import { getSafeUserProfiles, getAdminAuthHeaders, verifyAdminPassword, UserProfile } from "@/data/authData";
import { getStoredTickets, saveTickets, RecepcionTicket } from "@/data/recepcionData";
import { getStoredReparaciones, saveReparaciones, OrdenReparacion } from "@/data/tallerReparacionesData";
import { getStoredMontajes, saveMontajes, OrdenMontajeReal } from "@/data/montajesData";
import { getStoredCdeTickets, saveCdeTickets, RecepcionCdeTicket } from "@/data/recepcionCdeData";

interface DatabaseViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TableTab =
  | "taller_reparaciones"
  | "recepcion_tickets"
  | "recepcion_cde_tickets"
  | "ordenes_montaje"
  | "usuarios"
  | "sql_schema";

const SQL_SCHEMA_TEXT = `-- Base de Datos: nissei_portal / railway (MySQL 8.0 / InnoDB / utf8mb4)
CREATE DATABASE IF NOT EXISTS \`nissei_portal\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`nissei_portal\`;

-- 1. Tabla de Usuarios y Perfiles Operativos
CREATE TABLE IF NOT EXISTS usuarios (
  id VARCHAR(50) PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  role VARCHAR(50) NOT NULL,
  password VARCHAR(120) NOT NULL,
  default_route VARCHAR(100) NOT NULL,
  avatar VARCHAR(10) NOT NULL,
  badge VARCHAR(100) NOT NULL,
  descripcion TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Recepción Post-Venta (Tickets SATI)
CREATE TABLE IF NOT EXISTS recepcion_tickets (
  id_orden VARCHAR(50) PRIMARY KEY,
  codigo_producto VARCHAR(80) DEFAULT '',
  cliente VARCHAR(200) NOT NULL,
  mensaje TEXT,
  fecha_ingreso VARCHAR(50) NOT NULL,
  fecha_entregada VARCHAR(50) DEFAULT NULL,
  fecha_venta VARCHAR(50) DEFAULT NULL,
  estado VARCHAR(80) NOT NULL,
  tipo_componente VARCHAR(100) NOT NULL,
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(200) NOT NULL,
  serial VARCHAR(150) NOT NULL,
  origen VARCHAR(40) DEFAULT 'CSV',
  accesorios TEXT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_recepcion_estado (estado),
  INDEX idx_recepcion_cliente (cliente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabla de Taller de Reparaciones SATI
CREATE TABLE IF NOT EXISTS taller_reparaciones (
  id_orden VARCHAR(50) PRIMARY KEY,
  codigo_producto VARCHAR(80) DEFAULT '',
  cliente VARCHAR(200) NOT NULL,
  equipo VARCHAR(255) NOT NULL,
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(200) NOT NULL,
  tipo_componente VARCHAR(100) NOT NULL,
  serial VARCHAR(150) NOT NULL,
  falla_reportada TEXT,
  detalle_reparacion TEXT,
  observaciones TEXT,
  mensaje_sati TEXT,
  fecha_ingreso VARCHAR(50) NOT NULL,
  fecha_asignacion VARCHAR(50) DEFAULT NULL,
  fecha_finalizacion VARCHAR(50) DEFAULT NULL,
  estado ENUM('SIN_ASIGNAR', 'EN_REPARACION', 'FINALIZADA') NOT NULL DEFAULT 'SIN_ASIGNAR',
  tecnico_asignado VARCHAR(100) DEFAULT NULL,
  asignado_por VARCHAR(100) DEFAULT NULL,
  dictamen_final ENUM('REPARADO', 'SIN_DEFECTO', 'NO_REPARADO') DEFAULT NULL,
  repuestos_utilizados TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_taller_estado (estado),
  INDEX idx_taller_tecnico (tecnico_asignado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla de Órdenes de Montaje de PC
CREATE TABLE IF NOT EXISTS ordenes_montaje (
  id VARCHAR(60) PRIMARY KEY,
  nro_reg VARCHAR(60) NOT NULL,
  cliente VARCHAR(200) NOT NULL,
  fecha_facturacion VARCHAR(50) NOT NULL,
  fecha_montaje VARCHAR(50) NOT NULL,
  vendedor VARCHAR(150) NOT NULL,
  canal VARCHAR(100) NOT NULL,
  estado VARCHAR(60) NOT NULL,
  tipo_servicio VARCHAR(60) NOT NULL,
  cantidad_equipos INT NOT NULL DEFAULT 1,
  tecnico VARCHAR(120) NOT NULL DEFAULT 'Sin Asignar',
  etapa VARCHAR(60) NOT NULL DEFAULT 'PENDIENTE_PIEZAS',
  progreso INT NOT NULL DEFAULT 15,
  prioridad VARCHAR(40) NOT NULL DEFAULT 'NORMAL',
  consumo_estimado VARCHAR(50) DEFAULT '450W',
  observaciones TEXT,
  componentes_json LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_montaje_estado (estado),
  INDEX idx_montaje_tecnico (tecnico)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla de Rendimiento Casa Matriz CDE & Retornos Depósito Danesa
CREATE TABLE IF NOT EXISTS recepcion_cde_tickets (
  id_orden VARCHAR(50) PRIMARY KEY,
  codigo_producto VARCHAR(80) DEFAULT '',
  cliente VARCHAR(200) NOT NULL,
  mensaje TEXT,
  fecha_ingreso VARCHAR(50) NOT NULL,
  fecha_entregada VARCHAR(50) DEFAULT NULL,
  fecha_venta VARCHAR(50) DEFAULT NULL,
  estado VARCHAR(80) NOT NULL,
  tipo_componente VARCHAR(100) NOT NULL,
  modelo VARCHAR(200) NOT NULL,
  marca VARCHAR(100) NOT NULL,
  serial VARCHAR(150) NOT NULL,
  dias_resolucion INT DEFAULT NULL,
  es_danesa TINYINT(1) DEFAULT 0,
  recibido_en_deposito TINYINT(1) DEFAULT 0,
  fecha_recibido_deposito VARCHAR(50) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cde_estado (estado),
  INDEX idx_cde_cliente (cliente),
  INDEX idx_cde_deposito (recibido_en_deposito)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

export default function DatabaseViewerModal({ isOpen, onClose }: DatabaseViewerModalProps) {
  const [activeTab, setActiveTab] = useState<TableTab>("taller_reparaciones");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const [isLoading, setIsLoading] = useState(false);
  const [mysqlConnected, setMysqlConnected] = useState<boolean>(false);
  const [serverInfo, setServerInfo] = useState<{
    host: string;
    port: number;
    database: string;
    user?: string;
    isRailway?: boolean;
    source?: string;
  } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [copiedSql, setCopiedSql] = useState(false);

  const [reparaciones, setReparaciones] = useState<OrdenReparacion[]>([]);
  const [recepcion, setRecepcion] = useState<RecepcionTicket[]>([]);
  const [cde, setCde] = useState<RecepcionCdeTicket[]>([]);
  const [montajes, setMontajes] = useState<OrdenMontajeReal[]>([]);
  const [usuarios, setUsuarios] = useState<UserProfile[]>(getSafeUserProfiles());

  const [confirmDelete, setConfirmDelete] = useState<{
    table: TableTab;
    id: string;
    label: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Temporizador estricto de seguridad de 30 segundos para MySQL
  const MYSQL_SESSION_TIMEOUT = 30;
  const [secondsRemaining, setSecondsRemaining] = useState<number>(MYSQL_SESSION_TIMEOUT);
  const [isSessionLocked, setIsSessionLocked] = useState<boolean>(false);
  const [reauthPassword, setReauthPassword] = useState<string>("");
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [showReauthPass, setShowReauthPass] = useState<boolean>(false);
  const reauthInputRef = React.useRef<HTMLInputElement | null>(null);

  // Iniciar o reiniciar cuenta regresiva cuando el modal está abierto y no bloqueado
  useEffect(() => {
    if (!isOpen) {
      setSecondsRemaining(MYSQL_SESSION_TIMEOUT);
      setIsSessionLocked(false);
      setReauthPassword("");
      setReauthError(null);
      return;
    }

    if (isSessionLocked) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsSessionLocked(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isSessionLocked]);

  // Enfocar automáticamente el input al bloquearse la sesión
  useEffect(() => {
    if (isSessionLocked) {
      setTimeout(() => {
        reauthInputRef.current?.focus();
      }, 100);
    }
  }, [isSessionLocked]);

  // Validación en tiempo real al escribir contraseña (sin necesidad de dar a enter)
  const handleReauthPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const entered = e.target.value;
    setReauthPassword(entered);
    setReauthError(null);

    if (verifyAdminPassword(entered)) {
      setReauthPassword("");
      setReauthError(null);
      setSecondsRemaining(MYSQL_SESSION_TIMEOUT);
      setIsSessionLocked(false);
      setToastMessage("✅ Acceso a MySQL renovado por 30 segundos.");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleReauthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminPassword(reauthPassword)) {
      setReauthPassword("");
      setReauthError(null);
      setSecondsRemaining(MYSQL_SESSION_TIMEOUT);
      setIsSessionLocked(false);
      setToastMessage("✅ Acceso a MySQL renovado por 30 segundos.");
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      setReauthError("Contraseña incorrecta. Acceso denegado a MySQL.");
    }
  };

  const executeDelete = async (table: TableTab, id: string) => {
    setIsDeleting(true);
    try {
      // 1. Intentar eliminar en MySQL (en servidor o local)
      try {
        await fetch("/api/db", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAdminAuthHeaders(),
          },
          body: JSON.stringify({ action: "DELETE_ROW", table, id }),
        });
      } catch (networkErr) {
        console.warn("[DB VIEWER] Error de conexión con MySQL en la nube:", networkErr);
      }

      // 2. Actualizar el estado local y localStorage inmediatamente
      if (table === "recepcion_tickets") {
        setRecepcion((prev) => {
          const next = prev.filter((t) => t.idOrden !== id);
          saveTickets(next);
          return next;
        });
        setReparaciones((prev) => {
          const next = prev.filter((r) => r.idOrden !== id);
          saveReparaciones(next);
          return next;
        });
      } else if (table === "taller_reparaciones") {
        setReparaciones((prev) => {
          const next = prev.filter((r) => r.idOrden !== id);
          saveReparaciones(next);
          return next;
        });
      } else if (table === "recepcion_cde_tickets") {
        setCde((prev) => {
          const next = prev.filter((c) => c.idOrden !== id);
          saveCdeTickets(next);
          return next;
        });
      } else if (table === "ordenes_montaje") {
        setMontajes((prev) => {
          const next = prev.filter((m) => m.id !== id);
          saveMontajes(next);
          return next;
        });
      } else if (table === "usuarios") {
        setUsuarios((prev) => prev.filter((u) => u.id !== id));
      }

      setConfirmDelete(null);
      setToastMessage(`Registro #${id} eliminado con éxito de la base de datos.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: unknown) {
      console.error("[DB DELETE ERROR]", err);
      setConfirmDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const loadAllData = async () => {
    setIsLoading(true);
    // Primero cargamos de inmediato los datos actuales sincronizados en el navegador
    const localRep = getStoredReparaciones();
    const localRec = getStoredTickets();
    const localCde = getStoredCdeTickets();
    const localMnt = getStoredMontajes();
    setReparaciones(localRep);
    setRecepcion(localRec);
    setCde(localCde);
    setMontajes(localMnt);
    setUsuarios(getSafeUserProfiles());

    // Luego consultamos directamente a MySQL (/api/db)
    try {
      const res = await fetch("/api/db", {
        cache: "no-store",
        headers: getAdminAuthHeaders(),
      });
      const json = await res.json();
      if (json.serverInfo) {
        setServerInfo(json.serverInfo);
      }
      if (json.ok) {
        setMysqlConnected(true);
        if (Array.isArray(json.reparaciones) && json.reparaciones.length > 0) {
          setReparaciones(json.reparaciones);
        }
        if (Array.isArray(json.recepcion) && json.recepcion.length > 0) {
          setRecepcion(json.recepcion);
        }
        if (Array.isArray(json.cde) && json.cde.length > 0) {
          setCde(json.cde);
        }
        if (Array.isArray(json.montajes) && json.montajes.length > 0) {
          setMontajes(json.montajes);
        }
        if (Array.isArray(json.usuarios) && json.usuarios.length > 0) {
          setUsuarios(json.usuarios);
        }
      } else {
        setMysqlConnected(false);
      }
    } catch {
      setMysqlConnected(false);
    } finally {
      setLastSyncTime(
        new Date().toLocaleTimeString("es-PY", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen]);

  useEffect(() => {
    setPage(1);
    setStatusFilter("ALL");
  }, [activeTab, searchTerm]);

  // Filtrado de taller_reparaciones
  const filteredReparaciones = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return reparaciones.filter((r) => {
      if (statusFilter !== "ALL" && r.estado !== statusFilter) return false;
      if (!q) return true;
      return (
        r.idOrden.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.equipo.toLowerCase().includes(q) ||
        r.serial.toLowerCase().includes(q) ||
        (r.tecnicoAsignado || "").toLowerCase().includes(q) ||
        (r.fallaReportada || "").toLowerCase().includes(q) ||
        (r.detalleReparacion || "").toLowerCase().includes(q) ||
        (r.observaciones || "").toLowerCase().includes(q)
      );
    });
  }, [reparaciones, searchTerm, statusFilter]);

  // Filtrado de recepcion_tickets
  const filteredRecepcion = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return recepcion.filter((t) => {
      if (statusFilter !== "ALL" && t.estado !== statusFilter) return false;
      if (!q) return true;
      return (
        t.idOrden.toLowerCase().includes(q) ||
        t.cliente.toLowerCase().includes(q) ||
        t.marca.toLowerCase().includes(q) ||
        t.modelo.toLowerCase().includes(q) ||
        t.serial.toLowerCase().includes(q) ||
        (t.mensaje || "").toLowerCase().includes(q) ||
        t.tipoComponente.toLowerCase().includes(q)
      );
    });
  }, [recepcion, searchTerm, statusFilter]);

  // Filtrado de recepcion_cde_tickets
  const filteredCde = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return cde.filter((t) => {
      if (statusFilter !== "ALL" && t.estado !== statusFilter) return false;
      if (!q) return true;
      return (
        t.idOrden.toLowerCase().includes(q) ||
        t.cliente.toLowerCase().includes(q) ||
        t.marca.toLowerCase().includes(q) ||
        t.modelo.toLowerCase().includes(q) ||
        t.serial.toLowerCase().includes(q) ||
        (t.mensaje || "").toLowerCase().includes(q) ||
        t.tipoComponente.toLowerCase().includes(q)
      );
    });
  }, [cde, searchTerm, statusFilter]);

  // Filtrado de ordenes_montaje
  const filteredMontajes = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return montajes.filter((m) => {
      if (statusFilter !== "ALL" && m.etapa !== statusFilter) return false;
      if (!q) return true;
      return (
        m.id.toLowerCase().includes(q) ||
        m.nro_reg.toLowerCase().includes(q) ||
        m.cliente.toLowerCase().includes(q) ||
        m.tecnico.toLowerCase().includes(q) ||
        m.vendedor.toLowerCase().includes(q) ||
        (m.observaciones || "").toLowerCase().includes(q)
      );
    });
  }, [montajes, searchTerm, statusFilter]);

  // Filtrado de usuarios
  const filteredUsuarios = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return usuarios.filter((u) => {
      if (!q) return true;
      return (
        u.id.toLowerCase().includes(q) ||
        u.nombre.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.badge.toLowerCase().includes(q)
      );
    });
  }, [usuarios, searchTerm]);

  const handleExportJSON = () => {
    let dataToExport: unknown = [];
    if (activeTab === "taller_reparaciones") dataToExport = filteredReparaciones;
    else if (activeTab === "recepcion_tickets") dataToExport = filteredRecepcion;
    else if (activeTab === "recepcion_cde_tickets") dataToExport = filteredCde;
    else if (activeTab === "ordenes_montaje") dataToExport = filteredMontajes;
    else if (activeTab === "usuarios") {
      dataToExport = filteredUsuarios.map(({ passwordHash: _ph, ...safeUser }) => ({
        ...safeUser,
        password: "•••••••• (SHA-256)",
      }));
    }

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nissei_portal_${activeTab}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_TEXT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  if (!isOpen) return null;

  const currentListLength =
    activeTab === "taller_reparaciones"
      ? filteredReparaciones.length
      : activeTab === "recepcion_tickets"
      ? filteredRecepcion.length
      : activeTab === "recepcion_cde_tickets"
      ? filteredCde.length
      : activeTab === "ordenes_montaje"
      ? filteredMontajes.length
      : filteredUsuarios.length;

  const totalPages = Math.max(1, Math.ceil(currentListLength / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;

  const displayHost = serverInfo?.host || "localhost:3306";
  const displayDb = serverInfo?.database || "nissei_portal";
  const isCloudRailway = Boolean(serverInfo?.isRailway || displayHost.includes("railway"));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 lg:p-6">
      <div className={`bg-[#FFFDF9] w-full max-w-7xl 3xl:max-w-[1800px] h-[92dvh] rounded-xl border-3 border-black shadow-[8px_8px_0px_#000] flex flex-col overflow-hidden transition-all duration-300 ${isSessionLocked ? "blur-md pointer-events-none select-none opacity-25" : ""}`}>
        {/* Cabecera del Visor de Base de Datos Neo-Brutalista Retro */}
        <div className="bg-[#FAF6EE] text-black px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FFD23F] border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_#000]">
              <Database className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-heading font-extrabold text-black tracking-tight">
                  Visor de Base de Datos MySQL
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-[#FFFDF9] border-2 border-black rounded text-black shadow-[1px_1px_0px_#000]">
                  DB: {displayDb}
                </span>
                {mysqlConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#2A9D8F]/20 text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                    <CheckCircle2 className="w-3 h-3 text-black" />
                    {isCloudRailway ? "MySQL Cloud Activo (Railway)" : `MySQL Activo (${displayHost})`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FFD23F] text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                    <HardDrive className="w-3 h-3 text-black" />
                    MySQL en la Nube (Conectando...)
                  </span>
                )}
                {/* Temporizador de Seguridad de 30 Segundos */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border-2 border-black shadow-[1px_1px_0px_#000] transition-colors ${
                    secondsRemaining <= 10
                      ? "bg-[#E76F51] text-white animate-pulse"
                      : "bg-[#FFFDF9] text-black"
                  }`}
                  title="Sesión protegida en MySQL: Expira automáticamente a los 30 segundos y requiere re-autenticación"
                >
                  <Clock className={`w-3 h-3 ${secondsRemaining <= 10 ? "text-white" : "text-black"}`} />
                  <span>Sesión: {secondsRemaining}s</span>
                </span>
              </div>
              <p className="text-xs text-neutral-800 mt-0.5 font-mono font-medium">
                Host: {displayHost} · Motor: InnoDB utf8mb4 · Última lectura: {lastSyncTime || "--:--"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={loadAllData}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-[#FFFDF9] hover:bg-[#FFD23F] text-black text-xs font-heading font-extrabold border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Recargar</span>
            </button>
            {activeTab !== "sql_schema" && (
              <button
                type="button"
                onClick={handleExportJSON}
                className="px-3 py-1.5 rounded-lg bg-[#FFFDF9] hover:bg-[#FFD23F] text-black text-xs font-heading font-extrabold border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar JSON</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-[#FFFDF9] hover:bg-[#E76F51] hover:text-white text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
              title="Cerrar visor de base de datos"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pestañas de Tablas de la Base de Datos Neo-Brutalista Retro */}
        <div className="bg-[#FAF6EE] px-5 pt-3 border-b-2 border-black flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
            <button
              type="button"
              onClick={() => { setActiveTab("taller_reparaciones"); setPage(1); }}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-heading font-extrabold transition-all flex items-center gap-2 border-t-2 border-x-2 border-black cursor-pointer ${
                activeTab === "taller_reparaciones"
                  ? "bg-black text-[#FFD23F] shadow-[2px_0px_0px_#000]"
                  : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span className="font-mono">taller_reparaciones</span>
              <span className={`px-1.5 py-0.5 text-[10px] rounded font-mono font-extrabold ${activeTab === "taller_reparaciones" ? "bg-[#FFD23F] text-black border border-black" : "bg-black text-white"}`}>
                {reparaciones.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab("recepcion_tickets"); setPage(1); }}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-heading font-extrabold transition-all flex items-center gap-2 border-t-2 border-x-2 border-black cursor-pointer ${
                activeTab === "recepcion_tickets"
                  ? "bg-black text-[#FFD23F] shadow-[2px_0px_0px_#000]"
                  : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
              }`}
            >
              <AnimatedReceptionBox className="w-3.5 h-3.5" beamColor="bg-emerald-500" pingColor="bg-emerald-500" />
              <span className="font-mono">recepcion_tickets</span>
              <span className={`px-1.5 py-0.5 text-[10px] rounded font-mono font-extrabold ${activeTab === "recepcion_tickets" ? "bg-[#FFD23F] text-black border border-black" : "bg-black text-white"}`}>
                {recepcion.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab("recepcion_cde_tickets"); setPage(1); }}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-heading font-extrabold transition-all flex items-center gap-2 border-t-2 border-x-2 border-black cursor-pointer ${
                activeTab === "recepcion_cde_tickets"
                  ? "bg-black text-[#FFD23F] shadow-[2px_0px_0px_#000]"
                  : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
              }`}
            >
              <SpeedTruck className="w-3.5 h-3.5" smokeColor="bg-amber-400" />
              <span className="font-mono">recepcion_cde_tickets</span>
              <span className={`px-1.5 py-0.5 text-[10px] rounded font-mono font-extrabold ${activeTab === "recepcion_cde_tickets" ? "bg-[#FFD23F] text-black border border-black" : "bg-black text-white"}`}>
                {cde.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab("ordenes_montaje"); setPage(1); }}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-heading font-extrabold transition-all flex items-center gap-2 border-t-2 border-x-2 border-black cursor-pointer ${
                activeTab === "ordenes_montaje"
                  ? "bg-black text-[#FFD23F] shadow-[2px_0px_0px_#000]"
                  : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
              }`}
            >
              <AnimatedCpu className="w-3.5 h-3.5" coreColor="bg-cyan-500" />
              <span className="font-mono">ordenes_montaje</span>
              <span className={`px-1.5 py-0.5 text-[10px] rounded font-mono font-extrabold ${activeTab === "ordenes_montaje" ? "bg-[#FFD23F] text-black border border-black" : "bg-black text-white"}`}>
                {montajes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab("usuarios"); setPage(1); }}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-heading font-extrabold transition-all flex items-center gap-2 border-t-2 border-x-2 border-black cursor-pointer ${
                activeTab === "usuarios"
                  ? "bg-black text-[#FFD23F] shadow-[2px_0px_0px_#000]"
                  : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="font-mono">usuarios</span>
              <span className={`px-1.5 py-0.5 text-[10px] rounded font-mono font-extrabold ${activeTab === "usuarios" ? "bg-[#FFD23F] text-black border border-black" : "bg-black text-white"}`}>
                {usuarios.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab("sql_schema"); setPage(1); }}
              className={`px-3.5 py-2 rounded-t-lg text-xs font-heading font-extrabold transition-all flex items-center gap-2 border-t-2 border-x-2 border-black cursor-pointer ${
                activeTab === "sql_schema"
                  ? "bg-black text-[#FFD23F] shadow-[2px_0px_0px_#000]"
                  : "bg-[#FFFDF9] text-black hover:bg-[#FFD23F]"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Estructura SQL</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda Neo-Brutalista Retro */}
        {activeTab !== "sql_schema" && (
          <div className="px-5 py-3 bg-[#FAF6EE] border-b-2 border-black flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Buscar en tabla ${activeTab} (orden, cliente, serie, técnico, fallo...)`}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white text-black border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] focus:bg-[#FFFDF9] outline-none font-mono font-medium"
                />
              </div>

              {activeTab === "taller_reparaciones" && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs bg-white text-black border-2 border-black rounded-lg px-2.5 py-1.5 font-heading font-extrabold shadow-[2px_2px_0px_#000] outline-none cursor-pointer"
                >
                  <option value="ALL">Todos los estados</option>
                  <option value="SIN_ASIGNAR">SIN_ASIGNAR</option>
                  <option value="EN_REPARACION">EN_REPARACION</option>
                  <option value="FINALIZADA">FINALIZADA</option>
                </select>
              )}

              {activeTab === "ordenes_montaje" && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs bg-white text-black border-2 border-black rounded-lg px-2.5 py-1.5 font-heading font-extrabold shadow-[2px_2px_0px_#000] outline-none cursor-pointer"
                >
                  <option value="ALL">Todas las etapas</option>
                  <option value="PENDIENTE_PIEZAS">PENDIENTE_PIEZAS</option>
                  <option value="ARMADO_MECANICO">ARMADO_MECANICO</option>
                  <option value="ESTRES_TERMICO">ESTRES_TERMICO</option>
                  <option value="LISTO_ENTREGA">LISTO_ENTREGA</option>
                </select>
              )}
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-black font-mono">
              <span>
                Mostrando{" "}
                <strong>
                  {currentListLength === 0 ? 0 : startIndex + 1}-
                  {Math.min(startIndex + PAGE_SIZE, currentListLength)}
                </strong>{" "}
                de <strong>{currentListLength}</strong> filas
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-[#FFD23F] disabled:opacity-40 shadow-[1px_1px_0px_#000] cursor-pointer transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono text-xs font-bold">
                  Pág. {page}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-[#FFD23F] disabled:opacity-40 shadow-[1px_1px_0px_#000] cursor-pointer transition-all"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Contenido Principal de la Tabla Seleccionada Neo-Brutalista Retro */}
        <div className="flex-1 overflow-auto bg-[#FAF6EE]/50">
          {/* 1. TABLA: taller_reparaciones */}
          {activeTab === "taller_reparaciones" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FAF6EE] text-black font-mono text-[11px] font-black uppercase sticky top-0 z-10 border-b-2 border-black">
                <tr>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">id_orden</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">cliente</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">equipo</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">tipo_componente</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">serial</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">estado</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">tecnico_asignado</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">falla_reportada</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">detalle_reparacion</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">observaciones</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">dictamen_final</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">fecha_ingreso</th>
                  <th className="py-2.5 px-3 text-center text-black">acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10 bg-[#FFFDF9]">
                {filteredReparaciones
                  .slice(startIndex, startIndex + PAGE_SIZE)
                  .map((r) => (
                    <tr key={r.idOrden} className="hover:bg-[#FAF6EE] transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-black border-r-2 border-black/10 whitespace-nowrap">
                        #{r.idOrden}
                      </td>
                      <td className="py-2 px-3 font-heading font-bold text-black border-r-2 border-black/10">
                        {r.cliente}
                      </td>
                      <td className="py-2 px-3 text-neutral-800 font-medium border-r-2 border-black/10">
                        {r.equipo}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-700 border-r-2 border-black/10 whitespace-nowrap">
                        {r.tipoComponente}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-700 border-r-2 border-black/10 whitespace-nowrap">
                        {r.serial}
                      </td>
                      <td className="py-2 px-3 border-r-2 border-black/10 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold border-2 border-black shadow-[1px_1px_0px_#000] ${
                            r.estado === "FINALIZADA"
                              ? "bg-[#2A9D8F] text-white"
                              : r.estado === "EN_REPARACION"
                              ? "bg-[#FFD23F] text-black"
                              : "bg-[#FAF6EE] text-black"
                          }`}
                        >
                          {r.estado}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-black border-r-2 border-black/10 whitespace-nowrap">
                        {r.tecnicoAsignado || <span className="text-neutral-400 font-mono">NULL</span>}
                      </td>
                      <td className="py-2 px-3 text-neutral-800 border-r-2 border-black/10 max-w-xs truncate font-medium" title={r.fallaReportada}>
                        {r.fallaReportada || <span className="text-neutral-400 font-mono">-</span>}
                      </td>
                      <td className="py-2 px-3 text-[#2A9D8F] font-bold border-r-2 border-black/10 max-w-xs truncate" title={r.detalleReparacion}>
                        {r.detalleReparacion || <span className="text-neutral-400 font-mono">-</span>}
                      </td>
                      <td className="py-2 px-3 text-amber-800 font-medium border-r-2 border-black/10 max-w-xs truncate" title={r.observaciones}>
                        {r.observaciones || <span className="text-neutral-400 font-mono">-</span>}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] font-bold border-r-2 border-black/10 whitespace-nowrap">
                        {r.dictamenFinal || <span className="text-neutral-400">NULL</span>}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-600 border-r-2 border-black/10 whitespace-nowrap">
                        {r.fechaIngreso}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              table: "taller_reparaciones",
                              id: r.idOrden,
                              label: `Orden #${r.idOrden} · ${r.cliente}`,
                            })
                          }
                          className="p-1 rounded-lg border-2 border-black bg-white hover:bg-[#E76F51] hover:text-white text-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                          title={`Eliminar orden #${r.idOrden} de la base de datos`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* 2. TABLA: recepcion_tickets */}
          {activeTab === "recepcion_tickets" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FAF6EE] text-black font-mono text-[11px] font-black uppercase sticky top-0 z-10 border-b-2 border-black">
                <tr>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">id_orden</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">codigo_producto</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">cliente</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">tipo_componente</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">marca</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">modelo</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">serial</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">estado</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">mensaje</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">fecha_ingreso</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">fecha_entregada</th>
                  <th className="py-2.5 px-3 text-center text-black">acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10 bg-[#FFFDF9]">
                {filteredRecepcion
                  .slice(startIndex, startIndex + PAGE_SIZE)
                  .map((t) => (
                    <tr key={t.idOrden} className="hover:bg-[#FAF6EE] transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-black border-r-2 border-black/10 whitespace-nowrap">
                        #{t.idOrden}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-600 border-r-2 border-black/10 whitespace-nowrap">
                        {t.codigoProducto || "-"}
                      </td>
                      <td className="py-2 px-3 font-heading font-bold text-black border-r-2 border-black/10">
                        {t.cliente}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-700 border-r-2 border-black/10 whitespace-nowrap">
                        {t.tipoComponente}
                      </td>
                      <td className="py-2 px-3 text-neutral-800 font-medium border-r-2 border-black/10 whitespace-nowrap">
                        {t.marca}
                      </td>
                      <td className="py-2 px-3 text-neutral-800 font-medium border-r-2 border-black/10">
                        {t.modelo}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-700 border-r-2 border-black/10 whitespace-nowrap">
                        {t.serial}
                      </td>
                      <td className="py-2 px-3 border-r-2 border-black/10 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FAF6EE] text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                          {t.estado}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-neutral-700 border-r-2 border-black/10 max-w-xs truncate" title={t.mensaje}>
                        {t.mensaje || "-"}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-600 border-r-2 border-black/10 whitespace-nowrap">
                        {t.fechaIngreso}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-600 border-r-2 border-black/10 whitespace-nowrap">
                        {t.fechaEntregada || <span className="text-neutral-400">NULL</span>}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              table: "recepcion_tickets",
                              id: t.idOrden,
                              label: `Orden #${t.idOrden} · ${t.cliente}`,
                            })
                          }
                          className="p-1 rounded-lg border-2 border-black bg-white hover:bg-[#E76F51] hover:text-white text-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                          title={`Eliminar orden #${t.idOrden} de la base de datos`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* 2b. TABLA: recepcion_cde_tickets (Casa Matriz CDE & Retornos Depósito Danesa) */}
          {activeTab === "recepcion_cde_tickets" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FAF6EE] text-black font-mono text-[11px] font-black uppercase sticky top-0 z-10 border-b-2 border-black">
                <tr>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">id_orden</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">cliente</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">equipo / hardware</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">serial</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">ingreso_asu</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">despacho_cde</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">dias_taller</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">estado_cde</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">deposito</th>
                  <th className="py-2.5 px-3 text-center text-black">acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10 bg-[#FFFDF9]">
                {filteredCde
                  .slice(startIndex, startIndex + PAGE_SIZE)
                  .map((cItem) => (
                    <tr key={cItem.idOrden} className="hover:bg-[#FAF6EE] transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-black border-r-2 border-black/10 whitespace-nowrap">
                        #{cItem.idOrden}
                      </td>
                      <td className="py-2 px-3 font-heading font-bold text-black border-r-2 border-black/10 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {cItem.cliente}
                          {cItem.esDanesa && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold bg-[#FFD23F] text-black border border-black shadow-[1px_1px_0px_#000]">
                              DANESA
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-neutral-800 font-medium border-r-2 border-black/10">
                        {cItem.marca} {cItem.modelo} ({cItem.tipoComponente})
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-700 border-r-2 border-black/10 whitespace-nowrap">
                        {cItem.serial}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-600 border-r-2 border-black/10 whitespace-nowrap">
                        {cItem.fechaIngreso}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-600 border-r-2 border-black/10 whitespace-nowrap">
                        {cItem.fechaEntregada || <span className="text-neutral-400">-</span>}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] font-bold text-amber-600 border-r-2 border-black/10 whitespace-nowrap">
                        {cItem.diasResolucion !== null && cItem.diasResolucion !== undefined ? `${cItem.diasResolucion} d` : "-"}
                      </td>
                      <td className="py-2 px-3 border-r-2 border-black/10 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#2A9D8F]/20 text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                          {cItem.estado}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r-2 border-black/10 whitespace-nowrap">
                        {cItem.recibidoEnDeposito ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#2A9D8F] text-white border-2 border-black shadow-[1px_1px_0px_#000]">
                            Recibido
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#FFD23F] text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                            En tránsito
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              table: "recepcion_cde_tickets",
                              id: cItem.idOrden,
                              label: `Orden CDE #${cItem.idOrden} · ${cItem.cliente}`,
                            })
                          }
                          className="p-1 rounded-lg border-2 border-black bg-white hover:bg-[#E76F51] hover:text-white text-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                          title={`Eliminar orden #${cItem.idOrden} de la base de datos`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* 3. TABLA: ordenes_montaje */}
          {activeTab === "ordenes_montaje" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FAF6EE] text-black font-mono text-[11px] font-black uppercase sticky top-0 z-10 border-b-2 border-black">
                <tr>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">id</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">nro_reg</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">cliente</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">tipo_servicio</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">tecnico</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">etapa</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">progreso</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">estado</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">vendedor / canal</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">componentes_json</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">fecha_montaje</th>
                  <th className="py-2.5 px-3 text-center text-black">acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10 bg-[#FFFDF9]">
                {filteredMontajes
                  .slice(startIndex, startIndex + PAGE_SIZE)
                  .map((m) => (
                    <tr key={m.id} className="hover:bg-[#FAF6EE] transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-black border-r-2 border-black/10 whitespace-nowrap">
                        {m.id}
                      </td>
                      <td className="py-2 px-3 font-mono text-neutral-600 border-r-2 border-black/10 whitespace-nowrap">
                        {m.nro_reg}
                      </td>
                      <td className="py-2 px-3 font-heading font-bold text-black border-r-2 border-black/10">
                        {m.cliente}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-700 border-r-2 border-black/10 whitespace-nowrap">
                        {m.tipo_servicio} ({m.cantidadEquipos} eq.)
                      </td>
                      <td className="py-2 px-3 font-bold text-black border-r-2 border-black/10 whitespace-nowrap">
                        {m.tecnico}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-700 border-r-2 border-black/10 whitespace-nowrap">
                        {m.etapa}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-black border-r-2 border-black/10 whitespace-nowrap">
                        {m.progreso}%
                      </td>
                      <td className="py-2 px-3 border-r-2 border-black/10 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FAF6EE] text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                          {m.estado}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-neutral-700 border-r-2 border-black/10 whitespace-nowrap font-medium">
                        {m.vendedor} · <span className="text-neutral-500">{m.canal}</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-700 border-r-2 border-black/10 max-w-xs truncate" title={JSON.stringify(m.componentes)}>
                        [{m.componentes?.length || 0} piezas] {m.observaciones}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-neutral-600 border-r-2 border-black/10 whitespace-nowrap">
                        {m.fecha_montaje}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              table: "ordenes_montaje",
                              id: m.id,
                              label: `Montaje ${m.id} · ${m.cliente}`,
                            })
                          }
                          className="p-1 rounded-lg border-2 border-black bg-white hover:bg-[#E76F51] hover:text-white text-black shadow-[1px_1px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                          title={`Eliminar orden de montaje ${m.id} de la base de datos`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* 4. TABLA: usuarios */}
          {activeTab === "usuarios" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#FAF6EE] text-black font-mono text-[11px] font-black uppercase sticky top-0 z-10 border-b-2 border-black">
                <tr>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">id</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">avatar</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">nombre</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">role</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">password</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">default_route</th>
                  <th className="py-2.5 px-3 border-r-2 border-black/15 text-black">badge</th>
                  <th className="py-2.5 px-3 text-black">descripcion</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10 bg-[#FFFDF9]">
                {filteredUsuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-[#FAF6EE] transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-black border-r-2 border-black/10">
                      {u.id}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-neutral-700 border-r-2 border-black/10">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#FFD23F] text-black border-2 border-black shadow-[1px_1px_0px_#000] text-[10px] font-extrabold">
                        {u.avatar}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-heading font-bold text-black border-r-2 border-black/10">
                      {u.nombre}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] border-r-2 border-black/10">
                      <span className="px-2 py-0.5 rounded bg-[#FAF6EE] border-2 border-black text-black font-extrabold shadow-[1px_1px_0px_#000]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#2A9D8F] font-bold border-r-2 border-black/10">
                      •••••••• (SHA-256)
                    </td>
                    <td className="py-2.5 px-3 font-mono text-neutral-600 border-r-2 border-black/10">
                      {u.defaultRoute}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-800 font-medium border-r-2 border-black/10">
                      {u.badge}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-700">{u.descripcion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 5. ESTRUCTURA SQL */}
          {activeTab === "sql_schema" && (
            <div className="p-6 max-w-5xl mx-auto space-y-4">
              <div className="flex items-center justify-between bg-[#FAF6EE] p-4 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]">
                <div>
                  <h3 className="text-sm font-heading font-extrabold text-black flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-black" />
                    <span>Esquema Oficial MySQL (`src/lib/mysql.ts`)</span>
                  </h3>
                  <p className="text-xs text-neutral-700 mt-0.5 font-medium">
                    Estas 4 tablas se crean y poblan automáticamente cuando el servicio MySQL está activo en `localhost:3306`.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-3.5 py-1.5 rounded-lg bg-[#FFD23F] hover:bg-[#FACC15] text-black text-xs font-heading font-extrabold flex items-center gap-1.5 border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                      <span>SQL Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-black" />
                      <span>Copiar Script SQL</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-5 rounded-xl bg-black text-[#FFD23F] font-mono text-xs overflow-x-auto leading-relaxed border-2 border-black shadow-[4px_4px_0px_#000]">
                {SQL_SCHEMA_TEXT}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Toast informativo Neo-Brutalista */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[80] bg-[#FFD23F] text-black text-xs font-heading font-extrabold px-4 py-2.5 rounded-xl shadow-[4px_4px_0px_#000] border-2 border-black flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-black stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal de confirmación para eliminar fila Neo-Brutalista */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF9] rounded-xl max-w-md w-full shadow-[8px_8px_0px_#000] border-3 border-black overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="w-12 h-12 rounded-xl bg-[#E76F51] border-2 border-black text-white flex items-center justify-center mb-4 shadow-[2px_2px_0px_#000]">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base font-heading font-extrabold text-black mb-1">
                ¿Eliminar registro de la base de datos?
              </h3>
              <p className="text-xs text-neutral-800 mb-4 leading-relaxed font-medium">
                Esta acción eliminará permanentemente{" "}
                <span className="font-mono font-bold text-black bg-[#FFD23F] px-1 border border-black rounded">{confirmDelete.label}</span>{" "}
                de la tabla <span className="font-mono font-bold text-black">{confirmDelete.table}</span> en MySQL y en el almacenamiento local.
              </p>
              <div className="p-3 bg-[#FFD23F]/30 rounded-lg border-2 border-black text-xs text-black leading-relaxed mb-5 shadow-[2px_2px_0px_#000] font-medium">
                <strong className="font-bold">Advertencia:</strong> Esta operación no se puede deshacer.
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 text-xs font-heading font-extrabold text-black bg-[#FAF6EE] hover:bg-[#FFD23F] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => executeDelete(confirmDelete.table, confirmDelete.id)}
                  className="px-4 py-2 text-xs font-heading font-extrabold text-white bg-[#E76F51] hover:bg-rose-700 disabled:opacity-50 border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar Definitivamente</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pantalla de Re-autenticación de Seguridad (30 segundos expirados) Neo-Brutalista */}
      {isSessionLocked && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#FFFDF9] rounded-xl max-w-md w-full shadow-[8px_8px_0px_#000] border-3 border-black overflow-hidden">
            <div className="bg-black text-[#FFD23F] px-5 py-4 flex items-center justify-between border-b-2 border-black">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#FFD23F] text-black border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                  <ShieldAlert className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h3 className="text-sm font-heading font-extrabold text-[#FFD23F] tracking-tight">Sesión MySQL Expirada (30s)</h3>
                  <p className="text-[11px] text-neutral-300 font-mono">Límite de seguridad alcanzado</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-neutral-900 hover:bg-[#E76F51] text-white border-2 border-black transition-colors cursor-pointer"
                title="Cerrar visor MySQL"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReauthSubmit} className="p-6 space-y-4">
              <div className="p-3.5 bg-[#FAF6EE] rounded-xl border-2 border-black text-black text-xs leading-relaxed flex items-start gap-2.5 shadow-[2px_2px_0px_#000]">
                <Clock className="w-4 h-4 text-black shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-heading font-extrabold text-black">Tiempo de visualización agotado</strong>
                  <span className="font-medium text-neutral-800">
                    Por seguridad, el visor de MySQL se bloquea automáticamente cada 30 segundos. Ingrese la clave para renovar el acceso.
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-heading font-extrabold text-black block">
                  Contraseña de Administrador (MySQL)
                </label>
                <div className="relative">
                  <input
                    ref={reauthInputRef}
                    type={showReauthPass ? "text" : "password"}
                    value={reauthPassword}
                    onChange={handleReauthPasswordChange}
                    placeholder="Escriba la clave de Admin / Depósito..."
                    autoFocus
                    className="w-full text-sm bg-white text-black border-2 border-black rounded-lg px-3.5 py-2.5 pr-10 focus:bg-[#FAF6EE] outline-none shadow-[2px_2px_0px_#000] font-mono transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowReauthPass(!showReauthPass)}
                    className="absolute right-3 top-3 text-neutral-500 hover:text-black transition-colors cursor-pointer"
                    title={showReauthPass ? "Ocultar" : "Mostrar"}
                  >
                    {showReauthPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-700 font-mono font-bold pt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2A9D8F] shrink-0" />
                  <span>Validación automática en tiempo real al escribir</span>
                </div>
              </div>

              {reauthError && (
                <div className="p-2.5 bg-[#E76F51]/15 border-2 border-[#E76F51] rounded-lg text-[#E76F51] text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{reauthError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-heading font-extrabold text-black hover:bg-[#FFD23F] bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                >
                  Cerrar Visor
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-heading font-extrabold text-[#FFD23F] bg-black hover:bg-neutral-800 border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Desbloquear MySQL</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
