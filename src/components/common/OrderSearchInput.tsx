"use client";

import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { BarcodeScannerModal } from "@/components/common/BarcodeScannerModal";
import { ScanButton } from "@/components/common/ScanButton";

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

        <ScanButton
          onClick={() => setScannerOpen(true)}
          title="Escanear código de barras para buscar"
        />
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
