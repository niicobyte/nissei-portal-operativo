import { applyCloudRecepcionTickets, RecepcionTicket } from "@/data/recepcionData";
import { saveReparaciones, OrdenReparacion } from "@/data/tallerReparacionesData";
import {
  getPendingDirtyMontajeIds,
  mergeAndSaveCloudMontajes,
  OrdenMontajeReal,
  pushPendingDirtyMontajes,
} from "@/data/montajesData";
import {
  applyCloudCdeTickets,
  RecepcionCdeTicket,
  SatiCheckinData,
} from "@/data/recepcionCdeData";

const CLOUD_SYNC_WARNING_KEY = "nissei_cloud_sync_warning_v1";

export interface CloudSyncResult {
  ok: boolean;
  error?: string;
}

export function setCloudSyncWarning(message: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!message) {
      sessionStorage.removeItem(CLOUD_SYNC_WARNING_KEY);
    } else {
      sessionStorage.setItem(CLOUD_SYNC_WARNING_KEY, message);
    }
  } catch {
    // Ignore storage errors
  }
}

export function consumeCloudSyncWarning(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const msg = sessionStorage.getItem(CLOUD_SYNC_WARNING_KEY);
    if (msg) {
      sessionStorage.removeItem(CLOUD_SYNC_WARNING_KEY);
      return msg;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sincroniza todos los módulos del portal (Recepción, Reparaciones, Montajes, Vendedores,
 * SATI ASU-CDE, Cruces y Check-ins) desde MySQL en la nube al iniciar sesión en cualquier PC.
 */
export async function syncAllModulesFromMySQL(timeoutMs = 7500): Promise<CloudSyncResult> {
  if (typeof window === "undefined") return { ok: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("/api/db?module=all", {
      cache: "no-store",
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      const errorMsg =
        json?.error ||
        `No se pudo sincronizar con MySQL en la nube (HTTP ${res.status}).`;
      setCloudSyncWarning(errorMsg);
      return { ok: false, error: errorMsg };
    }

    if (Array.isArray(json.recepcion) && json.recepcion.length > 0) {
      applyCloudRecepcionTickets(json.recepcion as RecepcionTicket[]);
    }

    if (Array.isArray(json.reparaciones) && json.reparaciones.length > 0) {
      saveReparaciones(json.reparaciones as OrdenReparacion[]);
    }

    if (Array.isArray(json.montajes) && json.montajes.length > 0) {
      mergeAndSaveCloudMontajes(json.montajes as OrdenMontajeReal[]);
      if (getPendingDirtyMontajeIds().length > 0) {
        await pushPendingDirtyMontajes().catch((err) => {
          console.warn("[CloudSync] Pendientes de montaje no subidos aún:", err);
        });
      }
    }

    if (Array.isArray(json.cde) && json.cde.length > 0) {
      applyCloudCdeTickets(
        json.cde as RecepcionCdeTicket[],
        (json.checkins as Record<string, SatiCheckinData>) || null,
        Array.isArray(json.crossMatches) ? json.crossMatches : null
      );
    }

    setCloudSyncWarning(null);
    return { ok: true };
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    const errorMsg = isAbort
      ? "La sincronización inicial con MySQL tardó más de lo esperado. Se cargó la caché local y continuará sincronizando."
      : err instanceof Error
        ? err.message
        : "Error de red al conectar con MySQL en la nube.";
    setCloudSyncWarning(errorMsg);
    return { ok: false, error: errorMsg };
  } finally {
    clearTimeout(timer);
  }
}
