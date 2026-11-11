"use client";

import React, { useState, useMemo, useEffect } from "react";
import { CleanSelect, CleanSelectOption } from "@/components/common/CleanSelect";
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
  Search,
  Check
} from "lucide-react";
import {
  CATALOGO_MONTAJE_PC,
  CATALOGO_EXPANSION_NOTEBOOK,
  CATALOGO_HARDWARE_REAL,
  LISTA_VENDEDORES_REALES,
  LISTA_TECNICOS_MONTAJE,
  ComponenteMontaje,
  OrdenMontajeReal,
  addMontajeAsync,
  fetchMontajesFromMySQL,
  getPendingDirtyMontajeIds,
  getStoredVendedores,
  addCustomVendedor
} from "@/data/montajesData";
import { setCloudSyncWarning } from "@/lib/cloudSync";
import { AuthBadge } from "@/components/common/AuthBadge";
import { AuthGuard } from "@/components/common/AuthGuard";

export default function NuevoIngresoMontajePage() {
  const router = useRouter();

  // Lista dinámica de vendedores persistida en localStorage
  const [listaVendedores, setListaVendedores] = useState<string[]>(LISTA_VENDEDORES_REALES);

  useEffect(() => {
    setListaVendedores(getStoredVendedores());
    fetchMontajesFromMySQL().then(() => {
      setListaVendedores(getStoredVendedores());
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
  const [clientPhone, setClientPhone] = useState<string>("");
  const [tipoServicio, setTipoServicio] = useState<"Montaje" | "Expansion">("Montaje");

  // 3. APARTADO DE COMPONENTES DE HARDWARE
  const [components, setComponents] = useState<ComponenteMontaje[]>([]);
  
  // Catálogo activo según la modalidad
  const currentCatalog = tipoServicio === "Montaje" ? CATALOGO_MONTAJE_PC : CATALOGO_EXPANSION_NOTEBOOK;

  // Estados para el ingreso de componente (manual con autocompletado por SKU)
  const [customSku, setCustomSku] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customCategory, setCustomCategory] = useState<ComponenteMontaje["categoria"]>(
    tipoServicio === "Montaje" ? "PROCESADOR" : "NOTEBOOK"
  );
  const [customSerial, setCustomSerial] = useState("");
  const [skuMatchNotice, setSkuMatchNotice] = useState<string | null>(null);

  // 4. APARTADO DE TÉCNICO RESPONSABLE & PRIORIDAD
  const [assignedTech, setAssignedTech] = useState<"Nicolas Solis" | "Magaly Yegros" | "Juan Ronnebeck">(
    LISTA_TECNICOS_MONTAJE[0]
  );
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

  const tecnicoOptions: CleanSelectOption[] = LISTA_TECNICOS_MONTAJE.map((t) => ({
    value: t,
    label: t,
  }));

  const prioridadOptions: CleanSelectOption[] = [
    { value: "NORMAL", label: "NORMAL (Cola estándar 48h)" },
    { value: "EXPRESS", label: "EXPRESS (Prioridad 24h)" },
    { value: "URGENTE", label: "URGENTE (Despacho en el día)" },
  ];
  const [assemblyDate, setAssemblyDate] = useState<string>(deliveryDateDefault);
  const [observations, setObservations] = useState<string>("");

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cambiar modalidad y reiniciar valores
  const handleChangeTipoServicio = (tipo: "Montaje" | "Expansion") => {
    setTipoServicio(tipo);
    setCustomCategory(tipo === "Montaje" ? "PROCESADOR" : "NOTEBOOK");
    setCustomSku("");
    setCustomDesc("");
    setCustomSerial("");
    setSkuMatchNotice(null);
  };

  // Autocompletado inteligente cuando se escribe o selecciona el SKU
  const handleSkuChange = (skuVal: string) => {
    setCustomSku(skuVal);
    const clean = skuVal.trim();
    if (!clean) {
      setSkuMatchNotice(null);
      return;
    }

    // Buscar en catálogo de la modalidad o en el general
    const found =
      currentCatalog.find((c) => c.sku.toLowerCase() === clean.toLowerCase()) ||
      CATALOGO_HARDWARE_REAL.find((c) => c.sku.toLowerCase() === clean.toLowerCase());

    if (found) {
      setCustomCategory(found.categoria);
      setCustomDesc(found.descripcion);
      setSkuMatchNotice(`Coincidencia oficial encontrada: [${found.categoria}] ${found.descripcion}`);
    } else {
      setSkuMatchNotice(null);
    }
  };

  // Autocompletado inverso si se escribe o selecciona la descripción
  const handleDescChange = (descVal: string) => {
    setCustomDesc(descVal);
    const clean = descVal.trim();
    if (!clean) return;

    const found =
      currentCatalog.find((c) => c.descripcion.toLowerCase() === clean.toLowerCase()) ||
      CATALOGO_HARDWARE_REAL.find((c) => c.descripcion.toLowerCase() === clean.toLowerCase());

    if (found) {
      setCustomSku(found.sku);
      setCustomCategory(found.categoria);
      setSkuMatchNotice(`SKU asignado automáticamente: ${found.sku}`);
    }
  };

  // Agregar componente a la tabla
  const handleAddComponent = () => {
    if (!customDesc.trim()) {
      alert("Por favor ingrese la descripción del componente o un SKU válido.");
      return;
    }

    const newComponent: ComponenteMontaje = {
      sku: customSku.trim() || `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      descripcion: customDesc.trim(),
      seriales: customSerial.trim() || "Sin serial visible",
      categoria: customCategory
    };

    setComponents((prev) => [...prev, newComponent]);

    // Limpiar campos listos para el siguiente componente
    setCustomSku("");
    setCustomDesc("");
    setCustomSerial("");
    setSkuMatchNotice(null);
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

    // 3. Cliente / Razón Social -> Salta a Teléfono
    if (target.id === "input-client-name") {
      document.getElementById("input-client-phone")?.focus();
      return;
    }

    // 4. Teléfono del cliente -> Salta a SKU del componente
    if (target.id === "input-client-phone") {
      document.getElementById("component-sku")?.focus();
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

    // 7. Serial del componente -> Si hay descripción, agrega el componente a la orden y vuelve a SKU
    if (target.id === "component-serial") {
      if (customDesc.trim()) {
        handleAddComponent();
        setTimeout(() => {
          document.getElementById("component-sku")?.focus();
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

    const cleanReg = nroRegistroInterno.replace(/[^0-9]/g, "") || String(Math.floor(100000 + Math.random() * 900000));
    const prefix = tipoServicio === "Montaje" ? "MNT" : "EXP";
    const newId = `${prefix}-${cleanReg.slice(0, 7)}`;

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
      cantidadEquipos: 1,
      tecnico: assignedTech,
      etapa: "ARMADO_MECANICO",
      progreso: 35,
      prioridad: priority,
      consumoEstimado: tipoServicio === "Montaje" ? "550W" : undefined,
      observaciones: observations.trim(),
      componentes: components
    };

    // Guardar en almacenamiento local y confirmar persistencia en MySQL en la nube
    await addMontajeAsync(newOrder);
    if (getPendingDirtyMontajeIds().includes(newOrder.id)) {
      setCloudSyncWarning(
        `Orden #${newOrder.id} guardada localmente, pero MySQL en la nube no confirmó aún. Pulse "Sincronizar Nube" al conectarse.`
      );
    }

    // Envío automático al Grupo de Montajes vía WhaApi (Canal MONTAJES -> Grupo 120363428540171277@g.us)
    const msg = generateWhatsAppMessage();
    fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "MONTAJES",
        to: "120363428540171277@g.us",
        body: msg
      })
    }).catch((err) => console.error("[WHAPI ERROR]", err));

    router.push("/tecnicos");
  };

  // Mensaje para notificación de WhatsApp
  const generateWhatsAppMessage = () => {
    const compText = components
      .map((c) => `• [${c.categoria}] ${c.descripcion} (SKU: ${c.sku} | S/N: ${c.seriales || "A registrar en banco"})`)
      .join("\n");

    const effectiveVendedor = salesAgent === "OTRO" ? customSalesAgent.trim() || "Asesor Comercial" : salesAgent;

    return `El montaje de *${clientName || "Cliente"}*, ha ingresado y finalizara en la brevedad posible:

*Nro. Registro / Interno:* ${nroRegistroInterno || "Pendiente"}
*Vendedor Responsable:* ${effectiveVendedor} (${salesChannel})
*Servicio:* ${tipoServicio === "Montaje" ? "Montaje de PC Completa" : "Expansión / Upgrade de Notebook"}
*Técnico Responsable:* ${assignedTech}
*Prioridad:* ${priority}
*Fecha Estimada de Entrega:* ${assemblyDate}

*Componentes a Procesar:*
${compText || "(Sin componentes registrados aún)"}${observations ? `\n\n*Observaciones:* ${observations}` : ""}`;
  };

  return (
    <AuthGuard requiredModule="montajes">
      <main className="min-h-screen bg-[#fbf9f9] py-6 sm:py-8 2xl:py-12 px-3 sm:px-6 lg:px-8 2xl:px-16">
      <div className="max-w-7xl 2xl:max-w-[1700px] 3xl:max-w-[2200px] mx-auto space-y-6 2xl:space-y-8">
        
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
                {/* Vendedor */}
                <div>
                  <label className="text-xs text-zinc-600 font-semibold block mb-1">
                    Vendedor Comercial *
                  </label>
                  <CleanSelect
                    value={salesAgent}
                    onChange={(val) => setSalesAgent(val)}
                    options={vendedorOptions}
                    fullWidth
                    dropdownWidth="w-full"
                    searchable
                    searchPlaceholder="Buscar vendedor..."
                    className="w-full justify-between"
                  />
                </div>

                {/* Vendedor personalizado si seleccionó OTRO */}
                {salesAgent === "OTRO" && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-zinc-600 font-semibold block">
                        Nombre del Asesor *
                      </label>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Enter confirma
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        id="input-custom-sales-agent"
                        type="text"
                        required
                        value={customSalesAgent}
                        onChange={(e) => setCustomSalesAgent(e.target.value)}
                        onBlur={handleConfirmCustomSalesAgent}
                        placeholder="Ej: Laura Benítez"
                        className="w-full text-xs sm:text-sm border border-zinc-200 rounded-lg px-3 py-2 focus:border-zinc-900 outline-none text-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={handleConfirmCustomSalesAgent}
                        className="px-2.5 py-2 text-xs font-semibold bg-zinc-900 hover:bg-black text-white rounded-lg whitespace-nowrap shadow-xs"
                        title="Guardar asesor en la lista"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                )}

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
                  <input
                    id="input-nro-registro"
                    type="text"
                    required
                    value={nroRegistroInterno}
                    onChange={(e) => setNroRegistroInterno(e.target.value)}
                    placeholder="Ej: 966.565 ó 001-002-0045892"
                    className="w-full text-xs sm:text-sm font-mono border border-zinc-200 rounded-lg px-3 py-2 focus:border-zinc-900 outline-none font-bold text-zinc-900"
                  />
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
                    Teléfono / WhatsApp de Contacto
                  </label>
                  <input
                    id="input-client-phone"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="Ej: +595 983 123 456"
                    className="w-full text-xs sm:text-sm font-mono border border-zinc-200 rounded-lg px-3 py-2 focus:border-zinc-900 outline-none text-zinc-900"
                  />
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
                      Ingrese el SKU para autocompletar la categoría y descripción oficial, o complete los campos de forma manual.
                    </span>
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                  {components.length} {components.length === 1 ? "componente" : "componentes"}
                </span>
              </div>

              {/* Formulario de Ingreso Directo Inteligente (OPCIÓN DEFAULT) */}
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-xs font-bold text-zinc-900 uppercase font-mono tracking-wide flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-zinc-700" />
                    Cargar Componente a la Orden:
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Escriba el SKU o elija de las sugerencias
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  
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
                      Serial Físico / IMEI (Opcional)
                    </label>
                    <input
                      id="component-serial"
                      type="text"
                      value={customSerial}
                      onChange={(e) => setCustomSerial(e.target.value)}
                      placeholder="Escanear serial físico o dejar en blanco si no tiene..."
                      className="w-full text-xs font-mono bg-white border border-zinc-300 rounded-lg px-3 py-2 outline-none focus:border-zinc-900 text-zinc-900 shadow-sm"
                    />
                  </div>

                  {/* Botón Agregar */}
                  <div className="sm:col-span-4 flex items-end">
                    <button
                      type="button"
                      onClick={handleAddComponent}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-4 bg-zinc-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Agregar a la Orden</span>
                    </button>
                  </div>

                </div>

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
                            {item.sku}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-100 text-zinc-700 border border-zinc-200">
                              {item.categoria}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-zinc-900 min-w-[220px]">
                            {item.descripcion}
                          </td>
                          <td className="py-2.5 px-3 min-w-[160px]">
                            <input
                              type="text"
                              value={item.seriales}
                              onChange={(e) => handleUpdateComponentField(index, "seriales", e.target.value)}
                              placeholder="Sin serial visible o escanee..."
                              className="w-full text-xs font-mono border border-zinc-200 rounded px-2 py-1 focus:border-zinc-900 outline-none"
                            />
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                {/* Técnico Responsable: Nicolas Solis, Magaly Yegros, Juan Ronnebeck */}
                <div>
                  <label className="text-xs text-zinc-600 font-semibold block mb-1">
                    Técnico Responsable *
                  </label>
                  <CleanSelect
                    value={assignedTech}
                    onChange={(val) => setAssignedTech(val as any)}
                    options={tecnicoOptions}
                    fullWidth
                    dropdownWidth="w-full"
                    className="w-full justify-between"
                  />
                </div>

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
                  <span className="text-zinc-500">Técnico Responsable:</span>
                  <span className="text-zinc-900 font-bold">{assignedTech}</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Piezas cargadas:</span>
                  <span className="font-mono font-bold text-zinc-900 tabular-nums">
                    {components.length} ítems
                  </span>
                </div>
              </div>

              {/* Previsualización Notificación WhatsApp */}
              <div className="pt-3 border-t border-zinc-200 space-y-1.5">
                <span className="text-[11px] font-mono text-zinc-500 uppercase block font-semibold">
                  Aviso Automático de WhatsApp al Cliente:
                </span>
                <pre className="p-2.5 rounded bg-zinc-50 border border-zinc-200 text-[11px] font-mono text-zinc-700 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                  {generateWhatsAppMessage()}
                </pre>
              </div>

              {/* Botón de Enviar Formulario */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Registrando en taller...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Registrar Ingreso de Montaje</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-zinc-400 text-center">
                La orden ingresará a la cola activa del taller bajo la responsabilidad de {assignedTech}.
              </p>
            </div>

          </div>

        </form>

      </div>
    </main>
    </AuthGuard>
  );
}
