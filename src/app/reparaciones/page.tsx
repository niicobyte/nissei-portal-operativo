"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Wrench,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Cpu,
  Layers,
  MessageSquare,
  Sparkles,
  RefreshCw,
  X,
  Eye,
  Printer,
  Bell
} from "lucide-react";
import {
  LISTA_TECNICOS,
  LISTA_ADMINS,
  OrdenReparacion,
  getStoredReparaciones,
  fetchReparacionesFromMySQL,
  asignarOrdenATecnico,
  finalizarReparacionTecnico,
  generarMensajeGrupoWhatsApp,
  resetReparaciones,
  Tecnico,
  Admin
} from "@/data/tallerReparacionesData";
import { getActiveUser } from "@/data/authData";
import { consumeCloudSyncWarning } from "@/lib/cloudSync";
import { AuthBadge } from "@/components/common/AuthBadge";
import { AuthGuard } from "@/components/common/AuthGuard";
import { CleanSelect } from "@/components/common/CleanSelect";
import { SatiThermalPrintModal } from "@/components/common/SatiThermalPrintModal";
import {
  saveWorkDraft,
  loadWorkDraft,
  useFlushDraftBeforeLogout,
} from "@/lib/workDrafts";

export default function TallerReparacionesPage() {
  // Usuario Activo (Por defecto: Admin)
  const [currentUserType, setCurrentUserType] = useState<"ADMIN" | "TECNICO">("ADMIN");
  const [currentAdmin, setCurrentAdmin] = useState<Admin>(LISTA_ADMINS[0]); // Admin
  const [currentTecnico, setCurrentTecnico] = useState<Tecnico>(LISTA_TECNICOS[0]); // Carlos
  const [activeSessionRole, setActiveSessionRole] = useState<string>("ADMIN");

  // Datos
  const [ordenes, setOrdenes] = useState<OrdenReparacion[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [adminTab, setAdminTab] = useState<"SIN_ASIGNAR" | "EN_REPARACION" | "FINALIZADAS" | "TODAS">("SIN_ASIGNAR");
  const [tecnicoFilterStatus, setTecnicoFilterStatus] = useState<"TODAS" | "EN_REPARACION" | "FINALIZADAS">("EN_REPARACION");

  // Paginación
  const [adminPage, setAdminPage] = useState(1);
  const [tecnicoPage, setTecnicoPage] = useState(1);
  const ADMIN_PAGE_SIZE = 25;
  const TECNICO_PAGE_SIZE = 12;

  // Modal de Finalización de Reparación (para el técnico)
  const [repairModalOrden, setRepairModalOrden] = useState<OrdenReparacion | null>(null);
  const [modalDictamen, setModalDictamen] = useState<"REPARADO" | "SIN_DEFECTO" | "NO_REPARADO" | "CAMBIO_NUEVO">("REPARADO");
  const [modalDetalle, setModalDetalle] = useState("");
  const [modalRepuestos, setModalRepuestos] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modales de Ver Detalle (Ojito) e Imprimir Boleta SATI
  const [selectedOrdenDetail, setSelectedOrdenDetail] = useState<OrdenReparacion | null>(null);
  const [showPrintOrdenModal, setShowPrintOrdenModal] = useState<OrdenReparacion | null>(null);

  // Modal para ver y enviar el mensaje de WhatsApp al Grupo
  const [whatsappDispatchModal, setWhatsappDispatchModal] = useState<{
    orden: OrdenReparacion;
    mensaje: string;
  } | null>(null);

  // Modal para Asignar Técnico & Detallar la Falla a Chequear
  const [assignModal, setAssignModal] = useState<{
    orden: OrdenReparacion;
    nombreTecnico: string;
    detalleFalla: string;
  } | null>(null);
  const draftHydratedRef = useRef(false);

  const syncReparacionesFromCloud = async (showFeedback = false) => {
    try {
      const dbData = await fetchReparacionesFromMySQL({ throwOnError: showFeedback });
      if (dbData && dbData.length > 0) {
        setOrdenes(dbData);
      }
      if (showFeedback) {
        showToast(`Taller sincronizado con MySQL (${dbData.length} órdenes).`);
      }
    } catch (err) {
      if (showFeedback) {
        showToast(
          err instanceof Error
            ? err.message
            : "No se pudo sincronizar Taller de Reparaciones con MySQL."
        );
      }
    }
  };

  // Carga inicial desde MySQL (/api/db?module=reparaciones) y sincronización con el perfil autenticado
  useEffect(() => {
    const active = getActiveUser();
    if (!active) return;

    const loadedOrdenes = getStoredReparaciones();
    setOrdenes(loadedOrdenes);

    const draft = loadWorkDraft<{
      searchTerm?: string;
      adminTab?: "SIN_ASIGNAR" | "EN_REPARACION" | "FINALIZADAS" | "TODAS";
      tecnicoFilterStatus?: "TODAS" | "EN_REPARACION" | "FINALIZADAS";
      adminPage?: number;
      tecnicoPage?: number;
      repairOrdenId?: string | null;
      modalDictamen?: "REPARADO" | "SIN_DEFECTO" | "NO_REPARADO" | "CAMBIO_NUEVO";
      modalDetalle?: string;
      modalRepuestos?: string;
      assignOrdenId?: string | null;
      assignNombreTecnico?: string;
      assignDetalleFalla?: string;
      whatsappOrdenId?: string | null;
      whatsappMensaje?: string;
      detailOrdenId?: string | null;
    }>("reparaciones_workspace");

    if (draft) {
      if (typeof draft.searchTerm === "string") setSearchTerm(draft.searchTerm);
      if (draft.adminTab) setAdminTab(draft.adminTab);
      if (draft.tecnicoFilterStatus) setTecnicoFilterStatus(draft.tecnicoFilterStatus);
      if (typeof draft.adminPage === "number" && draft.adminPage >= 1) setAdminPage(draft.adminPage);
      if (typeof draft.tecnicoPage === "number" && draft.tecnicoPage >= 1) setTecnicoPage(draft.tecnicoPage);

      if (draft.repairOrdenId) {
        const ord = loadedOrdenes.find((o) => o.idOrden === draft.repairOrdenId);
        if (ord) {
          setRepairModalOrden(ord);
          if (draft.modalDictamen) setModalDictamen(draft.modalDictamen);
          if (typeof draft.modalDetalle === "string") setModalDetalle(draft.modalDetalle);
          if (typeof draft.modalRepuestos === "string") setModalRepuestos(draft.modalRepuestos);
        }
      }
      if (draft.assignOrdenId) {
        const ord = loadedOrdenes.find((o) => o.idOrden === draft.assignOrdenId);
        if (ord) {
          setAssignModal({
            orden: ord,
            nombreTecnico: draft.assignNombreTecnico || LISTA_TECNICOS[0].nombre,
            detalleFalla: draft.assignDetalleFalla || "",
          });
        }
      }
      if (draft.whatsappOrdenId) {
        const ord = loadedOrdenes.find((o) => o.idOrden === draft.whatsappOrdenId);
        if (ord) {
          setWhatsappDispatchModal({
            orden: ord,
            mensaje: draft.whatsappMensaje || "",
          });
        }
      }
      if (draft.detailOrdenId) {
        const ord = loadedOrdenes.find((o) => o.idOrden === draft.detailOrdenId);
        if (ord) setSelectedOrdenDetail(ord);
      }
    }
    draftHydratedRef.current = true;

    const pendingWarning = consumeCloudSyncWarning();
    if (pendingWarning) {
      showToast(pendingWarning);
    }

    void syncReparacionesFromCloud(false);

    const handleWindowFocus = () => {
      if (getActiveUser()) {
        void syncReparacionesFromCloud(false);
      }
    };
    window.addEventListener("focus", handleWindowFocus);

    setActiveSessionRole(active.role);
    if (active.role === "ADMIN") {
      setCurrentUserType("ADMIN");
      const foundAdmin = LISTA_ADMINS.find((a) => a.nombre.toLowerCase() === active.nombre.toLowerCase());
      if (foundAdmin) setCurrentAdmin(foundAdmin);
    } else if (active.role === "TECNICO") {
      setCurrentUserType("TECNICO");
      const foundTech = LISTA_TECNICOS.find((t) => t.nombre.toLowerCase() === active.nombre.toLowerCase());
      if (foundTech) setCurrentTecnico(foundTech);
    }

    return () => window.removeEventListener("focus", handleWindowFocus);
  }, []);

  const buildReparacionesDraft = () => ({
    searchTerm,
    adminTab,
    tecnicoFilterStatus,
    adminPage,
    tecnicoPage,
    repairOrdenId: repairModalOrden?.idOrden || null,
    modalDictamen,
    modalDetalle,
    modalRepuestos,
    assignOrdenId: assignModal?.orden.idOrden || null,
    assignNombreTecnico: assignModal?.nombreTecnico || "",
    assignDetalleFalla: assignModal?.detalleFalla || "",
    whatsappOrdenId: whatsappDispatchModal?.orden.idOrden || null,
    whatsappMensaje: whatsappDispatchModal?.mensaje || "",
    detailOrdenId: selectedOrdenDetail?.idOrden || null,
  });

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    saveWorkDraft("reparaciones_workspace", buildReparacionesDraft());
  }, [
    searchTerm,
    adminTab,
    tecnicoFilterStatus,
    adminPage,
    tecnicoPage,
    repairModalOrden,
    modalDictamen,
    modalDetalle,
    modalRepuestos,
    assignModal,
    whatsappDispatchModal,
    selectedOrdenDetail,
  ]);

  useFlushDraftBeforeLogout(() => {
    if (draftHydratedRef.current) {
      saveWorkDraft("reparaciones_workspace", buildReparacionesDraft());
    }
  });

  // Reset de página al buscar o cambiar pestañas
  useEffect(() => {
    setAdminPage(1);
  }, [searchTerm, adminTab]);

  useEffect(() => {
    setTecnicoPage(1);
  }, [searchTerm, tecnicoFilterStatus]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Acción del botón "Avisar" (notifica el estado de la orden a WhatsApp / Recepción)
  const handleAvisarOrden = (orden: OrdenReparacion) => {
    const msg = generarMensajeGrupoWhatsApp(orden);

    fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "TALLER",
        body: msg,
      }),
    })
      .then(() => {
        showToast(`Aviso enviado para la Orden #${orden.idOrden} (${orden.cliente}).`);
      })
      .catch(() => {
        showToast(`Aviso preparado para la Orden #${orden.idOrden}.`);
      });

    setWhatsappDispatchModal({ orden, mensaje: msg });
  };

  // Abrir recuadro modal para detallar la falla antes de asignar
  const handleOpenAssignModal = (orden: OrdenReparacion, nombreTecnico: string) => {
    setAssignModal({
      orden,
      nombreTecnico,
      detalleFalla: orden.fallaReportada || "",
    });
  };

  // Confirmar Asignación desde el Modal y Despachar a WhatsApp
  const handleConfirmAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModal) return;

    const { orden, nombreTecnico, detalleFalla } = assignModal;
    const fallaFinal = detalleFalla.trim();

    const updated = asignarOrdenATecnico(orden.idOrden, nombreTecnico, currentAdmin.nombre, fallaFinal);
    setOrdenes(updated);
    setAssignModal(null);
    showToast(`Orden #${orden.idOrden} asignada a ${nombreTecnico} con éxito.`);

    // Envío automático al Grupo de WhatsApp del Taller vía WhaApi (Canal TALLER)
    const msg = `🔔 *NUEVA ASIGNACIÓN EN LABORATORIO TÉCNICO*
*NISSEI S.A. · Taller de Reparaciones CDE*

📋 *Nº Orden SATI:* #${orden.idOrden}
👨‍🔧 *Técnico Asignado:* ${nombreTecnico}
🛡️ *Asignado por:* ${currentAdmin.nombre}

💻 *Equipo a Chequear:* ${orden.equipo}
🏷️ *Categoría:* ${orden.tipoComponente}
🔢 *Nº de Serie / IMEI:* ${orden.serial || "S/N"}
👤 *Cliente:* ${orden.cliente}

⚠️ *FALLA A ASIGNAR / CHEQUEAR:*
${fallaFinal}
${orden.observaciones ? `\n📌 *Observaciones previas:* ${orden.observaciones}` : ""}

📅 *Fecha de Ingreso:* ${orden.fechaIngreso}
📍 *Por favor retirar el equipo de recepción e iniciar pruebas de banco.*`;

    fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "TALLER",
        body: msg,
      }),
    }).catch((err) => console.error("[WHAPI ASIGNACION ERROR]", err));
  };

  // Restablecer cola
  const handleReset = () => {
    if (window.confirm("¿Deseas restablecer todas las órdenes para que las pendientes vuelvan a estar 'Sin Asignar'?")) {
      const resetList = resetReparaciones();
      setOrdenes(resetList);
      showToast("Cola de taller restablecida: todas las órdenes pendientes están Sin Asignar.");
    }
  };

  // Abrir modal de finalización para técnico
  const handleOpenRepairModal = (orden: OrdenReparacion) => {
    setRepairModalOrden(orden);
    setModalDictamen("REPARADO");
    setModalDetalle(
      "Revisión en banco de pruebas completada. Solucionado con mantenimiento de circuito y calibración de parámetros operativos. Stress test superado satisfactoriamente."
    );
    setModalRepuestos("Pasta térmica de alto rendimiento, limpieza ultrasónica.");
  };

  // Confirmar y finalizar reparación por el técnico
  const handleConfirmRepair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repairModalOrden) return;

    const { updatedList, ordenFinalizada } = finalizarReparacionTecnico(
      repairModalOrden.idOrden,
      currentTecnico.nombre,
      modalDictamen,
      modalDetalle,
      modalRepuestos
    );

    setOrdenes(updatedList);
    setRepairModalOrden(null);

    if (ordenFinalizada) {
      const msg = generarMensajeGrupoWhatsApp(ordenFinalizada);

      // Envío automático al Grupo del Taller vía WhaApi (Canal TALLER)
      fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "TALLER",
          body: msg,
        }),
      })
        .then(() => {
          showToast(`¡Orden #${ordenFinalizada.idOrden} finalizada y notificada al Grupo de WhatsApp!`);
        })
        .catch((err) => console.error("[WHAPI REPARACION ERROR]", err));

      setWhatsappDispatchModal({ orden: ordenFinalizada, mensaje: msg });
    }
  };

  // Métricas del Administrador
  const adminMetrics = useMemo(() => {
    const total = ordenes.length || 1;
    const sinAsignar = ordenes.filter((o) => o.estado === "SIN_ASIGNAR").length;
    const enReparacion = ordenes.filter((o) => o.estado === "EN_REPARACION").length;
    const finalizadas = ordenes.filter((o) => o.estado === "FINALIZADA").length;

    // Carga por técnico
    const cargaPorTecnico = LISTA_TECNICOS.map((t) => {
      const asignadas = ordenes.filter(
        (o) => o.tecnicoAsignado === t.nombre && o.estado === "EN_REPARACION"
      ).length;
      const completadas = ordenes.filter(
        (o) => o.tecnicoAsignado === t.nombre && o.estado === "FINALIZADA"
      ).length;
      return { ...t, asignadas, completadas };
    });

    return { total, sinAsignar, enReparacion, finalizadas, cargaPorTecnico };
  }, [ordenes]);

  // Órdenes filtradas para el Administrador (ordenadas de más reciente a más antigua)
  const filteredAdminOrdenes = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const filtered = ordenes.filter((o) => {
      const matchSearch =
        !q ||
        o.idOrden.toLowerCase().includes(q) ||
        o.cliente.toLowerCase().includes(q) ||
        o.equipo.toLowerCase().includes(q) ||
        o.serial.toLowerCase().includes(q) ||
        (o.fallaReportada || "").toLowerCase().includes(q) ||
        (o.detalleReparacion || "").toLowerCase().includes(q) ||
        (o.observaciones || "").toLowerCase().includes(q);

      const matchTab =
        adminTab === "SIN_ASIGNAR"
          ? o.estado === "SIN_ASIGNAR"
          : adminTab === "EN_REPARACION"
          ? o.estado === "EN_REPARACION"
          : adminTab === "FINALIZADAS"
          ? o.estado === "FINALIZADA"
          : true;

      return matchSearch && matchTab;
    });

    return [...filtered].sort(
      (a, b) => (Number(b.idOrden) || 0) - (Number(a.idOrden) || 0)
    );
  }, [ordenes, searchTerm, adminTab]);

  // Paginación Admin
  const adminTotalPages = Math.ceil(filteredAdminOrdenes.length / ADMIN_PAGE_SIZE) || 1;
  const currentAdminOrdenes = useMemo(() => {
    const start = (adminPage - 1) * ADMIN_PAGE_SIZE;
    return filteredAdminOrdenes.slice(start, start + ADMIN_PAGE_SIZE);
  }, [filteredAdminOrdenes, adminPage]);

  // Órdenes filtradas para el Técnico Activo (ordenadas de más reciente a más antigua)
  const tecnicoOrdenes = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const filtered = ordenes.filter((o) => {
      const isMine = o.tecnicoAsignado === currentTecnico.nombre;
      if (!isMine) return false;

      const matchSearch =
        !q ||
        o.idOrden.toLowerCase().includes(q) ||
        o.cliente.toLowerCase().includes(q) ||
        o.equipo.toLowerCase().includes(q) ||
        o.serial.toLowerCase().includes(q) ||
        (o.fallaReportada || "").toLowerCase().includes(q) ||
        (o.detalleReparacion || "").toLowerCase().includes(q) ||
        (o.observaciones || "").toLowerCase().includes(q);

      const matchStatus =
        tecnicoFilterStatus === "TODAS" ||
        (tecnicoFilterStatus === "EN_REPARACION" && o.estado === "EN_REPARACION") ||
        (tecnicoFilterStatus === "FINALIZADAS" && o.estado === "FINALIZADA");

      return matchSearch && matchStatus;
    });

    return [...filtered].sort(
      (a, b) => (Number(b.idOrden) || 0) - (Number(a.idOrden) || 0)
    );
  }, [ordenes, currentTecnico, searchTerm, tecnicoFilterStatus]);

  // Paginación Técnico
  const tecnicoTotalPages = Math.ceil(tecnicoOrdenes.length / TECNICO_PAGE_SIZE) || 1;
  const currentTecnicoOrdenes = useMemo(() => {
    const start = (tecnicoPage - 1) * TECNICO_PAGE_SIZE;
    return tecnicoOrdenes.slice(start, start + TECNICO_PAGE_SIZE);
  }, [tecnicoOrdenes, tecnicoPage]);

  return (
    <AuthGuard requiredModule="reparaciones">
      <main className="min-h-dvh bg-[#fbf9f9] py-4 sm:py-6 lg:py-8 2xl:py-10 px-3 sm:px-5 lg:px-7 2xl:px-10">
      <div className="w-full max-w-[1680px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] mx-auto space-y-5 lg:space-y-6 2xl:space-y-8 min-w-0">
        
        {/* Notificación Toast */}
        {toastMessage && (
          <div className="fixed top-4 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg border border-zinc-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Cabecera Principal Limpia y Elegante */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-200">
          <div>
            {currentUserType !== "ADMIN" && activeSessionRole === "ADMIN" && (
              /* Botón de retorno al panel admin si el supervisor estaba viendo el banco de un técnico */
              <div className="mb-2">
                <button
                  onClick={() => setCurrentUserType("ADMIN")}
                  className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 px-2 py-0.5 rounded transition-colors"
                >
                  ← Volver a supervisión
                </button>
              </div>
            )}

            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
              {currentUserType === "ADMIN"
                ? "Gestión & Asignación de Taller"
                : `Banco de Trabajo · ${currentTecnico.nombre}`}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-3xl">
              {currentUserType === "ADMIN"
                ? "Supervise los equipos en cola del archivo de órdenes SATI, asigne a los técnicos y controle la carga de los bancos."
                : `Bandeja de órdenes asignadas a ${currentTecnico.nombre}. Ejecute las pruebas técnicas, registre la resolución y notifique al Grupo de WhatsApp al finalizar.`}
            </p>
          </div>

          <div className="flex items-center">
            <AuthBadge
              requiredModule="reparaciones"
              onSyncMysql={() => void syncReparacionesFromCloud(true)}
            />
          </div>
        </header>

        {/* ============================================================== */}
        {/* VISTA 1: MODO ADMINISTRADOR (Admin)                            */}
        {/* ============================================================== */}
        {currentUserType === "ADMIN" && (
          <div className="space-y-6">
            
            {/* 4 KPIs de Supervisión */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <span className="text-xs text-zinc-500 block">Sin asignar (en espera)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-rose-700 tabular-nums">
                    {adminMetrics.sinAsignar}
                  </span>
                  <span className="text-xs text-rose-600 font-medium">Por asignar</span>
                </div>
                <span className="text-[11px] text-zinc-500 block mt-1">Requieren técnico</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <span className="text-xs text-zinc-500 block">En reparación activa</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-amber-700 tabular-nums">
                    {adminMetrics.enReparacion}
                  </span>
                  <span className="text-xs text-amber-600 font-medium">En bancos</span>
                </div>
                <span className="text-[11px] text-zinc-500 block mt-1">En proceso por técnicos</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <span className="text-xs text-zinc-500 block">Reparadas / Listas</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700 tabular-nums">
                    {adminMetrics.finalizadas}
                  </span>
                  <span className="text-xs text-emerald-600 font-medium">Pase a recepción</span>
                </div>
                <span className="text-[11px] text-zinc-500 block mt-1">Notificadas por WhatsApp</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <span className="text-xs text-zinc-500 block">Bancos operativos</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-zinc-900 tabular-nums">4 / 4</span>
                  <span className="text-xs text-zinc-500 font-medium">100% activos</span>
                </div>
                <span className="text-[11px] text-zinc-500 block mt-1">Carlos, Enrique, Michael, Marcelo</span>
              </div>
            </section>

            {/* Panel de Carga de Trabajo por Técnico */}
            <section className="bg-white p-4 sm:p-5 rounded-xl border border-zinc-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">
                    Carga de trabajo por banco de técnico
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Asignación actual de Carlos, Enrique, Michael y Marcelo
                  </p>
                </div>
                <span className="text-xs font-mono font-medium px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded border border-zinc-200">
                  Supervisión: {currentAdmin.nombre}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {adminMetrics.cargaPorTecnico.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-lg border border-zinc-200 bg-zinc-50/50 space-y-2 hover:border-zinc-400 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded bg-zinc-900 text-white font-mono text-xs font-bold flex items-center justify-center">
                          {t.avatar}
                        </span>
                        <div>
                          <strong className="text-xs font-bold text-zinc-900 block">
                            {t.nombre}
                          </strong>
                          <span className="text-xs text-zinc-500">{t.banco}</span>
                        </div>
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded tabular-nums">
                        {t.asignadas} activas
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-zinc-500 pt-2 border-t border-zinc-200">
                      <span>Finalizadas: <strong className="text-zinc-900 tabular-nums">{t.completadas}</strong></span>
                      <button
                        onClick={() => {
                          setCurrentUserType("TECNICO");
                          setCurrentTecnico(t);
                        }}
                        className="text-zinc-900 hover:underline font-semibold"
                      >
                        Ver banco →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Pestañas de Órdenes y Búsqueda */}
            <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden space-y-3 p-4">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                
                {/* Pestañas */}
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  <button
                    onClick={() => setAdminTab("SIN_ASIGNAR")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                      adminTab === "SIN_ASIGNAR"
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Sin asignar</span>
                    <span className="font-mono tabular-nums text-xs font-bold">({adminMetrics.sinAsignar})</span>
                  </button>
                  <button
                    onClick={() => setAdminTab("EN_REPARACION")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                      adminTab === "EN_REPARACION"
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>En reparación</span>
                    <span className="font-mono tabular-nums text-xs font-bold">({adminMetrics.enReparacion})</span>
                  </button>
                  <button
                    onClick={() => setAdminTab("FINALIZADAS")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                      adminTab === "FINALIZADAS"
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Reparadas / Listas</span>
                    <span className="font-mono tabular-nums text-xs font-bold">({adminMetrics.finalizadas})</span>
                  </button>
                  <button
                    onClick={() => setAdminTab("TODAS")}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
                      adminTab === "TODAS"
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Todas en taller</span>
                    <span className="font-mono tabular-nums text-xs font-bold">({adminMetrics.total})</span>
                  </button>
                </div>

                {/* Acciones y Buscador */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    onClick={handleReset}
                    title="Restablecer todas las órdenes pendientes a 'Sin Asignar'"
                    className="p-2 border border-zinc-200 hover:border-rose-300 text-zinc-500 hover:text-rose-600 bg-white rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-xs font-semibold">Restablecer Cola</span>
                  </button>

                  {/* Buscador */}
                  <div className="relative w-full sm:w-72">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar orden, cliente, serie..."
                      className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:border-zinc-900 focus:bg-white transition-colors"
                    />
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-900"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabla de Órdenes */}
              <div className="overflow-x-auto border-2 border-black rounded-lg shadow-[2px_2px_0px_#000]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF6EE] text-black uppercase tracking-wider border-b-2 border-black font-mono text-xs font-black select-none">
                    <tr>
                      <th className="py-3 px-3.5 font-black text-black">Nº Orden</th>
                      <th className="py-3 px-3.5 font-black text-black">Cliente</th>
                      <th className="py-3 px-3.5 font-black text-black">Equipo &amp; Serie</th>
                      <th className="py-3 px-3.5 font-black text-black">Fallas a Asignar</th>
                      <th className="py-3 px-3.5 font-black text-black">Detalle de la Reparación</th>
                      <th className="py-3 px-3.5 font-black text-black">Observaciones</th>
                      <th className="py-3 px-3.5 font-black text-black">Estado / Técnico</th>
                      <th className="py-3 px-3.5 font-black text-black">Asignar al Técnico</th>
                      <th className="py-3 px-3.5 font-black text-black text-right min-w-[140px]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-zinc-900">
                    {currentAdminOrdenes.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-zinc-500">
                          No se encontraron órdenes con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      currentAdminOrdenes.map((ord) => (
                        <tr key={ord.idOrden} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="font-bold text-zinc-900 font-mono">#{ord.idOrden}</span>
                            <div className="text-[10px] text-zinc-500 font-mono">{ord.fechaIngreso}</div>
                          </td>

                          <td className="py-3 px-3.5 font-semibold text-zinc-900">
                            {ord.cliente}
                          </td>

                          <td className="py-3 px-3.5">
                            <div className="font-semibold text-zinc-900">{ord.equipo}</div>
                            <span className="text-[10px] font-mono text-zinc-500">
                              S/N: {ord.serial} · {ord.tipoComponente}
                            </span>
                          </td>

                          {/* Columna 1: Fallas a Asignar (detallada al seleccionar técnico) */}
                          <td className="py-3 px-3.5 max-w-[200px]" title={ord.fallaReportada || ""}>
                            {ord.fallaReportada ? (
                              <div className="font-semibold text-zinc-900 flex items-start gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1.5"></span>
                                <span className="line-clamp-2">{ord.fallaReportada}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-400 italic text-[11px]">
                                Sin falla asignada
                              </span>
                            )}
                          </td>

                          {/* Columna 2: Detalle de la Reparación (solo cuando sí fue reparado) */}
                          <td className="py-3 px-3.5 max-w-[220px]" title={ord.detalleReparacion || ""}>
                            {ord.detalleReparacion ? (
                              <div className="text-emerald-900 bg-emerald-50/70 border border-emerald-200/80 px-2 py-1 rounded text-[11px] font-medium line-clamp-2">
                                {ord.detalleReparacion}
                              </div>
                            ) : (
                              <span className="text-zinc-300 font-mono">—</span>
                            )}
                          </td>

                          {/* Columna 3: Observaciones (NC, cambio por nuevo, sin reparo, rechazo, etc.) */}
                          <td className="py-3 px-3.5 max-w-[220px]" title={ord.observaciones || ""}>
                            {ord.observaciones ? (
                              <div className="text-zinc-700 bg-zinc-100/80 border border-zinc-200 px-2 py-1 rounded text-[11px] line-clamp-2">
                                {ord.observaciones}
                              </div>
                            ) : (
                              <span className="text-zinc-300 font-mono">—</span>
                            )}
                          </td>

                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {ord.tecnicoAsignado ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-zinc-100 text-zinc-900 border border-zinc-300">
                                <Wrench className="w-3.5 h-3.5 text-zinc-700" />
                                {ord.tecnicoAsignado}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <Clock className="w-3 h-3 text-rose-600" />
                                Sin Asignar
                              </span>
                            )}
                          </td>

                          {/* Selector Desplegable de Asignación a Banco */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <CleanSelect
                              value={ord.tecnicoAsignado || ""}
                              onChange={(val) => {
                                if (val) handleOpenAssignModal(ord, val);
                              }}
                              placeholder="Asignar técnico..."
                              options={LISTA_TECNICOS.map((t) => ({
                                value: t.nombre,
                                label: `${t.nombre} (${t.banco})`,
                                badge: t.banco.replace("Banco ", "B"),
                                badgeColor: "bg-zinc-100 text-zinc-800 border border-zinc-200",
                              }))}
                              icon={<UserCheck className="w-3.5 h-3.5" />}
                              dropdownWidth="w-56"
                              activeClassName="bg-zinc-900 text-white border-zinc-900 shadow-sm"
                              className="bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400"
                            />
                          </td>

                          {/* Columna Acciones: Ojito (Ver Detalle), Imprimir y Avisar */}
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedOrdenDetail(ord)}
                                className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors flex items-center justify-center"
                                title="Ver Detalle Completo"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setShowPrintOrdenModal(ord)}
                                className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors flex items-center justify-center"
                                title="Imprimir Boleta SATI"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAvisarOrden(ord)}
                                className="px-2.5 py-1 bg-zinc-900 hover:bg-black text-white rounded font-medium text-xs transition-colors shadow-sm"
                                title="Avisar estado de la orden por WhatsApp"
                              >
                                Avisar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación Admin */}
              {adminTotalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-200 text-xs text-zinc-500">
                  <div>
                    Mostrando <strong className="text-zinc-900">{(adminPage - 1) * ADMIN_PAGE_SIZE + 1}</strong> a{" "}
                    <strong className="text-zinc-900">{Math.min(adminPage * ADMIN_PAGE_SIZE, filteredAdminOrdenes.length)}</strong> de{" "}
                    <strong className="text-zinc-900">{filteredAdminOrdenes.length}</strong> órdenes
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setAdminPage((p) => Math.max(1, p - 1))}
                      disabled={adminPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors shadow-sm"
                    >
                      ← Anterior
                    </button>
                    <span className="font-mono text-xs px-2 text-zinc-500">
                      Página {adminPage} de {adminTotalPages}
                    </span>
                    <button
                      onClick={() => setAdminPage((p) => Math.min(adminTotalPages, p + 1))}
                      disabled={adminPage === adminTotalPages}
                      className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors shadow-sm"
                    >
                      Siguiente →
                    </button>
                  </div>
                </div>
              )}
            </section>

          </div>
        )}

        {/* ============================================================== */}
        {/* VISTA 2: MODO TÉCNICO (Carlos / Enrique / Michael / Marcelo)   */}
        {/* ============================================================== */}
        {currentUserType === "TECNICO" && (
          <div className="space-y-6">
            
            {/* 4 KPIs de Alto Impacto para el Banco Técnico */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <span className="text-xs text-zinc-500 block">Banco Técnico</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-zinc-900 font-mono">
                    {currentTecnico.banco}
                  </span>
                  <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Activo
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500 block mt-1">Operador: {currentTecnico.nombre}</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <span className="text-xs text-zinc-500 block">En Reparación Activa</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-amber-700 tabular-nums">
                    {tecnicoOrdenes.filter((o) => o.estado === "EN_REPARACION").length}
                  </span>
                  <span className="text-xs text-amber-700 font-medium">En banco</span>
                </div>
                <span className="text-[11px] text-zinc-500 block mt-1">Pendientes de pruebas &amp; dictamen</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <span className="text-xs text-zinc-500 block">Reparadas / Listas</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700 tabular-nums">
                    {tecnicoOrdenes.filter((o) => o.estado === "FINALIZADA").length}
                  </span>
                  <span className="text-xs text-emerald-700 font-medium">Pase a recepción</span>
                </div>
                <span className="text-[11px] text-zinc-500 block mt-1">Notificadas vía WhatsApp</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                <span className="text-xs text-zinc-500 block">Total Histórico</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-zinc-900 tabular-nums">
                    {tecnicoOrdenes.length}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">Equipos</span>
                </div>
                <span className="text-[11px] text-zinc-500 block mt-1">Carga asignada al banco</span>
              </div>
            </section>

            {/* Filtros de la Bandeja */}
            <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  onClick={() => { setTecnicoFilterStatus("EN_REPARACION"); setTecnicoPage(1); }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    tecnicoFilterStatus === "EN_REPARACION"
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Pendientes de Reparar</span>
                  <span className="text-[11px] font-mono opacity-80 tabular-nums">
                    ({tecnicoOrdenes.filter((o) => o.estado === "EN_REPARACION").length})
                  </span>
                </button>

                <button
                  onClick={() => { setTecnicoFilterStatus("FINALIZADAS"); setTecnicoPage(1); }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    tecnicoFilterStatus === "FINALIZADAS"
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Reparadas / Despachadas</span>
                  <span className="text-[11px] font-mono opacity-80 tabular-nums">
                    ({tecnicoOrdenes.filter((o) => o.estado === "FINALIZADA").length})
                  </span>
                </button>

                <button
                  onClick={() => { setTecnicoFilterStatus("TODAS"); setTecnicoPage(1); }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    tecnicoFilterStatus === "TODAS"
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Todas</span>
                  <span className="text-[11px] font-mono opacity-80 tabular-nums">
                    ({tecnicoOrdenes.length})
                  </span>
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setTecnicoPage(1); }}
                  placeholder="Buscar en mis órdenes..."
                  className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-zinc-900 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Listado de Tarjetas de Órdenes del Técnico */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentTecnicoOrdenes.length === 0 ? (
                <div className="col-span-full py-16 text-center bg-white rounded-xl border border-zinc-200 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-zinc-400 mx-auto" />
                  <h3 className="text-sm font-bold text-zinc-900">
                    No tienes órdenes pendientes con este filtro
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto">
                    El supervisor Admin te asignará nuevos equipos desde la cola general, o puedes cambiar de filtro.
                  </p>
                </div>
              ) : (
                currentTecnicoOrdenes.map((ord) => {
                  const isDone = ord.estado === "FINALIZADA";
                  return (
                    <div
                      key={ord.idOrden}
                      className={`bg-white rounded-xl p-4 sm:p-5 border transition-all flex flex-col justify-between space-y-3.5 shadow-sm ${
                        isDone ? "border-emerald-200 bg-emerald-50/20" : "border-zinc-200 hover:border-zinc-400"
                      }`}
                    >
                      <div className="space-y-2.5">
                        {/* Header de la tarjeta con Ojito, Imprimir y Avisar */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-zinc-100 text-zinc-900 rounded border border-zinc-200">
                              #{ord.idOrden}
                            </span>
                            {isDone ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                FINALIZADA
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                <Wrench className="w-3 h-3" />
                                EN REPARACIÓN
                              </span>
                            )}
                          </div>

                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedOrdenDetail(ord)}
                              className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
                              title="Ver Detalle Completo"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowPrintOrdenModal(ord)}
                              className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors"
                              title="Imprimir Boleta SATI"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAvisarOrden(ord)}
                              className="px-2 py-0.5 bg-zinc-900 hover:bg-black text-white rounded font-medium text-[11px] transition-colors shadow-sm"
                            >
                              Avisar
                            </button>
                          </div>
                        </div>

                        {/* Equipo y Cliente */}
                        <div>
                          <h3 className="text-sm font-bold text-zinc-900 leading-snug">
                            {ord.equipo}
                          </h3>
                          <div className="text-xs text-zinc-500 mt-1">
                            Cliente: <strong className="text-zinc-900">{ord.cliente}</strong>
                          </div>
                        </div>

                        {/* Metadatos */}
                        <div className="bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 text-xs font-mono space-y-1">
                          <div className="flex justify-between">
                            <span className="text-zinc-500">CATEGORÍA:</span>
                            <span className="font-semibold text-zinc-900">{ord.tipoComponente}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Nº SERIE:</span>
                            <span className="font-semibold text-zinc-900">{ord.serial}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">ASIGNADO POR:</span>
                            <span className="font-semibold text-zinc-900">{ord.asignadoPor || "Admin"}</span>
                          </div>
                        </div>

                        {/* Falla a Asignar / Chequear en Banco */}
                        <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/90 space-y-1">
                          <div className="flex items-center justify-between text-[10px] uppercase font-mono">
                            <span className="font-bold text-amber-900 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              Falla Asignada a Chequear:
                            </span>
                            <span className="text-amber-800 text-[9px] font-semibold">Por {ord.asignadoPor || "Admin"}</span>
                          </div>
                          <p className="text-xs text-amber-950 font-medium leading-relaxed">
                            {ord.fallaReportada || "Sin falla específica detallada en la asignación."}
                          </p>
                        </div>

                        {/* Detalle de la Reparación (si tiene reparación registrada) */}
                        {ord.detalleReparacion && (
                          <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs space-y-1">
                            <span className="text-[10px] uppercase font-mono text-emerald-800 font-bold block">
                              Detalle de la Reparación:
                            </span>
                            <p className="text-[11px] text-emerald-950 font-medium leading-relaxed">
                              {ord.detalleReparacion}
                            </p>
                          </div>
                        )}

                        {/* Observaciones (si no se reparó nada: NC, cambio por nuevo, sin reparo, etc.) */}
                        {ord.observaciones && (
                          <div className="p-2.5 rounded-lg bg-zinc-100 border border-zinc-200 text-xs space-y-1">
                            <span className="text-[10px] uppercase font-mono text-zinc-600 font-bold block">
                              Observaciones:
                            </span>
                            <p className="text-[11px] text-zinc-800 leading-relaxed">
                              {ord.observaciones}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Botón de Acción para el Técnico */}
                      <div className="pt-2 border-t border-zinc-200">
                        {isDone ? (
                          <button
                            onClick={() => handleAvisarOrden(ord)}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Avisar / Reenviar a WhatsApp</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenRepairModal(ord)}
                            className="w-full py-2.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
                          >
                            <Wrench className="w-3.5 h-3.5 text-amber-400" />
                            <span>Finalizar Reparación &amp; Dictaminar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Paginación Técnico */}
            {tecnicoTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-200 text-xs text-zinc-500 bg-white p-4 rounded-xl border border-zinc-200">
                <div>
                  Mostrando <strong className="text-zinc-900">{(tecnicoPage - 1) * TECNICO_PAGE_SIZE + 1}</strong> a{" "}
                  <strong className="text-zinc-900">{Math.min(tecnicoPage * TECNICO_PAGE_SIZE, tecnicoOrdenes.length)}</strong> de{" "}
                  <strong className="text-zinc-900">{tecnicoOrdenes.length}</strong> órdenes
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setTecnicoPage((p) => Math.max(1, p - 1))}
                    disabled={tecnicoPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors shadow-sm"
                  >
                    ← Anterior
                  </button>
                  <span className="font-mono text-xs px-2 text-zinc-500">
                    Página {tecnicoPage} de {tecnicoTotalPages}
                  </span>
                  <button
                    onClick={() => setTecnicoPage((p) => Math.min(tecnicoTotalPages, p + 1))}
                    disabled={tecnicoPage === tecnicoTotalPages}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors shadow-sm"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: VER DETALLE COMPLETO DE LA ORDEN (OJITO)                */}
        {/* ============================================================== */}
        {selectedOrdenDetail && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2.5 sm:p-4">
            <div className="bg-white rounded-2xl max-w-lg 2xl:max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 border border-[#e5e5e5] max-h-[92dvh] overflow-y-auto overscroll-contain">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
                <div>
                  <span className="text-[11px] font-mono text-[#888888] uppercase">DETALLE DE ORDEN EN TALLER SATI</span>
                  <h3 className="text-lg 2xl:text-xl font-bold text-[#121212]">
                    Orden #{selectedOrdenDetail.idOrden} · {selectedOrdenDetail.equipo}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedOrdenDetail(null)}
                  className="text-[#888888] hover:text-[#121212] text-xl font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-[#f9f9f9] p-3.5 rounded-xl border border-[#f0f0f0]">
                  <div>
                    <span className="text-[#888888] block text-[11px]">Cliente</span>
                    <strong className="text-[#121212] text-sm">{selectedOrdenDetail.cliente}</strong>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[11px]">Código de Producto</span>
                    <strong className="text-[#121212] font-mono">{selectedOrdenDetail.codigoProducto || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[11px]">Fecha de Ingreso</span>
                    <strong className="text-[#121212] font-mono">{selectedOrdenDetail.fechaIngreso || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[11px]">Técnico Asignado</span>
                    <strong className="text-[#121212] font-mono">
                      {selectedOrdenDetail.tecnicoAsignado || "Sin asignar"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[11px]">Estado en Taller</span>
                    <strong className="text-[#121212] font-mono">{selectedOrdenDetail.estado}</strong>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[11px]">Dictamen Final</span>
                    <strong className="text-[#121212] font-mono">{selectedOrdenDetail.dictamenFinal || "En evaluación"}</strong>
                  </div>
                </div>

                <div>
                  <span className="text-[#888888] block mb-1 text-[11px]">Identificación del Hardware</span>
                  <div className="p-3 bg-white border border-[#e5e5e5] rounded-xl space-y-1">
                    <div className="font-bold text-sm text-[#121212]">
                      {selectedOrdenDetail.equipo}
                    </div>
                    <div className="text-[11px] text-[#555555] font-mono flex items-center justify-between">
                      <span>Categoría: {selectedOrdenDetail.tipoComponente}</span>
                      <span>S/N: <strong>{selectedOrdenDetail.serial || "N/A"}</strong></span>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[#888888] block mb-1 text-[11px]">Falla a Asignar / Chequear</span>
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-950 font-medium">
                    {selectedOrdenDetail.fallaReportada || "Sin falla específica asignada."}
                  </div>
                </div>

                {selectedOrdenDetail.detalleReparacion && (
                  <div>
                    <span className="text-[#888888] block mb-1 text-[11px]">Detalle de la Reparación</span>
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-950 font-medium">
                      {selectedOrdenDetail.detalleReparacion}
                    </div>
                  </div>
                )}

                {selectedOrdenDetail.observaciones && (
                  <div>
                    <span className="text-[#888888] block mb-1 text-[11px]">Observaciones</span>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[#222222] leading-relaxed">
                      {selectedOrdenDetail.observaciones}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#e5e5e5] flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    const ord = selectedOrdenDetail;
                    setSelectedOrdenDetail(null);
                    handleAvisarOrden(ord);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  Avisar por WhatsApp
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOrdenDetail(null)}
                  className="px-4 py-2 bg-[#1c1c1e] text-white rounded-xl text-xs font-semibold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: IMPRIMIR BOLETA SATI TÉRMICA CALIBRABLE                 */}
        {/* ============================================================== */}
        {showPrintOrdenModal && (
          <SatiThermalPrintModal
            data={{
              idOrden: showPrintOrdenModal.idOrden,
              codigoProducto: showPrintOrdenModal.codigoProducto,
              cliente: showPrintOrdenModal.cliente,
              equipo: showPrintOrdenModal.equipo,
              serial: showPrintOrdenModal.serial,
              tecnico: showPrintOrdenModal.tecnicoAsignado,
              estado: showPrintOrdenModal.estado,
              informeTecnico:
                showPrintOrdenModal.detalleReparacion ||
                showPrintOrdenModal.observaciones ||
                showPrintOrdenModal.fallaReportada ||
                "Sin observaciones.",
              subtitulo: "COMPROBANTE DEL SERVICIO POST - VENTA NISSEI",
              fechaIngreso: showPrintOrdenModal.fechaIngreso,
            }}
            onClose={() => setShowPrintOrdenModal(null)}
          />
        )}

        {/* ============================================================== */}
        {/* MODAL: ASIGNAR TÉCNICO & DETALLAR FALLA A CHEQUEAR (ADMIN)     */}
        {/* ============================================================== */}
        {assignModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-4 sm:p-6 shadow-xl space-y-4 border border-zinc-200 max-h-[92dvh] overflow-y-auto overscroll-contain">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                      Asignación de Banco Técnico
                    </span>
                    <h3 className="text-base font-bold text-zinc-900 leading-tight">
                      Asignar a {assignModal.nombreTecnico}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignModal(null)}
                  className="text-zinc-400 hover:text-zinc-900 p-1 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmAssign} className="space-y-4 text-xs">
                {/* Resumen del Equipo */}
                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">ORDEN:</span>
                    <strong className="text-zinc-900">#{assignModal.orden.idOrden}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">EQUIPO:</span>
                    <strong className="text-zinc-900">{assignModal.orden.equipo}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Nº SERIE:</span>
                    <span className="text-zinc-800">{assignModal.orden.serial || "S/N"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">CLIENTE:</span>
                    <span className="text-zinc-800">{assignModal.orden.cliente}</span>
                  </div>
                  {assignModal.orden.detalleReparacion && (
                    <div className="pt-1.5 border-t border-zinc-200 text-emerald-800 font-sans">
                      <span className="text-[10px] text-emerald-700 uppercase font-mono font-bold block">Detalle de Reparación:</span>
                      <span className="text-xs">{assignModal.orden.detalleReparacion}</span>
                    </div>
                  )}
                  {assignModal.orden.observaciones && (
                    <div className="pt-1.5 border-t border-zinc-200 text-zinc-700 font-sans">
                      <span className="text-[10px] text-zinc-500 uppercase font-mono font-bold block">Observaciones en CSV:</span>
                      <span className="text-xs italic">{assignModal.orden.observaciones}</span>
                    </div>
                  )}
                </div>

                {/* Campo de Detalle de Falla a Asignar */}
                <div className="space-y-2">
                  <label className="font-bold text-zinc-900 block uppercase font-mono text-[11px]">
                    Falla a Asignar / ¿Qué debe chequear el técnico? *
                  </label>
                  <textarea
                    rows={3}
                    required
                    autoFocus
                    value={assignModal.detalleFalla}
                    onChange={(e) => setAssignModal({ ...assignModal, detalleFalla: e.target.value })}
                    placeholder="Describa la falla que presenta el equipo o qué pruebas debe realizar el técnico en banco..."
                    className="w-full p-3 border border-zinc-200 rounded-lg outline-none focus:border-zinc-900 focus:bg-white bg-zinc-50 text-xs leading-relaxed transition-colors font-sans"
                  />

                  {/* Sugerencias Rápidas */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-mono block">Sugerencias rápidas:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "No enciende / Sin alimentación",
                        "Pantalla rota / Sin video",
                        "Sobrecalentamiento / Pasta térmica",
                        "Reinicios continuos / Pantalla azul",
                        "Problemas de audio / Parlantes",
                        "Revisión general en banco de pruebas"
                      ].map((sug) => (
                        <button
                          type="button"
                          key={sug}
                          onClick={() => {
                            const prev = assignModal.detalleFalla;
                            setAssignModal({
                              ...assignModal,
                              detalleFalla: prev ? `${prev} · ${sug}` : sug
                            });
                          }}
                          className="px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-[11px] text-zinc-700 transition-colors"
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Aviso informativo de WhaApi */}
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <Send className="w-3.5 h-3.5" />
                    Notificación Automática a WhaApi
                  </div>
                  <p className="text-emerald-700 leading-relaxed">
                    Al confirmar, se enviará la ficha técnica al <strong>Grupo Oficial de WhatsApp de Taller SATI</strong> y este detalle de falla aparecerá destacado en el panel de <strong>{assignModal.nombreTecnico}</strong>.
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setAssignModal(null)}
                    className="px-4 py-2 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold hover:bg-zinc-50 transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Confirmar Asignación &amp; Enviar a WhatsApp</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: FINALIZAR REPARACIÓN Y PREPARAR WHATSAPP (TÉCNICO)       */}
        {/* ============================================================== */}
        {repairModalOrden && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4 border border-zinc-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold uppercase tracking-wider">
                    FINALIZACIÓN DE SERVICIO TÉCNICO
                  </span>
                  <h3 className="text-base font-bold text-zinc-900">
                    Orden #{repairModalOrden.idOrden} · {repairModalOrden.equipo}
                  </h3>
                </div>
                <button
                  onClick={() => setRepairModalOrden(null)}
                  className="text-zinc-400 hover:text-zinc-900 text-lg font-bold p-1 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmRepair} className="space-y-4 text-xs">
                {/* Datos del Cliente y Falla */}
                <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 space-y-1.5">
                  <div className="flex justify-between font-mono">
                    <span className="text-zinc-500">CLIENTE:</span>
                    <strong className="text-zinc-900">{repairModalOrden.cliente}</strong>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-zinc-500">TÉCNICO RESPONSABLE:</span>
                    <strong className="text-zinc-900">{currentTecnico.nombre}</strong>
                  </div>
                  <div className="pt-1.5 p-2 rounded bg-amber-50 border border-amber-200 text-amber-950">
                    <span className="text-amber-800 font-bold block text-[10px] uppercase font-mono">
                      Falla Asignada a Chequear en Banco:
                    </span>
                    <p className="font-semibold mt-0.5">
                      {repairModalOrden.fallaReportada || "Sin falla específica detallada."}
                    </p>
                    {repairModalOrden.observaciones && (
                      <p className="text-[10px] text-zinc-600 font-mono mt-1 pt-1 border-t border-amber-200/50">
                        Observaciones previas: {repairModalOrden.observaciones}
                      </p>
                    )}
                  </div>
                </div>

                {/* Selección del Dictamen Técnico */}
                <div>
                  <label className="font-bold text-zinc-900 block mb-1.5 uppercase font-mono text-[11px]">
                    1. Dictamen Resolutivo Final *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalDictamen("REPARADO")}
                      className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                        modalDictamen === "REPARADO"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-semibold ring-2 ring-emerald-500/20"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs">Reparado</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalDictamen("CAMBIO_NUEVO")}
                      className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                        modalDictamen === "CAMBIO_NUEVO"
                          ? "border-teal-600 bg-teal-50 text-teal-800 font-semibold ring-2 ring-teal-500/20"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      <span className="text-xs">Cambio x Nuevo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalDictamen("SIN_DEFECTO")}
                      className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                        modalDictamen === "SIN_DEFECTO"
                          ? "border-zinc-700 bg-zinc-100 text-zinc-900 font-semibold ring-2 ring-zinc-500/20"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 text-zinc-600" />
                      <span className="text-xs">Sin Defecto</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalDictamen("NO_REPARADO")}
                      className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                        modalDictamen === "NO_REPARADO"
                          ? "border-rose-600 bg-rose-50 text-rose-800 font-semibold ring-2 ring-rose-500/20"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      <X className="w-4 h-4 text-rose-600" />
                      <span className="text-xs">Sin Reparo / RMA</span>
                    </button>
                  </div>
                </div>

                {/* Detalle Técnico de la Reparación */}
                <div>
                  <label className="font-bold text-zinc-900 block mb-1 uppercase font-mono text-[11px]">
                    2. Detalle de la Reparación y Pruebas Ejecutadas *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={modalDetalle}
                    onChange={(e) => setModalDetalle(e.target.value)}
                    placeholder="Describa el trabajo realizado en el equipo, calibraciones, pruebas de estrés..."
                    className="w-full p-2.5 border border-zinc-200 rounded-lg outline-none focus:border-zinc-900 focus:bg-white bg-zinc-50 text-xs leading-relaxed transition-colors"
                  />
                </div>

                {/* Repuestos / Insumos Utilizados */}
                <div>
                  <label className="font-bold text-zinc-900 block mb-1 uppercase font-mono text-[11px]">
                    3. Repuestos o Insumos Utilizados (Opcional)
                  </label>
                  <input
                    type="text"
                    value={modalRepuestos}
                    onChange={(e) => setModalRepuestos(e.target.value)}
                    placeholder="Ej. Cambio de display original, pasta térmica Arctic MX-4, flex de carga..."
                    className="w-full p-2.5 border border-zinc-200 rounded-lg outline-none focus:border-zinc-900 focus:bg-white bg-zinc-50 text-xs transition-colors"
                  />
                </div>

                <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setRepairModalOrden(null)}
                    className="px-4 py-2 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold hover:bg-zinc-50 transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Finalizar y Preparar WhatsApp</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL: DISPATCH AL GRUPO DE WHATSAPP                           */}
        {/* ============================================================== */}
        {whatsappDispatchModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4 border border-zinc-200">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h3 className="text-base font-bold text-zinc-900">
                    Notificación al Grupo de WhatsApp de Taller
                  </h3>
                </div>
                <button
                  onClick={() => setWhatsappDispatchModal(null)}
                  className="text-zinc-400 hover:text-zinc-900 text-lg font-bold p-1 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    Notificación enviada automáticamente vía <strong>WhaApi</strong> al grupo oficial de taller SATI.
                  </span>
                </div>

                <p className="text-xs text-zinc-600">
                  La orden <strong>#{whatsappDispatchModal.orden.idOrden}</strong> ({whatsappDispatchModal.orden.cliente}) está lista para notificación en el canal de{" "}
                  <strong>Taller &amp; Recepción de Retornos</strong>.
                </p>

                {/* Previsualización del Mensaje para el Grupo */}
                <div className="bg-zinc-50 p-3.5 rounded-lg border border-zinc-200 text-xs">
                  <div className="text-[10px] font-mono text-zinc-500 pb-1 border-b border-zinc-200 mb-2 flex justify-between">
                    <span>GRUPO: TALLER &amp; POST-VENTA NISSEI CDE</span>
                    <span className="text-emerald-700 font-semibold">WHAPI INTEGRATION · SENT</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-zinc-900 leading-relaxed">
                    {whatsappDispatchModal.mensaje}
                  </pre>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-200 flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => setWhatsappDispatchModal(null)}
                  className="px-4 py-2 border border-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold hover:bg-zinc-50 transition-colors"
                >
                  Cerrar
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      fetch("/api/whatsapp/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          channel: "TALLER",
                          body: whatsappDispatchModal.mensaje,
                        }),
                      })
                        .then(() => showToast("Mensaje reenviado al grupo vía WhaApi con éxito."))
                        .catch(() => showToast("Error al reenviar a WhaApi."));
                    }}
                    className="px-3.5 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Reenviar a WhaApi</span>
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(whatsappDispatchModal.mensaje)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setWhatsappDispatchModal(null)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <span>Abrir en WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
    </AuthGuard>
  );
}
