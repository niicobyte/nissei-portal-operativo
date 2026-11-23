"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { CleanSelect, CleanSelectOption } from "@/components/common/CleanSelect";
import { VendedorSelect } from "@/components/common/VendedorSelect";
import { CleanDatePicker } from "@/components/common/CleanDatePicker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Cpu,
  Plus,
  Trash2,
  ShoppingBag,
  User,
  Wrench,
  AlertCircle,
  AlertTriangle,
  Laptop,
  Send,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  enriquecerComponente,
  verificarCompatibilidadPC,
  ResultadoCompatibilidad,
  AlertaCompatibilidad,
  HardwarePresupuestoItem,
} from "@/data/compatibilidadPcData";
import { BarcodeScannerModal } from "@/components/common/BarcodeScannerModal";
import { ScanButton } from "@/components/common/ScanButton";
import {
  CATALOGO_HARDWARE_REAL,
  LISTA_VENDEDORES_REALES,
  LISTA_TECNICOS_MONTAJE,
  MONTAJES_WHATSAPP_GROUP_ID,
  ComponenteMontaje,
  OrdenMontajeReal,
  SkuCatalogItem,
  addMontajeAsync,
  fetchMontajesFromMySQL,
  getPendingDirtyMontajeIds,
  getStoredVendedores,
  addCustomVendedor,
  getStoredTecnicos,
  addCustomTecnico,
  getStoredSkuCatalog,
  fetchSkuCatalogFromMySQL,
  saveSkusToCatalogOnline,
  mergeSkuCatalogItems,
  extractSkusFromOrders,
  isRealSku,
  findSkuByUpc,
  normalizeUpcCode,
  formatMontajeWhatsAppMessage,
} from "@/data/montajesData";
import { setCloudSyncWarning } from "@/lib/cloudSync";
import { AuthBadge } from "@/components/common/AuthBadge";
import { AuthGuard } from "@/components/common/AuthGuard";
import {
  saveWorkDraft,
  loadWorkDraft,
  clearWorkDraft,
  useFlushDraftBeforeLogout,
} from "@/lib/workDrafts";

const EXPANSION_PRIORITY_CATS = new Set(["NOTEBOOK", "RAM", "ALMACENAMIENTO"]);
const TECNICOS_NUEVO_DRAFT_KEY = "tecnicos_nuevo";

interface TecnicosNuevoDraft {
  salesAgent: string;
  customSalesAgent: string;
  salesChannel: "Tienda" | "Ecommerce - Web" | "Empresas / Coorporativo";
  nroRegistroInterno: string;
  invoiceDate: string;
  clientName: string;
  cantidadEquipos: number;
  tipoServicio: "Montaje" | "Expansion";
  components: ComponenteMontaje[];
  customUpc: string;
  customSku: string;
  customDesc: string;
  customCategory: ComponenteMontaje["categoria"];
  customSerial: string;
  assignedTech: string;
  customTech?: string;
  priority: "NORMAL" | "EXPRESS" | "URGENTE";
  assemblyDate: string;
  observations: string;
}

export default function NuevoIngresoMontajePage() {
  const router = useRouter();

  // Lista dinámica de vendedores, técnicos y catálogo maestro de SKUs sincronizados con MySQL
  const [listaVendedores, setListaVendedores] = useState<string[]>(LISTA_VENDEDORES_REALES);
  const [listaTecnicos, setListaTecnicos] = useState<string[]>(LISTA_TECNICOS_MONTAJE);
  const [skuCatalog, setSkuCatalog] = useState<SkuCatalogItem[]>(() =>
    CATALOGO_HARDWARE_REAL.map((c) => ({
      sku: c.sku,
      descripcion: c.descripcion,
      categoria: c.categoria,
      fuente: "OFICIAL",
    }))
  );

  useEffect(() => {
    setListaVendedores(getStoredVendedores());
    setListaTecnicos(getStoredTecnicos());
    setSkuCatalog(getStoredSkuCatalog());

    Promise.all([
      fetchMontajesFromMySQL().catch(() => []),
      fetchSkuCatalogFromMySQL().catch(() => []),
    ]).then(([orders, dbCatalog]) => {
      setListaVendedores(getStoredVendedores());
      setListaTecnicos(getStoredTecnicos());
      const fromOrders = Array.isArray(orders) ? extractSkusFromOrders(orders) : [];
      setSkuCatalog((prev) =>
        mergeSkuCatalogItems(
          prev,
          fromOrders,
          Array.isArray(dbCatalog) ? dbCatalog : []
        )
      );
    });
  }, []);

  // Fecha actual en formato YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];
  const deliveryDateDefault = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // 1. APARTADO DE VENDEDOR & CANAL COMERCIAL
  const [salesAgent, setSalesAgent] = useState<string>(LISTA_VENDEDORES_REALES[0]); // "Helen Rivarola"
  const [customSalesAgent, setCustomSalesAgent] = useState<string>("");
  const [salesChannel, setSalesChannel] = useState<"Tienda" | "Ecommerce - Web" | "Empresas / Coorporativo">("Tienda");
  const [nroRegistroInterno, setNroRegistroInterno] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>(todayStr);

  // 2. APARTADO DE DATOS DEL CLIENTE & TIPO DE SERVICIO
  const [clientName, setClientName] = useState<string>("");
  const [cantidadEquipos, setCantidadEquipos] = useState<number>(1);
  const [tipoServicio, setTipoServicio] = useState<"Montaje" | "Expansion">("Montaje");

  // 3. APARTADO DE COMPONENTES DE HARDWARE
  const [components, setComponents] = useState<ComponenteMontaje[]>([]);

  // Catálogo activo priorizando la modalidad pero incluyendo todos los SKUs aprendidos en MySQL
  const currentCatalog = useMemo(() => {
    const items = [...skuCatalog];
    items.sort((a, b) => {
      const aMatch =
        tipoServicio === "Expansion"
          ? EXPANSION_PRIORITY_CATS.has(a.categoria)
          : a.categoria !== "NOTEBOOK";
      const bMatch =
        tipoServicio === "Expansion"
          ? EXPANSION_PRIORITY_CATS.has(b.categoria)
          : b.categoria !== "NOTEBOOK";
      if (aMatch !== bMatch) return aMatch ? -1 : 1;
      return a.descripcion.localeCompare(b.descripcion);
    });
    return items;
  }, [skuCatalog, tipoServicio]);

  // Estados para el ingreso de componente (manual con autocompletado por UPC / SKU)
  const [customUpc, setCustomUpc] = useState("");
  const [customSku, setCustomSku] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customCategory, setCustomCategory] = useState<ComponenteMontaje["categoria"]>(
    tipoServicio === "Montaje" ? "PROCESADOR" : "NOTEBOOK"
  );
  const [customSerial, setCustomSerial] = useState("");
  const [skuMatchNotice, setSkuMatchNotice] = useState<string | null>(null);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [scannerTarget, setScannerTarget] = useState<
    | { mode: "nro_reg" }
    | { mode: "upc" }
    | { mode: "new" }
    | { mode: "row"; index: number }
    | null
  >(null);

  // 3b. MOTOR INTELIGENTE DE COMPATIBILIDAD DE HARDWARE (ARMAR-PC)
  const enrichedComponents = useMemo<HardwarePresupuestoItem[]>(() => {
    return components.map((c) => enriquecerComponente(c));
  }, [components]);

  const resultadoCompatibilidad = useMemo<ResultadoCompatibilidad | null>(() => {
    if (tipoServicio !== "Montaje" || enrichedComponents.length === 0) return null;
    return verificarCompatibilidadPC(enrichedComponents);
  }, [tipoServicio, enrichedComponents]);

  // Detección preventiva de conflicto mientras se escribe el SKU o Descripción antes de agregar
  const prospectiveItem = useMemo<HardwarePresupuestoItem | null>(() => {
    if (tipoServicio !== "Montaje" || !customDesc.trim()) return null;
    return enriquecerComponente({
      sku: customSku.trim() || "PREVIEW",
      upc: customUpc.trim() || undefined,
      categoria: customCategory,
      descripcion: customDesc.trim(),
      seriales: customSerial.trim() || "N/A",
    });
  }, [tipoServicio, customDesc, customSku, customUpc, customCategory, customSerial]);

  const prospectiveConflict = useMemo<AlertaCompatibilidad | null>(() => {
    if (!prospectiveItem || tipoServicio !== "Montaje" || enrichedComponents.length === 0) return null;
    const testBuild = [...enrichedComponents, prospectiveItem];
    const testResult = verificarCompatibilidadPC(testBuild);

    const baseAlertKeys = new Set(
      resultadoCompatibilidad?.alertas.map((a) => `${a.tipo}-${a.titulo}`) || []
    );

    const newErrors = testResult.alertas.filter(
      (a) => a.tipo === "ERROR" && !baseAlertKeys.has(`${a.tipo}-${a.titulo}`)
    );
    if (newErrors.length > 0) return newErrors[0];

    const newWarnings = testResult.alertas.filter(
      (a) => a.tipo === "WARNING" && !baseAlertKeys.has(`${a.tipo}-${a.titulo}`)
    );
    if (newWarnings.length > 0) return newWarnings[0];

    return null;
  }, [prospectiveItem, enrichedComponents, resultadoCompatibilidad, tipoServicio]);

  // 4. APARTADO DE TÉCNICO RESPONSABLE & PRIORIDAD
  const [assignedTech, setAssignedTech] = useState<string>(LISTA_TECNICOS_MONTAJE[0]);
  const [customTech, setCustomTech] = useState<string>("");
  const [priority, setPriority] = useState<"NORMAL" | "EXPRESS" | "URGENTE">("NORMAL");

  // Opciones con estilo CleanSelect
  const vendedorOptions = useMemo<CleanSelectOption[]>(
    () => [
      ...listaVendedores.map((v) => ({ value: v, label: v })),
      { value: "OTRO", label: "+ Otro vendedor (especificar)" },
    ],
    [listaVendedores]
  );

  const canalOptions: CleanSelectOption[] = [
    { value: "Tienda", label: "Tienda" },
    { value: "Ecommerce - Web", label: "Ecommerce - Web" },
    { value: "Empresas / Coorporativo", label: "Empresas / Coorporativo" },
  ];

  const categoriaOptions: CleanSelectOption[] =
    tipoServicio === "Montaje"
      ? [
          { value: "PROCESADOR", label: "Procesador" },
          { value: "PLACA_MADRE", label: "Placa Madre" },
          { value: "RAM", label: "Memoria RAM Desktop" },
          { value: "GPU", label: "Tarjeta de Video" },
          { value: "ALMACENAMIENTO", label: "Almacenamiento SSD" },
          { value: "FUENTE", label: "Fuente de Poder" },
          { value: "GABINETE", label: "Gabinete" },
          { value: "REFRIGERACION", label: "Cooler / Líquida" },
          { value: "OTROS", label: "Otro Componente" },
        ]
      : [
          { value: "NOTEBOOK", label: "Notebook del Cliente" },
          { value: "RAM", label: "Memoria RAM SODIMM" },
          { value: "ALMACENAMIENTO", label: "SSD Expansión (M.2/SATA)" },
          { value: "OTROS", label: "Otro Accesorio" },
        ];

  const tecnicoOptions = useMemo<CleanSelectOption[]>(
    () => [
      ...listaTecnicos.map((t) => ({ value: t, label: t })),
      { value: "OTRO", label: "+ Otro técnico (especificar)" },
    ],
    [listaTecnicos]
  );

  const prioridadOptions: CleanSelectOption[] = [
    { value: "NORMAL", label: "NORMAL (Cola estándar 48h)" },
    { value: "EXPRESS", label: "EXPRESS (Prioridad 24h)" },
    { value: "URGENTE", label: "URGENTE (Despacho en el día)" },
  ];
  const [assemblyDate, setAssemblyDate] = useState<string>(deliveryDateDefault);
  const [observations, setObservations] = useState<string>("");

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restoredDraftBanner, setRestoredDraftBanner] = useState(false);
  const draftHydratedRef = useRef(false);

  const buildCurrentDraft = (): TecnicosNuevoDraft => ({
    salesAgent,
    customSalesAgent,
    salesChannel,
    nroRegistroInterno,
    invoiceDate,
    clientName,
    cantidadEquipos,
    tipoServicio,
    components,
    customUpc,
    customSku,
    customDesc,
    customCategory,
    customSerial,
    assignedTech,
    customTech,
    priority,
    assemblyDate,
    observations,
  });

  // Restaurar borrador en progreso al montar (por recarga o actualización de deploy)
  useEffect(() => {
    const saved = loadWorkDraft<TecnicosNuevoDraft>(TECNICOS_NUEVO_DRAFT_KEY);
    if (saved) {
      const hasContent =
        Boolean(saved.nroRegistroInterno?.trim()) ||
        Boolean(saved.clientName?.trim()) ||
        Boolean(saved.observations?.trim()) ||
        Boolean(saved.customUpc?.trim()) ||
        Boolean(saved.customSku?.trim()) ||
        Boolean(saved.customDesc?.trim()) ||
        Boolean(saved.customSerial?.trim()) ||
        (Array.isArray(saved.components) && saved.components.length > 0);

      if (hasContent) {
        if (saved.salesAgent) setSalesAgent(saved.salesAgent);
        if (typeof saved.customSalesAgent === "string") setCustomSalesAgent(saved.customSalesAgent);
        if (saved.salesChannel) setSalesChannel(saved.salesChannel);
        if (typeof saved.nroRegistroInterno === "string") setNroRegistroInterno(saved.nroRegistroInterno);
        if (saved.invoiceDate) setInvoiceDate(saved.invoiceDate);
        if (typeof saved.clientName === "string") setClientName(saved.clientName);
        if (typeof saved.cantidadEquipos === "number" && saved.cantidadEquipos >= 1) {
          setCantidadEquipos(saved.cantidadEquipos);
        }
        if (saved.tipoServicio) setTipoServicio(saved.tipoServicio);
        if (Array.isArray(saved.components)) setComponents(saved.components);
        if (typeof saved.customUpc === "string") setCustomUpc(saved.customUpc);
        if (typeof saved.customSku === "string") setCustomSku(saved.customSku);
        if (typeof saved.customDesc === "string") setCustomDesc(saved.customDesc);
        if (saved.customCategory) setCustomCategory(saved.customCategory);
        if (typeof saved.customSerial === "string") setCustomSerial(saved.customSerial);
        if (saved.assignedTech) setAssignedTech(saved.assignedTech);
        if (typeof saved.customTech === "string") setCustomTech(saved.customTech);
        if (saved.priority) setPriority(saved.priority);
        if (saved.assemblyDate) setAssemblyDate(saved.assemblyDate);
        if (typeof saved.observations === "string") setObservations(saved.observations);
        setRestoredDraftBanner(true);
      }
    }

    // Importación automática de presupuesto generado en /armar-pc si existe
    if (typeof window !== "undefined") {
      try {
        const rawPresupuesto = sessionStorage.getItem("nissei_presupuesto_export_v1");
        if (rawPresupuesto) {
          const pres = JSON.parse(rawPresupuesto);
          if (pres && Array.isArray(pres.componentes) && pres.componentes.length > 0) {
            if (pres.cliente) setClientName(pres.cliente);
            if (pres.vendedor) setSalesAgent(pres.vendedor);
            if (pres.canal) setSalesChannel(pres.canal);
            if (pres.tipoServicio) setTipoServicio(pres.tipoServicio);
            if (pres.observaciones) setObservations(pres.observaciones);
            setComponents(pres.componentes);
            sessionStorage.removeItem("nissei_presupuesto_export_v1");
            setRestoredDraftBanner(true);
          }
        }
      } catch (err) {
        console.warn("Error importando presupuesto a nuevo montaje:", err);
      }
    }

    draftHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!draftHydratedRef.current) return;
    saveWorkDraft(TECNICOS_NUEVO_DRAFT_KEY, buildCurrentDraft());
  }, [
    salesAgent,
    customSalesAgent,
    salesChannel,
    nroRegistroInterno,
    invoiceDate,
    clientName,
    cantidadEquipos,
    tipoServicio,
    components,
    customUpc,
    customSku,
    customDesc,
    customCategory,
    customSerial,
    assignedTech,
    customTech,
    priority,
    assemblyDate,
    observations,
  ]);

  useFlushDraftBeforeLogout(() => {
    if (draftHydratedRef.current) {
      saveWorkDraft(TECNICOS_NUEVO_DRAFT_KEY, buildCurrentDraft());
    }
  });

  // Cambiar modalidad y reiniciar valores
  const handleChangeTipoServicio = (tipo: "Montaje" | "Expansion") => {
    setTipoServicio(tipo);
    setCustomCategory(tipo === "Montaje" ? "PROCESADOR" : "NOTEBOOK");
    setCustomSku("");
    setCustomDesc("");
    setCustomUpc("");
    setCustomSerial("");
    setSkuMatchNotice(null);
  };

  // Autocompletado inteligente por UPC / Código de Barras -> completa SKU, Categoría y Descripción
  const handleUpcChange = (upcVal: string, scannedFormatLabel?: string) => {
    setComponentError(null);
    setCustomUpc(upcVal);
    const clean = normalizeUpcCode(upcVal);
    if (!clean) {
      if (!customSku.trim()) setSkuMatchNotice(null);
      return;
    }

    const found = findSkuByUpc(skuCatalog, clean);
    if (found) {
      setCustomSku(found.sku);
      setCustomCategory(found.categoria);
      setCustomDesc(found.descripcion);
      setSkuMatchNotice(
        `${scannedFormatLabel ? `UPC escaneado (${scannedFormatLabel}) · ` : ""}Vinculado al SKU ${found.sku}: [${found.categoria}] ${found.descripcion}`
      );
    } else if (isRealSku(customSku)) {
      setSkuMatchNotice(
        `${scannedFormatLabel ? `UPC escaneado (${scannedFormatLabel}) · ` : ""}Al agregar, el UPC ${clean} se vinculará al SKU ${customSku.trim()} en MySQL.`
      );
    } else if (scannedFormatLabel) {
      setSkuMatchNotice(
        `UPC escaneado (${scannedFormatLabel}): ${clean} — Ingrese o seleccione el SKU abajo para vincularlo en MySQL.`
      );
    } else if (!customSku.trim()) {
      setSkuMatchNotice(
        "UPC aún no vinculado: ingrese o elija el SKU abajo para asociarlo en MySQL."
      );
    }
  };

  // Autocompletado inteligente al escribir o seleccionar SKU
  const handleSkuChange = (skuVal: string) => {
    setComponentError(null);
    setCustomSku(skuVal);
    const clean = skuVal.trim();
    if (!clean) {
      setSkuMatchNotice(null);
      return;
    }

    // Buscar en catálogo unificado (oficial + MySQL catalogo_sku + órdenes históricas)
    const found = skuCatalog.find((c) => c.sku.toLowerCase() === clean.toLowerCase());
    const enteredUpc = normalizeUpcCode(customUpc);

    if (found) {
      setCustomCategory(found.categoria);
      setCustomDesc(found.descripcion);
      if (found.upc && !enteredUpc) {
        setCustomUpc(found.upc);
      }
      const originTag =
        found.fuente === "OFICIAL"
          ? "Catálogo oficial"
          : found.fuente === "CSV"
            ? "CSV en MySQL"
            : found.fuente === "ORDEN"
              ? "Orden previa MySQL"
              : "Guardado en MySQL";
      const upcNote =
        enteredUpc && normalizeUpcCode(found.upc).toLowerCase() !== enteredUpc.toLowerCase()
          ? ` · Al agregar se vinculará UPC ${enteredUpc}`
          : found.upc
            ? ` · UPC ${found.upc}`
            : "";
      setSkuMatchNotice(`${originTag}: [${found.categoria}] ${found.descripcion}${upcNote}`);
    } else if (enteredUpc) {
      setSkuMatchNotice(
        `Al agregar, el nuevo SKU ${clean} quedará guardado con UPC ${enteredUpc} en MySQL.`
      );
    } else {
      setSkuMatchNotice(null);
    }
  };

  // Autocompletado inverso si se escribe o selecciona la descripción
  const handleDescChange = (descVal: string) => {
    setComponentError(null);
    setCustomDesc(descVal);
    const clean = descVal.trim();
    if (!clean) return;

    const found = skuCatalog.find(
      (c) => c.descripcion.toLowerCase() === clean.toLowerCase()
    );

    if (found) {
      setCustomSku(found.sku);
      setCustomCategory(found.categoria);
      if (found.upc && !normalizeUpcCode(customUpc)) {
        setCustomUpc(found.upc);
      }
      setSkuMatchNotice(
        `SKU asignado automáticamente: ${found.sku}${found.upc ? ` (UPC ${found.upc})` : ""}`
      );
    }
  };

  // Agregar componente a la tabla y aprender SKU / UPC en MySQL si corresponde
  const handleAddComponent = (): boolean => {
    setComponentError(null);

    const cleanUpc = normalizeUpcCode(customUpc);
    const cleanSku = customSku.trim();
    const cleanDesc = customDesc.trim();

    if (!cleanUpc) {
      setComponentError("El campo UPC / Código de Barras es obligatorio.");
      document.getElementById("component-upc")?.focus();
      return false;
    }

    if (!isRealSku(cleanSku)) {
      setComponentError("El campo SKU (Código) es obligatorio.");
      document.getElementById("component-sku")?.focus();
      return false;
    }

    if (!customCategory) {
      setComponentError("La Categoría del componente es obligatoria.");
      return false;
    }

    if (!cleanDesc) {
      setComponentError("La Descripción del Hardware es obligatoria.");
      document.getElementById("component-desc")?.focus();
      return false;
    }

    const finalSerial = customSerial.trim() || "N/A";

    const newComponent: ComponenteMontaje = {
      sku: cleanSku,
      upc: cleanUpc,
      descripcion: cleanDesc,
      seriales: finalSerial,
      categoria: customCategory,
    };

    setComponents((prev) => [...prev, newComponent]);

    let learnedNotice: string | null = null;
    const existing = skuCatalog.find(
      (c) => c.sku.toLowerCase() === cleanSku.toLowerCase()
    );
    const existingUpc = normalizeUpcCode(existing?.upc);
    const upcChanged = Boolean(cleanUpc) && existingUpc.toLowerCase() !== cleanUpc.toLowerCase();

    if (
      !existing ||
      existing.descripcion.toLowerCase() !== cleanDesc.toLowerCase() ||
      existing.categoria !== customCategory ||
      upcChanged
    ) {
      const finalUpc = cleanUpc || existingUpc;
      const newItem: SkuCatalogItem = {
        sku: cleanSku,
        ...(finalUpc ? { upc: finalUpc } : {}),
        descripcion: cleanDesc,
        categoria: customCategory,
        fuente: "MANUAL",
      };
      setSkuCatalog((prev) => mergeSkuCatalogItems(prev, [newItem]));
      learnedNotice = existing && upcChanged
        ? `UPC ${cleanUpc} vinculado al SKU ${cleanSku} y guardado en MySQL para futuros montajes.`
        : `Nuevo SKU ${cleanSku}${finalUpc ? ` (UPC ${finalUpc})` : ""} guardado en catálogo MySQL para futuros montajes.`;
      void saveSkusToCatalogOnline([newItem]).then((res) => {
        if (res.items.length > 0) {
          setSkuCatalog(res.items);
        }
      });
    }

    // Limpiar campos listos para el siguiente componente
    setCustomUpc("");
    setCustomSku("");
    setCustomDesc("");
    setCustomSerial("");
    setSkuMatchNotice(learnedNotice);
    return true;
  };

  // Eliminar componente
  const handleRemoveComponent = (indexToRemove: number) => {
    setComponents((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Confirmar y registrar nuevo vendedor comercial en la lista permanente
  const handleConfirmCustomSalesAgent = () => {
    const clean = customSalesAgent.trim();
    if (clean) {
      const updated = addCustomVendedor(clean);
      setListaVendedores(updated);
      setSalesAgent(clean);
      setCustomSalesAgent("");
    }
  };

  // Confirmar y registrar nuevo técnico de laboratorio en la lista permanente
  const handleConfirmCustomTech = () => {
    const clean = customTech.trim();
    if (clean) {
      const updated = addCustomTecnico(clean);
      setListaTecnicos(updated);
      setAssignedTech(clean);
      setCustomTech("");
    }
  };

  // Manejo de la tecla Enter para confirmar casilla y pasar a la siguiente sin bugear el formulario
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter") return;

    const target = e.target as HTMLElement;

    // Permitir salto de línea en textarea
    if (target.tagName === "TEXTAREA") return;

    // Permitir activación de botones con Enter
    if (target.tagName === "BUTTON") return;

    // Prevenir el submit accidental de HTML
    e.preventDefault();

    // 1. Campo de asesor personalizado
    if (target.id === "input-custom-sales-agent") {
      handleConfirmCustomSalesAgent();
      document.getElementById("input-nro-registro")?.focus();
      return;
    }

    // 2. Número de Registro Interno -> Salta a Cliente
    if (target.id === "input-nro-registro") {
      document.getElementById("input-client-name")?.focus();
      return;
    }

    // 3. Cliente / Razón Social -> Salta a Cantidad de Equipos
    if (target.id === "input-client-name") {
      document.getElementById("input-cantidad-equipos")?.focus();
      return;
    }

    // 4. Cantidad de Equipos -> Salta a UPC del componente
    if (target.id === "input-cantidad-equipos") {
      document.getElementById("component-upc")?.focus();
      return;
    }

    // 4b. UPC del componente -> Si autocompletó SKU y descripción, pasa a serial; si no, a SKU
    if (target.id === "component-upc") {
      if (customSku.trim() && customDesc.trim()) {
        document.getElementById("component-serial")?.focus();
      } else {
        document.getElementById("component-sku")?.focus();
      }
      return;
    }

    // 5. SKU del componente -> Si autocompletó, pasa a serial; si no, a descripción
    if (target.id === "component-sku") {
      if (customDesc.trim()) {
        document.getElementById("component-serial")?.focus();
      } else {
        document.getElementById("component-desc")?.focus();
      }
      return;
    }

    // 6. Descripción del componente -> Pasa a serial
    if (target.id === "component-desc") {
      document.getElementById("component-serial")?.focus();
      return;
    }

    // 7. Serial del componente -> Intenta agregar componente y vuelve a UPC si se agregó
    if (target.id === "component-serial") {
      if (handleAddComponent()) {
        setTimeout(() => {
          document.getElementById("component-upc")?.focus();
        }, 40);
      }
      return;
    }

    // Fallback de navegación: encontrar el siguiente input enfocable
    const form = e.currentTarget;
    const focusable = Array.from(
      form.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), button:not([disabled])'
      )
    ).filter((el) => el.offsetParent !== null);

    const idx = focusable.indexOf(target);
    if (idx >= 0 && idx < focusable.length - 1) {
      focusable[idx + 1].focus();
    }
  };

  // Actualizar serial o campo de una fila en la tabla
  const handleUpdateComponentField = (
    index: number,
    field: keyof ComponenteMontaje,
    value: string
  ) => {
    setComponents((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, [field]: value } : c))
    );
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!clientName.trim()) {
      setFormError("Debe ingresar el nombre o razón social del cliente.");
      return;
    }
    if (!nroRegistroInterno.trim()) {
      setFormError("Debe ingresar el Nro. Registro / Interno.");
      return;
    }
    if (components.length === 0) {
      setFormError(
        tipoServicio === "Montaje"
          ? "Debe agregar al menos un componente de hardware al montaje."
          : "Debe registrar la notebook del cliente y el módulo de RAM o SSD para la expansión."
      );
      return;
    }

    // Validación defensiva del Escudo de Compatibilidad de Hardware (Motor Armar-PC)
    if (tipoServicio === "Montaje" && resultadoCompatibilidad && resultadoCompatibilidad.totalErrores > 0) {
      const errorLines = resultadoCompatibilidad.alertas
        .filter((a) => a.tipo === "ERROR")
        .map((a, i) => `${i + 1}. ${a.titulo}:\n   ${a.detalle}`)
        .join("\n\n");
      const confirmed = window.confirm(
        `⚠️ ADVERTENCIA CRÍTICA DE COMPATIBILIDAD (MOTOR ARMAR-PC):\n\n` +
        `Se detectaron ${resultadoCompatibilidad.totalErrores} incompatibilidad(es) física(s) insalvable(s) en los componentes de este ensamble:\n\n` +
        errorLines +
        `\n\n¿Desea forzar y registrar de todas formas esta orden de montaje con incompatibilidades físicas? Presione Aceptar para forzar o Cancelar para corregir los componentes.`
      );
      if (!confirmed) {
        setFormError(
          `Ingreso detenido: corrija las ${resultadoCompatibilidad.totalErrores} incompatibilidad(es) crítica(s) de hardware antes de registrar.`
        );
        return;
      }
    }

    setIsSubmitting(true);

    let effectiveVendedor = salesAgent;
    if (salesAgent === "OTRO") {
      const cleanCustom = customSalesAgent.trim() || "Comercial Salón";
      effectiveVendedor = cleanCustom;
      if (customSalesAgent.trim()) {
        const updatedVend = addCustomVendedor(cleanCustom);
        setListaVendedores(updatedVend);
      }
    }

    let effectiveTecnico = assignedTech;
    if (assignedTech === "OTRO") {
      const cleanCustom = customTech.trim() || "Técnico de Laboratorio";
      effectiveTecnico = cleanCustom;
      if (customTech.trim()) {
        const updatedTech = addCustomTecnico(cleanCustom);
        setListaTecnicos(updatedTech);
      }
    }

    const safeCantidadEquipos = Math.max(1, Number(cantidadEquipos) || 1);
    const cleanReg = nroRegistroInterno.replace(/[^0-9]/g, "") || String(Math.floor(100000 + Math.random() * 900000));
    const prefix = tipoServicio === "Montaje" ? "MNT" : "EXP";
    const newId = `${prefix}-${cleanReg.slice(0, 7)}`;

    const normalizedComponents: ComponenteMontaje[] = components.map((c) => ({
      ...c,
      seriales: String(c.seriales || "").trim() || "N/A",
    }));

    const missingMeta = normalizedComponents.some(
      (c) =>
        !normalizeUpcCode(c.upc) ||
        !isRealSku(c.sku) ||
        !c.categoria ||
        !String(c.descripcion || "").trim()
    );
    if (missingMeta) {
      setFormError(
        "Todos los componentes de la orden deben tener UPC, SKU, Categoría y Descripción del Hardware completos."
      );
      setIsSubmitting(false);
      return;
    }

    const newOrder: OrdenMontajeReal = {
      id: newId,
      nro_reg: nroRegistroInterno.trim(),
      cliente: clientName.trim(),
      fecha_facturacion: invoiceDate,
      fecha_montaje: assemblyDate,
      vendedor: effectiveVendedor,
      canal: salesChannel,
      estado: "En Proceso",
      tipo_servicio: tipoServicio,
      cantidadEquipos: safeCantidadEquipos,
      tecnico: effectiveTecnico,
      etapa: "ARMADO_MECANICO",
      progreso: 35,
      prioridad: priority,
      consumoEstimado:
        tipoServicio === "Montaje" && resultadoCompatibilidad
          ? `${resultadoCompatibilidad.consumoTotalWatts}W (Recomendado: ${resultadoCompatibilidad.fuenteRecomendadaWatts}W+)`
          : tipoServicio === "Montaje"
          ? "550W"
          : undefined,
      observaciones: observations.trim(),
      componentes: normalizedComponents,
    };

    // Guardar en almacenamiento local y confirmar persistencia en MySQL en la nube
    await addMontajeAsync(newOrder);
    clearWorkDraft(TECNICOS_NUEVO_DRAFT_KEY);
    const mysqlPending = getPendingDirtyMontajeIds().includes(newOrder.id);

    // Envío explícito y esperado (await) al Grupo de Montajes vía WhaApi antes de navegar
    const msg = formatMontajeWhatsAppMessage({
      cliente: newOrder.cliente,
      nro_reg: newOrder.nro_reg,
      vendedor: effectiveVendedor,
      canal: salesChannel,
      tipo_servicio: tipoServicio,
      cantidadEquipos: safeCantidadEquipos,
      tecnico: effectiveTecnico,
      prioridad: priority,
      fecha_montaje: assemblyDate,
      componentes: components,
      observaciones: observations.trim(),
    });

    let whatsappSent = false;
    let whatsappError: string | null = null;
    try {
      const waController = new AbortController();
      const waTimer = setTimeout(() => waController.abort(), 8000);
      const waRes = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "MONTAJES",
          to: MONTAJES_WHATSAPP_GROUP_ID,
          body: msg,
        }),
        keepalive: true,
        signal: waController.signal,
      });
      clearTimeout(waTimer);
      const waJson = await waRes.json().catch(() => null);
      if (waRes.ok && waJson?.success) {
        whatsappSent = true;
      } else {
        whatsappError =
          (typeof waJson?.error === "string" && waJson.error) ||
          `Error HTTP ${waRes.status} al enviar notificación.`;
        console.error("[WHAPI MONTAJES ERROR]", waRes.status, waJson);
      }
    } catch (err) {
      whatsappError =
        err instanceof DOMException && err.name === "AbortError"
          ? "Tiempo de espera agotado conectando con WhaApi."
          : "Error de red al enviar notificación a WhatsApp.";
      console.error("[WHAPI ERROR]", err);
    }

    if (mysqlPending && !whatsappSent) {
      setCloudSyncWarning(
        `Orden #${newOrder.id} guardada localmente (MySQL sin confirmar) y WhatsApp falló: ${whatsappError}`
      );
    } else if (mysqlPending) {
      setCloudSyncWarning(
        `Orden #${newOrder.id} enviada a WhatsApp (${MONTAJES_WHATSAPP_GROUP_ID}), pero MySQL aún no confirmó. Reintente recargar la página.`
      );
    } else if (!whatsappSent) {
      setCloudSyncWarning(
        `Orden #${newOrder.id} guardada en MySQL, pero NO se envió al grupo WhatsApp (${MONTAJES_WHATSAPP_GROUP_ID}): ${whatsappError}`
      );
    } else {
      setCloudSyncWarning(
        `Orden #${newOrder.id} guardada en MySQL y aviso enviado al grupo de WhatsApp (${MONTAJES_WHATSAPP_GROUP_ID}).`
      );
    }

    router.push("/tecnicos");
  };

  // Mensaje para previsualización en vivo y notificación al grupo de WhatsApp
  const generateWhatsAppMessage = () => {
    const effectiveVendedor = salesAgent === "OTRO" ? customSalesAgent.trim() || "Asesor Comercial" : salesAgent;
    const effectiveTecnico = assignedTech === "OTRO" ? customTech.trim() || "Técnico de Laboratorio" : assignedTech;
    return formatMontajeWhatsAppMessage({
      cliente: clientName,
      nro_reg: nroRegistroInterno,
      vendedor: effectiveVendedor,
      canal: salesChannel,
      tipo_servicio: tipoServicio,
      cantidadEquipos: cantidadEquipos,
      tecnico: effectiveTecnico,
      prioridad: priority,
      fecha_montaje: assemblyDate,
      componentes: components,
      observaciones: observations,
    });
  };

  return (
    <AuthGuard requiredModule="montajes">
      <main className="min-h-dvh bg-[#FAF6EE] py-4 sm:py-6 lg:py-8 2xl:py-10 px-3 sm:px-5 lg:px-7 2xl:px-10 font-sans">
      <div className="w-full max-w-[1680px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] mx-auto space-y-5 lg:space-y-6 2xl:space-y-8 min-w-0">
        
        {/* Cabecera con Botón Volver Mejorado Neo-Brutalismo */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-black gap-2 flex-wrap">
          <Link
            href="/tecnicos"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-heading font-extrabold text-black bg-[#FFFDF9] hover:bg-[#FFD23F] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-black stroke-[2.5]" />
            <span>Volver al Dashboard de Montajes</span>
          </Link>
          <AuthBadge requiredModule="tecnicos" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#FFD23F] text-black text-xs font-mono font-bold border-2 border-black shadow-[2px_2px_0px_#000]">
            <Wrench className="w-3.5 h-3.5 text-black" />
            <span>TALLER DE MONTAJES &amp; ENSAMBLES</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-extrabold text-black tracking-tight">
            Nuevo Ingreso de Montaje &amp; Ensamble de PC
          </h1>
          <p className="text-xs sm:text-sm text-neutral-800 max-w-4xl font-medium">
            Carga de órdenes operativas para ensambles de computadoras de escritorio y expansiones de memoria o almacenamiento en notebooks.
          </p>
        </div>

        {restoredDraftBanner && (
          <div className="p-3.5 rounded-xl bg-[#2A9D8F] text-white border-2 border-black text-xs sm:text-sm flex items-center justify-between gap-2 shadow-[4px_4px_0px_#000] font-heading font-extrabold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
              <span>
                Se restauró tu carga en progreso automáticamente tras reiniciar sesión.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRestoredDraftBanner(false)}
              className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-black text-[#FFD23F] border border-black shadow-[1px_1px_0px_#000] shrink-0 cursor-pointer"
            >
              Ocultar
            </button>
          </div>
        )}

        {formError && (
          <div className="p-3.5 rounded-xl bg-[#E76F51] text-white border-2 border-black text-xs sm:text-sm flex items-center gap-2 shadow-[4px_4px_0px_#000] font-heading font-extrabold">
            <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUMNA PRINCIPAL DE FORMULARIO (8 cols) */}
          <div className="lg:col-span-8 space-y-6">

            {/* SECCIÓN 1: APARTADO DE VENDEDOR & CANAL COMERCIAL */}
            <section className="bg-[#FFFDF9] p-5 sm:p-6 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-[#FFD23F] text-black border-2 border-black text-xs sm:text-sm flex items-center justify-center font-heading font-black shadow-[1px_1px_0px_#000]">
                    1
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-heading font-extrabold text-black">
                      Apartado de Vendedor &amp; Canal Comercial
                    </h2>
                    <span className="text-xs text-neutral-600 font-medium">
                      Asesor comercial responsable, canal de venta y número de registro interno
                    </span>
                  </div>
                </div>
                <ShoppingBag className="w-5 h-5 text-black" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Vendedor Comercial Categorizado */}
                <div>
                  <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1.5">
                    Vendedor Comercial *
                  </label>
                  <VendedorSelect
                    value={salesAgent}
                    onChange={(val, area) => {
                      setSalesAgent(val);
                      if (area === "Ventas Corp") {
                        setSalesChannel("Empresas / Coorporativo");
                      } else if (area === "Ventas Tienda") {
                        setSalesChannel("Tienda");
                      }
                    }}
                  />
                </div>

                {/* Canal de Venta: Tienda, Ecommerce - Web, Empresas / Coorporativo */}
                <div>
                  <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1.5">
                    Canal de Venta
                  </label>
                  <CleanSelect
                    value={salesChannel}
                    onChange={(val) => setSalesChannel(val as any)}
                    options={canalOptions}
                    size="md"
                    fullWidth
                    dropdownWidth="w-full"
                    className="w-full justify-between"
                  />
                </div>

                {/* Nro. Registro / Interno */}
                <div className="sm:col-span-2">
                  <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1.5">
                    Nro. Registro / Interno *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="input-nro-registro"
                      type="text"
                      required
                      value={nroRegistroInterno}
                      onChange={(e) => setNroRegistroInterno(e.target.value)}
                      placeholder="Ej: 966.565 ó 001-002-0045892"
                      className="w-full min-w-0 text-sm sm:text-base font-mono border-2 border-black rounded-xl px-3.5 py-2.5 bg-white outline-none font-bold text-black shadow-[2px_2px_0px_#000]"
                    />
                    <ScanButton
                      onClick={() => setScannerTarget({ mode: "nro_reg" })}
                      icon="barcode"
                      title="Abrir cámara para escanear solo Código de Barras"
                    />
                  </div>
                </div>

                {/* Fecha de Facturación */}
                <div className="sm:col-span-2">
                  <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1.5">
                    Fecha de Facturación
                  </label>
                  <CleanDatePicker
                    value={invoiceDate}
                    onChange={(val) => setInvoiceDate(val)}
                    placeholder="DD / MM / AAAA"
                    size="md"
                  />
                </div>
              </div>
            </section>

            {/* SECCIÓN 2: APARTADO DE DATOS DEL CLIENTE & MODALIDAD */}
            <section className="bg-[#FFFDF9] p-5 sm:p-6 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-[#FFD23F] text-black border-2 border-black text-xs sm:text-sm flex items-center justify-center font-heading font-black shadow-[1px_1px_0px_#000]">
                    2
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-heading font-extrabold text-black">
                      Apartado de Datos del Cliente &amp; Tipo de Servicio
                    </h2>
                    <span className="text-xs text-neutral-600 font-medium">
                      Titular de la orden y selección entre Ensamble de PC Completa o Expansión de Notebook
                    </span>
                  </div>
                </div>
                <User className="w-5 h-5 text-black" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1.5">
                    Cliente / Razón Social *
                  </label>
                  <input
                    id="input-client-name"
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ej: Prychen Wei / J.W.F. SA / Mariano Cano"
                    className="w-full text-sm sm:text-base border-2 border-black rounded-xl px-3.5 py-2.5 bg-white outline-none font-bold text-black shadow-[2px_2px_0px_#000]"
                  />
                </div>

                <div>
                  <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1.5">
                    Cantidad de Equipos (PCs / Laptops) *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCantidadEquipos((prev) => Math.max(1, prev - 1))}
                      className="px-3.5 py-2.5 border-2 border-black rounded-lg bg-[#FFFDF9] hover:bg-[#FFD23F] text-base font-black text-black cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                      aria-label="Restar equipo"
                    >
                      −
                    </button>
                    <input
                      id="input-cantidad-equipos"
                      type="number"
                      min={1}
                      max={99}
                      required
                      value={cantidadEquipos}
                      onChange={(e) =>
                        setCantidadEquipos(Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      className="w-full text-center text-sm sm:text-base font-mono font-black border-2 border-black rounded-lg px-2 py-2.5 bg-white outline-none text-black shadow-[2px_2px_0px_#000]"
                    />
                    <button
                      type="button"
                      onClick={() => setCantidadEquipos((prev) => Math.min(99, prev + 1))}
                      className="px-3.5 py-2.5 border-2 border-black rounded-lg bg-[#FFFDF9] hover:bg-[#FFD23F] text-base font-black text-black cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                      aria-label="Sumar equipo"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Selector de Modalidad */}
              <div>
                <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1.5">
                  Tipo de Servicio Técnico *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleChangeTipoServicio("Montaje")}
                    className={`p-4 sm:p-5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                      tipoServicio === "Montaje"
                        ? "border-black bg-[#FFD23F] text-black shadow-[4px_4px_0px_#000]"
                        : "border-black/30 hover:border-black bg-[#FFFDF9] text-black shadow-[2px_2px_0px_#000]"
                    }`}
                  >
                    <Cpu className="w-6 h-6 mt-0.5 flex-shrink-0 text-black stroke-[2.5]" />
                    <div>
                      <strong className="block text-sm sm:text-base font-heading font-extrabold text-black">
                        Montaje de PC Completa
                      </strong>
                      <span className="text-xs block mt-1 leading-relaxed text-neutral-800 font-medium">
                        Ensamble desde cero: CPU, Placa Madre, RAM Desktop, GPU, Fuente, Gabinete, Cooler y SSD.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChangeTipoServicio("Expansion")}
                    className={`p-4 sm:p-5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                      tipoServicio === "Expansion"
                        ? "border-black bg-[#FFD23F] text-black shadow-[4px_4px_0px_#000]"
                        : "border-black/30 hover:border-black bg-[#FFFDF9] text-black shadow-[2px_2px_0px_#000]"
                    }`}
                  >
                    <Laptop className="w-6 h-6 mt-0.5 flex-shrink-0 text-black stroke-[2.5]" />
                    <div>
                      <strong className="block text-sm sm:text-base font-heading font-extrabold text-black">
                        Expansión / Upgrade de Notebook
                      </strong>
                      <span className="text-xs block mt-1 leading-relaxed text-neutral-800 font-medium">
                        Ampliación de hardware en laptops: Expansión de Memoria RAM SODIMM (DDR4/DDR5) o Almacenamiento SSD M.2/SATA.
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </section>

            {/* SECCIÓN 3: APARTADO DE COMPONENTES DE HARDWARE CON AUTOCOMPLETADO POR SKU */}
            <section className="bg-[#FFFDF9] p-5 sm:p-6 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-[#FFD23F] text-black border-2 border-black text-xs sm:text-sm flex items-center justify-center font-heading font-black shadow-[1px_1px_0px_#000]">
                    3
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-heading font-extrabold text-black">
                      Apartado de Componentes de Hardware ({tipoServicio === "Montaje" ? "PC Completa" : "Notebook & Expansión"})
                    </h2>
                    <span className="text-xs text-neutral-600 font-medium">
                      Ingrese el SKU para autocompletar o cargue uno nuevo y quedará guardado en MySQL para todos.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-[#FAF6EE] text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                    {components.length} {components.length === 1 ? "componente" : "componentes"}
                  </span>
                </div>
              </div>

              {/* Formulario de Ingreso Directo Inteligente (OPCIÓN DEFAULT) */}
              <div className="bg-[#FAF6EE] p-4 rounded-xl border-2 border-black space-y-3 shadow-[3px_3px_0px_#000]">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-xs font-heading font-extrabold text-black uppercase font-mono tracking-wide flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-black stroke-[3]" />
                    Cargar Componente a la Orden:
                  </span>
                  <span className="text-[11px] text-neutral-600 font-mono font-bold">
                    Escanee el UPC o escriba el SKU
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                  {/* UPC / EAN arriba del SKU (autocompleta SKU/Descripción y se vincula en MySQL) */}
                  <div className="sm:col-span-12">
                    <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1 font-mono">
                      UPC / Código de Barras del Producto *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="component-upc"
                        type="text"
                        list="upcs-list"
                        value={customUpc}
                        onChange={(e) => handleUpcChange(e.target.value)}
                        placeholder="Escanear o escribir UPC / EAN para autocompletar o vincular al SKU..."
                        className="w-full min-w-0 text-sm font-mono font-bold bg-white border-2 border-black rounded-xl px-3.5 py-2.5 outline-none text-black shadow-[2px_2px_0px_#000]"
                      />
                      <ScanButton
                        onClick={() => setScannerTarget({ mode: "upc" })}
                        icon="barcode"
                        title="Abrir cámara para escanear el UPC o código de barras del producto"
                      />
                    </div>
                    <datalist id="upcs-list">
                      {currentCatalog
                        .filter((c) => c.upc)
                        .map((c) => (
                          <option key={`${c.sku}-${c.upc}`} value={c.upc}>
                            SKU {c.sku} · {c.descripcion}
                          </option>
                        ))}
                    </datalist>
                  </div>

                  {/* SKU con datalist de autocompletado */}
                  <div className="sm:col-span-3">
                    <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1 font-mono">
                      SKU (Código) *
                    </label>
                    <input
                      id="component-sku"
                      type="text"
                      list="skus-list"
                      value={customSku}
                      onChange={(e) => handleSkuChange(e.target.value)}
                      placeholder="Ej: 774198"
                      className="w-full text-sm font-mono font-bold bg-white border-2 border-black rounded-xl px-3.5 py-2.5 outline-none text-black shadow-[2px_2px_0px_#000]"
                    />
                    <datalist id="skus-list">
                      {currentCatalog.map((c) => (
                        <option key={c.sku} value={c.sku}>
                          [{c.categoria}] {c.descripcion}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* Categoría (se autoselecciona al coincidir SKU o se elige manual) */}
                  <div className="sm:col-span-3">
                    <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1 font-mono">
                      Categoría *
                    </label>
                    <CleanSelect
                      value={customCategory}
                      onChange={(val) => setCustomCategory(val as any)}
                      options={categoriaOptions}
                      size="md"
                      fullWidth
                      dropdownWidth="w-full"
                      className="w-full justify-between"
                    />
                  </div>

                  {/* Descripción del Hardware */}
                  <div className="sm:col-span-6">
                    <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1 font-mono">
                      Descripción del Hardware *
                    </label>
                    <input
                      id="component-desc"
                      type="text"
                      list="desc-list"
                      value={customDesc}
                      onChange={(e) => handleDescChange(e.target.value)}
                      placeholder="Ej: CPU INTEL I5-12400 2.5GHZ... o escribir nombre"
                      className="w-full text-sm font-bold bg-white border-2 border-black rounded-xl px-3.5 py-2.5 outline-none text-black shadow-[2px_2px_0px_#000]"
                    />
                    <datalist id="desc-list">
                      {currentCatalog.map((c) => (
                        <option key={c.sku} value={c.descripcion}>
                          SKU {c.sku} [{c.categoria}]
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* Serial / IMEI */}
                  <div className="sm:col-span-8">
                    <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1 font-mono">
                      Serial Físico / IMEI (Opcional · vacío = N/A)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="component-serial"
                        type="text"
                        value={customSerial}
                        onChange={(e) => setCustomSerial(e.target.value)}
                        placeholder="Escanear serial físico o dejar vacío (se asignará N/A)..."
                        className="w-full min-w-0 text-sm font-mono bg-white border-2 border-black rounded-xl px-3.5 py-2.5 outline-none text-black shadow-[2px_2px_0px_#000]"
                      />
                      <ScanButton
                        onClick={() => setScannerTarget({ mode: "new" })}
                        icon="qr"
                        title="Abrir cámara para escanear Código de Barras o código QR"
                      />
                    </div>
                  </div>

                  {/* Botón Agregar */}
                  <div className="sm:col-span-4 flex items-end">
                    <button
                      type="button"
                      onClick={() => handleAddComponent()}
                      className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#FFD23F] hover:bg-[#FACC15] text-black text-xs sm:text-sm font-heading font-extrabold rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>+ Agregar a la Orden</span>
                    </button>
                  </div>

                </div>

                {/* Error de campos obligatorios del componente */}
                {componentError && (
                  <div className="text-xs font-mono font-bold text-white bg-[#E76F51] border-2 border-black px-3.5 py-2.5 rounded-xl flex items-center gap-2 shadow-[2px_2px_0px_#000]">
                    <AlertCircle className="w-4 h-4 text-white flex-shrink-0" />
                    <span>{componentError}</span>
                  </div>
                )}

                {/* Aviso visual de coincidencia automática */}
                {skuMatchNotice && (
                  <div className="text-xs font-mono font-bold text-black bg-[#2A9D8F]/25 border-2 border-black px-3.5 py-2.5 rounded-xl flex items-center gap-2 shadow-[2px_2px_0px_#000]">
                    <CheckCircle2 className="w-4 h-4 text-black flex-shrink-0" />
                    <span>{skuMatchNotice}</span>
                  </div>
                )}

                {/* Alerta en tiempo real de conflicto previsto al escribir o escanear un componente */}
                {prospectiveConflict && (
                  <div
                    className={`p-3.5 rounded-xl border-2 border-black text-xs flex items-start gap-3 shadow-[4px_4px_0px_#000] transition-all ${
                      prospectiveConflict.tipo === "ERROR"
                        ? "bg-[#E76F51]/20 text-black"
                        : "bg-[#FFD23F]/30 text-black"
                    }`}
                  >
                    {prospectiveConflict.tipo === "ERROR" ? (
                      <ShieldAlert className="w-5 h-5 text-black flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-black flex-shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-mono font-black uppercase tracking-wider text-[10px] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] ${
                            prospectiveConflict.tipo === "ERROR"
                              ? "bg-[#E76F51] text-white"
                              : "bg-[#FFD23F] text-black"
                          }`}
                        >
                          {prospectiveConflict.tipo === "ERROR" ? "Conflicto Detectado antes de Agregar" : "Advertencia Técnica"}
                        </span>
                        <strong className="text-xs sm:text-sm font-heading font-extrabold text-black">
                          {prospectiveConflict.titulo}
                        </strong>
                      </div>
                      <p className="text-xs leading-relaxed font-medium text-neutral-800">
                        {prospectiveConflict.detalle}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ESCUDO DE COMPATIBILIDAD DE HARDWARE (MOTOR ARMAR-PC) */}
              {tipoServicio === "Montaje" && components.length > 0 && resultadoCompatibilidad && (
                <div
                  className={`p-4 sm:p-5 rounded-2xl border-2 border-black transition-all space-y-3.5 shadow-[4px_4px_0px_#000] ${
                    resultadoCompatibilidad.totalErrores > 0
                      ? "bg-[#E76F51]/15"
                      : resultadoCompatibilidad.totalWarnings > 0
                      ? "bg-[#FFD23F]/20"
                      : "bg-[#2A9D8F]/15"
                  }`}
                >
                  {/* Cabecera del Escudo */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000] ${
                          resultadoCompatibilidad.totalErrores > 0
                            ? "bg-[#E76F51] text-white"
                            : resultadoCompatibilidad.totalWarnings > 0
                            ? "bg-[#FFD23F] text-black"
                            : "bg-[#2A9D8F] text-white"
                        }`}
                      >
                        {resultadoCompatibilidad.totalErrores > 0 ? (
                          <ShieldAlert className="w-5 h-5" />
                        ) : resultadoCompatibilidad.totalWarnings > 0 ? (
                          <AlertTriangle className="w-5 h-5" />
                        ) : (
                          <ShieldCheck className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-heading font-extrabold text-black flex items-center gap-2">
                          <span>Escudo de Compatibilidad de Ensamble</span>
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-white border border-black text-black shadow-[1px_1px_0px_#000]">
                            Motor Armar-PC
                          </span>
                        </h3>
                        <p className="text-xs text-neutral-800 font-medium">
                          {resultadoCompatibilidad.totalErrores > 0
                            ? `Se detectaron ${resultadoCompatibilidad.totalErrores} incompatibilidad(es) física(s) que impiden el funcionamiento correcto.`
                            : resultadoCompatibilidad.totalWarnings > 0
                            ? `Componentes compatibles con ${resultadoCompatibilidad.totalWarnings} advertencia(s) para optimización.`
                            : "Todos los componentes cargados son 100% compatibles física y eléctricamente."}
                        </p>
                      </div>
                    </div>

                    {/* Badges de Consumo Eléctrico y Estado */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border-2 border-black text-xs font-mono font-bold text-black shadow-[2px_2px_0px_#000]">
                        <Zap className="w-3.5 h-3.5 text-black" />
                        <span>Consumo: ~{resultadoCompatibilidad.consumoTotalWatts}W</span>
                        <span className="text-neutral-400">|</span>
                        <span className="text-neutral-700">Fuente recomendada: {resultadoCompatibilidad.fuenteRecomendadaWatts}W+</span>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-mono font-extrabold border-2 border-black flex items-center gap-1.5 shadow-[2px_2px_0px_#000] ${
                          resultadoCompatibilidad.totalErrores > 0
                            ? "bg-[#E76F51] text-white"
                            : resultadoCompatibilidad.totalWarnings > 0
                            ? "bg-[#FFD23F] text-black"
                            : "bg-[#2A9D8F] text-white"
                        }`}
                      >
                        {resultadoCompatibilidad.totalErrores > 0 ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Incompatible ({resultadoCompatibilidad.totalErrores})</span>
                          </>
                        ) : resultadoCompatibilidad.totalWarnings > 0 ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Con Advertencias ({resultadoCompatibilidad.totalWarnings})</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>100% Compatible</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Lista de Alertas Críticas (Errores) */}
                  {resultadoCompatibilidad.totalErrores > 0 && (
                    <div className="space-y-2 pt-1">
                      {resultadoCompatibilidad.alertas
                        .filter((a) => a.tipo === "ERROR")
                        .map((alerta, idx) => (
                          <div
                            key={idx}
                            className="p-3 sm:p-3.5 rounded-xl bg-white border-2 border-black text-black space-y-1 shadow-[2px_2px_0px_#000]"
                          >
                            <div className="flex items-center gap-2 font-heading font-extrabold text-[#E76F51] text-xs sm:text-sm">
                              <span>⛔</span>
                              <span>{alerta.titulo}</span>
                            </div>
                            <p className="text-xs sm:text-[13px] leading-relaxed text-neutral-800 font-medium pl-6">
                              {alerta.detalle}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Lista de Advertencias Técnicas (Warnings) */}
                  {resultadoCompatibilidad.totalWarnings > 0 && (
                    <div className="space-y-2 pt-1">
                      {resultadoCompatibilidad.alertas
                        .filter((a) => a.tipo === "WARNING")
                        .map((alerta, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-white border-2 border-black text-black space-y-1 shadow-[2px_2px_0px_#000]"
                          >
                            <div className="flex items-center gap-2 font-heading font-extrabold text-[#B45309] text-xs">
                              <span>⚠️</span>
                              <span>{alerta.titulo}</span>
                            </div>
                            <p className="text-xs leading-relaxed text-neutral-800 font-medium pl-6">
                              {alerta.detalle}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Checklist de Compatibilidad cuando está 100% Compatible */}
                  {resultadoCompatibilidad.totalErrores === 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      <div className="p-2.5 rounded-xl bg-white border-2 border-black flex items-center gap-2 shadow-[2px_2px_0px_#000]">
                        <CheckCircle2 className="w-4 h-4 text-[#2A9D8F] shrink-0 stroke-[2.5]" />
                        <span className="font-mono font-bold text-black">Socket CPU &amp; Placa</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border-2 border-black flex items-center gap-2 shadow-[2px_2px_0px_#000]">
                        <CheckCircle2 className="w-4 h-4 text-[#2A9D8F] shrink-0 stroke-[2.5]" />
                        <span className="font-mono font-bold text-black">Generación de RAM</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border-2 border-black flex items-center gap-2 shadow-[2px_2px_0px_#000]">
                        <CheckCircle2 className="w-4 h-4 text-[#2A9D8F] shrink-0 stroke-[2.5]" />
                        <span className="font-mono font-bold text-black">Refrigeración &amp; Gabinete</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white border-2 border-black flex items-center gap-2 shadow-[2px_2px_0px_#000]">
                        <CheckCircle2 className="w-4 h-4 text-[#2A9D8F] shrink-0 stroke-[2.5]" />
                        <span className="font-mono font-bold text-black">Capacidad Eléctrica</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tabla de Componentes Agregados */}
              {components.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-black rounded-xl space-y-2 bg-[#FAF6EE]">
                  <Cpu className="w-9 h-9 text-black mx-auto" />
                  <p className="text-sm font-heading font-extrabold text-black">
                    Aún no se han registrado componentes en esta orden.
                  </p>
                  <p className="text-xs text-neutral-600 font-medium">
                    {tipoServicio === "Montaje"
                      ? "Ingrese el SKU (ej: 774198 para i5-12400 o 879268 para placa Asus) para autocompletar y presione '+ Agregar a la Orden'."
                      : "Ingrese el SKU o descripción de la Notebook y el módulo de memoria SODIMM o disco SSD a instalar."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#FAF6EE] border-b-2 border-black text-black font-mono uppercase text-xs">
                      <tr>
                        <th className="py-3 px-3.5 font-bold">SKU</th>
                        <th className="py-3 px-3.5 font-bold">Categoría</th>
                        <th className="py-3 px-3.5 font-bold">Descripción Hardware</th>
                        <th className="py-3 px-3.5 font-bold">Serial / IMEI Físico</th>
                        <th className="py-3 px-3 text-right font-bold">Quitar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/20">
                      {components.map((item, index) => (
                        <tr key={index} className="hover:bg-[#FAF6EE]/50 transition-colors">
                          <td className="py-3 px-3.5 font-mono font-bold text-black whitespace-nowrap text-sm">
                            <span>{item.sku}</span>
                            {item.upc && (
                              <span className="block text-xs font-normal text-neutral-600">
                                UPC: {item.upc}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#FAF6EE] text-black border border-black shadow-[1px_1px_0px_#000]">
                              {item.categoria}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 font-bold text-black min-w-[240px] text-sm">
                            <div>{item.descripcion}</div>
                            {enrichedComponents[index] && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {enrichedComponents[index].socket && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF6EE] text-black border border-black font-bold">
                                    Socket {enrichedComponents[index].socket}
                                  </span>
                                )}
                                {enrichedComponents[index].ramType && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF6EE] text-black border border-black font-bold">
                                    {enrichedComponents[index].ramType}
                                  </span>
                                )}
                                {enrichedComponents[index].categoria === "GABINETE" && (
                                  <span
                                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border border-black font-bold ${
                                      (enrichedComponents[index].maxRadiatorMm ?? 0) > 0
                                        ? "bg-[#2A9D8F] text-white"
                                        : "bg-[#FAF6EE] text-black"
                                    }`}
                                  >
                                    Soporte Rad: {(enrichedComponents[index].maxRadiatorMm ?? 0) > 0 ? `${enrichedComponents[index].maxRadiatorMm}mm` : "0mm (Solo Aire)"}
                                  </span>
                                )}
                                {enrichedComponents[index].categoria === "REFRIGERACION" && enrichedComponents[index].isAioLiquid && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FFD23F] text-black border border-black font-bold">
                                    Líquida {enrichedComponents[index].radiatorSizeMm ? `${enrichedComponents[index].radiatorSizeMm}mm` : "AIO"}
                                  </span>
                                )}
                                {enrichedComponents[index].potenciaWatts ? (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FFD23F] text-black border border-black font-bold">
                                    {enrichedComponents[index].potenciaWatts}W
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 min-w-[200px]">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item.seriales}
                                onChange={(e) => handleUpdateComponentField(index, "seriales", e.target.value)}
                                onBlur={(e) => {
                                  if (!e.target.value.trim()) {
                                    handleUpdateComponentField(index, "seriales", "N/A");
                                  }
                                }}
                                placeholder="N/A o escanee serial..."
                                className="w-full min-w-0 text-sm font-mono border-2 border-black rounded-lg px-2.5 py-1.5 bg-white text-black font-bold outline-none shadow-[1px_1px_0px_#000]"
                              />
                              <ScanButton
                                onClick={() => setScannerTarget({ mode: "row", index })}
                                icon="barcode"
                                compact
                                title="Escanear QR o Código de barras con cámara"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(index)}
                              className="p-1.5 text-black hover:text-white hover:bg-[#E76F51] rounded-lg border-2 border-transparent hover:border-black transition-all cursor-pointer shadow-none hover:shadow-[1px_1px_0px_#000]"
                              title="Eliminar de la orden"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* SECCIÓN 4: ASIGNACIÓN A TÉCNICO RESPONSABLE & PRIORIDAD */}
            <section className="bg-[#FFFDF9] p-5 sm:p-6 rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-[#FFD23F] text-black border-2 border-black text-xs sm:text-sm flex items-center justify-center font-heading font-black shadow-[1px_1px_0px_#000]">
                    4
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-heading font-extrabold text-black">
                      Técnico Responsable &amp; Compromiso
                    </h2>
                    <span className="text-xs text-neutral-600 font-medium">
                      Técnico de laboratorio asignado, prioridad de cola y fecha prometida
                    </span>
                  </div>
                </div>
                <Wrench className="w-5 h-5 text-black" />
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-2 ${assignedTech === "OTRO" ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3 sm:gap-4`}>
                {/* Técnico Responsable */}
                <div>
                  <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1.5">
                    Técnico Responsable *
                  </label>
                  <CleanSelect
                    value={assignedTech}
                    onChange={(val) => setAssignedTech(val)}
                    options={tecnicoOptions}
                    size="md"
                    fullWidth
                    dropdownWidth="w-full"
                    searchable
                    searchPlaceholder="Buscar técnico..."
                    className="w-full justify-between"
                  />
                </div>

                {/* Técnico personalizado si seleccionó OTRO */}
                {assignedTech === "OTRO" && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1">
                        Nombre del Técnico *
                      </label>
                      <span className="text-[10px] text-neutral-600 font-mono font-bold">
                        Enter confirma
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        id="input-custom-tech"
                        type="text"
                        required
                        value={customTech}
                        onChange={(e) => setCustomTech(e.target.value)}
                        onBlur={handleConfirmCustomTech}
                        placeholder="Ej: Carlos Silva"
                        className="w-full text-xs sm:text-sm border-2 border-black rounded-lg px-3 py-2 bg-white text-black font-bold outline-none shadow-[1px_1px_0px_#000]"
                      />
                      <button
                        type="button"
                        onClick={handleConfirmCustomTech}
                        className="px-3 py-2 text-xs font-heading font-extrabold bg-[#FFD23F] hover:bg-[#FACC15] text-black border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] whitespace-nowrap cursor-pointer"
                        title="Guardar técnico en la lista"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                )}

                {/* Prioridad */}
                <div>
                  <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1.5">
                    Prioridad de Entrega
                  </label>
                  <CleanSelect
                    value={priority}
                    onChange={(val) => setPriority(val as any)}
                    options={prioridadOptions}
                    size="md"
                    fullWidth
                    dropdownWidth="w-full"
                    className="w-full justify-between"
                  />
                </div>

                {/* Fecha Estimada */}
                <div>
                  <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1.5">
                    Fecha Prometida de Entrega
                  </label>
                  <CleanDatePicker
                    value={assemblyDate}
                    onChange={(val) => setAssemblyDate(val)}
                    placeholder="DD / MM / AAAA"
                    align="right"
                    size="md"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="text-xs sm:text-sm text-black font-heading font-extrabold block mb-1.5">
                  Observaciones / Instrucciones del Vendedor para el Taller
                </label>
                <textarea
                  rows={3}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder={
                    tipoServicio === "Montaje"
                      ? "Ej: Actualizar BIOS a última versión para microprocesador, verificar cable management limpio y pruebas térmicas Cinebench."
                      : "Ej: Instalación de módulo adicional de memoria SODIMM en Slot 2 y verificación en Windows Task Manager."
                  }
                  className="w-full text-xs sm:text-sm border-2 border-black rounded-xl p-3 bg-white text-black font-medium outline-none shadow-[2px_2px_0px_#000]"
                />
              </div>
            </section>

          </div>

          {/* COLUMNA LATERAL: RESUMEN, WHATSAPP & BOTÓN REGISTRAR (4 cols) */}
          <div className="lg:col-span-4 space-y-6">

            {/* Tarjeta Resumen de la Orden Neo-Brutalista */}
            <div className="bg-[#FFFDF9] p-5 sm:p-6 rounded-xl border-3 border-black shadow-[6px_6px_0px_#000] space-y-4 sticky top-6">
              <div className="border-b-2 border-black pb-3">
                <span className="text-xs sm:text-sm font-heading font-extrabold text-black uppercase tracking-wider bg-[#FFD23F] px-2.5 py-1 border-2 border-black rounded shadow-[2px_2px_0px_#000] inline-block">
                  Resumen de Ingreso al Taller
                </span>
              </div>

              <div className="space-y-2.5 text-xs sm:text-sm divide-y-2 divide-dashed divide-black/20">
                <div className="pt-2 flex justify-between items-center">
                  <span className="font-mono text-neutral-700 text-xs">Vendedor:</span>
                  <strong className="text-black font-mono font-bold text-right">
                    {salesAgent === "OTRO" ? customSalesAgent || "No especificado" : salesAgent}
                  </strong>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <span className="font-mono text-neutral-700 text-xs">Canal:</span>
                  <span className="font-mono font-bold text-black">{salesChannel}</span>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <span className="font-mono text-neutral-700 text-xs">Nro. Registro / Interno:</span>
                  <span className="font-mono font-bold text-black bg-[#FFD23F] px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000]">
                    {nroRegistroInterno || "---"}
                  </span>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <span className="font-mono text-neutral-700 text-xs">Cliente:</span>
                  <strong className="text-black font-mono font-bold text-right truncate max-w-[180px]">
                    {clientName || "Sin asignar"}
                  </strong>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <span className="font-mono text-neutral-700 text-xs">Modalidad:</span>
                  <span className="px-2 py-0.5 rounded bg-[#FAF6EE] text-black font-mono text-xs font-bold border border-black shadow-[1px_1px_0px_#000]">
                    {tipoServicio === "Montaje" ? "Montaje PC" : "Expansión Notebook"}
                  </span>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <span className="font-mono text-neutral-700 text-xs">Cantidad de Equipos:</span>
                  <span className="font-mono font-bold text-black">
                    {cantidadEquipos} {cantidadEquipos === 1 ? "unidad" : "unidades"}
                  </span>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <span className="font-mono text-neutral-700 text-xs">Técnico Responsable:</span>
                  <span className="text-black font-mono font-bold">
                    {assignedTech === "OTRO" ? customTech || "No especificado" : assignedTech}
                  </span>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <span className="font-mono text-neutral-700 text-xs">Piezas cargadas:</span>
                  <span className="font-mono font-bold text-black tabular-nums">
                    {components.length} ítems
                  </span>
                </div>

                {tipoServicio === "Montaje" && (
                  <>
                    <div className="pt-2 flex justify-between items-center">
                      <span className="font-mono text-neutral-700 text-xs">Compatibilidad:</span>
                      {components.length === 0 ? (
                        <span className="text-neutral-500 font-mono text-xs">Sin piezas</span>
                      ) : (resultadoCompatibilidad?.totalErrores ?? 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded-lg bg-[#E76F51] text-white border border-black font-mono text-xs font-bold flex items-center gap-1 shadow-[1px_1px_0px_#000]">
                          <ShieldAlert className="w-3 h-3 text-white" />
                          <span>Incompatible ({resultadoCompatibilidad?.totalErrores})</span>
                        </span>
                      ) : (resultadoCompatibilidad?.totalWarnings ?? 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded-lg bg-[#FFD23F] text-black border border-black font-mono text-xs font-bold flex items-center gap-1 shadow-[1px_1px_0px_#000]">
                          <AlertTriangle className="w-3 h-3 text-black" />
                          <span>Con Advertencia</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-[#2A9D8F] text-white border border-black font-mono text-xs font-bold flex items-center gap-1 shadow-[1px_1px_0px_#000]">
                          <ShieldCheck className="w-3 h-3 text-white" />
                          <span>100% Compatible</span>
                        </span>
                      )}
                    </div>

                    {components.length > 0 && resultadoCompatibilidad && (
                      <div className="pt-2 flex justify-between items-center text-xs">
                        <span className="font-mono text-neutral-700">Potencia estimada:</span>
                        <span className="font-mono font-bold text-black">
                          ~{resultadoCompatibilidad.consumoTotalWatts}W (Pico: {resultadoCompatibilidad.fuenteRecomendadaWatts}W)
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Previsualización Notificación WhatsApp al Grupo Montajes */}
              <div className="pt-3 border-t-2 border-black space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-mono text-black uppercase block font-bold">
                    Aviso al Grupo WhatsApp (Montajes):
                  </span>
                  <span className="text-xs font-mono font-bold text-white bg-[#2A9D8F] border-2 border-black px-2 py-0.5 rounded-lg inline-flex items-center gap-1 shadow-[1px_1px_0px_#000]">
                    <Send className="w-3 h-3 text-white" />
                    Montajes
                  </span>
                </div>
                <pre className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-mono text-black whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed shadow-[2px_2px_0px_#000]">
                  {generateWhatsAppMessage()}
                </pre>
              </div>

              {/* Botón de Enviar Formulario */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#FFD23F] hover:bg-[#FACC15] text-black text-sm sm:text-base font-heading font-extrabold rounded-xl border-2 border-black shadow-[4px_4px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Guardando y enviando al grupo...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-black stroke-[2.5]" />
                    <span>Registrar Ingreso de Montaje</span>
                  </>
                )}
              </button>

              <p className="text-xs text-neutral-700 font-medium text-center">
                La orden ingresará a la cola activa del taller bajo la responsabilidad de{" "}
                <span className="font-bold text-black">{assignedTech === "OTRO" ? customTech || "nuevo técnico" : assignedTech}</span>.
              </p>
            </div>

          </div>

        </form>

        <BarcodeScannerModal
          isOpen={scannerTarget !== null}
          scanMode={scannerTarget?.mode === "nro_reg" ? "barcode" : "all"}
          title={
            scannerTarget?.mode === "nro_reg"
              ? "Escanear Nro. Registro / Interno (Barras)"
              : scannerTarget?.mode === "upc"
                ? "Escanear UPC / Código de Producto"
                : "Escanear Serial (QR / Código de Barras)"
          }
          subtitle={
            scannerTarget?.mode === "nro_reg"
              ? "Apuntá la cámara al código de barras del número de registro o comprobante."
              : scannerTarget?.mode === "upc"
                ? "Apuntá la cámara al código UPC de la caja para completar el SKU automáticamente o vincularlo."
                : "Apuntá la cámara a la etiqueta del componente. Detecta automáticamente QR, DataMatrix y códigos de barras."
          }
          onClose={() => setScannerTarget(null)}
          onDetected={(code, formatLabel) => {
            if (scannerTarget?.mode === "nro_reg") {
              setNroRegistroInterno(code);
            } else if (scannerTarget?.mode === "upc") {
              handleUpcChange(code, formatLabel);
            } else if (scannerTarget?.mode === "row") {
              handleUpdateComponentField(scannerTarget.index, "seriales", code);
            } else {
              setCustomSerial(code);
              setSkuMatchNotice(`Serial escaneado (${formatLabel}): ${code}`);
            }
            setScannerTarget(null);
          }}
        />

      </div>
    </main>
    </AuthGuard>
  );
}
