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
          ? "inline-flex items-center justify-center p-1.5 bg-zinc-50 hover:bg-zinc-100 focus-visible:bg-white border border-zinc-200 hover:border-zinc-400 focus-visible:border-zinc-900 rounded-lg text-zinc-600 hover:text-zinc-900 outline-none transition-all cursor-pointer shrink-0"
          : "inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 focus-visible:bg-white border border-zinc-200 hover:border-zinc-400 focus-visible:border-zinc-900 rounded-xl text-xs font-medium text-zinc-700 hover:text-zinc-900 outline-none transition-all cursor-pointer shrink-0"
      }
    >
      <IconComponent className={compact ? "w-3.5 h-3.5 text-zinc-500 shrink-0" : "w-4 h-4 text-zinc-500 shrink-0"} />
      {!compact && <span>{label}</span>}
    </button>
  );
}
