import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FloatingFeedbackWidget } from "@/components/common/FloatingFeedbackWidget";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "NISSEI Portal Operativo | Taller & Post-Venta CDE",
  description:
    "Consola integrada de diagnóstico industrial, validación QC, retornos SATI y ensamble técnico de PCs en NISSEI Ciudad del Este.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&family=Roboto+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans min-h-dvh bg-[#fbf9f9] text-[#121212] antialiased selection:bg-[#e2e2e2] selection:text-[#121212]">
        {children}
        <FloatingFeedbackWidget />
      </body>
    </html>
  );
}
