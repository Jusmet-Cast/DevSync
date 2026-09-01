# DEVSYNC — Amendments Consolidados

Registro versionado de ajustes a `DEVSYNC_SYSTEM_PROMPT.md` y a los `.md` de agentes en `Agentes/`.
Regla #4: los ajustes se añaden acá como sub-sección versionada, nunca como archivos sueltos.

---

## Amendment 001 — Protocolo de Arranque y Cierre de Sesión (25 Ago 2026)

**Agente responsable:** CORE (`DEVSYNC_SYSTEM_PROMPT.md`) — es orquestación transversal, no dominio de un agente de línea.

### Protocolo de Arranque — "Hello World!"

Al iniciar una sesión de DevSync (después de `claude` en CLI, cuando el usuario invoca trabajo bajo el
marco DevSync), CORE actúa como motor de arranque:

1. Verificar la conexión a DevCodex (Notion) — confirmar que el MCP responde antes de asumir cualquier
   estado de proyecto (coherente con la Regla #3: Notion es el estado).
2. Resolver en vivo el proyecto activo (`Projects`, `Status = "In progress"`) y el ciclo vigente
   (`Sprints`, `Status = "Active"`), per la sección "Resolución dinámica del estado".
3. Saludar con **"Hello World!"** como confirmación de que el motor de arranque completó los pasos 1-2
   y DevSync está operativo — no antes de verificar la conexión real.

Si Notion no conecta, CORE lo informa explícitamente en el saludo (no se simula haber cargado contexto —
mismo principio que el protocolo de Engram para MCPs no disponibles).

### Protocolo de Cierre — "Bye world! ;)"

Antes de cerrar una sesión de DevSync, CORE ejecuta en orden:

1. Documentar en DevCodex (Dev Log + Notas Finales/Quick Notes del proyecto activo) el trabajo de la
   sesión — spikes, hallazgos, decisiones — siguiendo el Protocolo de Espejo (Regla #2).
2. Preparar una proyección para el próximo daily (qué se hizo, qué sigue, impedimentos) y dejarla
   registrada en el mismo lugar.
3. Bajar cualquier proceso en background que la sesión haya iniciado (servidores de desarrollo,
   watchers, builds) — verificar explícitamente que el puerto/proceso quedó liberado, no asumirlo.
4. Despedirse con **"Bye world! ;)"** como confirmación de que los pasos 1-3 se completaron.

**Por qué:** el usuario pidió explícitamente estos dos protocolos de sign-off/arranque el 25 Ago 2026,
como parte de cerrar una sesión de trabajo sobre el proyecto "Administración de Impulsadoras y Meta".
El arranque necesitaba un motor explícito porque hasta ahora la conexión a Notion se resolvía de forma
implícita/ad-hoc; el cierre necesitaba un checklist porque documentar y bajar procesos se hacía a mano,
sin garantía de que quedara completo antes de despedirse.

**Nota de redundancia (Regla #9):** este amendment vive hoy SOLO acá y en el propio archivo de sesión.
`DEVSYNC_SYSTEM_PROMPT.md` (el archivo raíz) todavía no referencia `DEVSYNC_UPDATES.md` como documento
canónico a consultar — falta agregarlo a la sección "📚 DOCUMENTOS CANÓNICOS" y a "🏗️ INFRAESTRUCTURA
(CONSULTAR PRIMERO)" para que el protocolo se cargue de forma consistente en cada sesión, no solo cuando
se recuerda buscarlo. ~~Pendiente de que el usuario lo confirme y aplique esa edición al archivo raíz.~~

**✅ RESUELTO — 1 Sep 2026.** El usuario lo confirmó. `DEVSYNC_SYSTEM_PROMPT.md` ahora lista
`DEVSYNC_UPDATES.md` como punto 2 de «INFRAESTRUCTURA (CONSULTAR PRIMERO)» y le quitó el marcador
*(pendiente)* en «DOCUMENTOS CANÓNICOS». El protocolo de arranque se carga en cada sesión.
