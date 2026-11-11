import React from "react";
import type { SatiDepurationStats } from "../lib/satiRawDepurator";

interface SatiDepurationSummaryProps {
  stats?: SatiDepurationStats;
}

/**
 * Muestra el resumen compacto de la depuración automática aplicada al Excel/CSV crudo SATI
 * (filtros de IDs mínimos ASU/CDE, palabras clave, paréntesis permitidos, duplicados y normalización).
 */
export function SatiDepurationSummary({ stats }: SatiDepurationSummaryProps) {
  if (!stats || stats.totalRawFilas === 0) return null;

  const totalDescartadas =
    stats.descartadasHistoricasAsu +
    stats.descartadasHistoricasCde +
    stats.descartadasFiltroCliente +
    stats.descartadasParentesis;

  if (
    totalDescartadas === 0 &&
    stats.duplicadosFusionados === 0 &&
    stats.camposNormalizados === 0
  ) {
    return null;
  }

  return (
    <div className="bg-white/90 rounded-lg border border-zinc-200 px-3 py-2 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600">
      <span className="font-bold text-zinc-800 mr-1">
        Depuración SATI automática:
      </span>
      <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-mono text-zinc-700">
        Brutas: {stats.totalRawFilas.toLocaleString()}
      </span>
      {stats.descartadasHistoricasAsu > 0 && (
        <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-mono text-zinc-600">
          Hist. ASU (&lt;29403): -{stats.descartadasHistoricasAsu.toLocaleString()}
        </span>
      )}
      {stats.descartadasHistoricasCde > 0 && (
        <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-mono text-zinc-600">
          Hist. CDE (&lt;125650): -{stats.descartadasHistoricasCde.toLocaleString()}
        </span>
      )}
      {stats.descartadasFiltroCliente > 0 && (
        <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-mono text-zinc-600">
          Filtro cliente (drop/emap/...): -{stats.descartadasFiltroCliente.toLocaleString()}
        </span>
      )}
      {stats.descartadasParentesis > 0 && (
        <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-mono text-zinc-600">
          Paréntesis excluidos: -{stats.descartadasParentesis.toLocaleString()}
        </span>
      )}
      {stats.duplicadosFusionados > 0 && (
        <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 font-mono text-zinc-600">
          Duplicados fusionados: {stats.duplicadosFusionados.toLocaleString()}
        </span>
      )}
      {stats.camposNormalizados > 0 && (
        <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-mono text-emerald-700">
          Campos normalizados: {stats.camposNormalizados.toLocaleString()}
        </span>
      )}
      <span className="px-2 py-0.5 rounded bg-zinc-900 text-white font-mono font-semibold ml-auto">
        Limpias: {stats.totalValidas.toLocaleString()}
      </span>
    </div>
  );
}
