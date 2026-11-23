"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  MessageSquarePlus,
  Bug,
  Lightbulb,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  saveWorkDraft,
  loadWorkDraft,
  clearWorkDraft,
  useFlushDraftBeforeLogout,
} from "@/lib/workDrafts";

const FEEDBACK_DRAFT_KEY = "floating_feedback_form_v1";

interface FeedbackDraftData {
  nombre: string;
  tipo: "SUGERENCIA" | "BUG";
  detalle: string;
  isOpen?: boolean;
}

export function FloatingFeedbackWidget({
  defaultVendedor,
}: {
  defaultVendedor?: string;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"SUGERENCIA" | "BUG">("SUGERENCIA");
  const [detalle, setDetalle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);

  // Sincronizar con el vendedor seleccionado en /armar-pc si el campo nombre aún está vacío
  useEffect(() => {
    if (defaultVendedor && !nombre.trim()) {
      setNombre(defaultVendedor);
    }
  }, [defaultVendedor]);

  // Hidratar borrador previo o autocompletar nombre del vendedor si ya lo seleccionó en la página
  useEffect(() => {
    const saved = loadWorkDraft<FeedbackDraftData>(FEEDBACK_DRAFT_KEY);
    if (saved) {
      if (saved.nombre) setNombre(saved.nombre);
      if (saved.tipo === "BUG" || saved.tipo === "SUGERENCIA") setTipo(saved.tipo);
      if (saved.detalle) setDetalle(saved.detalle);
      if (saved.isOpen && saved.detalle) setIsOpen(true);
    }

    if (!saved?.nombre) {
      try {
        // Intentar recuperar el vendedor activo de /armar-pc o de la sesión operativa
        const armarDraft = loadWorkDraft<{ selectedVendedor?: string }>("armar_pc_v1");
        if (armarDraft?.selectedVendedor) {
          setNombre(armarDraft.selectedVendedor);
          return;
        }
        const rawSession =
          sessionStorage.getItem("nissei_active_session_v4") ||
          localStorage.getItem("nissei_active_session_v4");
        if (rawSession) {
          const parsed = JSON.parse(rawSession);
          if (parsed?.name) {
            setNombre(parsed.name);
          }
        }
      } catch {
        // Ignorar
      }
    }
  }, []);

  const persistCurrentDraft = useCallback(() => {
    if (!nombre.trim() && !detalle.trim()) {
      clearWorkDraft(FEEDBACK_DRAFT_KEY);
      return;
    }
    saveWorkDraft<FeedbackDraftData>(FEEDBACK_DRAFT_KEY, {
      nombre,
      tipo,
      detalle,
      isOpen,
    });
  }, [nombre, tipo, detalle, isOpen]);

  useEffect(() => {
    persistCurrentDraft();
  }, [persistCurrentDraft]);

  useFlushDraftBeforeLogout(persistCurrentDraft);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanNombre = nombre.trim();
    const cleanDetalle = detalle.trim();

    if (cleanNombre.length < 2) {
      setErrorMsg("Por favor ingresá tu nombre.");
      return;
    }

    if (cleanDetalle.length < 4) {
      setErrorMsg("Por favor detallá la sugerencia o el error encontrado.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: cleanNombre,
          tipo,
          detalle: cleanDetalle,
          pagina: pathname || "/armar-pc",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setErrorMsg(
          data?.error ||
            "No se pudo enviar el reporte en este momento. Intentá nuevamente."
        );
        return;
      }

      setSentSuccess(true);
      setDetalle("");
      saveWorkDraft<FeedbackDraftData>(FEEDBACK_DRAFT_KEY, {
        nombre: cleanNombre,
        tipo: "SUGERENCIA",
        detalle: "",
        isOpen: false,
      });

      setTimeout(() => {
        setSentSuccess(false);
        setIsOpen(false);
      }, 3200);
    } catch {
      setErrorMsg("Error de red al enviar la notificación. Verificá tu conexión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mostrar exclusivamente en la página /armar-pc
  if (!pathname || !pathname.startsWith("/armar-pc")) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 print:hidden">
      {/* Recuadro Flotante del Formulario */}
      {isOpen && (
        <div className="fixed bottom-20 right-3 left-3 sm:left-auto sm:right-5 sm:w-[390px] bg-[#FFFDF9] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-hidden animate-in fade-in duration-150 mb-1 z-50">
          {/* Cabecera */}
          <div className="bg-[#FFD23F] text-black border-b-2 border-black px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-black text-[#FFD23F] border border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                {tipo === "BUG" ? (
                  <Bug className="w-4 h-4 text-[#E76F51] stroke-[2.5]" />
                ) : (
                  <Lightbulb className="w-4 h-4 text-[#FFD23F] stroke-[2.5]" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-heading font-extrabold text-black leading-tight truncate">
                  Sugerencias &amp; Reporte de Bugs
                </h4>
                <span className="text-[11px] font-mono font-bold text-neutral-800 block truncate">
                  Notificación directa por WhatsApp
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setErrorMsg(null);
              }}
              className="p-1.5 rounded-lg text-black hover:bg-black hover:text-white border border-black shadow-[1px_1px_0px_#000] transition-colors cursor-pointer shrink-0"
              title="Cerrar formulario"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Cuerpo del Formulario */}
          {sentSuccess ? (
            <div className="p-6 text-center space-y-3 bg-[#FAF6EE]">
              <div className="w-12 h-12 rounded-xl bg-[#2A9D8F] border-2 border-black text-white flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-heading font-extrabold text-black">
                  ¡Reporte enviado con éxito!
                </h5>
                <p className="text-xs text-neutral-700 leading-relaxed font-medium">
                  Tu {tipo === "BUG" ? "reporte de error" : "sugerencia"} ya fue enviado por{" "}
                  <strong className="text-black font-extrabold">WhatsApp</strong> con todo el detalle. ¡Muchas gracias por colaborar!
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSentSuccess(false);
                  setIsOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-black hover:bg-zinc-800 text-[#FFD23F] border-2 border-black text-xs font-heading font-extrabold cursor-pointer shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              >
                Cerrar ventana
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3.5 bg-[#FFFDF9]">
              {/* 1. Selector de Tipo: Sugerencia o Error / Bug */}
              <div>
                <label className="text-xs font-heading font-extrabold text-black block mb-1.5">
                  ¿Qué deseas reportar?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTipo("SUGERENCIA");
                      setErrorMsg(null);
                    }}
                    className={`p-2.5 rounded-xl border-2 border-black text-left transition-all cursor-pointer flex items-center gap-2 ${
                      tipo === "SUGERENCIA"
                        ? "bg-[#FFD23F] text-black shadow-[2px_2px_0px_#000]"
                        : "bg-[#FAF6EE] text-neutral-700 hover:bg-white shadow-[1px_1px_0px_#000]"
                    }`}
                  >
                    <Lightbulb
                      className="w-4 h-4 shrink-0 text-black stroke-[2.5]"
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-heading font-extrabold text-black block leading-tight">
                        Sugerencia
                      </span>
                      <span className="text-[10px] font-mono text-neutral-700 block truncate">
                        Idea o mejora
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTipo("BUG");
                      setErrorMsg(null);
                    }}
                    className={`p-2.5 rounded-xl border-2 border-black text-left transition-all cursor-pointer flex items-center gap-2 ${
                      tipo === "BUG"
                        ? "bg-[#E76F51] text-white shadow-[2px_2px_0px_#000]"
                        : "bg-[#FAF6EE] text-neutral-700 hover:bg-white shadow-[1px_1px_0px_#000]"
                    }`}
                  >
                    <Bug
                      className={`w-4 h-4 shrink-0 stroke-[2.5] ${
                        tipo === "BUG" ? "text-white" : "text-black"
                      }`}
                    />
                    <div className="min-w-0">
                      <span className={`text-xs font-heading font-extrabold block leading-tight ${
                        tipo === "BUG" ? "text-white" : "text-black"
                      }`}>
                        Algún Bug / Error
                      </span>
                      <span className={`text-[10px] font-mono block truncate ${
                        tipo === "BUG" ? "text-white/90" : "text-neutral-700"
                      }`}>
                        Falla en la página
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Nombre del Vendedor */}
              <div>
                <label className="text-xs font-heading font-extrabold text-black block mb-1">
                  Tu Nombre (Vendedor) <span className="text-[#E76F51]">*</span>
                </label>
                <input
                  type="text"
                  maxLength={80}
                  required
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Ej: Marcelo Gómez..."
                  className="w-full bg-[#FAF6EE] focus:bg-white border-2 border-black rounded-xl px-3 py-2 text-xs sm:text-sm font-sans font-medium text-black outline-none shadow-[2px_2px_0px_#000] transition-colors"
                />
              </div>

              {/* 3. Detalle de la Sugerencia o Bug */}
              <div>
                <label className="text-xs font-heading font-extrabold text-black block mb-1">
                  {tipo === "BUG"
                    ? "Detalle del error o bug encontrado"
                    : "Detalle de tu sugerencia o mejora"}{" "}
                  <span className="text-[#E76F51]">*</span>
                </label>
                <textarea
                  rows={4}
                  maxLength={1500}
                  required
                  value={detalle}
                  onChange={(e) => {
                    setDetalle(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={
                    tipo === "BUG"
                      ? "Describí qué error encontraste en la página (ej: qué botón o componente dio problema)..."
                      : "Contanos qué idea o mejora te gustaría que agreguemos a la página..."
                  }
                  className="w-full bg-[#FAF6EE] focus:bg-white border-2 border-black rounded-xl p-3 text-xs sm:text-sm text-black outline-none shadow-[2px_2px_0px_#000] transition-colors resize-none leading-relaxed font-sans"
                />
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-[#E76F51]/15 border-2 border-black text-black text-xs font-heading font-extrabold flex items-center gap-2 shadow-[2px_2px_0px_#000]">
                  <AlertCircle className="w-4 h-4 text-[#E76F51] shrink-0 stroke-[2.5]" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Botón de Envío a WhatsApp */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2.5 px-4 rounded-xl text-white text-xs sm:text-sm font-heading font-extrabold border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${
                  tipo === "BUG"
                    ? "bg-[#E76F51] hover:bg-rose-700"
                    : "bg-[#2A9D8F] hover:bg-emerald-600"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando a WhatsApp...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {tipo === "BUG"
                        ? "Enviar Reporte de Bug por WhatsApp"
                        : "Enviar Sugerencia por WhatsApp"}
                    </span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Botón Flotante Inferior Derecho */}
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setErrorMsg(null);
          setSentSuccess(false);
        }}
        className={`group flex items-center gap-2.5 px-4 sm:px-5 py-3 rounded-full border-2 border-black font-heading font-extrabold text-xs sm:text-sm tracking-tight transition-all cursor-pointer shadow-[3px_3px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
          isOpen
            ? "bg-black text-[#FFD23F]"
            : "bg-[#FFD23F] hover:bg-[#FACC15] text-black"
        }`}
        title="Enviar sugerencia o reportar algún bug en la página"
      >
        <span className="relative flex items-center justify-center">
          <MessageSquarePlus className="w-5 h-5 text-black group-hover:rotate-6 transition-transform stroke-[2.5]" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#2A9D8F] border border-black" />
        </span>
        <span>
          {isOpen ? "Cerrar" : "Sugerencias / Reportar Bug"}
        </span>
      </button>
    </div>
  );
}
