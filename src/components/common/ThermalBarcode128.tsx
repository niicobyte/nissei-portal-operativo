"use client";

import React, { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface ThermalBarcode128Props {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
}

export function ThermalBarcode128({
  value,
  width = 1.8,
  height = 44,
  fontSize = 13,
  displayValue = true,
  className = "",
}: ThermalBarcode128Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    // Limpiar string para barcode CODE128 (mantener número o código alfanumérico limpio)
    const barcodeText = String(value).trim().replace(/^#/, "");

    if (!barcodeText) return;

    try {
      JsBarcode(svgRef.current, barcodeText, {
        format: "CODE128",
        width,
        height,
        displayValue,
        text: `#${barcodeText}`,
        font: "Space Mono, monospace",
        fontOptions: "bold",
        fontSize,
        textMargin: 2,
        margin: 0,
        lineColor: "#000000",
        background: "transparent",
      });
    } catch (err) {
      console.warn("Error rendering barcode CODE128:", err);
    }
  }, [value, width, height, fontSize, displayValue]);

  if (!value || !value.trim()) return null;

  return (
    <div className={`flex flex-col items-center justify-center py-1 ${className}`}>
      <svg ref={svgRef} className="max-w-full block" />
    </div>
  );
}
