"use client";

import { useState, useEffect, useCallback, RefObject } from "react";

export interface PopoverLayout {
  left: number;
  width: number;
  maxHeight: number;
}

export interface ComputePopoverOptions {
  preferredWidth: number;
  preferAlign?: "left" | "right";
  margin?: number;
  maxPreferredHeight?: number;
}

/**
 * Calcula desplazamiento horizontal (`left` relativo al contenedor) y dimensiones máximas
 * de un menú o popover para que nunca se corte fuera del viewport en móviles, tablets o escritorio,
 * contemplando teclados virtuales (`visualViewport`).
 */
export function computeClampedPopoverLayout(
  anchorEl: HTMLElement | null,
  options: ComputePopoverOptions
): PopoverLayout | null {
  if (typeof window === "undefined" || !anchorEl) return null;

  const {
    preferredWidth,
    preferAlign = "left",
    margin = 12,
    maxPreferredHeight = 420,
  } = options;

  const rect = anchorEl.getBoundingClientRect();
  const vvWidth = window.visualViewport?.width ?? window.innerWidth;
  const vvHeight = window.visualViewport?.height ?? window.innerHeight;

  const width = Math.max(160, Math.min(preferredWidth, vvWidth - margin * 2));

  let targetScreenLeft: number;
  if (preferAlign === "right") {
    const rightAlignedLeft = rect.right - width;
    targetScreenLeft =
      rightAlignedLeft >= margin
        ? Math.min(rightAlignedLeft, vvWidth - width - margin)
        : Math.max(margin, Math.min(rect.left, vvWidth - width - margin));
  } else {
    targetScreenLeft = Math.max(
      margin,
      Math.min(rect.left, vvWidth - width - margin)
    );
  }

  const spaceBelow = Math.max(160, vvHeight - rect.bottom - margin);
  const maxHeight = Math.min(maxPreferredHeight, spaceBelow);

  return {
    left: Math.round(targetScreenLeft - rect.left),
    width: Math.round(width),
    maxHeight: Math.round(maxHeight),
  };
}

/**
 * Mantiene actualizado el layout de un popover dentro del viewport mientras esté abierto,
 * reaccionando a cambios de tamaño de pantalla y apertura del teclado virtual móvil.
 */
export function useClampedPopover(
  anchorRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  options: ComputePopoverOptions
) {
  const {
    preferredWidth,
    preferAlign = "left",
    margin = 12,
    maxPreferredHeight = 420,
  } = options;

  const [layout, setLayout] = useState<PopoverLayout | null>(null);

  const update = useCallback(() => {
    const next = computeClampedPopoverLayout(anchorRef.current, {
      preferredWidth,
      preferAlign,
      margin,
      maxPreferredHeight,
    });
    if (next) setLayout(next);
  }, [anchorRef, preferredWidth, preferAlign, margin, maxPreferredHeight]);

  useEffect(() => {
    if (!isOpen) return;
    update();

    window.addEventListener("resize", update);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [isOpen, update]);

  return { layout, update };
}
