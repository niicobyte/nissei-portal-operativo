"use client";

import React from "react";
import { PackageOpen } from "lucide-react";

interface AnimatedReceptionBoxProps {
  className?: string; // Clases para el ícono de caja, ej: "w-5 h-5 text-white"
  beamColor?: string; // Color del haz láser del escáner óptico
  pingColor?: string; // Color del radar de aviso entrante
  title?: string;
  showScanner?: boolean;
  showPing?: boolean;
}

export function AnimatedReceptionBox({
  className = "w-5 h-5 text-zinc-900",
  beamColor = "bg-emerald-400",
  pingColor = "bg-emerald-400",
  title = "Recepción Post-Venta & Retornos",
  showScanner = true,
  showPing = true,
}: AnimatedReceptionBoxProps) {
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      title={title}
      style={{ overflow: "visible" }}
    >
      {/* Radar de notificación entrante / WhatsApp en esquina superior */}
      {showPing && (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 flex h-2 w-2 pointer-events-none z-20"
        >
          <span
            className={`animate-radar-ping absolute inline-flex h-full w-full rounded-full ${pingColor} opacity-75`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${pingColor}`}
          />
        </span>
      )}

      {/* Caja con suave flotación de mostrador */}
      <span className="animate-reception-float relative z-10 inline-flex items-center justify-center">
        <PackageOpen className={className} />

        {/* Haz láser horizontal que barre de arriba a abajo simulando escáner de código */}
        {showScanner && (
          <span
            aria-hidden="true"
            className={`absolute left-[10%] right-[10%] h-[1.5px] rounded-full pointer-events-none z-10 animate-laser-scan shadow-[0_0_6px_rgba(16,185,129,0.9)] ${beamColor}`}
          />
        )}
      </span>
    </span>
  );
}

export default AnimatedReceptionBox;
