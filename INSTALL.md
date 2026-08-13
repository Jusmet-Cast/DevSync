# DevSync — Guía de Instalación y Replicación
**Versión:** 1.0 · 8 Ago 2026 · Justyn A. Castro

Cómo levantar el ecosistema DevSync completo en una máquina nueva: el proyecto de Claude, la configuración local de Claude Code, y la conexión con DevCodex (Notion).

---

## 1. Qué es DevSync y de qué partes se compone

DevSync no es una herramienta — son **tres capas que se necesitan entre sí**. Instalar una sola no sirve de nada.

```
┌──────────────────────────────────────────────────────┐
│  CAPA 1 — GOBERNANZA          DevSync Core (main loop)│
│  Roles: PILOT · COMPASS · ECHO · SCRIBE · MENTOR ·    │
│         SENTRY · FORGE · RELAY · CIPHER               │
│  Vive en: System/*.md  →  base de conocimiento        │
├──────────────────────────────────────────────────────┤
│  CAPA 2 — EJECUCIÓN            Agentes de Claude Code │
│  dev-orchestrator · sdd-* (8) · judgment-day · jd-*   │
│  Vive en: ClaudeConfig/agents/  →  ~/.claude/agents/  │
├──────────────────────────────────────────────────────┤
│  CAPA 3 — ESTADO                   DevCodex (Notion)  │
│  Projects · Sprints · Dev Log · Repos · Learning …    │
│  Vive en: la nube. Es la única fuente de verdad viva. │
└──────────────────────────────────────────────────────┘
```

**La regla que explica todo:** los roles de la capa 1 **no son procesos**, son sombreros que se pone el main loop. Los procesos reales que se spawnean son los de la capa 2.

> ### ⚠️ Por qué esto no es un capricho de diseño
>
> `settings.json` fija `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH = 3`, y la cadena más larga del sistema ya lo consume entero:
>
> ```
> sdd-verify (1) → judgment-day (2) → jd-judge (3)   ← tope
> ```
>
> Si convirtieras un rol de DevSync en subagente que invoca `dev-orchestrator`, la cadena pasaría a 5 niveles y **rompería**. Por eso DevSync Core vive en el main loop y delega hacia abajo, nunca al revés.

---

## 2. Requisitos previos

| Requisito | Por qué | Cómo verificar |
|---|---|---|
| **Git for Windows (Git Bash)** | Sin él Claude Code cae a PowerShell y los comandos POSIX de agentes y skills rompen **en silencio** | `bash --version` |
| **Node.js** | Los hooks están escritos en Node (no en bash + `jq`, porque Git Bash no trae `jq` y fallarían sin avisar) | `node --version` |
| **Claude Code** | El runtime | `claude --version` |
| **Engram ≥ v1.12.0** | Memoria persistente cross-sesión y cross-herramienta | `engram --version` |
| **Cuenta de Notion** con acceso a DevCodex | Capa 3 | — |

---

## 3. Instalación paso a paso

### Paso 1 — Configuración de Claude Code

```bash
# Respaldá lo que ya tengas
mv ~/.claude ~/.claude.backup.$(date +%Y%m%d) 2>/dev/null || true
mkdir -p ~/.claude

# Copiá la configuración portátil de este repo
cp -r ClaudeConfig/agents   ~/.claude/
cp -r ClaudeConfig/hooks    ~/.claude/
cp -r ClaudeConfig/skills   ~/.claude/
cp -r ClaudeConfig/mcp      ~/.claude/
cp -r ClaudeConfig/memory   ~/.claude/
cp    ClaudeConfig/CLAUDE.md ClaudeConfig/README.md \
      ClaudeConfig/settings.json ClaudeConfig/.gitignore ~/.claude/
```

**Qué NO se copia, y por qué importa:**

| Excluido | Motivo |
|---|---|
| `.credentials.json` | 🔴 Credenciales de sesión. **Nunca** se versiona ni se comparte. Se regenera al loguearte. |
| `projects/` · `sessions/` · `session-*` | Historial local de conversaciones. Específico de la máquina. |
| `history.jsonl` · `shell-snapshots/` · `paste-cache/` | Estado efímero. |
| `cache/` · `file-history/` · `backups/` · `telemetry/` | Regenerables. |
| `plugins/` | ~6.6 MB. Se reinstalan solos desde el marketplace declarado en `settings.json`. |

### Paso 2 — MCP servers

Los servers **no** se versionan en `settings.json`: el registro real vive en `.claude.json`, que contiene el token y está en `.gitignore`. Las definiciones reproducibles están en `mcp/*.json` — **sin tokens**.

> ⚠️ **De este paso depende toda la Capa 3.** Sin el token de Notion, DevSync sigue funcionando pero **ciego**: los agentes no leen proyectos, ni ciclos, ni el Document Hub. Es el único punto de fallo que deja el sistema en pie pero vacío.

#### 2.1 · Engram

```bash
claude mcp add --scope user engram -- engram mcp
```

Dentro de Docker hace falta `-e ENGRAM_DATA_DIR=...` — ver `mcp/engram.json` para el motivo (SQLite y locking POSIX sobre 9p).

#### 2.2 · Notion — obtener el token

**No es OAuth.** Es un stdio server que recibe un token por variable de entorno.

**a) Crear la integración**

Entrá a **`https://www.notion.so/profile/integrations`**
*(equivalente: Notion → Settings → Connections → Develop or manage integrations · también accesible desde `https://app.notion.com/developers/connections`)*

```
New integration
  Tipo:         Internal
  Workspace:    el que contiene DevCodex
  Capabilities: ✅ Read content
                ✅ Update content
                ✅ Insert content
                ⬜ User information  ← DevSync no lo necesita
```

**b) Copiar el secreto**

El **Internal Integration Secret** empieza con `ntn_`. Copialo ahora; después hay que regenerarlo.

**c) ⚠️ Compartir la página — el paso que todos olvidan**

**El token no da acceso a nada por sí solo.** Notion usa acceso explícito por página:

```
Abrir DevCodex → menú (···) → Connections → buscar la integración → Confirm
```

Las bases y subpáginas **heredan** el acceso del padre, así que compartir la raíz `DevCodex` alcanza para las 10 bases.

> **Síntoma de haberlo olvidado:** la API responde `200 OK` pero devuelve listas vacías, o `404 Page not found or not shared with the integration`. El token funciona; simplemente no ve nada.

**d) Registrar el server**

```bash
claude mcp add --scope user notion \
  -e NOTION_TOKEN=ntn_TU_TOKEN_ACA \
  -- npx -y @notionhq/notion-mcp-server
```

Una sola vez por máquina. Queda a nivel usuario, así que sirve para **todos** tus proyectos — Claude Code CLI, app de escritorio y sesiones remotas por igual.

#### 2.3 · Verificación

| Comando | Qué confirma |
|---|---|
| `claude mcp list` | El server está registrado |
| `/mcp` *(dentro de Claude Code)* | Está **conectado**, no solo declarado |
| *"buscá la página DevCodex en Notion"* | El token **ve** el contenido |

Los tres son distintos. Si el segundo pasa y el tercero falla, el problema es el **share de la página**, no el token.

**Si Engram no responde, el hook `session-bootstrap.js` te lo avisa explícitamente en el contexto** — falla ruidoso, no silencioso. El de Notion **no** tiene ese aviso: se detecta al primer comando que necesite DevCodex.

#### 2.4 · Seguridad del token (Regla #6 — dominio de CIPHER)

| Regla | Por qué |
|---|---|
| El token da **lectura y escritura** sobre todo lo compartido | No es de solo lectura. Un agente con este token puede modificar tu workspace. |
| Vive **solo** en `.claude.json`, que está en `.gitignore` | Nunca se commitea ni se copia al espejo `ClaudeConfig/` |
| Si se expone → **se rota** | Regenerar en la página de la integración. Borrarlo de donde se filtró **no lo desexpone** |
| Para revocar sin rotar → quitar la integración de `Connections` | Corta el acceso al instante, sin invalidar el token |
| Compartir **solo** DevCodex, no el workspace entero | Alcance mínimo: si compartís todo, los agentes ven todo, incluido lo personal |

#### 2.5 · Uso remoto y en otras interfaces

El registro `--scope user` vale para toda la máquina. Para **Claude Code web**, worktrees remotos o cron, tené en cuenta:

- Engram **sí** persiste en entornos headless.
- **Notion puede no estar disponible** en runs headless según cómo se propaguen las variables de entorno. Por eso todos los agentes de DevSync **degradan con gracia**: registran la falta de acceso como deuda explícita y siguen. Ver `sdd-archive` Step 5.7.

### Paso 3 — Validar hooks

```bash
node ~/.claude/hooks/validate-config.js
```

Hooks activos, por evento:

| Evento | Hooks |
|---|---|
| `SessionStart` | `session-bootstrap` · `session-sync` · `session-title` |
| `PreToolUse` | `git-guard` · `clean-arch-guard` · `atl-only-guard` |
| `PostToolUse` | `auto-format` · `subagent-index` |
| `SubagentStart` / `SubagentStop` | `detect-subagent-model` · `judge-output-guard` |
| `Stop` / `SessionEnd` | `session-close-guard` · `post-compact-memory` · `precommit-validate` |
| `Notification` | `notify-desktop` |

> **Los hooks obligan; las skills solo enseñan.** Una skill se carga si el modelo decide que el trigger matchea — no está garantizado. Si una regla tiene que cumplirse SÍ o SÍ (ej. que el agente nunca haga `git commit`), va en un hook. `git-guard.js` y `clean-arch-guard.js` son exactamente eso.

### Paso 4 — Gobernanza (capa 1)

**No hay una sola forma de cargar esto.** Elegí según dónde vas a usar DevSync — o las tres, si querés acceso dual (compu + celular).

> ⚠️ **Un chat de claude.ai fuera del Project, o una sesión de Claude Code en una carpeta sin el `CLAUDE.md`, NO tiene DevSync Core cargado.** No es automático en todos lados: solo corre donde efectivamente pusiste la Capa 1. Preguntarle a Claude sobre un proyecto en otro chat/sesión que no tenga ninguna de las dos opciones de abajo es hablarle a un Claude genérico, no a DevSync.

#### Opción A · Project de claude.ai — necesaria para celular

Creá un proyecto nuevo en Claude.ai llamado **DevSync** y subí a su base de conocimiento:

```
System/DEVSYNC_SYSTEM_PROMPT.md    ← pegar también como System Prompt del proyecto
System/NOTION_DATA_REGISTRY.md
System/DEVSYNC_KPI_TEMPLATE.md
System/Agentes/*.md                 (los 9 roles)
System/DEVSYNC_UPDATES.md           (cuando exista — amendments, Regla #4)
```

Es la **única** vía que funciona desde la app de celular o el navegador sin Claude Code instalado — ahí no existe `CLAUDE.md` ni terminal. Requiere resubir los archivos a mano cada vez que cambien.

#### Opción B · `CLAUDE.md` global — recomendada para terminal / Claude Code, "siempre puesto"

> ⚠️ **Dependencia del sistema:** esta opción exige que ya tengas el mecanismo `@import` funcionando en tu `~/.claude/CLAUDE.md` — el mismo que usa Engram (`ENGRAM-PROTOCOL.md`). Si tu instalación de Claude Code no tiene ya un `CLAUDE.md` global con al menos un `@import`, empezá por ahí; DevSync Core se agrega como una línea más al lado de esa, no como mecanismo nuevo.

No subís nada a ningún lado ni dependés de estar parado en la carpeta del repo. Agregás una línea a tu `CLAUDE.md` **global** (`~/.claude/CLAUDE.md`, no uno del proyecto):

```
@<ruta-absoluta-al-repo>/System/DEVSYNC_SYSTEM_PROMPT.md
```

Con esto, DevSync Core carga en **toda** sesión de Claude Code, sin importar en qué repo estés parado — igual que Engram y que tu persona de Arquitecto Senior. Es la forma correcta de usarlo si tu trabajo real pasa en *otros* repos (que es el caso típico): un `CLAUDE.md` de proyecto atado a la carpeta de DevSync solo se activaría cuando `cd`eás justo ahí, y DevSync existe para orquestar el trabajo en los demás.

> **Tradeoff a tener en cuenta:** al quedar siempre activo, el roster completo (PILOT/COMPASS/FORGE/etc.) y sus reglas se cargan incluso en tareas sueltas que no tienen nada que ver con tu portafolio de proyectos. Si preferís que solo se active bajo demanda, la alternativa es un `CLAUDE.md` de proyecto (`echo '@.../DEVSYNC_SYSTEM_PROMPT.md' > ./CLAUDE.md` en la raíz de un repo puntual) — pero entonces solo corre en ese repo, no en los demás.

#### Opción C · Dual — celular + terminal siempre activo

Combinás A (Project en claude.ai, para el celular) con B (import global, para toda sesión de Claude Code). Las dos apuntan al mismo texto fuente (`System/DEVSYNC_SYSTEM_PROMPT.md`), así que no divergen por copiarlo distinto — pero sí pueden divergir en el tiempo, porque **el Project no se actualiza solo con `git pull`, y el import global sí**: la Regla #9 (§6 de esta guía) es el mecanismo para detectar ese drift entre lados.

| Opción | Celular | Toda sesión de Claude Code, cualquier repo | Se actualiza solo con `git pull` |
|---|---|---|---|
| A · Project only | ✅ | ❌ — no existe fuera del Project | ❌ — hay que resubir a mano |
| B · Import global | ❌ | ✅ | ✅ |
| C · Dual | ✅ | ✅ | Solo el lado B — el Project sigue manual |

### Paso 5 — Levantar DevCodex (Capa 3)

👉 **Guía completa: [`Notion/DEVCODEX_TEMPLATE.md`](Notion/DEVCODEX_TEMPLATE.md)**

Dos caminos, porque la API **no puede crear bases de datos** (`G-05`) ni configurar filtros de vista:

| Camino | Tiempo | Qué trae |
|---|---|---|
| **A · Duplicar plantilla** ✅ | 15 s | Todo: bases, schemas, relaciones, **vistas, filtros, layout** |
| **B · Reconstrucción manual** | ~30 min | 10 contenedores vacíos + schema aplicado por agente |

El Camino A gana porque la duplicación transporta justo lo que la API no puede tocar.

Después, en cualquiera de los dos casos:

```bash
# 1. Compartir DevCodex con la integración (··· → Connections → Confirm)
# 2. Verificar la estructura contra el esquema canónico
NOTION_TOKEN=ntn_xxx node Notion/verify-devcodex.mjs
# 3. Copiar los data_source_id que imprime a System/NOTION_DATA_REGISTRY.md §2
```

⚠️ Los `data_source_id` son **específicos del workspace** y cambian al duplicar. El paso 3 no es opcional: los agentes leen el registro para saber a qué base escribir.

```
Notion/devcodex-schema.json     →  qué DEBE existir  (plantilla, sin IDs)
System/NOTION_DATA_REGISTRY.md  →  qué existe HOY    (instancia, con IDs)
```

`verify-devcodex.mjs` también sirve como **detector de drift** (Regla #9): un campo renombrado a mano en la UI no da error hasta que un agente escribe mal. Exit code 1 si hay diferencias, así que corre en CI o cron.

---

## 4. Verificación post-instalación

```bash
claude --version && node --version && bash --version && engram --version
node ~/.claude/hooks/validate-config.js
ls ~/.claude/agents | wc -l     # esperado: 13
ls ~/.claude/skills | wc -l     # esperado: 30 (29 skills + SKILL-REGISTRY.md)
```

Dentro de Claude Code:

| Comando | Resultado esperado |
|---|---|
| `/mcp` | `engram` y `notion` conectados |
| `/agents` | 13 agentes listados |
| *"¿qué contexto tenés?"* | Debe llamar `mem_context` y reportar qué cargó |
| `/status` | Estado del portafolio leído desde Notion |

---

## 5. Uso remoto (dispatch / cowork)

Las tres capas están diseñadas para sobrevivir sin la máquina local:

- **Capa 1 y 3** son *cloud-native*: el proyecto de Claude y Notion se acceden desde cualquier lado.
- **Capa 2** requiere entorno de ejecución — Claude Code web (`claude.ai/code`), un worktree remoto, o la app de escritorio.

⚠️ **Limitación conocida:** en runs headless o de cron, los MCP con autenticación interactiva (Notion) pueden no estar disponibles. Engram sí persiste. Diseñá los comandos automatizados para degradar con gracia, no para asumir Notion.

---

## 6. Sincronización y drift — Regla #9

El sistema vive **redundante a propósito**: en los `.md` locales y en DevCodex. La redundancia te protege de la inaccesibilidad; el problema es el drift.

Por eso la **Regla #9** del System Prompt: cuando se modifica una definición del sistema (un rol, un comando, un schema, una regla) en **cualquiera** de los dos lados, DevSync Core dispara de inmediato un recordatorio explícito listando qué quedó desactualizado en el otro.

**Checklist manual al cambiar algo estructural:**

- [ ] `System/DEVSYNC_SYSTEM_PROMPT.md` — ¿cambió el roster, los comandos o las reglas?
- [ ] `System/NOTION_DATA_REGISTRY.md` — ¿cambió algún schema o data source ID?
- [ ] `System/Agentes/*.md` — ¿el rol afectado sigue siendo coherente?
- [ ] Base de conocimiento del proyecto de Claude — ¿resubiste los archivos?
- [ ] `ClaudeConfig/` de este repo — ¿replicaste el cambio de `~/.claude`?
- [ ] DevCodex — ¿el manual embebido en la página sigue diciendo la verdad?

**Ante discrepancia entre un archivo y Notion, gana Notion** (Regla #3) — y se te notifica para que decidas si el archivo necesita actualizarse.

---

## 7. Gotchas heredados — leer antes de tocar Notion por API

Documentados en detalle en `System/NOTION_DATA_REGISTRY.md §5.1`. El resumen que más duele:

| # | Comportamiento | Impacto |
|---|---|---|
| G-01 | Renombrar una opción existente de select/multi_select **no funciona y devuelve `200 OK`** | Falla silenciosa. Verificá la respuesta, no el status code. |
| G-02 | Cambiar el color de una opción existente da `400` | Mandá solo `{"id": "..."}` sin `color`. |
| G-03 | Omitir una opción del array **la elimina** junto con sus asignaciones | Es la vía legítima de borrado — pero solo tras migrar. |
| G-04 | Las opciones de una propiedad `status` **no son editables por API** | Cambio manual en la UI, sin excepción. |
| G-05 | **No se pueden crear bases de datos nuevas** con este MCP (`create-a-data-source` responde que se use la Create Database API, no expuesta) | La base vacía la crea un humano; el agente después le puebla el schema. |

---

## 8. Estructura de este repositorio

```
DevSync/
├── INSTALL.md                          ← este archivo
├── PROPUESTA_NIVELACION_DEVCODEX.md    ← diagnóstico y arquitectura (v1)
├── Notion/                             ← CAPA 3 · replicación del workspace
│   ├── DEVCODEX_TEMPLATE.md            ← guía: duplicar plantilla o reconstruir
│   ├── devcodex-schema.json            ← esquema canónico · 10 bases · 90 props · sin IDs
│   └── verify-devcodex.mjs             ← verificador y detector de drift (solo lectura)
├── System/                             ← CAPA 1 · base de conocimiento
│   ├── DEVSYNC_SYSTEM_PROMPT.md        ← Core · 13 reglas · catálogo de comandos
│   ├── NOTION_DATA_REGISTRY.md         ← schemas exactos · gotchas · doctrina
│   ├── DEVSYNC_KPI_TEMPLATE.md         ← plantilla canónica de KPI
│   └── Agentes/                        ← los 9 roles
│       ├── PILOT.md · COMPASS.md · ECHO.md        (gobernanza)
│       ├── FORGE.md · SENTRY.md · RELAY.md        (ejecución)
│       └── SCRIBE.md · MENTOR.md · CIPHER.md      (conocimiento y seguridad)
└── ClaudeConfig/                       ← CAPA 2 · espejo portátil de ~/.claude
    ├── CLAUDE.md · README.md · settings.json · .gitignore
    ├── agents/   (13)
    ├── hooks/    (18 + lib + windows)
    ├── skills/   (29 + registry)
    ├── mcp/      (engram.json · playwright.json)
    └── memory/   (ENGRAM-PROTOCOL.md)
```

---

## 9. Filosofía

> *"Los grandes proyectos se construyen con pequeños commits."* — DevCodex

CONCEPTOS > CÓDIGO. La IA ejecuta, el humano dirige. El sistema existe para que las decisiones queden **registradas, medibles y recuperables** — no para decidir por vos.
