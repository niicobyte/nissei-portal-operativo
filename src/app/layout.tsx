import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/common/ThemeProvider";

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

const THEME_INIT_SCRIPT = `(function(){try{if(window.location.pathname.indexOf('/armar-pc')===0){document.documentElement.classList.remove('dark');return;}if(localStorage.getItem('nissei_portal_theme_v1')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@700;800&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans min-h-dvh bg-[#FAF6EE] text-[#111111] antialiased selection:bg-[#FFD23F] selection:text-[#000000]">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
