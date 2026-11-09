# 🛠️ NISSEI Portal Operativo — Taller & Post-Venta

Sistema de orquestación operativa, diagnóstico industrial y control de calidad diseñado específicamente para la sucursal de **NISSEI Ciudad del Este, Paraguay**.

Construido con **Next.js 15 (App Router)**, **React 19**, **TypeScript** y **Tailwind CSS v4**.

---

## 🚀 Inicio Rápido

### Requisitos previos
- Node.js >= 18.18
- npm o pnpm

### Ejecución en Modo Desarrollo
```bash
# Navegar al directorio del proyecto
cd nissei-portal-operativo

# Copiar variables de entorno y configurar credenciales privadas
cp .env.example .env.local

# Iniciar servidor de desarrollo en el puerto 3000
npm run dev
```

Abra su navegador en [http://localhost:3000](http://localhost:3000).

### Compilación para Producción
```bash
npm run build
npm run start
```

---

## 🔒 Arquitectura de Seguridad
- **Autenticación con Hash Criptográfico (SHA-256 + Salt):** Las contraseñas de acceso por sector (`ADMIN`, `TECNICO`, `RECEPCION`, `MONTAJES`) nunca se almacenan ni viajan en texto plano en el código fuente, en el bundle de JavaScript del navegador, en `localStorage` ni en respuestas de la API (`/api/db`).
- **Guardia de Sesión y Rol (`AuthBadge`):** Las rutas operativas (`/recepcion`, `/reparaciones`, `/tecnicos`) verifican sesión activa y rol autorizado antes de mostrar el contenido.
- **Variables Sensibles Aisladas (`.env.local`):** Los tokens de `Whapi.cloud`, IDs de grupos de WhatsApp (`@g.us`) y credenciales de MySQL residen exclusivamente en `.env.local` (ignorado por Git) y se consumen únicamente desde el servidor.
- **Cabeceras HTTP de Seguridad:** Configuradas en `next.config.mjs` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader: false`).
