"use client";

import { useEffect, useRef } from "react";

const DRAFT_PREFIX = "nissei_work_draft_v1::";
export const FLUSH_DRAFTS_EVENT = "nissei:save-drafts-before-logout";

interface StoredDraftEnvelope<T> {
  ts: number;
  data: T;
}

/**
 * Guarda un borrador de trabajo o estado en progreso en localStorage.
 */
export function saveWorkDraft<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: StoredDraftEnvelope<T> = {
      ts: Date.now(),
      data,
    };
    localStorage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify(envelope));
  } catch {
    // Ignorar errores de cuota de almacenamiento
  }
}

/**
 * Recupera un borrador guardado siempre que no haya expirado por antigüedad.
 */
export function loadWorkDraft<T>(
  key: string,
  maxAgeMs = 24 * 60 * 60 * 1000
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraftEnvelope<T>;
    if (!parsed || typeof parsed.ts !== "number" || !("data" in parsed)) {
      return null;
    }
    if (Date.now() - parsed.ts > maxAgeMs) {
      localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Elimina un borrador cuando la operación ya fue confirmada y guardada.
 */
export function clearWorkDraft(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
  } catch {
    // Ignorar
  }
}

/**
 * Suscribe una función de guardado inmediato ante cierre por actualización de deploy o recarga.
 */
export function useFlushDraftBeforeLogout(flushFn: () => void): void {
  const flushRef = useRef(flushFn);
  flushRef.current = flushFn;

  useEffect(() => {
    const handleFlush = () => {
      try {
        flushRef.current();
      } catch {
        // Garantizar que el flujo de cierre de sesión no se bloquee
      }
    };

    window.addEventListener(FLUSH_DRAFTS_EVENT, handleFlush);
    window.addEventListener("beforeunload", handleFlush);
    window.addEventListener("pagehide", handleFlush);

    return () => {
      window.removeEventListener(FLUSH_DRAFTS_EVENT, handleFlush);
      window.removeEventListener("beforeunload", handleFlush);
      window.removeEventListener("pagehide", handleFlush);
    };
  }, []);
}
