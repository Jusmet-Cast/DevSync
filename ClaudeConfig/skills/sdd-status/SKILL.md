---
name: sdd-status
description: Muestra el estado del flujo SDD del proyecto actual — changes abiertos, fase, artifacts y próximo paso concreto.
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash
---

# Estado SDD

Mostrá el estado del flujo SDD de este proyecto. Sin relleno, sin preámbulo.

1. `Glob` sobre `.atl/changes/*/state.md`.
   - Si no hay nada: decí que este proyecto no tiene SDD iniciado y ofrecé correr `sdd-init`. Fin.

2. Por cada change encontrado, leé su `state.md` y armá esta tabla:

   | Change | Fase actual | Fases completadas | Artifacts presentes | Última actividad |
   |--------|-------------|-------------------|---------------------|------------------|

   - `Artifacts presentes`: verificá cuáles existen de verdad en disco (`explore.md`, `proposal.md`,
     `spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`,
     `archive-report.md`). No los listes desde `state.md` sin confirmar el archivo.
   - Marcá con ⚠️ todo change sin movimiento hace 7 días o más.
   - Los `closed` van aparte, en una línea de resumen. No ocupan la tabla.

3. Si algún `state.md` tiene `## Open Questions Pendientes` con contenido, listalas aparte bajo
   **"❓ Esperando decisión tuya"** — esas son las que los sub-agentes no pudieron preguntar.

4. Si hay `tasks.md` en el change activo, contá cuántas tasks están `[x]` sobre el total y mostralo
   como progreso (`14/23 tasks`).

5. Cerrá con **UNA** recomendación concreta de qué hacer ahora: qué fase sigue y sobre qué change.
   Una sola. Si hay varios candidatos, elegí y justificá en una línea.
