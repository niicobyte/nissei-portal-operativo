import React from "react";
import type { SatiDepurationStats } from "../lib/satiRawDepurator";

interface SatiDepurationSummaryProps {
  stats?: SatiDepurationStats;
}

const chipClass =
  "px-2 py-0.5 rounded-md bg-[#FAF6EE] border-2 border-black font-mono font-bold text-black shadow-[1px_1px_0px_#000] whitespace-nowrap";

/**
 * Muestra el resumen compacto de la depuración automática aplicada al Excel/CSV crudo SATI
 * (filtros de IDs mínimos ASU/CDE, palabras clave, paréntesis permitidos, duplicados y normalización).
 * Estilo Neo-Brutalismo Retro.
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
    <div className="bg-[#FFFDF9] rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] px-3 py-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-black">
      <span className="font-heading font-extrabold text-black mr-1 uppercase tracking-wide text-[11px]">
        Depuración SATI automática:
      </span>
      <span className={chipClass}>Brutas: {stats.totalRawFilas.toLocaleString()}</span>
      {stats.descartadasHistoricasAsu > 0 && (
        <span className={chipClass}>
          Hist. ASU (&lt;29403): -{stats.descartadasHistoricasAsu.toLocaleString()}
        </span>
      )}
      {stats.descartadasHistoricasCde > 0 && (
        <span className={chipClass}>
          Hist. CDE (&lt;125650): -{stats.descartadasHistoricasCde.toLocaleString()}
        </span>
      )}
      {stats.descartadasFiltroCliente > 0 && (
        <span className={chipClass}>
          Filtro cliente (drop/emap/...): -{stats.descartadasFiltroCliente.toLocaleString()}
        </span>
      )}
      {stats.descartadasParentesis > 0 && (
        <span className={chipClass}>
          Paréntesis excluidos: -{stats.descartadasParentesis.toLocaleString()}
        </span>
      )}
      {stats.duplicadosFusionados > 0 && (
        <span className={chipClass}>
          Duplicados fusionados: {stats.duplicadosFusionados.toLocaleString()}
        </span>
      )}
      {stats.camposNormalizados > 0 && (
        <span className="px-2 py-0.5 rounded-md bg-[#2A9D8F] border-2 border-black font-mono font-bold text-white shadow-[1px_1px_0px_#000] whitespace-nowrap">
          Campos normalizados: {stats.camposNormalizados.toLocaleString()}
        </span>
      )}
      <span className="px-2 py-0.5 rounded-md bg-black text-[#FFD23F] border-2 border-black font-mono font-extrabold ml-auto shadow-[1px_1px_0px_#000] whitespace-nowrap">
        Limpias: {stats.totalValidas.toLocaleString()}
      </span>
    </div>
  );
}
