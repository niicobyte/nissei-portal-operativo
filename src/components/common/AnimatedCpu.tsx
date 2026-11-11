"use client";

import React from "react";
import { Cpu } from "lucide-react";

interface AnimatedCpuProps {
  className?: string; // Clases para el ícono de CPU, ej: "w-5 h-5 text-white"
  coreColor?: string; // Color del silicio del procesador
  auraColor?: string; // Color del resplandor de banco de pruebas
  title?: string;
  showCore?: boolean;
  showBuses?: boolean;
}

export function AnimatedCpu({
  className = "w-5 h-5 text-zinc-900",
  coreColor = "bg-cyan-400",
  auraColor = "bg-cyan-400/15",
  title = "Taller de Montajes de PC & Pruebas",
  showCore = true,
  showBuses = true,
}: AnimatedCpuProps) {
  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0"
      title={title}
      style={{ overflow: "visible" }}
    >
      {/* Resplandor eléctrico de banco de pruebas / Enfriamiento */}
      <span
        aria-hidden="true"
        className={`absolute -inset-1 rounded-lg ${auraColor} blur-xs animate-cpu-aura pointer-events-none`}
      />

      {/* Micro-pulsos de corriente en los buses de pines hacia el procesador */}
      {showBuses && (
        <>
          {/* Bus Superior */}
          <span
            aria-hidden="true"
            className={`absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${coreColor} shadow-[0_0_4px_currentColor] animate-pin-top pointer-events-none z-20`}
          />
          {/* Bus Inferior */}
          <span
            aria-hidden="true"
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${coreColor} shadow-[0_0_4px_currentColor] animate-pin-bottom pointer-events-none z-20`}
          />
          {/* Bus Izquierdo */}
          <span
            aria-hidden="true"
            className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full ${coreColor} shadow-[0_0_4px_currentColor] animate-pin-left pointer-events-none z-20`}
          />
          {/* Bus Derecho */}
          <span
            aria-hidden="true"
            className={`absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full ${coreColor} shadow-[0_0_4px_currentColor] animate-pin-right pointer-events-none z-20`}
          />
        </>
      )}

      {/* Ícono de CPU con núcleo de silicio palpitante en frecuencia de reloj */}
      <span className="relative z-10 inline-flex items-center justify-center">
        <Cpu className={className} />

        {/* Núcleo de silicio central iluminado */}
        {showCore && (
          <span
            aria-hidden="true"
            className={`absolute inset-0 m-auto w-2 h-2 rounded-[2px] ${coreColor} shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-cpu-core pointer-events-none z-10`}
          />
        )}
      </span>
    </span>
  );
}

export default AnimatedCpu;
