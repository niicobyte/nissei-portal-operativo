import { NextResponse } from "next/server";
import { INITIAL_RECEPCION_DATA } from "@/data/recepcionData";
import { INITIAL_RECEPCION_CDE_DATA } from "@/data/recepcionCdeData";
import { INITIAL_MONTAJES_REALES } from "@/data/montajesData";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = String(now.getFullYear());
    const todayStr = `${d}/${m}/${y}`;

    const recTickets = INITIAL_RECEPCION_DATA;
    const ingresosHoy = recTickets.filter((t) =>
      (t.fechaIngreso || "").trim().includes(todayStr)
    ).length;

    const notificaciones = recTickets.filter((t) => {
      const isDanesa = (t.cliente || "").toUpperCase().includes("DANESA");
      return !isDanesa && Boolean(t.recibidoEnDeposito);
    }).length;

    const listosEntrega = recTickets.filter((t) => {
      const st = (t.estado || "").toLowerCase();
      if (st.includes("entregada") || st.includes("entregado")) return false;
      return Boolean(t.recibidoEnDeposito) || st.includes("reparada") || st.includes("listo");
    }).length;

    const cdeTickets = INITIAL_RECEPCION_CDE_DATA;
    const enCamino = cdeTickets.filter(
      (t) => !t.recibidoEnDeposito && Boolean(t.fechaEntregada && t.fechaEntregada.trim() !== "")
    ).length;
    const enCde = cdeTickets.filter(
      (t) => !t.fechaEntregada || t.fechaEntregada.trim() === ""
    ).length;
    const recibidosAsu = cdeTickets.filter((t) => Boolean(t.recibidoEnDeposito)).length;

    const montajesList = INITIAL_MONTAJES_REALES;
    const enCola = montajesList.filter(
      (o) => o.estado === "Pendiente" || o.etapa === "PENDIENTE_PIEZAS"
    ).length;
    const enBanco = montajesList.filter(
      (o) =>
        o.estado === "En Proceso" ||
        o.etapa === "ARMADO_MECANICO" ||
        o.etapa === "ESTRES_TERMICO"
    ).length;
    const finalizados = montajesList.filter(
      (o) =>
        o.estado === "Entregado" ||
        o.estado === "Rev. Cerrado" ||
        o.etapa === "LISTO_ENTREGA"
    ).length;

    return NextResponse.json(
      {
        ok: true,
        recepcion: {
          ingresosHoy,
          notificaciones,
          listosEntrega,
        },
        deposito: {
          enCamino,
          enCde,
          recibidosAsu,
        },
        montajes: {
          enCola,
          enBanco,
          finalizados,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        recepcion: { ingresosHoy: 0, notificaciones: 0, listosEntrega: 0 },
        deposito: { enCamino: 0, enCde: 0, recibidosAsu: 0 },
        montajes: { enCola: 0, enBanco: 0, finalizados: 0 },
      },
      { status: 200 }
    );
  }
}
