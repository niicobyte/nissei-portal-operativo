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
        <div className="fixed bottom-20 right-3 left-3 sm:left-auto sm:right-5 sm:w-[390px] bg-white rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden animate-in fade-in duration-150 mb-1">
          {/* Cabecera */}
          <div className="bg-zinc-900 text-white px-4 py-3.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                {tipo === "BUG" ? (
                  <Bug className="w-4 h-4 text-rose-400" />
                ) : (
                  <Lightbulb className="w-4 h-4 text-amber-300" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-sm font-extrabold leading-tight truncate">
                  Sugerencias &amp; Reporte de Bugs
                </h4>
                <span className="text-[11px] text-zinc-300 block truncate">
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
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Cerrar formulario"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cuerpo del Formulario */}
          {sentSuccess ? (
            <div className="p-6 text-center space-y-3 bg-emerald-50/40">
              <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-black text-zinc-900">
                  ¡Reporte enviado con éxito!
                </h5>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Tu {tipo === "BUG" ? "reporte de error" : "sugerencia"} ya fue enviado por{" "}
                  <strong>WhatsApp</strong> con todo el detalle. ¡Muchas gracias por ayudar a mejorar!
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSentSuccess(false);
                  setIsOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Cerrar ventana
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
              {/* 1. Selector de Tipo: Sugerencia o Error / Bug */}
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1.5">
                  ¿Qué deseas reportar?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTipo("SUGERENCIA");
                      setErrorMsg(null);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      tipo === "SUGERENCIA"
                        ? "bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-500/20 font-bold"
                        : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700"
                    }`}
                  >
                    <Lightbulb
                      className={`w-4 h-4 shrink-0 ${
                        tipo === "SUGERENCIA" ? "text-amber-600" : "text-zinc-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">
                        Sugerencia
                      </span>
                      <span className="text-[10px] text-zinc-500 block truncate">
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
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      tipo === "BUG"
                        ? "bg-rose-50 border-rose-500 text-rose-950 ring-2 ring-rose-500/20 font-bold"
                        : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700"
                    }`}
                  >
                    <Bug
                      className={`w-4 h-4 shrink-0 ${
                        tipo === "BUG" ? "text-rose-600" : "text-zinc-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="text-xs font-bold block leading-tight">
                        Algún Bug / Error
                      </span>
                      <span className="text-[10px] text-zinc-500 block truncate">
                        Falla en la página
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Nombre del Vendedor */}
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">
                  Tu Nombre (Vendedor) <span className="text-rose-600">*</span>
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
                  className="w-full bg-zinc-50 focus:bg-white border border-zinc-300 focus:border-zinc-900 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-zinc-900 outline-none transition-colors"
                />
              </div>

              {/* 3. Detalle de la Sugerencia o Bug */}
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">
                  {tipo === "BUG"
                    ? "Detalle del error o bug encontrado"
                    : "Detalle de tu sugerencia o mejora"}{" "}
                  <span className="text-rose-600">*</span>
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
                  className="w-full bg-zinc-50 focus:bg-white border border-zinc-300 focus:border-zinc-900 rounded-xl p-3 text-xs sm:text-sm text-zinc-900 outline-none transition-colors resize-none leading-relaxed"
                />
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Botón de Envío a WhatsApp */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2.5 px-4 rounded-xl text-white text-xs sm:text-sm font-extrabold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${
                  tipo === "BUG"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
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
        className={`group flex items-center gap-2.5 px-4 py-3 rounded-full shadow-xl border transition-all cursor-pointer ${
          isOpen
            ? "bg-zinc-800 text-white border-zinc-700"
            : "bg-zinc-900 hover:bg-black text-white border-zinc-700/80 hover:scale-[1.03] active:scale-95"
        }`}
        title="Enviar sugerencia o reportar algún bug en la página"
      >
        <span className="relative flex items-center justify-center">
          <MessageSquarePlus className="w-5 h-5 text-emerald-400 group-hover:rotate-6 transition-transform" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-900" />
        </span>
        <span className="text-xs sm:text-sm font-bold tracking-tight">
          {isOpen ? "Cerrar" : "Sugerencias / Reportar Bug"}
        </span>
      </button>
    </div>
  );
}
