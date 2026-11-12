"use client";

import React, { useState } from "react";
import { Search, ScanBarcode, X } from "lucide-react";
import { BarcodeScannerModal } from "@/components/common/BarcodeScannerModal";

interface OrderSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Buscador de órdenes con botón integrado para escanear códigos de barras (solo 1D),
 * manteniendo la misma estética liviana del campo de búsqueda.
 */
export function OrderSearchInput({
  value,
  onChange,
  placeholder = "Buscar por ID Orden (ASU o CDE), Serial, Modelo, Cliente...",
}: OrderSearchInputProps) {
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1.5 w-full lg:w-[27rem] xl:w-[29rem] min-w-0">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full min-w-0 pl-9 pr-8 py-2 bg-zinc-50 hover:bg-zinc-100/70 focus:bg-white border border-zinc-200 focus:border-zinc-900 rounded-xl text-xs text-zinc-900 outline-none transition-all placeholder:text-zinc-400"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-50 hover:bg-zinc-100 focus-visible:bg-white border border-zinc-200 hover:border-zinc-400 focus-visible:border-zinc-900 rounded-xl text-xs font-medium text-zinc-700 hover:text-zinc-900 outline-none transition-all cursor-pointer shrink-0"
          title="Escanear código de barras para buscar"
        >
          <ScanBarcode className="w-4 h-4 text-zinc-500 shrink-0" />
          <span>Escanear</span>
        </button>
      </div>

      <BarcodeScannerModal
        isOpen={scannerOpen}
        scanMode="barcode"
        title="Buscar por Código de Barras"
        subtitle="Apuntá la cámara al código de barras de la orden, serial o producto."
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          onChange(code);
          setScannerOpen(false);
        }}
      />
    </>
  );
}
