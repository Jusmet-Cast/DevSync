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

---

## Amendment 002 — Regla #9 v2: qué se respalda dónde (1 Sep 2026)

**Agente responsable:** CORE (`DEVSYNC_SYSTEM_PROMPT.md`) — es doctrina transversal sobre dónde vive
cada cosa, no dominio de un agente de línea.

### Qué se cambió

La Regla #9 v1 afirmaba que "el sistema vive en dos lados: los `.md` locales y DevCodex". **Eso era
falso.** Verificado el 1 Sep 2026 contra el workspace real: buscar `NOTION_DATA_REGISTRY` por título
en todo Notion devuelve cero resultados, y `Document Hub` filtrado por `Category = Reference` tenía un
único documento, ajeno al sistema. Para los archivos canónicos **no había ninguna redundancia**.

La v2 reemplaza la afirmación falsa por el reparto real de responsabilidades:

| | v1 | v2 |
|---|---|---|
| Quién respalda los `.md` | DevCodex (falso) | git + push al remoto |
| Qué guarda DevCodex del sistema | copias de definiciones | estado y avance, como proyecto |
| Qué hay en `Document Hub` | nada definido | puntero con SHA, nunca transcripción |
| Push pendiente | no contemplado | deuda que CORE reporta |

### Por qué puntero y no copia

Se evaluó publicar los `.md` canónicos completos en `Document Hub`. **Se rechazó.** Una copia en
Notion no tiene diff, no tiene historial y se sincroniza a mano: es exactamente el drift que la
Regla #9 existe para vigilar. `INSTALL.md` ya documenta ese fracaso para la Opción A — el Project de
claude.ai "no se actualiza solo con `git pull`". Repetir el mecanismo que se sabe que se
desincroniza, para protegerse de la desincronización, no resuelve nada.

Resuelve además una tensión real entre reglas propias: la **Regla #1** dice "Notion es el estado, el
prompt es la lógica", mientras la #9 v1 mandaba los `.md` a Notion. Los archivos canónicos son
lógica, así que gana la #1.

**El usuario lo formuló así:** que DevCodex sea "la base de contexto y avance del desarrollo y
crecimiento del propio DevSync", no el lugar donde el documento "viva precisamente".

### Hecho en esta sesión

- `DevSync — Ecosistema` creado en `Projects` — **primer proyecto con `Engagement = Internal`** del
  workspace. Sin él, el trabajo sobre la propia herramienta no tenía dónde registrarse.
- La entrada huérfana de `Dev Log` del 10 Ago (bootstrap de las bases) quedó enlazada a ese proyecto.
  `Dev Log` ya no tiene entradas sin proyecto.
- `G-06` verificado en vivo y `G-07` documentado en `NOTION_DATA_REGISTRY.md §5.1`.

### Pendiente (Regla #9 · esta enmienda se audita a sí misma)

- [ ] Crear los punteros en `Document Hub` para `DEVSYNC_SYSTEM_PROMPT.md`,
      `NOTION_DATA_REGISTRY.md`, `DEVSYNC_UPDATES.md` y `INSTALL.md`.
      **Hasta que existan, la v2 describe un mecanismo que todavía no está montado** — el mismo
      pecado de la v1, y por eso queda anotado acá en vez de darse por hecho.
- [ ] `Sprint` de la entrada de `Dev Log` del 10 Ago sigue vacío.
- [ ] Engram archiva bajo `claude-config-madian` todo lo guardado desde `C:\Users\jacastro`, porque
      resuelve el proyecto por `cwd` y auto-promueve el repo hijo. Se corrige arrancando la sesión
      con `cd ~/Downloads/DevSync && claude`. No existe proyecto `DevSync` en Engram todavía.
