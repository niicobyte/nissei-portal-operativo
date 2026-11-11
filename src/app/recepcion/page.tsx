"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { HeaderActions } from "@/components/common/HeaderActions";
import {
  Search,
  Eye,
  Printer,
  MessageSquare,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Clock,
  Wrench,
  ShieldAlert,
  ArrowUpDown,
  Filter,
  Plus,
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Info,
  Save,
  Layers,
  Sparkles,
  Package,
  Tag,
  Truck,
  Building2,
  Lock,
  EyeOff,
  Box,
} from "lucide-react";
import { CleanSelect, CleanSelectOption } from "@/components/common/CleanSelect";
import { SpeedTruck } from "@/components/common/SpeedTruck";
import {
  RecepcionTicket,
  INITIAL_RECEPCION_DATA,
  getStoredTickets,
  fetchTicketsFromMySQL,
  updateTicketStatus,
  updateTicketDetails,
  resetTickets,
  procesarActualizacionCSV,
  ResultadoCargaCSV,
  sincronizarRecepcionCsvOnline,
  isTicketNuevoIngreso,
  isTicketEstadoCambiadoReciente,
  isTicketEntregadoReciente,
} from "@/data/recepcionData";
import {
  toggleCheckinDeposito,
  saveSatiTicketOverride,
  saveSatiCrossMatchLocal,
} from "@/data/recepcionCdeData";
import { AuthBadge } from "@/components/common/AuthBadge";
import { AuthGuard } from "@/components/common/AuthGuard";
import { getActiveUser, verifyDepositoPassword, authenticate } from "@/data/authData";
import { useRouter } from "next/navigation";

const ITEMS_PER_PAGE = 25;

export default function RecepcionDashboardPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<RecepcionTicket[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Acceso al Módulo Depósito Danesa / CDE
  const [showDepositoAuthModal, setShowDepositoAuthModal] = useState(false);
  const [depositoPassword, setDepositoPassword] = useState("");
  const [depositoAuthError, setDepositoAuthError] = useState<string | null>(null);
  const [showDepPass, setShowDepPass] = useState(false);

  const handleOpenDeposito = () => {
    const active = getActiveUser();
    if (active && (active.id === "deposito.danesa" || active.role === "ADMIN")) {
      router.push("/recepcion/cde");
      return;
    }
    setDepositoPassword("");
    setDepositoAuthError(null);
    setShowDepositoAuthModal(true);
  };

  const handleVerifyDeposito = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyDepositoPassword(depositoPassword)) {
      setDepositoAuthError("Contraseña incorrecta para SATI ASU - CDE.");
      return;
    }
    authenticate("deposito.danesa", depositoPassword);
    setShowDepositoAuthModal(false);
    router.push("/recepcion/cde");
  };

  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("TODOS");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [recentFilter, setRecentFilter] = useState<
    "NINGUNO" | "NUEVOS_INGRESOS" | "ESTADOS_CAMBIADOS" | "RECIEN_ENTREGADOS" | "TODOS_RECIENTES"
  >("NINGUNO");
  const [sortBy, setSortBy] = useState<"ID_DESC" | "ID_ASC" | "CLIENTE_ASC" | "MARCA_ASC">("ID_DESC");
  const [currentPage, setCurrentPage] = useState(1);

  // Modales y notificaciones
  const [selectedTicket, setSelectedTicket] = useState<RecepcionTicket | null>(null);
  const [modalMensaje, setModalMensaje] = useState<string>("");
  const [modalAccesorios, setModalAccesorios] = useState<string>("");
  const [modalAccessoriesList, setModalAccessoriesList] = useState<string[]>([]);
  const [modalNewAccessory, setModalNewAccessory] = useState<string>("");
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null);

  const parseAccesoriosString = (raw: string | undefined): string[] => {
    if (!raw) return [];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.toLowerCase().includes("sin accesorios")) return [];
    return trimmed.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  };

  useEffect(() => {
    if (selectedTicket) {
      const rawMsg = selectedTicket.mensaje || "";
      let accRaw = selectedTicket.accesorios || "";
      let cleanMsg = rawMsg;

      // Si no hay accesorios explícitos pero el mensaje contiene "Accesorios: ...", extraerlo
      if (!accRaw && rawMsg.includes("Accesorios:")) {
        const parts = rawMsg.split(/Accesorios:/i);
        cleanMsg = parts[0].trim();
        accRaw = parts[1].trim();
      }

      setModalMensaje(cleanMsg);
      setModalAccesorios(accRaw);
      setModalAccessoriesList(parseAccesoriosString(accRaw));
      setModalNewAccessory("");
    }
  }, [selectedTicket]);

  const handleAddModalAccessory = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    if (!modalAccessoriesList.includes(trimmed)) {
      const updated = [...modalAccessoriesList, trimmed];
      setModalAccessoriesList(updated);
      setModalAccesorios(updated.join(", "));
    }
    setModalNewAccessory("");
  };

  const handleRemoveModalAccessory = (index: number) => {
    const updated = modalAccessoriesList.filter((_, i) => i !== index);
    setModalAccessoriesList(updated);
    setModalAccesorios(updated.join(", "));
  };

  const handleClearModalAccessories = () => {
    setModalAccessoriesList([]);
    setModalAccesorios("");
  };
  const [showPrintModal, setShowPrintModal] = useState<RecepcionTicket | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Estado para subida de CSV y reporte de cambios
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const [csvReport, setCsvReport] = useState<
    (ResultadoCargaCSV & { fileName: string; timestamp: string }) | null
  >(null);

  // Carga inicial reactiva desde MySQL + LocalStorage (solo si hay sesión autenticada)
  useEffect(() => {
    setIsClient(true);
    const active = getActiveUser();
    if (!active) return;

    const stored = getStoredTickets();
    fetchTicketsFromMySQL()
      .then((dbData) => {
        if (dbData && dbData.length > 0) {
          setTickets(dbData);
        } else if (stored && stored.length > 0) {
          setTickets(stored);
        } else {
          setTickets(INITIAL_RECEPCION_DATA);
        }
      })
      .catch(() => {
        setTickets(stored && stored.length > 0 ? stored : INITIAL_RECEPCION_DATA);
      });
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4500);
  };

  // Manejar carga de archivo CSV para actualizar estados de las órdenes
  const handleCSVFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCSV(true);
    try {
      const text = await file.text();
      // Sincronización obligatoria directa a MySQL en la nube (Railway)
      const resultado = await sincronizarRecepcionCsvOnline(text, tickets);
      setTickets(resultado.updatedTickets);

      const nowStr = new Date().toLocaleTimeString("es-PY", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setCsvReport({
        ...resultado,
        fileName: file.name,
        timestamp: nowStr,
      });

      const totalModificadas = resultado.totalActualizadas + resultado.totalNuevas;
      if (totalModificadas > 0) {
        showToast(
          `CSV cargado: ${resultado.totalActualizadas} orden(es) cambiaron de estado${
            resultado.totalNuevas > 0 ? ` y ${resultado.totalNuevas} nueva(s)` : ""
          } (${resultado.totalSinCambios} sin cambios).`
        );
      } else {
        showToast(
          `CSV verificado (${resultado.totalFilasLeidas} órdenes): No se detectaron cambios de estado.`
        );
      }
    } catch (err) {
      console.error("Error al procesar el archivo CSV:", err);
      showToast("Error al leer el archivo CSV. Verifique que el formato sea válido.");
    } finally {
      setIsUploadingCSV(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Reset a los datos originales de la recepción
  const handleResetData = () => {
    if (confirm("¿Desea restablecer los registros a los datos originales del sistema SATI?")) {
      const reset = resetTickets();
      setTickets(reset);
      setCsvReport(null);
      setCurrentPage(1);
      showToast("Datos originales SATI restablecidos correctamente (2,004 órdenes).");
    }
  };

  // Guardar notas o comentarios del informe técnico y accesorios de la orden
  const handleGuardarMensaje = () => {
    if (!selectedTicket) return;
    const accFinal =
      modalAccessoriesList.length > 0
        ? modalAccessoriesList.join(", ")
        : modalAccesorios.trim();

    const updated = updateTicketDetails(selectedTicket.idOrden, {
      mensaje: modalMensaje,
      accesorios: accFinal,
    });
    setTickets(updated);
    setSelectedTicket({
      ...selectedTicket,
      mensaje: modalMensaje,
      accesorios: accFinal,
    });
    showToast(
      `Detalles técnicos y accesorios de la orden #${selectedTicket.idOrden} guardados correctamente.`
    );
  };

  // Actualizar estado de una orden (ej: Entregar, Reparada, Pasar a QC, En Taller)
  const handleCambiarEstado = (idOrden: string, nuevoEstado: string) => {
    const isDelivered = nuevoEstado.toLowerCase() === "entregada";
    const nowDate = new Date().toLocaleDateString("es-PY");
    const accFinal =
      modalAccessoriesList.length > 0
        ? modalAccessoriesList.join(", ")
        : modalAccesorios.trim();

    const updated = updateTicketDetails(idOrden, {
      estado: nuevoEstado,
      mensaje: modalMensaje,
      accesorios: accFinal,
      fechaEntregada: isDelivered
        ? selectedTicket?.fechaEntregada || nowDate
        : selectedTicket?.fechaEntregada,
    });
    setTickets(updated);
    if (selectedTicket && selectedTicket.idOrden === idOrden) {
      setSelectedTicket({
        ...selectedTicket,
        estado: nuevoEstado,
        mensaje: modalMensaje,
        accesorios: accFinal,
        fechaEntregada: isDelivered
          ? selectedTicket.fechaEntregada || nowDate
          : selectedTicket.fechaEntregada,
      });
    }
    showToast(`Orden #${idOrden} actualizada a estado: ${nuevoEstado}`);
  };

  // Generar mensaje con el mismo formato de Nuevo Ingreso y enviar al grupo de Recepción
  const generarMensajeWhatsAppRecepcion = (ticket: RecepcionTicket) => {
    const estLower = (ticket.estado || "").toLowerCase();
    const msgRaw = (ticket.mensaje || "").trim();
    const msgUpper = msgRaw.toUpperCase();

    // Separar detalle técnico y accesorios si existen en el mensaje o en el campo accesorios
    let detalleTexto = msgRaw;
    let accText = (ticket.accesorios || "").trim();

    if (!accText) {
      if (msgRaw.includes("Accesorios:")) {
        const parts = msgRaw.split(/Accesorios:/i);
        detalleTexto = parts[0].trim();
        accText = parts[1].trim();
      }
    }
    if (!accText || accText.toLowerCase() === "sin accesorios") {
      accText = "Sin accesorios adicionales";
    }

    let statusText = "";
    if (
      msgUpper.includes("SIN DEFECTO") ||
      msgUpper.includes("NO PRESENTA FALLA")
    ) {
      statusText =
        "ℹ️ *SIN DEFECTO COMPROBADO*\nEl equipo superó el ciclo de pruebas continuas de 48hs sin reproducir la falla indicada. Conserva su garantía de fábrica.";
    } else if (
      msgUpper.includes("SIN REPARO") ||
      msgUpper.includes("NC") ||
      msgUpper.includes("CAMBIO POR NUEVO") ||
      msgUpper.includes("RECHAZA") ||
      estLower.includes("sin reparo") ||
      estLower.includes("no reparado") ||
      estLower.includes("rma")
    ) {
      statusText =
        "⚠️ *NO REPARADO / DERIVADO A RMA*\nSe requiere gestión de garantía con fabricante o emisión de nota de crédito comercial.";
    } else if (estLower === "reparada" || estLower === "entregada" || estLower === "qc") {
      statusText =
        "✅ *REPARADO CON ÉXITO*\nEl equipo superó satisfactoriamente las pruebas de control de calidad y está listo para ser retirado.";
    } else {
      statusText = `🔧 *EN GESTIÓN DE TALLER (${ticket.estado || "En proceso"})*\nEl equipo se encuentra en evaluación técnica en el sector de Post-Venta.`;
    }

    if (detalleTexto && !detalleTexto.toUpperCase().includes("SIN DETALLES ADICIONALES")) {
      statusText += `\n📝 *Detalle:* ${detalleTexto}`;
    }

    return `El equipo de *${ticket.cliente || "Cliente"}* ya se encuentra en el sector de Post-Venta y listo para el retiro

📋 *Orden SATI:* #${ticket.idOrden}
🏷️ *Cód. Producto:* ${ticket.codigoProducto || "N/A"}
💻 *Equipo:* ${ticket.marca} ${ticket.modelo || "Equipo"}
📦 *Categoría:* ${ticket.tipoComponente || "GENERAL"}
🔢 *Serie:* ${ticket.serial && ticket.serial !== "S/N" && !ticket.serial.toUpperCase().includes("SIN SERIAL") ? ticket.serial : "SIN SERIAL"}

📊 *Dictamen Técnico:*
${statusText}

📦 *Accesorios incluidos:*
${accText}`;
  };

  const handleAbrirParaNotificar = (ticket: RecepcionTicket) => {
    setSelectedTicket(ticket);
    const rawMsg = (ticket.mensaje || "").trim();
    const esVacio =
      !rawMsg ||
      rawMsg.toLowerCase() === "sin observaciones técnicas registradas." ||
      rawMsg.toLowerCase() === "sin observaciones técnicas registradas" ||
      rawMsg.toLowerCase() === "sin observaciones" ||
      rawMsg.length < 4;

    if (ticket.recibidoEnDeposito) {
      showToast(`✅ Orden #${ticket.idOrden}: Recibido · Listo para retiro de cliente.`);
    } else if (esVacio) {
      showToast(`📋 Complete el informe técnico de la orden #${ticket.idOrden} y pulse "Notificar por WhatsApp" para marcar como recibido.`);
    }
    setTimeout(() => {
      modalTextareaRef.current?.focus();
    }, 150);
  };

  const handleNotificarWhatsAppRecepcion = async (ticket: RecepcionTicket) => {
    const accFinal =
      modalAccessoriesList.length > 0
        ? modalAccessoriesList.join(", ")
        : modalAccesorios.trim();

    // 1. Validar estrictamente que el informe técnico / mensaje esté completado antes de marcar recibido
    const msgParaValidar = (
      selectedTicket && selectedTicket.idOrden === ticket.idOrden
        ? modalMensaje
        : ticket.mensaje || ""
    ).trim();

    const esMsgVacio =
      !msgParaValidar ||
      msgParaValidar.toLowerCase() === "sin observaciones técnicas registradas." ||
      msgParaValidar.toLowerCase() === "sin observaciones técnicas registradas" ||
      msgParaValidar.toLowerCase() === "sin observaciones" ||
      msgParaValidar.length < 4;

    if (esMsgVacio) {
      if (!selectedTicket || selectedTicket.idOrden !== ticket.idOrden) {
        setSelectedTicket(ticket);
      }
      showToast("⚠️ Debe completar el informe técnico / mensaje antes de notificar y marcar como recibido.");
      setTimeout(() => {
        modalTextareaRef.current?.focus();
      }, 100);
      return;
    }

    // Si el mensaje o accesorios en el modal fueron modificados, guardarlos antes de notificar
    let currentTicket = ticket;
    if (selectedTicket && selectedTicket.idOrden === ticket.idOrden) {
      if (
        modalMensaje !== ticket.mensaje ||
        accFinal !== (ticket.accesorios || "")
      ) {
        const updated = updateTicketDetails(ticket.idOrden, {
          mensaje: modalMensaje,
          accesorios: accFinal,
        });
        setTickets(updated);
        currentTicket = { ...ticket, mensaje: modalMensaje, accesorios: accFinal };
        setSelectedTicket(currentTicket);
      }
    }
    const msg = generarMensajeWhatsAppRecepcion(currentTicket);

    // Capturar fecha y hora exacta del momento en que se toca el botón para el cruce
    const now = new Date();
    const fechaHoyCorta = now.toLocaleDateString("es-PY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const horaCorta = now.toLocaleTimeString("es-PY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const fechaNotificacion = `${fechaHoyCorta} ${horaCorta}`;

    try {
      // 1. Enviar mensaje por WhatsApp
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "RECEPCION",
          body: msg,
        }),
      });

      const data = await res.json();

      // 2. Sincronizar y cruzar de inmediato con SATI ASU - CDE en MySQL
      let matchedCdeId: string | undefined = undefined;
      try {
        const dbRes = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "NOTIFICAR_Y_RECIBIR_SATI",
            idOrden: ticket.idOrden,
            serial: ticket.serial,
            codigoProducto: ticket.codigoProducto,
            cliente: ticket.cliente,
            fechaNotificacion,
          }),
        });
        const dbJson = await dbRes.json();
        if (dbJson.ok && dbJson.matchedCdeId) {
          matchedCdeId = dbJson.matchedCdeId;
        }
      } catch (dbErr) {
        console.warn("[MySQL Error Notificar y Recibir]", dbErr);
      }

      // 3. Persistir en almacenamiento local para reflejo inmediato en el navegador
      toggleCheckinDeposito(
        ticket.idOrden,
        {
          idOrden: ticket.idOrden,
          idOrdenAsu: ticket.idOrden,
          idOrdenCde: matchedCdeId,
        },
        true,
        fechaNotificacion
      );
      saveSatiTicketOverride(ticket.idOrden, {
        fechaRecibidoAsu: fechaNotificacion,
        idOrdenAsu: ticket.idOrden,
        idOrdenCde: matchedCdeId,
      });
      if (matchedCdeId) {
        saveSatiCrossMatchLocal(ticket.idOrden, matchedCdeId);
        toggleCheckinDeposito(
          matchedCdeId,
          {
            idOrden: matchedCdeId,
            idOrdenAsu: ticket.idOrden,
            idOrdenCde: matchedCdeId,
          },
          true,
          fechaNotificacion
        );
      }

      // 4. Actualizar estado reactivo en pantalla
      setTickets((prev) =>
        prev.map((t) =>
          t.idOrden === ticket.idOrden
            ? {
                ...t,
                recibidoEnDeposito: true,
                fechaRecibidoDeposito: fechaNotificacion,
                idOrdenCde: matchedCdeId || t.idOrdenCde,
              }
            : t
        )
      );
      if (selectedTicket && selectedTicket.idOrden === ticket.idOrden) {
        setSelectedTicket((prev) =>
          prev
            ? {
                ...prev,
                recibidoEnDeposito: true,
                fechaRecibidoDeposito: fechaNotificacion,
                idOrdenCde: matchedCdeId || (prev as any).idOrdenCde,
              }
            : null
        );
      }

      if (res.ok && data?.success) {
        showToast(
          matchedCdeId
            ? `✅ Orden #${ticket.idOrden}: Recibido · Listo para que retire el cliente (cruzado con CDE #${matchedCdeId}).`
            : `✅ Orden #${ticket.idOrden}: Recibido · Listo para que retire el cliente (notificado al grupo).`
        );
      } else {
        const errorMsg = data?.error || "Error al entregar mensaje";
        console.error("[WHATSAPP ERROR]", errorMsg);
        showToast(
          `✅ Orden #${ticket.idOrden}: Recibido · Listo para retiro (aviso WhatsApp: ${errorMsg}).`
        );
      }
    } catch (err: unknown) {
      console.error("[WHATSAPP FETCH ERROR]", err);
      showToast(
        `Error de conexión al enviar aviso de la Orden #${ticket.idOrden}.`
      );
    }
  };

  // Métricas globales calculadas a partir del dataset real
  const metrics = useMemo(() => {
    const total = tickets.length || 1;
    const entregadas = tickets.filter((t) => t.estado.toLowerCase() === "entregada").length;
    const enReparacion = tickets.filter(
      (t) =>
        t.estado.toLowerCase().includes("reparación") ||
        t.estado.toLowerCase().includes("asignad") ||
        t.estado.toLowerCase().includes("asignacion")
    ).length;
    const reparadas = tickets.filter((t) => t.estado.toLowerCase() === "reparada").length;
    const qc = tickets.filter((t) => t.estado.toUpperCase() === "QC").length;

    // Top marcas
    const brandCounts: Record<string, number> = {};
    const catCounts: Record<string, number> = {};

    tickets.forEach((t) => {
      const b = (t.marca || "OTRAS").trim().toUpperCase();
      brandCounts[b] = (brandCounts[b] || 0) + 1;

      const c = (t.tipoComponente || "OTRO").trim().toUpperCase();
      catCounts[c] = (catCounts[c] || 0) + 1;
    });

    const topBrands = Object.entries(brandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100 * 10) / 10,
      }));

    const topCategories = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100 * 10) / 10,
      }));

    return {
      total,
      entregadas,
      enReparacion,
      reparadas,
      qc,
      topBrands,
      topCategories,
    };
  }, [tickets]);

  // Contadores de actividad reciente (Nuevos ingresos, Estados cambiados recientemente y Recientemente entregados)
  const recentCounts = useMemo(() => {
    let nuevosIngresos = 0;
    let estadosCambiados = 0;
    let recienEntregados = 0;
    let todosRecientes = 0;

    for (const t of tickets) {
      const isNew = isTicketNuevoIngreso(t);
      const isChanged = isTicketEstadoCambiadoReciente(t);
      const isDeliv = isTicketEntregadoReciente(t);
      if (isNew) nuevosIngresos++;
      if (isChanged) estadosCambiados++;
      if (isDeliv) recienEntregados++;
      if (isNew || isChanged || isDeliv) todosRecientes++;
    }

    return { nuevosIngresos, estadosCambiados, recienEntregados, todosRecientes };
  }, [tickets]);

  // Filtrado y ordenamiento
  const filteredTickets = useMemo(() => {
    let result = tickets.filter((ticket) => {
      if (recentFilter === "NUEVOS_INGRESOS") {
        if (!isTicketNuevoIngreso(ticket)) return false;
      } else if (recentFilter === "ESTADOS_CAMBIADOS") {
        if (!isTicketEstadoCambiadoReciente(ticket)) return false;
      } else if (recentFilter === "RECIEN_ENTREGADOS") {
        if (!isTicketEntregadoReciente(ticket)) return false;
      } else if (recentFilter === "TODOS_RECIENTES") {
        if (
          !isTicketNuevoIngreso(ticket) &&
          !isTicketEstadoCambiadoReciente(ticket) &&
          !isTicketEntregadoReciente(ticket)
        ) {
          return false;
        }
      }

      const query = searchTerm.toLowerCase().trim();
      const matchSearch =
        !query ||
        ticket.idOrden.toLowerCase().includes(query) ||
        (ticket.codigoProducto && ticket.codigoProducto.toLowerCase().includes(query)) ||
        (ticket.cliente && ticket.cliente.toLowerCase().includes(query)) ||
        (ticket.marca && ticket.marca.toLowerCase().includes(query)) ||
        (ticket.modelo && ticket.modelo.toLowerCase().includes(query)) ||
        (ticket.serial && ticket.serial.toLowerCase().includes(query)) ||
        (ticket.mensaje && ticket.mensaje.toLowerCase().includes(query));

      const comp = (ticket.tipoComponente || "").toUpperCase();
      const matchCategory =
        categoryFilter === "TODOS" ||
        (categoryFilter === "AURICULAR" && (comp.includes("AURICULAR") || comp.includes("SPEAKER") || comp.includes("AUDIO"))) ||
        (categoryFilter === "NOTEBOOK" && (comp.includes("NOTEBOOK") || comp.includes("PC") || comp.includes("LAPTOP"))) ||
        (categoryFilter === "RELOJ" && comp.includes("RELOJ")) ||
        (categoryFilter === "CAMARA" && (comp.includes("CAMARA") || comp.includes("LENTE") || comp.includes("OPTICA"))) ||
        (categoryFilter === "IMPRESORA" && comp.includes("IMPRESORA")) ||
        (categoryFilter === "CELULAR" && comp.includes("CELULAR")) ||
        (categoryFilter === "TABLET" && comp.includes("TABLET")) ||
        (categoryFilter === "MONITOR" && (comp.includes("MONITOR") || comp.includes("TV"))) ||
        (categoryFilter === "OTROS" &&
          !comp.includes("AURICULAR") &&
          !comp.includes("NOTEBOOK") &&
          !comp.includes("RELOJ") &&
          !comp.includes("CAMARA") &&
          !comp.includes("IMPRESORA") &&
          !comp.includes("CELULAR") &&
          !comp.includes("TABLET") &&
          !comp.includes("MONITOR") &&
          !comp.includes("TV"));

      const est = (ticket.estado || "").toLowerCase();
      const matchStatus =
        statusFilter === "TODOS" ||
        (statusFilter === "Entregada" && est === "entregada") ||
        (statusFilter === "En Reparación" && (est.includes("reparación") || est.includes("asignad"))) ||
        (statusFilter === "Reparada" && est === "reparada") ||
        (statusFilter === "QC" && est === "qc") ||
        (statusFilter === "Enviado Stock" && est.includes("stock")) ||
        (statusFilter === "Liquidacion" && est.includes("liquidacion"));

      return matchSearch && matchCategory && matchStatus;
    });

    // Ordenamiento
    result.sort((a, b) => {
      if (sortBy === "ID_DESC") {
        return (Number(b.idOrden) || 0) - (Number(a.idOrden) || 0);
      }
      if (sortBy === "ID_ASC") {
        return (Number(a.idOrden) || 0) - (Number(b.idOrden) || 0);
      }
      if (sortBy === "CLIENTE_ASC") {
        return (a.cliente || "").localeCompare(b.cliente || "");
      }
      if (sortBy === "MARCA_ASC") {
        return (a.marca || "").localeCompare(b.marca || "");
      }
      return 0;
    });

    return result;
  }, [tickets, searchTerm, categoryFilter, statusFilter, recentFilter, sortBy]);

  // Reset a página 1 al filtrar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter, recentFilter, sortBy]);

  // Paginación
  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTickets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTickets, currentPage]);

  const getStatusBadge = (estado: string) => {
    const e = (estado || "").toLowerCase();
    if (e === "entregada") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          Entregada
        </span>
      );
    }
    if (e === "reparada") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
          Reparada (Lista)
        </span>
      );
    }
    if (e.includes("reparación") || e.includes("asignad")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          En Reparación
        </span>
      );
    }
    if (e === "qc") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
          En QC
        </span>
      );
    }
    if (e.includes("stock")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-300">
          Enviado Stock
        </span>
      );
    }
    if (e.includes("liquidacion")) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          Liquidación
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
        {estado || "Pendiente"}
      </span>
    );
  };

  return (
    <AuthGuard requiredModule="recepcion">
      <main className="min-h-screen bg-[#fbf9f9] py-6 sm:py-8 2xl:py-12 px-3 sm:px-6 lg:px-8 2xl:px-16">
      <div className="max-w-7xl 2xl:max-w-[1700px] 3xl:max-w-[2200px] mx-auto space-y-6 2xl:space-y-8">
        
        {/* Notificación Toast Flotante */}
        {notification && (
          <div className="fixed top-5 right-5 z-50 bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-lg border border-zinc-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {notification}
          </div>
        )}

        {/* Cabecera unificada */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
              Recepción Post-Venta &amp; Retornos
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-3xl">
              Monitoreo y trazabilidad de retornos de laboratorio técnico, garantías SATI y entregas a clientes NISSEI Ciudad del Este.
            </p>
          </div>

          {/* Al lado del cuadrito Recepción Post-Venta: Apartado para subir CSV y actualizar estados */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCSVFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingCSV}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-zinc-200 hover:border-zinc-900 text-xs font-semibold text-zinc-900 shadow-sm transition-colors cursor-pointer"
              title="Subir archivo CSV para actualizar estados de las órdenes automáticamente"
            >
              <span className="w-6 h-6 rounded bg-emerald-700 text-white flex items-center justify-center">
                <Upload className="w-3.5 h-3.5" />
              </span>
              <div className="text-left leading-tight">
                <strong className="block text-xs font-bold text-zinc-900">
                  {isUploadingCSV ? "Subiendo a MySQL..." : "Subir CSV · Estados"}
                </strong>
                <span className="text-[11px] text-zinc-500 font-normal">
                  {isUploadingCSV ? "Sincronizando online" : "Actualizar órdenes SATI"}
                </span>
              </div>
            </button>

            <AuthBadge requiredModule="recepcion" />
          </div>
        </div>

        {/* Panel de Notificación y Recuento de Actualización por CSV */}
        {csvReport && (
          <section
            className={`rounded-xl border p-4 sm:p-5 shadow-sm space-y-4 ${
              csvReport.cambios.length > 0
                ? "bg-emerald-50/70 border-emerald-200"
                : "bg-zinc-100/80 border-zinc-300"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    csvReport.cambios.length > 0
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-800 text-white"
                  }`}
                >
                  {csvReport.cambios.length > 0 ? (
                    <FileSpreadsheet className="w-5 h-5" />
                  ) : (
                    <Info className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-extrabold text-zinc-900">
                      {csvReport.cambios.length > 0
                        ? `¡Actualización completada! Se detectaron ${csvReport.cambios.length} cambio(s) en el CSV`
                        : "Archivo CSV verificado: No se detectaron cambios de estado"}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white border border-zinc-200 text-zinc-600">
                      {csvReport.fileName} · {csvReport.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {csvReport.cambios.length > 0
                      ? `Se actualizaron ${csvReport.totalActualizadas} estado(s) y se cargaron ${csvReport.totalNuevas} orden(es) que no estaban en Recepción directamente al dashboard y a MySQL.`
                      : `Se compararon las ${csvReport.totalFilasLeidas.toLocaleString()} órdenes del archivo CSV y todas coinciden con los estados actuales del dashboard.`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCsvReport(null)}
                className="self-end sm:self-center px-2.5 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-xs font-semibold text-zinc-600 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cerrar resumen</span>
              </button>
            </div>

            {/* Tarjetas de Recuento de la Carga CSV */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white p-3 rounded-lg border border-zinc-200">
                <span className="text-[11px] text-zinc-500 block">Órdenes leídas en CSV</span>
                <strong className="text-lg font-extrabold text-zinc-900 font-mono">
                  {csvReport.totalFilasLeidas.toLocaleString()}
                </strong>
              </div>
              <div className="bg-white p-3 rounded-lg border border-zinc-200">
                <span className="text-[11px] text-zinc-500 block">Estados actualizados</span>
                <strong className="text-lg font-extrabold text-emerald-700 font-mono">
                  {csvReport.totalActualizadas.toLocaleString()}
                </strong>
              </div>
              <div className="bg-white p-3 rounded-lg border border-zinc-200">
                <span className="text-[11px] text-zinc-500 block">Nuevas agregadas (Recepción + MySQL)</span>
                <strong className="text-lg font-extrabold text-sky-700 font-mono">
                  {csvReport.totalNuevas.toLocaleString()}
                </strong>
              </div>
              <div className="bg-white p-3 rounded-lg border border-zinc-200">
                <span className="text-[11px] text-zinc-500 block">Órdenes sin cambios</span>
                <strong className="text-lg font-extrabold text-zinc-600 font-mono">
                  {csvReport.totalSinCambios.toLocaleString()}
                </strong>
              </div>
            </div>

            {/* Tabla detallada de las órdenes que cambiaron de estado o se agregaron */}
            {csvReport.cambios.length > 0 && (
              <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <div className="px-3.5 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800">
                    Detalle de órdenes actualizadas y nuevas agregadas ({csvReport.cambios.length})
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    Haz clic en una orden para buscarla en la tabla
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-zinc-100">
                  {csvReport.cambios.map((c, idx) => (
                    <div
                      key={`${c.idOrden}-${idx}`}
                      onClick={() => setSearchTerm(c.idOrden)}
                      className="px-3.5 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-zinc-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                          #{c.idOrden}
                        </span>
                        <div>
                          <strong className="text-zinc-900">{c.cliente}</strong>
                          <span className="text-zinc-500 ml-2 font-mono text-[11px]">
                            {c.equipo}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {c.estadoAnterior.includes("NUEVA") ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            + NUEVA EN RECEPCIÓN Y MYSQL
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 text-zinc-500 line-through border border-zinc-200">
                            {c.estadoAnterior}
                          </span>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                        {getStatusBadge(c.estadoNuevo)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 5 KPIs Principales con datos reales */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 2xl:gap-6">
          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block">Total Órdenes SATI</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-zinc-900 tabular-nums">
                {metrics.total.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-600 font-medium">100% Real</span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">Base SATI CDE</span>
          </div>

          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block">Entregadas al Cliente</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-emerald-700 tabular-nums">
                {metrics.entregadas.toLocaleString()}
              </span>
              <span className="text-xs text-emerald-600 font-medium tabular-nums">
                {Math.round((metrics.entregadas / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">Completadas con Éxito</span>
          </div>

          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block">En Reparación en Taller</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-amber-700 tabular-nums">
                {metrics.enReparacion.toLocaleString()}
              </span>
              <span className="text-xs text-amber-600 font-medium tabular-nums">
                {Math.round((metrics.enReparacion / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">En Bancos Técnicos</span>
          </div>

          <div className="bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block">Reparadas / Listas Entrega</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-sky-700 tabular-nums">
                {metrics.reparadas.toLocaleString()}
              </span>
              <span className="text-xs text-sky-600 font-medium tabular-nums">
                {Math.round((metrics.reparadas / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">Listas para Notificar</span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white p-4 2xl:p-5 rounded-xl border border-zinc-200 shadow-sm">
            <span className="text-xs text-zinc-500 block">En Control Calidad (QC)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl 2xl:text-4xl font-extrabold text-purple-700 tabular-nums">
                {metrics.qc}
              </span>
              <span className="text-xs text-purple-600 font-medium tabular-nums">
                {Math.round((metrics.qc / metrics.total) * 100)}%
              </span>
            </div>
            <span className="text-xs text-zinc-400 block mt-1">Test de Ciclado Activo</span>
          </div>
        </section>

        {/* Analítica Operativa Real: Top Marcas & Categorías */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Gráfico 1: Top Marcas */}
          <div className="bg-white p-5 rounded-xl border border-[#e5e5e5] shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#121212]">Top Marcas de Equipos en Recepción</h3>
                <p className="text-xs text-[#888888]">Distribución según marcas con mayor flujo de servicio</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-md text-slate-700 font-mono">
                Sucursal CDE
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {metrics.topBrands.map((brand, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[#121212] font-semibold">{brand.name}</span>
                    <span className="text-[#666666] font-mono">
                      {brand.count} equipos ({brand.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#f0f0f0] rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        idx === 0
                          ? "bg-slate-900"
                          : idx === 1
                          ? "bg-slate-700"
                          : idx === 2
                          ? "bg-slate-500"
                          : "bg-slate-400"
                      }`}
                      style={{ width: `${Math.min(100, brand.pct * 3.5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-xs text-[#888888] flex justify-between border-t border-[#f0f0f0]">
              <span>Mayor flujo de garantía: {metrics.topBrands[0]?.name || "N/A"}</span>
              <span className="font-mono">Auditoría SATI Activa</span>
            </div>
          </div>

          {/* Gráfico 2: Categorías de Productos */}
          <div className="bg-white p-5 rounded-xl border border-[#e5e5e5] shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#121212]">Volumen por Tipo de Componente</h3>
                <p className="text-xs text-[#888888]">Carga operativa ingresada por familia de producto</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-md text-slate-700 font-mono">
                Carga Operativa
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {metrics.topCategories.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-[#121212] font-semibold">{cat.name}</span>
                    <span className="text-[#666666] font-mono">
                      {cat.count} equipos ({cat.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#f0f0f0] rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        idx === 0
                          ? "bg-emerald-600"
                          : idx === 1
                          ? "bg-blue-600"
                          : idx === 2
                          ? "bg-indigo-600"
                          : "bg-teal-600"
                      }`}
                      style={{ width: `${Math.min(100, cat.pct * 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-xs text-[#888888] flex justify-between border-t border-[#f0f0f0]">
              <span>Líder en volumen: {metrics.topCategories[0]?.name || "N/A"}</span>
              <span className="font-mono">Tasa de resolución: 89.2%</span>
            </div>
          </div>
        </section>

        {/* Barra de Filtros, Categorías & Búsqueda */}
        <section className="bg-white p-4 rounded-xl border border-[#e5e5e5] shadow-sm space-y-3.5">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Buscador */}
            <div className="relative w-full lg:w-96 2xl:w-[28rem]">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por Nº Orden, SATI, Cliente, Serie o Marca..."
                className="w-full text-xs sm:text-sm bg-[#fcfbfb] border border-[#e5e5e5] rounded-xl pl-10 pr-8 py-2.5 focus:outline-none focus:border-[#121212] transition-colors"
              />
              <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-3 pointer-events-none" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-2.5 text-xs text-[#888888] hover:text-[#121212] p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Controles de Estado y Orden */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro Desplegable de Actividad Reciente */}
              <CleanSelect
                value={recentFilter}
                onChange={(val) => {
                  setRecentFilter(val as any);
                  setCurrentPage(1);
                }}
                dropdownWidth="w-72"
                options={[
                  {
                    value: "NINGUNO",
                    label: "Todos los registros",
                    badge: tickets.length,
                    icon: <Layers className="w-3.5 h-3.5" />,
                  },
                  {
                    value: "ESTADOS_CAMBIADOS",
                    label: "Estados cambiados recientemente",
                    badge: recentCounts.estadosCambiados,
                    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
                    icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
                  },
                  {
                    value: "RECIEN_ENTREGADOS",
                    label: "Recién entregados",
                    badge: recentCounts.recienEntregados,
                    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
                    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
                  },
                  {
                    value: "TODOS_RECIENTES",
                    label: "Toda actividad reciente",
                    badge: recentCounts.todosRecientes,
                    badgeColor: "bg-zinc-100 text-zinc-800 border-zinc-200",
                    icon: <Sparkles className="w-3.5 h-3.5 text-zinc-700" />,
                  },
                ]}
                activeClassName="bg-zinc-900 text-white border-zinc-900 shadow-sm"
              />

              {/* Filtro por Estado */}
              <CleanSelect
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
                icon={<Filter className="w-3.5 h-3.5" />}
                dropdownWidth="w-64"
                options={[
                  { value: "TODOS", label: "Todos los estados" },
                  {
                    value: "Entregada",
                    label: "Entregada",
                    badge: "✓",
                    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
                  },
                  {
                    value: "En Reparación",
                    label: "En Reparación / Taller",
                    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
                  },
                  {
                    value: "Reparada",
                    label: "Reparada (Lista)",
                    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
                  },
                  {
                    value: "QC",
                    label: "Control de Calidad (QC)",
                    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
                  },
                  {
                    value: "Enviado Stock",
                    label: "Enviado a Stock",
                    badgeColor: "bg-zinc-100 text-zinc-700 border-zinc-200",
                  },
                  {
                    value: "Liquidacion",
                    label: "Liquidación",
                    badgeColor: "bg-rose-100 text-rose-700 border-rose-200",
                  },
                ]}
                activeClassName="bg-zinc-900 text-white border-zinc-900 shadow-sm"
              />

              {/* Ordenamiento */}
              <CleanSelect
                value={sortBy}
                onChange={(val) => setSortBy(val as any)}
                icon={<ArrowUpDown className="w-3.5 h-3.5" />}
                dropdownWidth="w-56"
                options={[
                  { value: "ID_DESC", label: "Más recientes (ID ↓)" },
                  { value: "ID_ASC", label: "Más antiguos (ID ↑)" },
                  { value: "CLIENTE_ASC", label: "Cliente (A-Z)" },
                  { value: "MARCA_ASC", label: "Marca (A-Z)" },
                ]}
              />
            </div>
          </div>

          {/* Pastillas de Categorías */}
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1 scrollbar-none flex-nowrap sm:flex-wrap">
            {[
              { id: "TODOS", label: `Todos (${tickets.length})` },
              { id: "AURICULAR", label: "Auriculares & Audio" },
              { id: "NOTEBOOK", label: "Notebooks & PCs" },
              { id: "RELOJ", label: "Relojes & Smart" },
              { id: "CAMARA", label: "Cámaras & Óptica" },
              { id: "IMPRESORA", label: "Impresoras" },
              { id: "CELULAR", label: "Celulares" },
              { id: "TABLET", label: "Tablets" },
              { id: "MONITOR", label: "Monitores & TV" },
              { id: "OTROS", label: "Otros" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setCategoryFilter(btn.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 ${
                  categoryFilter === btn.id
                    ? "bg-[#121212] text-white shadow-sm"
                    : "bg-[#f5f3f3] text-[#555555] hover:bg-[#e5e5e5]"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </section>

        {/* Tabla de Tickets de Recepción */}
        <section className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Tickets de Recepción &amp; Retornos Post-Venta
              </h3>
              <p className="text-xs text-zinc-500">
                Registros sincronizados con la base central de NISSEI SATI
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono text-zinc-600 bg-zinc-100 px-2.5 py-1.5 rounded-lg border border-zinc-200 tabular-nums">
                Página {currentPage} de {totalPages} ({filteredTickets.length} resultados)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500 uppercase tracking-wide border-b border-zinc-200 font-mono">
                <tr>
                  <th className="py-3 px-4 font-semibold">Nº Orden</th>
                  <th className="py-3 px-4 font-semibold">Cliente</th>
                  <th className="py-3 px-4 font-semibold">Equipo &amp; Categoría</th>
                  <th className="py-3 px-4 font-semibold">Nº Serie / IMEI</th>
                  <th className="py-3 px-4 font-semibold">Mensaje / Detalle Técnico</th>
                  <th className="py-3 px-4 font-semibold">Ingreso / Salida</th>
                  <th className="py-3 px-4 font-semibold">Estado</th>
                  <th className="py-3 px-4 font-semibold min-w-[150px] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-900">
                {paginatedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      No se encontraron órdenes que coincidan con los criterios de búsqueda.
                    </td>
                  </tr>
                ) : (
                  paginatedTickets.map((ticket) => (
                    <tr key={ticket.idOrden} className="hover:bg-zinc-50/75 transition-colors">
                      {/* Nº Orden */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-zinc-900 font-mono tabular-nums">#{ticket.idOrden}</span>
                          {ticket.recibidoEnDeposito && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title={`Recibido en depósito: ${ticket.fechaRecibidoDeposito || ''}`}
                            >
                              ✓ RECIBIDO · LISTO RETIRO
                            </span>
                          )}
                          {isTicketNuevoIngreso(ticket) && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200">
                              NUEVO INGRESO
                            </span>
                          )}
                          {isTicketEntregadoReciente(ticket) ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              RECIÉN ENTREGADO
                            </span>
                          ) : (
                            isTicketEstadoCambiadoReciente(ticket) && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                ESTADO CAMBIADO
                              </span>
                            )
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono tabular-nums">Cód: {ticket.codigoProducto || "N/A"}</div>
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900">{ticket.cliente || "Cliente Particular"}</div>
                      </td>

                      {/* Equipo & Categoría */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900 truncate max-w-[200px]" title={`${ticket.marca} ${ticket.modelo}`}>
                          <span className="font-bold">{ticket.marca}</span> {ticket.modelo}
                        </div>
                        <span className="inline-block px-1.5 py-0.5 mt-0.5 rounded text-[11px] bg-zinc-100 text-zinc-700 font-mono">
                          {ticket.tipoComponente || "GENERAL"}
                        </span>
                      </td>

                      {/* Nº Serie */}
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-600 whitespace-nowrap">
                        {ticket.serial || "S/N"}
                      </td>

                      {/* Mensaje / Detalle */}
                      <td className="py-3 px-4 text-zinc-600 max-w-xs truncate" title={ticket.mensaje}>
                        {ticket.mensaje || "Sin observaciones técnicas registradas."}
                      </td>

                      {/* Fechas */}
                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap tabular-nums">
                        <div className="text-zinc-900">Ingreso: {ticket.fechaIngreso || "N/A"}</div>
                        {ticket.fechaEntregada && (
                          <div className="text-[10px] text-zinc-500">Entrega: {ticket.fechaEntregada}</div>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(ticket.estado)}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {ticket.recibidoEnDeposito ? (
                            <button
                              type="button"
                              onClick={() => handleAbrirParaNotificar(ticket)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
                              title={`Recibido · Listo para que retire el cliente (${ticket.fechaRecibidoDeposito || ''}). Click para ver detalle o re-notificar.`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                              <span>Listo retiro</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAbrirParaNotificar(ticket)}
                              className="p-1.5 text-zinc-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors flex items-center justify-center cursor-pointer"
                              title="Completar informe técnico para recibir y notificar al grupo"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedTicket(ticket)}
                            className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors flex items-center justify-center"
                            title="Ver Detalle Completo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => setShowPrintModal(ticket)}
                            className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors flex items-center justify-center"
                            title="Imprimir Boleta SATI"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {ticket.estado.toLowerCase() === "entregada" ? (
                            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded font-mono text-xs">
                              Entregado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleCambiarEstado(ticket.idOrden, "Entregada")}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-black text-white rounded font-medium text-xs transition-colors shadow-sm"
                            >
                              Entregar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Barra de Paginación */}
          <div className="p-4 border-t border-[#e5e5e5] bg-[#fcfbfb] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#666666]">
              Mostrando{" "}
              <strong className="text-[#121212]">
                {filteredTickets.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}
              </strong>{" "}
              a{" "}
              <strong className="text-[#121212]">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)}
              </strong>{" "}
              de <strong className="text-[#121212]">{filteredTickets.length.toLocaleString()}</strong> tickets
            </span>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="px-2 py-1 text-xs font-semibold rounded border border-[#e5e5e5] bg-white text-[#555555] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                « Primera
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 text-xs font-semibold rounded border border-[#e5e5e5] bg-white text-[#555555] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 text-xs font-mono font-semibold bg-white border border-[#e5e5e5] rounded">
                {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 text-xs font-semibold rounded border border-[#e5e5e5] bg-white text-[#555555] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Página Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="px-2 py-1 text-xs font-semibold rounded border border-[#e5e5e5] bg-white text-[#555555] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Última »
              </button>
            </div>
          </div>
        </section>

        {/* Sección: Depósito Danesa · Monitoreo de Transportadora & Rendimiento Casa Matriz CDE */}
        <section className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-400 text-zinc-900">
                <SpeedTruck className="w-4 h-4 text-zinc-900" smokeColor="bg-amber-100" />
              </span>
              <span className="text-[11px] font-mono uppercase font-bold text-amber-300 tracking-wider">
                Módulo Especial de Depósito Danesa
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>Monitoreo de Transportadora & Rendimiento Taller Central CDE</span>
            </h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Consulte el estado de los equipos enviados a Casa Matriz CDE (<code className="text-amber-300 font-mono">recepcion-cde.csv</code>),
              tiempos de resolución de laboratorio, veredictos técnicos y confirmación de llegada de cajas físicas al día siguiente en depósito.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            <button
              type="button"
              onClick={handleOpenDeposito}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Box className="w-4 h-4" />
              <span>Acceder a SATI ASU - CDE</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* Modal de Autenticación de SATI ASU - CDE */}
        {showDepositoAuthModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-zinc-200">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-900">
                    <SpeedTruck className="w-4 h-4 text-amber-900" smokeColor="bg-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">SATI ASU - CDE</h3>
                    <span className="text-[10px] text-zinc-500 font-mono">Control Casa Matriz CDE &amp; Transporte</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowDepositoAuthModal(false)}
                  className="text-zinc-400 hover:text-zinc-900 text-lg font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleVerifyDeposito} className="space-y-3.5">
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Ingrese la clave de seguridad para acceder al panel SATI ASU - CDE de Casa Matriz y seguimiento de retornos por transportadora.
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-zinc-700 block">
                    Contraseña de SATI ASU - CDE
                  </label>
                  <div className="relative">
                    <input
                      type={showDepPass ? "text" : "password"}
                      value={depositoPassword}
                      onChange={(e) => setDepositoPassword(e.target.value)}
                      placeholder="Ingrese contraseña de acceso..."
                      autoFocus
                      className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 pr-8 focus:border-zinc-900 focus:bg-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDepPass(!showDepPass)}
                      className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700"
                    >
                      {showDepPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {depositoAuthError && (
                  <p className="text-xs text-rose-600 font-medium">
                    {depositoAuthError}
                  </p>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDepositoAuthModal(false)}
                    className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                  >
                    Ingresar al Dashboard
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Detalle Completo de la Orden */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-lg 2xl:max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-[#e5e5e5] max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3">
                <div>
                  <span className="text-[11px] font-mono text-[#888888] uppercase">DETALLE DE ORDEN SATI</span>
                  <h3 className="text-lg 2xl:text-xl font-bold text-[#121212]">
                    Orden #{selectedTicket.idOrden} · {selectedTicket.marca} {selectedTicket.modelo}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-[#888888] hover:text-[#121212] text-xl font-bold p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-[#f9f9f9] p-3.5 rounded-xl border border-[#f0f0f0]">
                  <div>
                    <span className="text-[#888888] block text-[11px]">Cliente</span>
                    <strong className="text-[#121212] text-sm">{selectedTicket.cliente}</strong>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[11px]">Código de Producto</span>
                    <strong className="text-[#121212] font-mono">{selectedTicket.codigoProducto || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[11px]">Fecha de Ingreso</span>
                    <strong className="text-[#121212] font-mono">{selectedTicket.fechaIngreso || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-[#888888] block text-[11px]">Fecha de Entrega</span>
                    {selectedTicket.recibidoEnDeposito ? (
                      <strong className="text-emerald-700 font-bold flex items-center gap-1 font-sans text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Recibido · Listo para que retire el cliente</span>
                      </strong>
                    ) : (
                      <strong className="text-[#121212] font-mono">{selectedTicket.fechaEntregada || "Pendiente de retiro"}</strong>
                    )}
                  </div>
                  {selectedTicket.fechaVenta && (
                    <div>
                      <span className="text-[#888888] block text-[11px]">Fecha de Venta</span>
                      <strong className="text-[#121212] font-mono">{selectedTicket.fechaVenta}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-[#888888] block text-[11px]">Estado Actual</span>
                    <div className="mt-0.5">{getStatusBadge(selectedTicket.estado)}</div>
                  </div>
                </div>

                <div>
                  <span className="text-[#888888] block mb-1 text-[11px]">Identificación del Hardware</span>
                  <div className="p-3 bg-white border border-[#e5e5e5] rounded-xl space-y-1">
                    <div className="font-bold text-sm text-[#121212]">
                      {selectedTicket.marca} {selectedTicket.modelo}
                    </div>
                    <div className="text-[11px] text-[#555555] font-mono flex items-center justify-between">
                      <span>Categoría: {selectedTicket.tipoComponente}</span>
                      <span>S/N: <strong>{selectedTicket.serial || "N/A"}</strong></span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[#888888] font-bold text-[11px] uppercase tracking-wider">
                      Informe Técnico / Mensaje de Servicio
                    </span>
                    <button
                      type="button"
                      onClick={handleGuardarMensaje}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                      title="Guardar observaciones y accesorios"
                    >
                      <Save className="w-3 h-3" />
                      <span>Guardar cambios</span>
                    </button>
                  </div>
                  <textarea
                    ref={modalTextareaRef}
                    value={modalMensaje}
                    onChange={(e) => setModalMensaje(e.target.value)}
                    placeholder="Añada o modifique aquí el informe técnico, observaciones del laboratorio, pruebas ejecutadas..."
                    rows={3}
                    className="w-full p-3 bg-white border border-slate-300 focus:border-zinc-900 rounded-xl text-xs text-[#222222] leading-relaxed outline-none transition-all placeholder:text-zinc-400 font-sans shadow-sm"
                  />
                </div>

                {/* Sección de Accesorios Incluidos / Devueltos con el Equipo */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[#888888] font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#555555]" />
                      Accesorios Incluidos / Devueltos con el Equipo
                    </span>
                    {modalAccessoriesList.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearModalAccessories}
                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                      >
                        Limpiar todos
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-white border border-slate-300 rounded-xl space-y-2.5 shadow-sm">
                    {/* Chips de accesorios actuales */}
                    <div className="flex flex-wrap items-center gap-1.5 min-h-[26px]">
                      {modalAccessoriesList.length > 0 ? (
                        modalAccessoriesList.map((acc, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg text-xs font-medium border border-zinc-200 transition-colors"
                          >
                            <Tag className="w-3 h-3 text-zinc-500" />
                            <span>{acc}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveModalAccessory(idx)}
                              className="ml-1 text-zinc-400 hover:text-rose-600 font-bold leading-none cursor-pointer"
                              title="Quitar accesorio"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-400 italic">
                          Sin accesorios registrados (se notificará &quot;Sin accesorios adicionales&quot;)
                        </span>
                      )}
                    </div>

                    {/* Input para agregar accesorio personalizado */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={modalNewAccessory}
                        onChange={(e) => setModalNewAccessory(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddModalAccessory(modalNewAccessory);
                          }
                        }}
                        placeholder="Escriba un accesorio (ej: Cargador 230W, Funda, Caja) y presione Enter o +"
                        className="flex-1 px-3 py-1.5 text-xs bg-zinc-50 border border-slate-200 focus:border-zinc-900 rounded-lg outline-none transition-colors placeholder:text-zinc-400 font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddModalAccessory(modalNewAccessory)}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        title="Agregar accesorio a la lista"
                      >
                        + Agregar
                      </button>
                    </div>

                    {/* Sugerencias rápidas con un toque */}
                    <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-dashed border-zinc-200 text-[11px]">
                      <span className="text-zinc-400 mr-1 font-mono text-[10px]">RÁPIDOS:</span>
                      {[
                        "Cargador Original",
                        "Caja Original",
                        "Cable USB",
                        "Funda / Estuche",
                        "Control Remoto",
                        "Batería",
                        "Adaptador de Corriente",
                      ].map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => handleAddModalAccessory(sug)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                            modalAccessoriesList.includes(sug)
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200"
                          }`}
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Acciones de cambio de estado en el modal */}
                <div className="p-3 bg-[#fdfdfd] border border-[#e5e5e5] rounded-xl flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#555555]">Cambiar estado:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleCambiarEstado(selectedTicket.idOrden, "Entregada")}
                      className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors"
                    >
                      ✓ Entregada
                    </button>
                    <button
                      onClick={() => handleCambiarEstado(selectedTicket.idOrden, "Reparada")}
                      className="px-2.5 py-1 text-xs font-semibold bg-sky-700 hover:bg-sky-800 text-white rounded-lg transition-colors"
                    >
                      Reparada
                    </button>
                    <button
                      onClick={() => handleCambiarEstado(selectedTicket.idOrden, "QC")}
                      className="px-2.5 py-1 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg transition-colors"
                    >
                      Pasar a QC
                    </button>
                    <button
                      onClick={() => handleCambiarEstado(selectedTicket.idOrden, "En Reparación")}
                      className="px-2.5 py-1 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-lg transition-colors"
                    >
                      En Taller
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#e5e5e5] flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => handleNotificarWhatsAppRecepcion(selectedTicket)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer transition-colors ${
                    selectedTicket.recibidoEnDeposito
                      ? "bg-emerald-700 hover:bg-emerald-800"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {selectedTicket.recibidoEnDeposito ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>Recibido · Listo para retiro (Re-notificar)</span>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      <span>Notificar por WhatsApp &amp; Marcar Recibido</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 bg-[#1c1c1e] text-white rounded-xl text-xs font-semibold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Impresión de Boleta */}
        {showPrintModal && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-[#e5e5e5]">
              <div className="text-center border-b border-[#e5e5e5] pb-3">
                <h2 className="text-xl font-black text-[#121212]">Nissei Post-Venta</h2>
                <div className="mt-2 inline-block px-3 py-1 bg-[#eeeeee] font-mono text-xs rounded font-bold">
                  COMPROBANTE DEL SERVICIO POST - VENTA NISSEI
                </div>
              </div>

              <div className="text-xs space-y-2 font-mono">
                <div className="flex justify-between">
                  <span className="text-[#888888]">Nº ORDEN:</span>
                  <span className="font-bold">#{showPrintModal.idOrden}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">CÓDIGO PROD:</span>
                  <span className="font-bold">{showPrintModal.codigoProducto || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">CLIENTE:</span>
                  <span className="font-semibold">{showPrintModal.cliente}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">EQUIPO:</span>
                  <span>{showPrintModal.marca} {showPrintModal.modelo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">Nº SERIE:</span>
                  <span>{showPrintModal.serial || "S/N"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#888888]">ESTADO:</span>
                  <span className="font-bold uppercase">{showPrintModal.estado}</span>
                </div>
                {showPrintModal.accesorios && (
                  <div className="border-t border-dashed border-[#cccccc] pt-2 flex justify-between gap-2">
                    <span className="text-[#888888]">ACCESORIOS:</span>
                    <span className="font-semibold text-right max-w-[240px] text-[11px]">
                      {showPrintModal.accesorios}
                    </span>
                  </div>
                )}
                <div className="border-t border-dashed border-[#cccccc] pt-2">
                  <span className="text-[#888888] block mb-1">INFORME TÉCNICO:</span>
                  <span className="text-[11px] font-sans text-slate-700 block leading-tight">
                    {showPrintModal.mensaje || "Sin observaciones."}
                  </span>
                </div>
              </div>

              <div className="pt-6 border-t border-[#e5e5e5] flex justify-between items-center">
                <button
                  onClick={() => setShowPrintModal(null)}
                  className="px-4 py-2 border border-[#e5e5e5] rounded-xl text-xs font-semibold text-[#555555]"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="px-5 py-2 bg-[#121212] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-black"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Comprobante
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
    </AuthGuard>
  );
}
