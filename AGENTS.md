# Reglas Operativas del Proyecto — NISSEI Portal Operativo

## 1. Subida Automática a GitHub (Auto Commit & Push Obligatorio)
- **Regla estricta:** Cada vez que el usuario pida cualquier cambio, mejora, corrección o nueva funcionalidad y se modifiquen o creen archivos en el proyecto, el agente **DEBE subir los cambios automáticamente a GitHub** al finalizar la tarea, **sin esperar a que el usuario lo pida explícitamente**.
- **Flujo obligatorio al terminar cada cambio:**
  1. Verificar que el código compile o sea válido y que archivos sensibles (`.env.local`, `.env`) sigan ignorados en `.gitignore`.
  2. Ejecutar `git add -A`.
  3. Ejecutar `git commit -m "<tipo>(<módulo>): <comentario descriptivo en español de lo realizado>"` siguiendo el formato Conventional Commits del repositorio (ej. `feat(recepcion): ...`, `fix(taller): ...`, `feat(montajes): ...`, `chore(config): ...`).
  4. Ejecutar `git push origin main`.
  5. Informar brevemente al usuario el hash del commit y el comentario con el que se subió a `https://github.com/niicobyte/nissei-portal-operativo.git`.

## 2. Cuenta Única de Git
- Todo el repositorio pertenece a una única cuenta sin colaboradores:
  - **Usuario:** `niicobyte`
  - **Email:** `niicobyte@users.noreply.github.com`
  - **Rama principal:** `main`
  - **Remoto:** `origin` (`https://github.com/niicobyte/nissei-portal-operativo.git`)

## 3. Seguridad Defensiva y Prevención de Filtraciones (Zero-Leak Policy)
- **Subagente dedicado:** `security-auditor` (Guardián de Seguridad).
- **Modelos IA Mandatorios de Escaneo y Auditoría:**
  - **100% Prioridad Principal:** `Claude Opus 5.5 High` (`claude-opus-5-5-high`).
  - **Fallback por agotamiento de cuota/tokens:** `Gemini 3.8 Flash Medium` (`gemini-3.8-flash-medium`).
- **Script de auditoría:** `node scripts/security-audit.mjs` (o `npm run audit:security`).
- **Reglas mandatorias:**
  1. Ningún archivo con claves reales, tokens de WhaApi o credenciales de MySQL debe subirse a Git.
  2. Todas las credenciales deben aislarse en `.env.local` (ignorado en `.gitignore`).
  3. Todas las consultas a base de datos deben utilizar Prepared Statements con `?`.
  4. Ejecutar la auditoría de seguridad preventiva antes de confirmar cambios críticos.
