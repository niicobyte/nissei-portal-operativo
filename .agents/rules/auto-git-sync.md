---
trigger: always_on
description: Subir automáticamente a GitHub (git add, commit con comentario descriptivo en español y push a origin main) cada cambio realizado.
---

# Auto-Commit y Push Automático a GitHub

Cada vez que realices cualquier modificación, corrección o agregues una funcionalidad pedida por el usuario en este proyecto:

1. Haz `git add -A` de todos los cambios realizados (respetando `.gitignore` para no incluir `.env.local`).
2. Haz `git commit -m "<tipo>(<alcance>): <descripción clara en español>"` explicando qué se hizo (por ejemplo: `feat(taller): ...`, `fix(recepcion): ...`).
3. Haz `git push origin main` directamente con la cuenta `niicobyte`.
4. No preguntes si debe subirse a GitHub: **hazlo siempre automáticamente al terminar cada solicitud** e indícale al usuario el commit subido.
