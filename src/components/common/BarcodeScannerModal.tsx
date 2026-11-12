"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  X,
  Flashlight,
  SwitchCamera,
  ImagePlus,
  QrCode,
  ScanBarcode,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { BrowserCodeReader, BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

export type ScannerMode = "all" | "barcode";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  scanMode?: ScannerMode;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onDetected: (code: string, formatLabel: string) => void;
}

const BARCODE_1D_FORMATS = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.CODABAR,
];

const ALL_SUPPORTED_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.PDF_417,
  BarcodeFormat.AZTEC,
  ...BARCODE_1D_FORMATS,
];

function createConfiguredReader(scanMode: ScannerMode = "all"): BrowserMultiFormatReader {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(
    DecodeHintType.POSSIBLE_FORMATS,
    scanMode === "barcode" ? BARCODE_1D_FORMATS : ALL_SUPPORTED_FORMATS
  );
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 120,
    delayBetweenScanSuccess: 700,
  });
}

function formatBarcodeLabel(format: BarcodeFormat): string {
  switch (format) {
    case BarcodeFormat.QR_CODE:
      return "Código QR";
    case BarcodeFormat.DATA_MATRIX:
      return "DataMatrix";
    case BarcodeFormat.AZTEC:
      return "Aztec";
    case BarcodeFormat.PDF_417:
      return "PDF417";
    case BarcodeFormat.CODE_128:
      return "Code 128";
    case BarcodeFormat.CODE_39:
      return "Code 39";
    case BarcodeFormat.EAN_13:
      return "EAN-13";
    case BarcodeFormat.EAN_8:
      return "EAN-8";
    case BarcodeFormat.UPC_A:
      return "UPC-A";
    default:
      return "Código de Barras";
  }
}

export function BarcodeScannerModal({
  isOpen,
  scanMode = "all",
  title,
  subtitle,
  onClose,
  onDetected,
}: BarcodeScannerModalProps) {
  const resolvedTitle =
    title ??
    (scanMode === "barcode"
      ? "Escanear Código de Barras"
      : "Escanear Serial (QR / Código de Barras)");
  const resolvedSubtitle =
    subtitle ??
    (scanMode === "barcode"
      ? "Apuntá la cámara al código de barras. Solo lectura de códigos de barras lineales."
      : "Apuntá la cámara a la etiqueta del componente. Detecta automáticamente QR, DataMatrix y códigos de barras.");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);

  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(undefined);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isDecodingPhoto, setIsDecodingPhoto] = useState(false);

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      // ignorar errores al detener lector
    }
    controlsRef.current = null;

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignorar
        }
      });
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setActiveDeviceId(undefined);
      setErrorMessage("");
      return;
    }

    let cancelled = false;
    detectedRef.current = false;
    setStatus("starting");
    setErrorMessage("");

    const startScanner = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(
            "Este navegador no permite acceso directo a la cámara en vivo (requiere conexión segura HTTPS). Podés usar el botón 'Foto de etiqueta' debajo."
          );
        }
        return;
      }

      try {
        const reader = createConfiguredReader(scanMode);
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: activeDeviceId
            ? {
                deviceId: { exact: activeDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
        };

        if (!videoRef.current) return;

        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result) => {
            if (cancelled || detectedRef.current || !result) return;
            const rawText = (result.getText() || "").trim();
            if (!rawText) return;

            detectedRef.current = true;
            const label = formatBarcodeLabel(result.getBarcodeFormat());
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
              try {
                navigator.vibrate(75);
              } catch {
                // vibración opcional
              }
            }
            stopCamera();
            onDetected(rawText, label);
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setStatus("scanning");

        // Detectar soporte de linterna (flash) en la cámara activa
        try {
          const stream = videoRef.current?.srcObject as MediaStream | null;
          const track = stream?.getVideoTracks()?.[0];
          const caps = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
          setTorchSupported(Boolean(caps?.torch && controls.switchTorch));
        } catch {
          setTorchSupported(false);
        }

        // Listar cámaras disponibles luego de conceder permiso (iOS/Android)
        try {
          const videoInputs = await BrowserCodeReader.listVideoInputDevices();
          if (!cancelled && videoInputs.length > 0) {
            setDevices(videoInputs);
          }
        } catch {
          // opcional
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        const denied =
          msg.toLowerCase().includes("permission") ||
          msg.toLowerCase().includes("notallowed") ||
          msg.toLowerCase().includes("denied");
        setStatus("error");
        setErrorMessage(
          denied
            ? "Permiso de cámara denegado. Habilitá el acceso a la cámara en tu navegador o sacá una foto con 'Foto de etiqueta'."
            : "No se pudo iniciar la cámara automáticamente. Verificá que no esté en uso por otra app o usá 'Foto de etiqueta'."
        );
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, activeDeviceId, scanMode, onDetected, stopCamera]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopCamera();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose, stopCamera]);

  const handleToggleTorch = async () => {
    if (!controlsRef.current?.switchTorch) return;
    try {
      const next = !torchOn;
      await controlsRef.current.switchTorch(next);
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const handleCycleCamera = () => {
    if (devices.length < 2) return;
    const currentIdx = devices.findIndex((d) => d.deviceId === activeDeviceId);
    const nextIdx = (currentIdx + 1) % devices.length;
    setActiveDeviceId(devices[nextIdx].deviceId);
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsDecodingPhoto(true);
    setErrorMessage("");
    const objectUrl = URL.createObjectURL(file);

    try {
      const reader = createConfiguredReader(scanMode);
      const result = await reader.decodeFromImageUrl(objectUrl);
      const rawText = (result.getText() || "").trim();
      if (rawText) {
        const label = formatBarcodeLabel(result.getBarcodeFormat());
        stopCamera();
        onDetected(rawText, label);
      } else {
        setErrorMessage("No se pudo leer ningún código en la foto. Acercate un poco más con buena luz.");
      }
    } catch {
      setErrorMessage(
        scanMode === "barcode"
          ? "No se detectó ningún código de barras nítido en la imagen. Probá enfocando más cerca del código."
          : "No se detectó ningún código QR ni código de barras nítido en la imagen. Probá enfocando más cerca de la etiqueta."
      );
    } finally {
      URL.revokeObjectURL(objectUrl);
      setIsDecodingPhoto(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-zinc-200 max-h-[92dvh] flex flex-col">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-zinc-200 bg-zinc-50/70">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-zinc-900 leading-tight">{resolvedTitle}</h3>
              <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">{resolvedSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors cursor-pointer shrink-0"
            title="Cerrar escáner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visor de Cámara */}
        <div className="p-3 sm:p-4 space-y-3 overflow-y-auto overscroll-contain">
          <div className="relative w-full aspect-[4/3] bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />

            {/* Marco guía + haz láser cuando escanea */}
            {status === "scanning" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative w-[78%] h-[58%] rounded-xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.42)] overflow-hidden">
                  <div className="absolute inset-x-2 h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] animate-laser-scan" />
                </div>
              </div>
            )}

            {/* Estado cargando cámara */}
            {status === "starting" && (
              <div className="absolute inset-0 bg-zinc-950/85 flex flex-col items-center justify-center gap-2 text-white px-4 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span className="text-xs font-medium">Activando cámara trasera...</span>
                <span className="text-[11px] text-zinc-400">Aceptá el permiso si el navegador lo solicita</span>
              </div>
            )}

            {/* Controles superpuestos: Linterna y Cambio de cámara */}
            {status === "scanning" && (torchSupported || devices.length > 1) && (
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                {torchSupported && (
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    className={`p-2 rounded-lg text-xs font-semibold backdrop-blur-md border transition-colors cursor-pointer ${
                      torchOn
                        ? "bg-amber-400 text-zinc-950 border-amber-300"
                        : "bg-black/60 text-white border-white/20 hover:bg-black/80"
                    }`}
                    title={torchOn ? "Apagar linterna" : "Encender linterna"}
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                )}
                {devices.length > 1 && (
                  <button
                    type="button"
                    onClick={handleCycleCamera}
                    className="p-2 rounded-lg bg-black/60 text-white border border-white/20 hover:bg-black/80 backdrop-blur-md transition-colors cursor-pointer"
                    title="Cambiar cámara"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Mensaje de error / fallback */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Badges de formatos compatibles + respaldo foto */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-zinc-600">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 font-mono">
                <ScanBarcode className="w-3 h-3 text-zinc-700" />
                Barras 1D
              </span>
              {scanMode !== "barcode" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 font-mono">
                  <QrCode className="w-3 h-3 text-zinc-700" />
                  QR / DataMatrix
                </span>
              )}
            </div>

            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isDecodingPhoto}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-zinc-800 transition-colors cursor-pointer disabled:opacity-60"
                title="Tomar foto o subir imagen de etiqueta si cuesta enfocar en vivo"
              >
                {isDecodingPhoto ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="w-3.5 h-3.5" />
                )}
                <span>{isDecodingPhoto ? "Leyendo..." : "Foto de etiqueta"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
