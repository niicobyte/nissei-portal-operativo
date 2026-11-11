---
trigger: always_on
description: Guardián de Seguridad permanente para prevenir fugas de secretos, vulnerabilidades SQL y exposición de credenciales.
---

# Guardián de Seguridad & Prevención de Filtraciones

Para proteger la integridad del proyecto y evitar cualquier filtración o vulnerabilidad:

1. **Prevenir Fugas de Secretos (Secret Leaks):**
   - NUNCA incluir tokens reales (como WhaApi), contraseñas de MySQL, JWT secrets o claves privadas en el código fuente, comentarios o mensajes de commit.
   - Todo secreto o credencial debe residir estrictamente en `.env.local` (el cual NUNCA se sube a GitHub y debe permanecer en `.gitignore`).
   - `.env.example` solo puede contener placeholders genéricos (ej. `tu_token_aqui`).

2. **Prevenir Inyecciones SQL:**
   - Toda consulta a MySQL mediante `mysql2` debe utilizar Prepared Statements con marcadores `?` y arreglo de parámetros (`pool.query(sql, [params])`).
   - NUNCA interpolar cadenas de variables no sanitizadas con template strings (`${...}`) dentro de sentencias SQL.

3. **Verificación de Seguridad Pre-Commit:**
   - Antes de realizar cualquier subida o commit a GitHub, verificar que `node scripts/security-audit.mjs` pase con 0 errores.
   - En caso de duda o cambio crítico, delegar o consultar con el subagente `security-auditor`.

4. **Modelos IA Mandatorios de Auditoría y Escaneo:**
   - **100% Prioritario:** Utilizar `Claude Opus 5.5 High` (`claude-opus-5-5-high`) para análisis de seguridad, revisión de código defensiva y razonamiento crítico.
   - **Fallback por agotamiento de tokens/cuota:** Cambiar a `Gemini 3.8 Flash Medium` (`gemini-3.8-flash-medium`) si se alcanza el límite de cuota.
