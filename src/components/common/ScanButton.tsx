"use client";

import React from "react";
import { QrCode, ScanBarcode } from "lucide-react";

interface ScanButtonProps {
  onClick: () => void;
  title?: string;
  label?: string;
  icon?: "barcode" | "qr";
  compact?: boolean;
}

/**
 * Botón liviano y unificado para disparar el escáner de cámara en formularios y buscadores.
 */
export function ScanButton({
  onClick,
  title = "Escanear código con cámara",
  label = "Escanear",
  icon = "barcode",
  compact = false,
}: ScanButtonProps) {
  const IconComponent = icon === "qr" ? QrCode : ScanBarcode;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        compact
          ? "inline-flex items-center justify-center p-1.5 bg-[#FFFDF9] hover:bg-[#FFD23F] border-2 border-black rounded-lg text-black outline-none transition-all shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer shrink-0"
          : "inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#FFFDF9] hover:bg-[#FFD23F] border-2 border-black rounded-lg text-xs font-heading font-extrabold text-black outline-none transition-all shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer shrink-0"
      }
    >
      <IconComponent className={compact ? "w-3.5 h-3.5 text-black shrink-0" : "w-4 h-4 text-black shrink-0"} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
