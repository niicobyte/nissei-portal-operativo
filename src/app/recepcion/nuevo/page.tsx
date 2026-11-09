"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Tag,
  Save,
  CheckCircle2,
  Send,
  CheckSquare,
  Sparkles,
  Layers,
  Search,
  Calendar,
  Barcode
} from "lucide-react";
import { addTicket, getStoredTickets, RecepcionTicket } from "@/data/recepcionData";
import {
  CATEGORY_FAMILIES,
  TOP_SATI_BRANDS,
  CategoryFamily
} from "@/data/recepcionCategories";
import { AuthBadge } from "@/components/common/AuthBadge";

export default function NuevoIngresoRetornoPage() {
  const router = useRouter();

  // Estados del Formulario SATI
  const [orderNumber, setOrderNumber] = useState("31409");
  const [codigoProducto, setCodigoProducto] = useState("769386");
  const [clientName, setClientName] = useState("Mariana Giménez Alcaraz");

  // Selección de Familia y Categoría Enriquecida
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("COMPUTACION");
  const [tipoComponente, setTipoComponente] = useState<string>("NOTEBOOK");
  const [marca, setMarca] = useState<string>("LENOVO");
  const [productModel, setProductModel] = useState("Legion Pro 5 16IRX8");
  const [serialNumber, setSerialNumber] = useState("PF4G89XK2023");
  const [fechaVenta, setFechaVenta] = useState("15/02/2025");

  // Dictamen y Observaciones Técnicas
  const [dictamen, setDictamen] = useState<"REPARADO" | "SIN_DEFECTO" | "NO_REPARADO">("REPARADO");
  const [technicalDetails, setTechnicalDetails] = useState(
    "Cambio de pasta térmica por Thermal Grizzly Kryonaut y limpieza integral de disipadores con ultrasonido. Stress test superado por 4 horas bajo carga Cinebench R23 sin throttling."
  );

  // Accesorios
  const [accessories, setAccessories] = useState<string[]>([
    "Cargador Original 230W",
    "Funda Acolchada",
    "Caja Original",
  ]);
  const [newAccessoryText, setNewAccessoryText] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  // Obtener la familia actual seleccionada
  const activeFamily = CATEGORY_FAMILIES.find((f) => f.id === selectedFamilyId) || CATEGORY_FAMILIES[0];

  // Calcular correlativo de orden SATI automáticamente
  useEffect(() => {
    const stored = getStoredTickets();
    if (stored && stored.length > 0) {
      const numericIds = stored
        .map((t) => Number(t.idOrden))
        .filter((n) => !isNaN(n));
      if (numericIds.length > 0) {
        const maxId = Math.max(...numericIds);
        setOrderNumber(String(maxId + 1));
      }
    }
  }, []);

  const handleSelectFamily = (family: CategoryFamily) => {
    setSelectedFamilyId(family.id);
    if (family.components.length > 0) {
      setTipoComponente(family.components[0]);
    }
  };

  const handleAddAccessory = () => {
    if (newAccessoryText.trim() && !accessories.includes(newAccessoryText.trim())) {
      setAccessories([...accessories, newAccessoryText.trim()]);
      setNewAccessoryText("");
    }
  };

  const handleRemoveAccessory = (indexToRemove: number) => {
    setAccessories(accessories.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);

    const estadoTicket =
      dictamen === "REPARADO"
        ? "Reparada"
        : dictamen === "SIN_DEFECTO"
        ? "Entregada"
        : "En Reparación";

    const newTicket: RecepcionTicket = {
      idOrden: orderNumber,
      codigoProducto: codigoProducto.trim() || String(Math.floor(100000 + Math.random() * 900000)),
      cliente: clientName.trim(),
      mensaje: `${technicalDetails}${
        accessories.length > 0 ? `\nAccesorios: ${accessories.join(", ")}` : ""
      }`,
      fechaIngreso: new Date().toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      fechaEntregada: dictamen === "SIN_DEFECTO" ? new Date().toLocaleDateString("es-PY") : undefined,
      fechaVenta: fechaVenta.trim() || undefined,
      estado: estadoTicket,
      tipoComponente: tipoComponente.trim().toUpperCase(),
      marca: marca.trim().toUpperCase(),
      modelo: productModel.trim(),
      serial: serialNumber.trim(),
    };

    addTicket(newTicket);

    // Envío automático al Grupo de Recepción Post-Venta vía WhaApi (Canal RECEPCION)
    const msg = getWhatsAppMessage();
    fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "120363426626761732@g.us",
        channel: "RECEPCION",
        body: msg
      })
    }).catch((err) => console.error("[WHAPI ERROR]", err));

    setTimeout(() => {
      router.push("/recepcion");
    }, 1200);
  };

  // Previsualización del mensaje para WhatsApp
  const getWhatsAppMessage = () => {
    let statusText = "";
    if (dictamen === "REPARADO") {
      statusText = "✅ *REPARADO CON ÉXITO*\nEl equipo superó satisfactoriamente las pruebas de control de calidad y está listo para ser retirado.";
    } else if (dictamen === "SIN_DEFECTO") {
      statusText = "ℹ️ *SIN DEFECTO COMPROBADO*\nEl equipo superó el ciclo de pruebas continuas de 48hs sin reproducir la falla indicada. Conserva su garantía de fábrica.";
    } else {
      statusText = "⚠️ *NO REPARADO / DERIVADO A RMA*\nSe requiere gestión de garantía con fabricante o emisión de nota de crédito comercial.";
    }

    const accText = accessories.length > 0 ? accessories.join(", ") : "Sin accesorios adicionales";

    return `El Cliente *${clientName || "Cliente"}* ya se encuentra en el sector de Post-Venta y listo para el retiro

📋 *Orden SATI:* #${orderNumber}
🏷️ *Cód. Producto:* ${codigoProducto || "N/A"}
💻 *Equipo:* ${marca} ${productModel || "Equipo"}
📦 *Categoría:* ${tipoComponente}
🔢 *Serie:* ${serialNumber || "N/A"}

📊 *Dictamen Técnico:*
${statusText}

📦 *Accesorios incluidos:*
${accText}`;
  };

  return (
    <main className="min-h-screen bg-[#fbf9f9] py-6 sm:py-8 2xl:py-12 px-3 sm:px-6 lg:px-8 2xl:px-16">
      <div className="max-w-7xl 2xl:max-w-[1700px] 3xl:max-w-[2200px] mx-auto space-y-6 2xl:space-y-8">
        
        {/* Cabecera con Botón Volver Mejorado */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 gap-2 flex-wrap">
          <Link
            href="/recepcion"
            className="group inline-flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-zinc-700 bg-white hover:bg-zinc-50 hover:text-zinc-900 border border-zinc-200 rounded-lg shadow-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-500 group-hover:-translate-x-0.5 group-hover:text-zinc-900 transition-transform" />
            <span>Volver al Dashboard Post-Venta</span>
          </Link>
          <AuthBadge requiredModule="recepcion" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">
            Nuevo Ingreso de Retorno de Laboratorio
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 max-w-4xl">
            Catálogo completo de hardware SATI NISSEI. Seleccione la familia, subtipo de producto, marca y especificaciones exactas para registrar la orden en el sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Formulario Principal (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Sección 01: Datos Generales */}
            <section className="bg-white p-4 sm:p-6 2xl:p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
              <h2 className="text-sm sm:text-base 2xl:text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span className="w-6 h-6 2xl:w-7 2xl:h-7 rounded-lg bg-zinc-900 text-white text-xs 2xl:text-sm flex items-center justify-center font-bold">
                  1
                </span>
                Datos Generales del Servicio
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-xs 2xl:text-sm text-zinc-500 font-mono block mb-1">
                    Nº ORDEN SATI (AUTOGENERADO)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={`#${orderNumber}`}
                    className="w-full bg-zinc-100 text-xs sm:text-sm 2xl:text-base font-mono border border-zinc-200 rounded-xl px-3 py-2 text-zinc-700 cursor-not-allowed font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs 2xl:text-sm text-zinc-500 font-mono block mb-1">
                    NOMBRE COMPLETO DEL CLIENTE *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ej. Carlos Figueredo"
                    className="w-full text-xs sm:text-sm border border-zinc-200 rounded-xl px-3 py-2 focus:border-zinc-900 outline-none transition-colors"
                  />
                </div>
              </div>
            </section>

            {/* Sección 02: Catálogo Expandido de Familias y Tipos de Producto */}
            <section className="bg-white p-4 sm:p-6 2xl:p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm sm:text-base 2xl:text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <span className="w-6 h-6 2xl:w-7 2xl:h-7 rounded-lg bg-zinc-900 text-white text-xs 2xl:text-sm flex items-center justify-center font-bold">
                    2
                  </span>
                  Familia de Producto &amp; Categoría SATI
                </h2>
                <span className="text-xs text-zinc-500 font-mono">
                  12 Familias Operativas · +80 Tipos Específicos
                </span>
              </div>

              {/* Paso 2.1: Cuadrícula de 12 Familias de Productos Reales */}
              <div>
                <label className="text-xs font-semibold text-zinc-600 block mb-2 font-mono">
                  1. Seleccione la Familia Principal de Hardware:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                  {CATEGORY_FAMILIES.map((fam) => {
                    const isSelected = selectedFamilyId === fam.id;
                    return (
                      <button
                        type="button"
                        key={fam.id}
                        onClick={() => handleSelectFamily(fam)}
                        className={`p-2.5 rounded-lg border text-left transition-colors flex flex-col justify-between gap-2 ${
                          isSelected
                            ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                            : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={`w-6 h-6 rounded flex items-center justify-center font-mono text-[10px] font-bold ${
                              isSelected ? "bg-white text-zinc-900" : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                            }`}
                          >
                            {fam.icon}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded tabular-nums ${
                              isSelected ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
                            }`}
                          >
                            {fam.components.length} tipos
                          </span>
                        </div>
                        <span className="font-semibold text-xs truncate w-full">{fam.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Paso 2.2: Subcomponente Específico SATI */}
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-semibold text-zinc-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-zinc-700" />
                    2. Tipo de Componente Específico en {activeFamily.name}:
                  </label>
                  <span className="text-[11px] text-zinc-500">
                    {activeFamily.description}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {activeFamily.components.map((comp) => {
                    const isCompActive = tipoComponente.toUpperCase() === comp.toUpperCase();
                    return (
                      <button
                        type="button"
                        key={comp}
                        onClick={() => setTipoComponente(comp)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isCompActive
                            ? "bg-zinc-900 text-white shadow-sm"
                            : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100"
                        }`}
                      >
                        {comp}
                      </button>
                    );
                  })}
                </div>

                {/* Campo libre o buscador de componente */}
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500 font-mono whitespace-nowrap">
                    O personalizar tipo:
                  </span>
                  <input
                    type="text"
                    value={tipoComponente}
                    onChange={(e) => setTipoComponente(e.target.value.toUpperCase())}
                    placeholder="Ej. NOTEBOOK, CAMARA IP, PROYECTOR..."
                    className="w-full text-xs font-mono font-bold bg-white border border-zinc-200 rounded-lg px-3 py-1.5 focus:border-zinc-900 outline-none"
                  />
                </div>
              </div>

              {/* Paso 2.3: Selección de Marca Real */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-600 block uppercase tracking-wider font-mono">
                  3. Marca del Equipo (Top SATI CDE):
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white border border-zinc-200 rounded-xl scrollbar-thin">
                  {TOP_SATI_BRANDS.map((b) => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => setMarca(b)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                        marca.toUpperCase() === b.toUpperCase()
                          ? "bg-zinc-900 text-white shadow-sm"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paso 2.4: Campos de Hardware y Trazabilidad SATI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
                <div>
                  <label className="text-xs text-zinc-500 font-mono block mb-1">
                    MARCA SELECCIONADA *
                  </label>
                  <input
                    type="text"
                    required
                    value={marca}
                    onChange={(e) => setMarca(e.target.value.toUpperCase())}
                    placeholder="Ej. LENOVO, EPSON, XIAOMI..."
                    className="w-full text-xs sm:text-sm font-bold border border-zinc-200 rounded-xl px-3 py-2 focus:border-zinc-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-500 font-mono block mb-1">
                    MODELO EXACTO *
                  </label>
                  <input
                    type="text"
                    required
                    value={productModel}
                    onChange={(e) => setProductModel(e.target.value)}
                    placeholder="Ej. Legion Pro 5 16IRX8, Buds 8 Pro..."
                    className="w-full text-xs sm:text-sm border border-zinc-200 rounded-xl px-3 py-2 focus:border-zinc-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-500 font-mono block mb-1">
                    NÚMERO DE SERIE / IMEI *
                  </label>
                  <input
                    type="text"
                    required
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Ej. PF4G89XK2023"
                    className="w-full text-xs sm:text-sm font-mono border border-zinc-200 rounded-xl px-3 py-2 focus:border-zinc-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-500 font-mono block mb-1 flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5 text-zinc-400" />
                    CÓDIGO PRODUCTO NISSEI (OPCIONAL)
                  </label>
                  <input
                    type="text"
                    value={codigoProducto}
                    onChange={(e) => setCodigoProducto(e.target.value)}
                    placeholder="Ej. 870754"
                    className="w-full text-xs sm:text-sm font-mono border border-zinc-200 rounded-xl px-3 py-2 focus:border-zinc-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-500 font-mono block mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    FECHA VENTA / FACTURA (OPCIONAL)
                  </label>
                  <input
                    type="text"
                    value={fechaVenta}
                    onChange={(e) => setFechaVenta(e.target.value)}
                    placeholder="DD/MM/AAAA (Ej. 15/02/2025)"
                    className="w-full text-xs sm:text-sm font-mono border border-zinc-200 rounded-xl px-3 py-2 focus:border-zinc-900 outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Sección 03: Dictamen y Pruebas Técnicas */}
            <section className="bg-white p-4 sm:p-6 2xl:p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
              <h2 className="text-sm sm:text-base 2xl:text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span className="w-6 h-6 2xl:w-7 2xl:h-7 rounded-lg bg-zinc-900 text-white text-xs 2xl:text-sm flex items-center justify-center font-bold">
                  3
                </span>
                Dictamen Resolutivo de Laboratorio
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Reparado */}
                <div
                  onClick={() => setDictamen("REPARADO")}
                  className={`p-4 rounded-xl cursor-pointer border transition-all flex flex-col justify-between ${
                    dictamen === "REPARADO"
                      ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                      : "border-zinc-200 hover:border-emerald-400 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-800 text-sm">✓ Reparado con Éxito</span>
                    <input
                      type="radio"
                      name="dictamen"
                      checked={dictamen === "REPARADO"}
                      onChange={() => setDictamen("REPARADO")}
                      className="accent-emerald-700"
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                    Solucionado con cambio de piezas, microelectrónica o calibración técnica.
                  </p>
                </div>

                {/* Sin Defecto */}
                <div
                  onClick={() => setDictamen("SIN_DEFECTO")}
                  className={`p-4 rounded-xl cursor-pointer border transition-all flex flex-col justify-between ${
                    dictamen === "SIN_DEFECTO"
                      ? "border-zinc-700 bg-zinc-100 shadow-sm"
                      : "border-zinc-200 hover:border-zinc-400 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-800 text-sm">ℹ Sin Defecto Comprobado</span>
                    <input
                      type="radio"
                      name="dictamen"
                      checked={dictamen === "SIN_DEFECTO"}
                      onChange={() => setDictamen("SIN_DEFECTO")}
                      className="accent-zinc-700"
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                    Superó banco de pruebas y stress test continuo sin reproducir la falla.
                  </p>
                </div>

                {/* No Reparado */}
                <div
                  onClick={() => setDictamen("NO_REPARADO")}
                  className={`p-4 rounded-xl cursor-pointer border transition-all flex flex-col justify-between ${
                    dictamen === "NO_REPARADO"
                      ? "border-rose-600 bg-rose-50/50 shadow-sm"
                      : "border-zinc-200 hover:border-rose-400 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-800 text-sm">✕ No Reparado / RMA</span>
                    <input
                      type="radio"
                      name="dictamen"
                      checked={dictamen === "NO_REPARADO"}
                      onChange={() => setDictamen("NO_REPARADO")}
                      className="accent-rose-700"
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                    Sin repuesto disponible, daño irreparable o presupuesto comercial rechazado.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-mono block mb-1">
                  DETALLE TÉCNICO Y PRUEBAS EJECUTADAS *
                </label>
                <textarea
                  rows={3}
                  required
                  value={technicalDetails}
                  onChange={(e) => setTechnicalDetails(e.target.value)}
                  placeholder="Describa el procedimiento realizado en banco, componentes y stress test..."
                  className="w-full text-xs sm:text-sm border border-zinc-200 rounded-xl p-3 focus:border-zinc-900 outline-none transition-colors leading-relaxed"
                />
              </div>

              {/* Accesorios con chips interactivos */}
              <div>
                <label className="text-xs text-zinc-500 font-mono block mb-2">
                  ACCESORIOS DEVUELTOS CON EL EQUIPO
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {accessories.map((acc, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-zinc-100 rounded-xl text-zinc-900 font-semibold flex items-center gap-1.5 border border-zinc-200"
                    >
                      <Tag className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{acc}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAccessory(idx)}
                        className="text-rose-600 hover:text-rose-800 font-bold ml-1 text-sm"
                        title="Quitar accesorio"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={newAccessoryText}
                      onChange={(e) => setNewAccessoryText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddAccessory();
                        }
                      }}
                      placeholder="Nuevo accesorio..."
                      className="text-xs border border-dashed border-zinc-300 rounded-xl px-3 py-1.5 outline-none focus:border-zinc-900 bg-zinc-50"
                    />
                    <button
                      type="button"
                      onClick={handleAddAccessory}
                      className="px-2.5 py-1.5 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-black"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Acciones Secundarias */}
            <div className="flex items-center justify-between pt-2">
              <Link
                href="/recepcion"
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                ← Volver a Bandeja de Recepción
              </Link>
            </div>
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
                  <span className="text-zinc-500">Nro. Orden SATI:</span>
                  <span className="font-mono font-bold text-zinc-900">#{orderNumber}</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Cód. Producto:</span>
                  <span className="font-mono font-semibold text-zinc-800">{codigoProducto || "---"}</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Cliente:</span>
                  <strong className="text-zinc-900 text-right truncate max-w-[180px]">
                    {clientName || "Sin asignar"}
                  </strong>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Equipo:</span>
                  <strong className="text-zinc-900 text-right truncate max-w-[180px]">
                    {marca} {productModel || "Equipo"}
                  </strong>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Categoría:</span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 font-mono text-[11px] font-semibold">
                    {tipoComponente}
                  </span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Nº Serie:</span>
                  <span className="font-mono font-semibold text-zinc-900">{serialNumber || "---"}</span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Dictamen Técnico:</span>
                  <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold border ${
                    dictamen === "REPARADO"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : dictamen === "SIN_DEFECTO"
                      ? "bg-zinc-100 text-zinc-800 border-zinc-200"
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}>
                    {dictamen === "REPARADO" ? "Reparado" : dictamen === "SIN_DEFECTO" ? "Sin Defecto" : "No Reparado"}
                  </span>
                </div>

                <div className="pt-2 flex justify-between">
                  <span className="text-zinc-500">Accesorios incluidos:</span>
                  <span className="font-mono font-bold text-zinc-900 tabular-nums">
                    {accessories.length} {accessories.length === 1 ? "ítem" : "ítems"}
                  </span>
                </div>
              </div>

              {/* Previsualización Notificación WhatsApp */}
              <div className="pt-3 border-t border-zinc-200 space-y-1.5">
                <span className="text-[11px] font-mono text-zinc-500 uppercase block font-semibold">
                  Aviso Automático de WhatsApp al Cliente:
                </span>
                <pre className="p-2.5 rounded bg-zinc-50 border border-zinc-200 text-[11px] font-mono text-zinc-700 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                  {getWhatsAppMessage()}
                </pre>
              </div>

              {/* Botón de Enviar Formulario */}
              <button
                type="submit"
                disabled={isSaved}
                className="w-full py-3 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSaved ? (
                  <span>Registrando en SATI...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Guardar Registro de Retorno</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-zinc-400 text-center">
                El equipo quedará registrado en la bandeja de retornos y se notificará al cliente vía WhatsApp.
              </p>
            </div>

            {/* Protocolo de Entrega SATI */}
            <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm space-y-3 text-xs">
              <h4 className="font-bold text-zinc-900 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                Protocolo de Entrega SATI
              </h4>
              <ul className="space-y-2 text-zinc-600">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Confirmar número de serie/IMEI físico contra factura de compra.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Verificar todos los accesorios listados antes del empaque final.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Adjuntar informe de pruebas y firma del técnico responsable.</span>
                </li>
              </ul>
            </div>

          </div>

        </form>

      </div>
    </main>
  );
}
