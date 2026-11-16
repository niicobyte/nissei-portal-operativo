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
  Laptop,
  Upload,
  FileSpreadsheet,
  Send,
  Database,
} from "lucide-react";
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
  parseSkuImportText,
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
  const skuFileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Estados para importador masivo CSV / Lista de SKUs a MySQL
  const [showSkuImporter, setShowSkuImporter] = useState(false);
  const [skuImportText, setSkuImportText] = useState("");
  const [isImportingSkus, setIsImportingSkus] = useState(false);
  const [skuImportFeedback, setSkuImportFeedback] = useState<string | null>(null);

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

  // Importar lote de SKUs desde archivo CSV o lista pegada hacia MySQL
  const handleSaveImportedSkus = async (rawText: string) => {
    const parsed = parseSkuImportText(rawText);
    if (parsed.length === 0) {
      setSkuImportFeedback(
        "No se detectaron SKUs válidos. Usá formato: SKU, Descripción, Categoría (opcional)."
      );
      return;
    }
    setIsImportingSkus(true);
    setSkuImportFeedback(null);
    const res = await saveSkusToCatalogOnline(parsed);
    setSkuCatalog(res.items);
    setIsImportingSkus(false);
    if (res.ok) {
      setSkuImportFeedback(
        `¡Listo! ${res.totalGuardados} SKU(s) guardados en MySQL (catalogo_sku) y disponibles para todo el equipo.`
      );
      setSkuImportText("");
    } else {
      setSkuImportFeedback(
        res.error || "Guardado localmente, pero falló la sincronización con MySQL."
      );
    }
  };

  const handleSkuCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await handleSaveImportedSkus(text);
    if (skuFileInputRef.current) {
      skuFileInputRef.current.value = "";
    }
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
      consumoEstimado: tipoServicio === "Montaje" ? "550W" : undefined,
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
      <main className="min-h-dvh bg-[#fbf9f9] py-4 sm:py-6 lg:py-8 2xl:py-10 px-3 sm:px-5 lg:px-7 2xl:px-10">
      <div className="w-full max-w-[1680px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] mx-auto space-y-5 lg:space-y-6 2xl:space-y-8 min-w-0">
        
        {/* Cabecera con Botón Volver Mejorado */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 gap-2 flex-wrap">
          <Link
            href="/tecnicos"
            className="group inline-flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-700 bg-white hover:bg-zinc-50 hover:text-zinc-900 border border-zinc-200 rounded-lg shadow-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-500 group-hover:-translate-x-0.5 group-hover:text-zinc-900 transition-transform" />
            <span>Volver al Dashboard de Montajes</span>
          </Link>
          <AuthBadge requiredModule="tecnicos" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
            Nuevo Ingreso de Montaje &amp; Ensamble de PC
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 max-w-4xl">
            Carga de órdenes operativas para ensambles de computadoras de escritorio y expansiones de memoria o almacenamiento en notebooks.
          </p>
        </div>

        {restoredDraftBanner && (
          <div className="p-3.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-medium">
                Se restauró tu carga en progreso automáticamente tras reiniciar sesión.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRestoredDraftBanner(false)}
              className="text-[11px] font-semibold text-indigo-700 hover:underline shrink-0 cursor-pointer"
            >
              Ocultar
            </button>
          </div>
        )}

        {formError && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-medium">{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* COLUMNA PRINCIPAL DE FORMULARIO (8 cols) */}
          <div className="lg:col-span-8 space-y-6">

            {/* SECCIÓN 1: APARTADO DE VENDEDOR & CANAL COMERCIAL */}
            <section className="bg-white p-5 sm:p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white text-xs flex items-center justify-center font-bold">
                    1
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-zinc-900">
                      Apartado de Vendedor &amp; Canal Comercial
                    </h2>
                    <span className="text-xs text-zinc-500">
                      Asesor comercial responsable, canal de venta y número de registro interno
                    </span>
                  </div>
                </div>
                <ShoppingBag className="w-5 h-5 text-zinc-400" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Vendedor Comercial Categorizado */}
                <div>
                  <label className="text-xs text-zinc-600 font-semibold block mb-1">
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
                  <label className="text-xs text-zinc-600 font-semibold block mb-1">
                    Canal de Venta
                  </label>
                  <CleanSelect
                    value={salesChannel}
                    onChange={(val) => setSalesChannel(val as any)}
                    options={canalOptions}
                    fullWidth
                    dropdownWidth="w-full"
                    className="w-full justify-between"
                  />
                </div>

                {/* Nro. Registro / Interno */}
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-600 font-semibold block mb-1">
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
                      className="w-full min-w-0 text-xs sm:text-sm font-mono border border-zinc-200 rounded-lg px-3 py-2 focus:border-zinc-900 outline-none font-bold text-zinc-900"
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
                  <label className="text-xs text-zinc-600 font-semibold block mb-1">
                    Fecha de Facturación
                  </label>
                  <CleanDatePicker
                    value={invoiceDate}
                    onChange={(val) => setInvoiceDate(val)}
                    placeholder="DD / MM / AAAA"
                  />
                </div>
              </div>
            </section>

            {/* SECCIÓN 2: APARTADO DE DATOS DEL CLIENTE & MODALIDAD */}
            <section className="bg-white p-5 sm:p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-zinc-900">
                      Apartado de Datos del Cliente &amp; Tipo de Servicio
                    </h2>
                    <span className="text-xs text-zinc-500">
                      Titular de la orden y selección entre Ensamble de PC Completa o Expansión de Notebook
                    </span>
                  </div>
                </div>
                <User className="w-5 h-5 text-zinc-400" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-600 font-semibold block mb-1">
                    Cliente / Razón Social *
                  </label>
                  <input
                    id="input-client-name"
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ej: Prychen Wei / J.W.F. SA / Mariano Cano"
                    className="w-full text-xs sm:text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:border-zinc-900 outline-none font-semibold text-zinc-900"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-600 font-semibold block mb-1">
                    Cantidad de Equipos (PCs / Laptops) *
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCantidadEquipos((prev) => Math.max(1, prev - 1))}
                      className="px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-zinc-700 cursor-pointer"
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
                      className="w-full text-center text-xs sm:text-sm font-mono font-bold border border-zinc-200 rounded-lg px-2 py-2 focus:border-zinc-900 outline-none text-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => setCantidadEquipos((prev) => Math.min(99, prev + 1))}
                      className="px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-xs font-bold text-zinc-700 cursor-pointer"
                      aria-label="Sumar equipo"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Selector de Modalidad */}
              <div>
                <label className="text-xs text-zinc-600 font-semibold block mb-1.5">
                  Tipo de Servicio Técnico *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleChangeTipoServicio("Montaje")}
                    className={`p-3.5 rounded-lg border text-left transition-colors flex items-start gap-3 ${
                      tipoServicio === "Montaje"
                        ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                        : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 text-zinc-900"
                    }`}
                  >
                    <Cpu className={`w-5 h-5 mt-0.5 flex-shrink-0 ${tipoServicio === "Montaje" ? "text-white" : "text-zinc-700"}`} />
                    <div>
                      <strong className="block text-xs sm:text-sm font-bold">
                        Montaje de PC Completa
                      </strong>
                      <span className={`text-[11px] block mt-0.5 leading-relaxed ${tipoServicio === "Montaje" ? "text-zinc-300" : "text-zinc-500"}`}>
                        Ensamble desde cero: CPU, Placa Madre, RAM Desktop, GPU, Fuente, Gabinete, Cooler y SSD.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChangeTipoServicio("Expansion")}
                    className={`p-3.5 rounded-lg border text-left transition-colors flex items-start gap-3 ${
                      tipoServicio === "Expansion"
                        ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                        : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100 text-zinc-900"
                    }`}
                  >
                    <Laptop className={`w-5 h-5 mt-0.5 flex-shrink-0 ${tipoServicio === "Expansion" ? "text-white" : "text-zinc-700"}`} />
                    <div>
                      <strong className="block text-xs sm:text-sm font-bold">
                        Expansión / Upgrade de Notebook
                      </strong>
                      <span className={`text-[11px] block mt-0.5 leading-relaxed ${tipoServicio === "Expansion" ? "text-zinc-300" : "text-zinc-500"}`}>
                        Ampliación de hardware en laptops: Expansión de Memoria RAM SODIMM (DDR4/DDR5) o Almacenamiento SSD M.2/SATA.
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </section>

            {/* SECCIÓN 3: APARTADO DE COMPONENTES DE HARDWARE CON AUTOCOMPLETADO POR SKU */}
            <section className="bg-white p-5 sm:p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white text-xs flex items-center justify-center font-bold">
                    3
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-zinc-900">
                      Apartado de Componentes de Hardware ({tipoServicio === "Montaje" ? "PC Completa" : "Notebook & Expansión"})
                    </h2>
                    <span className="text-xs text-zinc-500">
                      Ingrese el SKU para autocompletar o cargue uno nuevo y quedará guardado en MySQL para todos.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={skuFileInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv"
                    onChange={handleSkuCsvFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowSkuImporter((prev) => !prev);
                      setSkuImportFeedback(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 cursor-pointer transition-colors"
                    title="Importar lista o CSV de SKUs a MySQL"
                  >
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{skuCatalog.length} SKUs en catálogo · Importar CSV</span>
                  </button>
                  <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                    {components.length} {components.length === 1 ? "componente" : "componentes"}
                  </span>
                </div>
              </div>

              {showSkuImporter && (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        Importar SKUs al Catálogo Maestro MySQL
                      </h3>
                      <p className="text-[11px] text-zinc-600">
                        Subí un archivo CSV o pegá una lista (<code className="font-mono">SKU, Descripción, Categoría, UPC</code>). Se sincroniza en la nube para cualquier PC.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => skuFileInputRef.current?.click()}
                      disabled={isImportingSkus}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-800 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Subir archivo .CSV</span>
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={skuImportText}
                    onChange={(e) => setSkuImportText(e.target.value)}
                    placeholder={"774198, CPU INTEL I5-12400 2.5GHZ LGA1700, PROCESADOR\n879268, MB ASUS PRIME H610M-D D4, PLACA_MADRE"}
                    className="w-full text-xs font-mono bg-white border border-zinc-200 rounded-lg p-2.5 outline-none focus:border-zinc-900 text-zinc-900"
                  />

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-zinc-600">
                      {skuImportFeedback || "También podés escribir un SKU nuevo directo abajo y se guardará automáticamente al agregarlo."}
                    </span>
                    <button
                      type="button"
                      disabled={isImportingSkus || !skuImportText.trim()}
                      onClick={() => void handleSaveImportedSkus(skuImportText)}
                      className="px-3 py-1.5 bg-zinc-900 hover:bg-black disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      {isImportingSkus ? "Guardando en MySQL..." : "Guardar Lista en MySQL"}
                    </button>
                  </div>
                </div>
              )}

              {/* Formulario de Ingreso Directo Inteligente (OPCIÓN DEFAULT) */}
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-xs font-bold text-zinc-900 uppercase font-mono tracking-wide flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-zinc-700" />
                    Cargar Componente a la Orden:
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Escanee el UPC o escriba el SKU
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* UPC / EAN arriba del SKU (autocompleta SKU/Descripción y se vincula en MySQL) */}
                  <div className="sm:col-span-12">
                    <label className="text-[11px] text-zinc-700 font-bold block mb-1 font-mono">
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
                        className="w-full min-w-0 text-xs font-mono font-bold bg-white border border-zinc-300 rounded-lg px-3 py-2 outline-none focus:border-zinc-900 text-zinc-900 shadow-sm"
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
                    <label className="text-[11px] text-zinc-700 font-bold block mb-1 font-mono">
                      SKU (Código) *
                    </label>
                    <input
                      id="component-sku"
                      type="text"
                      list="skus-list"
                      value={customSku}
                      onChange={(e) => handleSkuChange(e.target.value)}
                      placeholder="Ej: 774198"
                      className="w-full text-xs font-mono font-bold bg-white border border-zinc-300 rounded-lg px-3 py-2 outline-none focus:border-zinc-900 text-zinc-900 shadow-sm"
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
                    <label className="text-[11px] text-zinc-700 font-bold block mb-1 font-mono">
                      Categoría *
                    </label>
                    <CleanSelect
                      value={customCategory}
                      onChange={(val) => setCustomCategory(val as any)}
                      options={categoriaOptions}
                      fullWidth
                      dropdownWidth="w-full"
                      className="w-full justify-between"
                    />
                  </div>

                  {/* Descripción del Hardware */}
                  <div className="sm:col-span-6">
                    <label className="text-[11px] text-zinc-700 font-bold block mb-1 font-mono">
                      Descripción del Hardware *
                    </label>
                    <input
                      id="component-desc"
                      type="text"
                      list="desc-list"
                      value={customDesc}
                      onChange={(e) => handleDescChange(e.target.value)}
                      placeholder="Ej: CPU INTEL I5-12400 2.5GHZ... o escribir nombre"
                      className="w-full text-xs bg-white border border-zinc-300 rounded-lg px-3 py-2 outline-none focus:border-zinc-900 text-zinc-900 shadow-sm"
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
                    <label className="text-[11px] text-zinc-700 font-bold block mb-1 font-mono">
                      Serial Físico / IMEI (Opcional · vacío = N/A)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="component-serial"
                        type="text"
                        value={customSerial}
                        onChange={(e) => setCustomSerial(e.target.value)}
                        placeholder="Escanear serial físico o dejar vacío (se asignará N/A)..."
                        className="w-full min-w-0 text-xs font-mono bg-white border border-zinc-300 rounded-lg px-3 py-2 outline-none focus:border-zinc-900 text-zinc-900 shadow-sm"
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
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-4 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Agregar a la Orden</span>
                    </button>
                  </div>

                </div>

                {/* Error de campos obligatorios del componente */}
                {componentError && (
                  <div className="text-[11px] font-mono text-rose-800 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                    <span>{componentError}</span>
                  </div>
                )}

                {/* Aviso visual de coincidencia automática */}
                {skuMatchNotice && (
                  <div className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    <span>{skuMatchNotice}</span>
                  </div>
                )}
              </div>

              {/* Tabla de Componentes Agregados */}
              {components.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-zinc-200 rounded-lg space-y-2">
                  <Cpu className="w-8 h-8 text-zinc-400 mx-auto" />
                  <p className="text-xs font-medium text-zinc-600">
                    Aún no se han registrado componentes en esta orden.
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {tipoServicio === "Montaje"
                      ? "Ingrese el SKU (ej: 774198 para i5-12400 o 879268 para placa Asus) para autocompletar y presione '+ Agregar a la Orden'."
                      : "Ingrese el SKU o descripción de la Notebook y el módulo de memoria SODIMM o disco SSD a instalar."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-mono uppercase text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Categoría</th>
                        <th className="py-2.5 px-3">Descripción Hardware</th>
                        <th className="py-2.5 px-3">Serial / IMEI Físico</th>
                        <th className="py-2.5 px-2 text-right">Quitar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {components.map((item, index) => (
                        <tr key={index} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-zinc-900 whitespace-nowrap">
                            <span>{item.sku}</span>
                            {item.upc && (
                              <span className="block text-[10px] font-normal text-zinc-500">
                                UPC: {item.upc}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 text-zinc-700 border border-zinc-200">
                              {item.categoria}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-zinc-900 min-w-[220px]">
                            {item.descripcion}
                          </td>
                          <td className="py-2.5 px-3 min-w-[180px]">
                            <div className="flex items-center gap-1.5">
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
                                className="w-full min-w-0 text-xs font-mono border border-zinc-200 rounded px-2 py-1 focus:border-zinc-900 outline-none"
                              />
                              <ScanButton
                                onClick={() => setScannerTarget({ mode: "row", index })}
                                icon="barcode"
                                compact
                                title="Escanear QR o Código de barras con cámara"
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveComponent(index)}
                              className="p-1 text-zinc-400 hover:text-rose-600 rounded transition-colors"
                              title="Eliminar de la orden"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
            <section className="bg-white p-5 sm:p-6 rounded-xl border border-zinc-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white text-xs flex items-center justify-center font-bold">
                    4
                  </span>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-zinc-900">
                      Técnico Responsable &amp; Compromiso
                    </h2>
                    <span className="text-xs text-zinc-500">
                      Técnico de laboratorio asignado, prioridad de cola y fecha prometida
                    </span>
                  </div>
                </div>
                <Wrench className="w-5 h-5 text-zinc-400" />
              </div>

              <div className={`grid grid-cols-1 sm:grid-cols-2 ${assignedTech === "OTRO" ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3 sm:gap-4`}>
                {/* Técnico Responsable */}
                <div>
                  <label className="text-xs text-zinc-600 font-semibold block mb-1">
                    Técnico Responsable *
                  </label>
                  <CleanSelect
                    value={assignedTech}
                    onChange={(val) => setAssignedTech(val)}
                    options={tecnicoOptions}
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
                      <label className="text-xs text-zinc-600 font-semibold block">
                        Nombre del Técnico *
                      </label>
                      <span className="text-[10px] text-zinc-400 font-mono">
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
                        className="w-full text-xs sm:text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:border-zinc-900 outline-none text-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={handleConfirmCustomTech}
                        className="px-2.5 py-2 text-xs font-semibold bg-zinc-900 hover:bg-black text-white rounded-lg whitespace-nowrap shadow-xs cursor-pointer"
                        title="Guardar técnico en la lista"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                )}

                {/* Prioridad */}
                <div>
                  <label className="text-xs text-zinc-600 font-semibold block mb-1">
                    Prioridad de Entrega
                  </label>
                  <CleanSelect
                    value={priority}
                    onChange={(val) => setPriority(val as any)}
                    options={prioridadOptions}
                    fullWidth
                    dropdownWidth="w-full"
                    className="w-full justify-between"
                  />
                </div>

                {/* Fecha Estimada */}
                <div>
                  <label className="text-xs text-zinc-600 font-semibold block mb-1">
                    Fecha Prometida de Entrega
                  </label>
                  <CleanDatePicker
                    value={assemblyDate}
                    onChange={(val) => setAssemblyDate(val)}
                    placeholder="DD / MM / AAAA"
                    align="right"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="text-xs text-zinc-600 font-semibold block mb-1">
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
                  className="w-full text-xs sm:text-sm border border-zinc-200 rounded-lg p-3 focus:border-zinc-900 outline-none text-zinc-900"
                />
              </div>
            </section>

          </div>

          {/* COLUMNA LATERAL: RESUMEN, WHATSAPP & BOTÓN REGISTRAR (4 cols) */}
          <div className="lg:col-span-4 space-y-6">

            {/* Tarjeta Resumen de la Orden */}
            <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm space-y-4 sticky top-6">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide font-mono">
                Resumen de Ingreso al Taller
              </h3>

              <div className="space-y-3 text-xs divide-y divide-zinc-100">
                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Vendedor:</span>
                  <strong className="text-zinc-900 text-right">
                    {salesAgent === "OTRO" ? customSalesAgent || "No especificado" : salesAgent}
                  </strong>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Canal:</span>
                  <span className="font-medium text-zinc-800">{salesChannel}</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Nro. Registro / Interno:</span>
                  <span className="font-mono font-bold text-zinc-900">{nroRegistroInterno || "---"}</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Cliente:</span>
                  <strong className="text-zinc-900 text-right truncate max-w-[180px]">
                    {clientName || "Sin asignar"}
                  </strong>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Modalidad:</span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 font-mono text-[11px] font-semibold">
                    {tipoServicio === "Montaje" ? "Montaje PC" : "Expansión Notebook"}
                  </span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Cantidad de Equipos:</span>
                  <span className="font-mono font-bold text-zinc-900">
                    {cantidadEquipos} {cantidadEquipos === 1 ? "unidad" : "unidades"}
                  </span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Técnico Responsable:</span>
                  <span className="text-zinc-900 font-bold">
                    {assignedTech === "OTRO" ? customTech || "No especificado" : assignedTech}
                  </span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Piezas cargadas:</span>
                  <span className="font-mono font-bold text-zinc-900 tabular-nums">
                    {components.length} ítems
                  </span>
                </div>
              </div>

              {/* Previsualización Notificación WhatsApp al Grupo Montajes */}
              <div className="pt-3 border-t border-zinc-200 space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-mono text-zinc-500 uppercase block font-semibold">
                    Aviso al Grupo WhatsApp (Montajes):
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                    <Send className="w-2.5 h-2.5" />
                    Grupo CDE
                  </span>
                </div>
                <pre className="p-2.5 rounded bg-zinc-50 border border-zinc-200 text-[11px] font-mono text-zinc-700 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                  {generateWhatsAppMessage()}
                </pre>
              </div>

              {/* Botón de Enviar Formulario */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Guardando y enviando al grupo...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Registrar Ingreso de Montaje</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-zinc-400 text-center">
                La orden ingresará a la cola activa del taller bajo la responsabilidad de{" "}
                {assignedTech === "OTRO" ? customTech || "nuevo técnico" : assignedTech}.
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
