"use client";

import React from "react";
import { Truck } from "lucide-react";

interface SpeedTruckProps {
  className?: string; // Clases para el ícono de camión, ej: "w-4 h-4 text-amber-600"
  smokeColor?: string; // Color de las partículas de humo
  title?: string;
}

export function SpeedTruck({
  className = "w-4 h-4 text-amber-600",
  smokeColor = "bg-amber-400/80",
  title = "En tránsito a toda velocidad",
}: SpeedTruckProps) {
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0 pr-0.5"
      title={title}
      style={{ overflow: "visible" }}
    >
      {/* Partículas / Bocanadas de humo animadas saliendo por detrás del camión */}
      <span
        aria-hidden="true"
        className={`absolute -left-1 bottom-0.5 w-1.5 h-1.5 rounded-full ${smokeColor} pointer-events-none animate-smoke-1`}
      />
      <span
        aria-hidden="true"
        className={`absolute -left-1.5 bottom-1.5 w-1.5 h-1.5 rounded-full ${smokeColor} pointer-events-none animate-smoke-2`}
      />
      <span
        aria-hidden="true"
        className={`absolute -left-0.5 bottom-2 w-1 h-1 rounded-full ${smokeColor} pointer-events-none animate-smoke-3`}
      />

      {/* Camioncito con animación de alta velocidad (vibración y suspensión en movimiento) */}
      <span className="animate-speed-truck relative z-10 inline-flex items-center">
        <Truck className={className} />
      </span>
    </span>
  );
}
export default SpeedTruck;
