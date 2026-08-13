# claude-config

Configuración de Claude Code versionada: memoria global, sub-agentes del flujo SDD, ecosistema de
skills, hooks de enforcement y permisos.

Este repo **es** el contenido de la carpeta de configuración de Claude Code (`.claude`).

## Todo vive dentro de la carpeta de configuración

**Principio de este setup: no hay configuración de Claude Code fuera de esta carpeta.**
Nada en el home del usuario, nada en rutas absolutas de la máquina. Un solo lugar.

Esto incluye `.claude.json` — el archivo con los MCP servers registrados y el estado local — que
por defecto Claude Code deja en el home, pero acá vive **adentro** de esta carpeta
(vía `CLAUDE_CONFIG_DIR`). Está en `.gitignore` porque contiene tokens, no porque esté afuera.

| Archivo | Dónde | Versionado |
|---------|-------|------------|
| `settings.json`, `CLAUDE.md`, `agents/`, `skills/`, `hooks/`, `memory/`, `mcp/` | Esta carpeta | ✅ Sí |
| `.claude.json` (MCP registrados, estado local, tokens) | Esta carpeta | ❌ No — tiene tokens |
| `session-state/`, `projects/`, `history.jsonl`, `plugins/marketplaces/` | Esta carpeta | ❌ No — estado y caché |

> **Para el agente:** si necesitás resolver configuración, buscá **acá adentro**. No salgas al home
> del usuario ni asumas rutas tipo `%USERPROFILE%\...` o `C:\Users\<user>\...`.
>
> **Única excepción**, y no es config de Claude Code: la base de datos de **Engram** pertenece a la
> herramienta Engram y su ubicación la resuelve ese binario (variable `ENGRAM_DB`).

**Los hooks se ubican solos.** Cada script resuelve la carpeta de configuración desde su propia
ruta (`path.resolve(__dirname, '..')`), con `CLAUDE_CONFIG_DIR` como override. No dependen de
`os.homedir()`, así que funcionan aunque muevas la carpeta.

**Los comandos de hook en `settings.json` también.** Usan `${CLAUDE_CONFIG_DIR:-$HOME/.claude}`:
si moviste la carpeta y apuntaste `CLAUDE_CONFIG_DIR` ahí, los hooks siguen encontrándose solos;
si no la moviste, cae al default de siempre. No hay ninguna ruta que actualizar a mano.

> Antes esas líneas decían `$HOME/.claude` fijo, lo cual contradecía en silencio al párrafo de
> arriba: los scripts se ubicaban solos pero `settings.json` no los encontraba. Moverla te dejaba
> con los hooks muertos y ningún mensaje de error.

## Requisitos

| Requisito | Por qué |
|-----------|---------|
| **Git for Windows** (Git Bash) | Claude Code solo usa una shell POSIX si lo detecta. Sin él cae a PowerShell y los comandos POSIX de agentes y skills rompen **en silencio**. |
| **Node.js** | Los hooks están escritos en Node. Ya viene con el toolchain de Angular. |
| **`engram` v1.12.0+ en el `PATH`** | Memoria persistente vía MCP. [Gentleman-Programming/engram](https://github.com/Gentleman-Programming/engram) — verificar con `engram --version`. Sin él, el protocolo de `CLAUDE.md` no se puede cumplir; el hook `SessionStart` avisa fuerte. |
| **.NET SDK / Angular CLI** | Opcionales: los usa el hook `auto-format` si están. Si no están, no formatea y sigue. |

## Bootstrap en una máquina nueva

```bash
git clone <repo> "$HOME/.claude"          # el repo ES la carpeta de configuracion
claude mcp add --scope user engram -- engram mcp   # queda en .claude.json, ver mcp/engram.json
claude                                    # verificar que la statusline aparezca
```

Si querés la carpeta en otro lado, cloná donde quieras y apuntá `CLAUDE_CONFIG_DIR` ahí
(recordá ajustar las rutas de los hooks en `settings.json` — ver abajo).

## Plugins — qué se versiona y qué no

El objetivo es que al clonar este repo en otra máquina tengas **los mismos plugins**. Eso se logra
versionando la **declaración**, no los archivos descargados:

| Qué | Dónde | ¿Se versiona? |
|-----|-------|---------------|
| Qué marketplaces usás | `extraKnownMarketplaces` en `settings.json` | ✅ **Sí** — es la declaración portable |
| Qué plugins están activos | `enabledPlugins` en `settings.json` | ✅ **Sí** — `"plugin@marketplace": true` |
| Los repos clonados de cada marketplace | `plugins/marketplaces/` | ❌ No — caché, se re-clona sola |
| `known_marketplaces.json` | `plugins/` | ❌ No — tiene `installLocation` con ruta absoluta de la máquina |

Con las dos primeras claves versionadas, en una máquina nueva Claude Code lee `settings.json`,
clona los marketplaces declarados e instala los plugins habilitados. **Subir los clones no ayuda**:
la doc los trata como caché (`rm -rf ~/.claude/plugins/cache` es el fix oficial cuando se corrompen)
y el auto-update los pisa igual.

Para llenar `enabledPlugins`, corré `/plugin list --enabled` y volcá cada entrada como
`"nombre-del-plugin@claude-plugins-official": true`.

## Estructura

```
CLAUDE.md                 Memoria global: reglas, persona, stack, restricciones de sub-agentes
memory/
  ENGRAM-PROTOCOL.md      Protocolo de memoria persistente (cargado con @import desde CLAUDE.md)
agents/                   dev-orchestrator + los 9 sub-agentes del flujo SDD
skills/                   Ecosistema de skills (stack, metodología e invocables)
  SKILL-REGISTRY.md       Cheat-sheet humano + compact rules de las skills de STACK
hooks/                    Enforcement en Node.js
  windows/                Scripts para el lado Windows del bridge Docker/WSL2 (ver Notificaciones)
mcp/                      Definiciones reproducibles de los MCP servers
  engram.json             Memoria persistente
  playwright.json         Navegador real para probar formularios contra una API
settings.json             Modelo, permisos, hooks, statusline
```

## Hooks

| Hook | Evento | Qué hace |
|------|--------|----------|
| `clean-arch-guard.js` | PreToolUse (Edit·MultiEdit·Write) | **Bloquea** violaciones de capas: EF/HTTP en Domain, HttpContext/DbContext en Application, mensajes de negocio en Repository, DTOs como `record`, sufijos prohibidos |
| `git-guard.js` | PreToolUse (Bash) | **Bloquea** `git commit/push/merge/rebase` en repos de proyecto. Exento el repo de config |
| `precommit-validate.js` | PreToolUse (Bash) | **Bloquea** `git commit` en ESTE repo si `validate-config.js` falla. La config no se commitea rota |
| `atl-only-guard.js` | PreToolUse — scoped a 8 sub-agentes | **Bloquea** escrituras fuera de `.atl/`. Enganchado por el campo `hooks:` del frontmatter, no global. Lo llevan todas las fases SDD **menos `sdd-apply`**, que es la única que escribe código de proyecto |
| `judge-output-guard.js` | PreToolUse — scoped a `jd-judge` | **Bloquea** escrituras fuera de `session-state/agent-outputs/` (bajo la carpeta de config, no del proyecto). Le da a `jd-judge` un `Write` acotado solo para persistir su propio veredicto como backup — sigue sin poder tocar código |
| `detect-subagent-model.js` | PostToolUse — scoped a los sub-agentes | Lee del transcript el modelo **real** que la plataforma asignó y lo compara con el declarado |
| `auto-format.js` | PostToolUse (Edit·MultiEdit·Write) | `dotnet format` / `prettier` sobre el archivo tocado. No compila |
| `session-title.js` | SessionStart | Nombra la sesión (la rama de trabajo) para que `/resume` muestre un título y no un pedazo de conversación |
| `session-bootstrap.js` | SessionStart | Cleanup de `agent-outputs` (TTL 24h) y de marcas de cierre (TTL 7d), inyecta changes SDD abiertos, avisa si Engram no está |
| `post-compact-memory.js` | SessionStart (`compact`) | Inyecta el protocolo AFTER COMPACTION de Engram apenas se compacta el contexto |
| `session-close-guard.js` | Stop | Bloquea **una vez por sesión** si hubo escrituras y no se llamó a `mem_session_summary` |
| `subagent-start.js` | SubagentStart | Abre la ficha del sub-agente en vuelo (tipo + **modelo** + inicio) que lee la statusline |
| `notify-desktop.js` | Notification (`permission_prompt`, `idle_prompt`) · SubagentStart | Notificación de escritorio multiplataforma para desligarse del CLI — ver sección "Notificaciones de escritorio" más abajo |
| `subagent-index.js` | SubagentStop | Cierra la ficha, calcula duración, traza en `_index.jsonl` y **devuelve una línea al orquestador** |
| `statusline.js` | statusLine | `proyecto · ‹sesión› · rama* · [modelo] · SDD:change→fase` — el segmento SDD **solo** aparece bajo `dev-orchestrator` (ver abajo) |
| `validate-config.js` | manual | Valida la consistencia de toda la config — ver abajo |

## Notificaciones de escritorio (`notify-desktop.js`)

Engancha `Notification` (`permission_prompt`: Claude bloqueado esperando que apruebes algo;
`idle_prompt`: Claude terminó y espera tu próximo mensaje) y `SubagentStart` (arrancó un sub-agente).
El objetivo es poder desligarse del CLI sin quedar pendiente de la terminal.

| Entorno | Mecanismo |
|---|---|
| Windows nativo | Toast vía `BurntToast` (PowerShell) |
| WSL2 corriendo Claude Code **directo** (sin contenedor) | Mismo camino, invocando el `powershell.exe` del host vía interop |
| macOS | `osascript -e 'display notification ...'` — nativo, sin dependencias |
| Linux de escritorio | `notify-send` (libnotify) |
| Claude Code **dentro de un contenedor Docker** (ej. WSL2 → `docker run` → Claude adentro) | Bridge de carpeta compartida + watcher de PowerShell — ver más abajo |

**Requisito único, Windows/WSL2 directo:** `Install-Module -Name BurntToast -Scope CurrentUser -Force`
en PowerShell, una sola vez. No hace falta admin.

### Si falta una dependencia, no falla en silencio

El hook detecta la ausencia de `BurntToast` (Windows/WSL2) o `notify-send` (Linux) y avisa **una sola
vez por sesión** (marca en `session-state/notify-warnings/`, no versionado) con instrucciones exactas
de qué instalar. Usa un exit code que no es `0` ni `2`, así el mensaje llega a la terminal sin activar
el comportamiento de bloqueo de ningún evento.

> **Ojo con quién puede instalar qué.** Esta sesión de Claude Code corre en un entorno remoto propio,
> sin acceso a tu máquina real — no puede ejecutar `Install-Module` en tu Windows. Quien sí puede es
> tu **Claude Code local** (el que corrés directo en tu PC/WSL), porque ese tiene una shell de verdad
> ahí: pedile a ese "instalá BurntToast" y va a correr el comando por vos. La alternativa es correrlo
> vos mismo.

### Contenedor Docker dentro de WSL2 — bridge de carpeta compartida

Si corrés `wsl` → `docker run` → Claude Code **adentro** del contenedor, ni el interop con
`powershell.exe` ni `notify-send` tienen efecto ahí adentro: el contenedor no ve el escritorio de
Windows. La solución es un bridge de archivos: el contenedor escribe un JSON chico en una carpeta
montada desde Windows, y un watcher de PowerShell corriendo en el host la mira y dispara el toast.

**1. Levantar el contenedor con el volumen montado** (desde WSL2, reemplazando `<TU_USUARIO_WINDOWS>`
por tu usuario real de Windows — el que ves en `C:\Users\`, no necesariamente el mismo que en WSL):

```bash
docker run -v /mnt/c/Users/<TU_USUARIO_WINDOWS>/ClaudeNotify:/claude-notify \
  ...el resto de tus flags de siempre... imagen
```

El path por default que espera `notify-desktop.js` adentro del contenedor es `/claude-notify`. Si
montás en otro lado, seteá `CLAUDE_NOTIFY_BRIDGE_DIR` al levantar el contenedor
(`-e CLAUDE_NOTIFY_BRIDGE_DIR=/otro/path`).

**2. Correr el watcher del lado de Windows** — `hooks/windows/notify-bridge-watcher.ps1`. Primero
probalo en primer plano para confirmar que aparecen los toasts:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\hooks\windows\notify-bridge-watcher.ps1"
```

Por default mira `$env:USERPROFILE\ClaudeNotify` (la misma carpeta del `-v` de arriba). Una vez
confirmado, registralo como Tarea Programada para que arranque solo al iniciar sesión y quede
corriendo en segundo plano (instrucciones completas con `Get-Help` del script, o en su docstring):

```powershell
$scriptPath = "$env:USERPROFILE\.claude\hooks\windows\notify-bridge-watcher.ps1"
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName 'ClaudeNotifyBridgeWatcher' -Action $action -Trigger $trigger `
    -Description 'Watcher de notificaciones de Claude Code (Docker/WSL2 bridge)'
```

Si el volumen no está montado (o no se puede escribir ahí), `notify-desktop.js` avisa una sola vez
por sesión en vez de fallar en silencio, con el mismo comando de arriba como recordatorio.

> **Sin probar en Windows real.** Este script se escribió y revisó a mano en un sandbox Linux sin
> PowerShell disponible — no se pudo ejecutar ni un chequeo de sintaxis automático. Probalo vos en
> primer plano (paso 1 de arriba) antes de confiar en la Tarea Programada para el día a día.

## MCP: Playwright — probar formularios contra una API real

`@playwright/mcp` (Microsoft) le da al agente un navegador de verdad. **No trabaja con píxeles**:
usa el árbol de accesibilidad, así que no hace falta un modelo de visión y las acciones son
determinísticas.

Está para tres cosas que el navegador ve y un test unitario no:

| Qué querés detectar | Con qué |
|---|---|
| Que la respuesta de la API sea la correcta | `browser_network_requests` (con `filter` regexp tipo `/api/.*`) → `browser_network_request` devuelve **headers y body** completos |
| Un loop infinito por una respuesta no contemplada | `browser_network_requests` filtrado: el mismo endpoint repetido N veces **es** la evidencia |
| Un `[object Object]` en el mensaje de éxito/error | `browser_snapshot`: como es el árbol de accesibilidad y no una foto, el texto roto aparece **literal** |

Y la pieza que lo vuelve un test y no una observación: **`browser_route` mockea respuestas**
(`pattern`, `status`, `body`, `contentType`). Podés **provocar** la respuesta rara —un 500 con un
body que la app no contempla— en vez de esperar a que ocurra. Se limpia con `browser_unroute`.

### Por qué MCP y no el CLI

El propio README de Playwright recomienda **CLI+SKILLS** para coding agents, por costo de tokens, y
reserva el MCP para *"exploratory automation... long-running autonomous workflows where maintaining
continuous browser context outweighs token cost concerns"*. Este caso es ese: el navegador tiene
que quedar **vivo** entre el submit del form, la lectura de la respuesta y la inspección del DOM.
Con el CLI, cada invocación arranca de cero.

### Permisos: no está auto-aprobado todo

De las ~50 tools, 27 quedan pre-aprobadas (navegar, llenar forms, leer red y consola, mockear).
Piden permiso las que tocan estado real o ejecutan código: `browser_evaluate`, `browser_file_upload`,
y todo lo de cookies/localStorage.

**`browser_run_code_unsafe` está en `deny`.** Su propia descripción dice: *"executes arbitrary
JavaScript in the Playwright server process and is **RCE-equivalent**"*. No hay caso de uso de
testeo de formularios que lo necesite.

> Del README, textual: **"Playwright MCP is *not* a security boundary"**, y `--allowed-origins`
> *"does not serve as a security boundary and does not affect redirects"*. No lo apuntes a un
> entorno con datos productivos.

Corre con `--isolated` (perfil en memoria: cada corrida arranca sin sesión ni cookies viejas) y
**headed** a propósito — para debuggear un form conviene ver el navegador. Agregale `--headless`
si lo vas a correr en CI.

### Activarlo: clonar el repo NO alcanza

`mcp/playwright.json` es la **declaración** versionada, no el registro. El registro real vive en
`.claude.json`, que está en `.gitignore` porque tiene tokens — exactamente el mismo caso que
Engram. En una máquina nueva hay que registrarlo a mano, una sola vez:

```bash
claude mcp add --scope user playwright -- npx @playwright/mcp@latest --isolated --caps=devtools
claude mcp list                                    # confirmar que aparece
```

Requisitos: **Node 18+** (ya lo tenés). El navegador lo baja `npx` la primera vez que se lanza,
así que **el primer uso tarda** — no es que se colgó. Si querés adelantarlo:
`npx playwright install chrome`.

Después: la app **corriendo** (la levantás vos, no el agente), y `/form-audit <URL>`.

### Quién tiene acceso al MCP (ojo con esto)

Registrar el server **no** se lo da a todos. El campo `tools:` de un agente es una **allowlist**:
la doc dice que un sub-agente *"inherits every tool available to subagents **if omitted**"* — o sea
que en cuanto lo declarás, lo que no está, no existe.

| Sesión | ¿Ve Playwright? | Por qué |
|---|---|---|
| `claude` (sin agente) | ✅ | El hilo principal no filtra tools |
| `claude --agent=dev-orchestrator` | ✅ | Tiene `mcp__playwright__*` en su `tools:` |
| Sub-agentes `sdd-*` y `jd-*` | ❌ | Su `tools:` no lo lista, y es a propósito: ninguno navega |

> Esto se descubrió probando el flujo real. `dev-orchestrator` declaraba solo `mcp__engram__*`, así
> que bajo `--agent=dev-orchestrator` las tools de Playwright **no existían** — sin error, igual que
> el `skills:` inválido y el `delegate()`. Si algún día querés auditar formularios dentro de la fase
> `verify`, hay que agregarle `mcp__playwright__*` a `agents/sdd-verify.md`; hoy no lo tiene.

## Validar la configuración

```bash
node hooks/validate-config.js     # exit 0 si esta todo bien, 1 si hay errores
```

Ya no hace falta que te acuerdes: el hook `precommit-validate.js` lo corre solo y **bloquea el
`git commit`** si algo está roto. Corrélo a mano igual cuando quieras feedback rápido.

Detecta lo que se rompe al borrar o renombrar cosas, que es de donde salieron todos los problemas
históricos de este repo:

1. Frontmatter YAML ausente o roto en `agents/` y `skills/`
2. **Campos de frontmatter que no existen en el schema** → se ignoran en silencio (ver abajo)
3. Un agente que precarga (`skills:`) una skill que ya no existe → **el agente no arranca**
4. Referencias colgadas en `SKILL-REGISTRY.md` a skills borradas
5. Skills de stack sin compact rules en el registry → el orquestador nunca las inyecta
6. Hooks de `settings.json` apuntando a archivos inexistentes
7. `model`, `effort` o `color` inválidos en el frontmatter de un agente
8. Errores de sintaxis en los hooks

### El chequeo de schema (punto 2) y por qué existe

`skills/arch-review` y `skills/tdd` declaraban `skills:` en su frontmatter, convencidas de que
precargaban `cc-solid` y compañía. **Ese campo no existe en `SKILL.md`** — es campo de sub-agente.
Claude Code lo ignoraba sin decir nada, y las dos corrían **sin una sola regla cargada**.

Un campo mal escrito no explota: no hace nada. Por eso el validador compara contra un **schema
cerrado** y no contra una lista de prohibidos. Ojo con el casing, que son dos schemas distintos:

| | Campo de herramientas denegadas | Otros ejemplos |
|---|---|---|
| `skills/*/SKILL.md` | `disallowed-tools` (kebab) | `allowed-tools`, `argument-hint`, `paths` |
| `agents/*.md` | `disallowedTools` (camel) | `tools`, `permissionMode`, `maxTurns`, `skills` |

Una skill **no puede precargar otras skills**. Si necesitás reglas cargadas, pedilas en el body
con el tool `Skill` o usá `context: fork` + `agent:`.

**Criterio**: un hook falla siempre **abierto** (nunca frena el trabajo por un error propio),
salvo los dos guards, cuyo trabajo ES bloquear.

### La statusline según el agente activo

El payload de `statusLine` trae `agent.name`, pero **solo** cuando la sesión corre con `--agent`
o con el setting `agent`. La barra usa ese dato para mostrar lo que corresponde a cada contexto:

| Sesión | Qué muestra |
|--------|-------------|
| `claude --agent=dev-orchestrator` | `proyecto · ‹sesión› · rama* · [modelo] · SDD:change→fase` |
| `claude` sin agente | `proyecto · ‹sesión› · rama* · [modelo]` — sin ruido de SDD |
| `claude --agent=otro` | `proyecto · ‹sesión› · rama* · [modelo] · @nombre-del-agente` |

### Segunda fila: cuánto te queda

La statusline imprime **dos filas** (cada línea impresa es una fila):

```
~/erp-facturacion  feat/12345-alta-vales*  [sonnet]  SDD:alta-vales→design
ctx ████████░░ 78% libre  ·  5h 24% ↻3h10m  ·  7d 41% ↻2d21h
```

Son **dos recursos distintos** que se confunden todo el tiempo:

| | Qué mide | ¿Se recupera? |
|---|---|---|
| `ctx` | Cuánto entra en **esta conversación** antes de compactar | ✅ Sí, al compactar |
| `5h` | Tu **cuota de suscripción** en la ventana de 5 horas | ❌ No, hasta el `↻reset` |

> La ventana de **7 días** (`rate_limits.seven_day`) viene en el payload y **se omite a propósito**:
> se agota lento y no se toma ninguna decisión con ella en el momento. La de 5h es la que te frena
> hoy, y dos números compitiendo hacen que no mires ninguno.

Los colores van por lo que **queda libre**: verde >30%, amarillo ≤30%, rojo ≤10%.

Ambos datos ya vienen en el payload del `statusLine` (`context_window` y `rate_limits`): no hay
que calcular nada ni consultar nada. Pero **los dos pueden faltar**, y la doc lo dice explícito:

- `rate_limits` existe **solo para suscriptores Claude.ai (Pro/Max)**, y recién después de la
  primera respuesta de la API. Cada ventana puede faltar por separado.
- `used_percentage` / `remaining_percentage` pueden venir en `null` al arrancar la sesión.

Si no hay ningún dato, **la fila entera no se dibuja**. Una barra a medias confunde más que ayuda.
El tamaño de ventana se muestra solo cuando **no** es el default de 200k (`94% libre 1M`), porque
ahí el porcentaje significa otra cosa.

#### Cada cuánto se actualiza (spoiler: no es tiempo real)

El script **no corre continuamente**. Según la doc, se dispara al arrancar la sesión y después
cuando: llega un mensaje nuevo del assistant, termina un `/compact`, cambia el permission mode,
se togglea vim mode, o vence un `refreshInterval`. Todo con debounce de 300ms.

Y los datos que muestra vienen **de la última respuesta de la API**. O sea:

- `ctx` se mueve **una vez por turno**. Durante un turno largo con muchas tool calls, el número
  que ves es el del turno anterior — vas consumiendo contexto sin que la barra se entere.
- `5h` igual: se actualiza cuando hay respuesta de la API, no mientras la mirás.

Por eso `settings.json` setea **`refreshInterval: 15`**. Sin eso, los disparadores por evento se
apagan cuando la sesión está quieta y pasan dos cosas feas: el contador `↻3h10m` queda **congelado
en una cuenta regresiva vieja**, y el segmento `⚙` de sub-agentes no se refresca justo cuando el
orquestador está esperando en background — los dos casos que la doc nombra explícitamente.

Como eso multiplica las corridas, la rama y el dirty flag ahora se **cachean 5 segundos** en
`session-state/`. `git status --porcelain` en un repo grande es lento y la doc avisa que una
statusline lenta se cuelga: 20 corridas seguidas tardan menos de un segundo.

### Sub-agentes en vuelo

Cuando hay sub-agentes corriendo, la barra cierra con `⚙ sdd-design[opus] sdd-spec[haiku] +1`
(los 2 más viejos, y `+N` para el resto). Con modelos mixtos por fase, saber **qué está corriendo
y con qué modelo** es la diferencia entre esperar tranquilo y preguntarse si se colgó.

> **El modelo NO viene en el payload de los hooks.** `SubagentStart` trae `agent_type`,
> `agent_id`, `prompt` y `description`, y nada más.

Se muestran **dos** modelos, y la diferencia es el punto:

| En la barra | Significa |
|---|---|
| `sdd-design[opus]` | El declarado en `agents/sdd-design.md`. Si además se pudo leer el real, coinciden |
| `sdd-design[opus≠sonnet]` | **Declaraste `opus` y Claude Code lo corrió con `sonnet`.** Ni el costo ni la calidad de esa fase son los que planificaste |

El **declarado** sale del frontmatter (indexado por el campo `name`, **no** por el nombre del
archivo, porque no tienen por qué coincidir). El **real** sale del transcript: cada turno del
assistant registra un `message.model` con el id completo que la plataforma usó de verdad. Lo lee
`detect-subagent-model.js`, enganchado como `PostToolUse` **dentro** de cada sub-agente — ahí el
payload trae `agent_id`, así que la correlación "este modelo es de ESTA corrida" es exacta y no
hay que adivinar cuando corren varios en paralelo.

> **Regla de oro del detector: ante la duda, no afirma nada.** Solo acepta un turno como propio
> del sub-agente si `isSidechain === true`, o si el `sessionId` del turno difiere del de la sesión
> padre (transcript propio). Cualquier otro turno se ignora: leer uno del hilo principal
> produciría un mismatch fantasma. Cuando no puede probarlo, deja `model_real` sin setear y la UI
> cae al declarado — `null` en el índice significa **"no se pudo determinar"**, que no es lo mismo
> que "coincide".

Los que discrepan se ordenan **primero** en la barra: con truncación a 2 elementos, una alarma
escondida detrás del `+N` no es una alarma.

Las fichas viven en `session-state/agent-runs/` (no versionado). Si un sub-agente muere de forma
sucia, `SubagentStop` nunca corre y la ficha queda huérfana: se descartan las de más de 2h al
leerlas y `session-bootstrap` las barre al arrancar. Mejor mostrar de menos que mentir.

### Por qué `/resume` mostraba un pedazo de conversación

El picker de `/resume` **no se puede customizar**: es UI interna, no hay setting ni hook que dibuje
esa lista. Lo que sí tiene es una cadena de fallback, textual de la doc:

> *"Each row shows the **session name if you set one**, otherwise the AI-generated session title,
> conversation summary, **or first prompt**"*

Cuando en la lista ves conversación en vez de un título, es porque cayó hasta el **último eslabón**.
No se arregla cambiando el picker — se arregla llenando el **primero**. Eso hace
`session-title.js`, emitiendo `hookSpecificOutput.sessionTitle`:

| Situación | Título |
|---|---|
| Hay una rama de feature | `12345-alta-vales` (sin el prefijo `feat/`) |
| Sesión suelta sobre `master` | **Ninguno, a propósito** |

**Deliberadamente NO incluye la fase SDD** (`change→fase`, la que sí muestra la statusline como
`SDD:...`). La continuidad entre sesiones de un mismo feature ya la da Engram (`mem_context`) + los
archivos `.atl/changes/` al arrancar con `dev-orchestrator` — el título de sesión no necesita
repetirla, y en una sesión sin el orquestador ese dato es ruido. La statusline es una vista **en
vivo** mientras trabajás bajo `dev-orchestrator`, no un mecanismo de continuidad entre sesiones:
por eso conserva la fase y el título no.

**No pisa dos cosas, y es deliberado:**

1. **Un nombre puesto por vos** (`--name`, `/rename`, `Ctrl+R` en el picker). Llega como
   `session_title` en el input; si viene, el hook no toca nada.
2. **El título autogenerado por IA, cuando va a ser mejor.** Claude Code resume tu primer prompt
   con un modelo rápido, y ese resumen suele ser más informativo que un nombre de rama. Pero el
   hook corre **antes** del primer prompt: no tiene con qué competir. Por eso solo nombra cuando
   tiene algo genuinamente mejor —una rama de feature—. Ponerle `master` a todo sería peor que el
   problema original.

El segmento `‹sesión›` sale de `session_name`, que **no siempre viene**: aparece solo si nombraste
la sesión con `--name` o `/rename`, o una vez que existe un título autogenerado. El nombre por
defecto (tipo `my-app-3f`) NO lo popula, así que el segmento simplemente se omite. Se trunca a
26 caracteres.

La fase se **trunca en el primer paréntesis, guion o punto y coma** y se corta a 24 caracteres:
`state.md` a veces trae prosa después del token (`verify (completado — falta ejecución BD)`) y eso
se comía toda la barra. El detalle completo se lee donde corresponde: en `state.md` o con
`/sdd-status`.

## Judgment Day — por qué es un agente y no una skill

```
/judgment-day  ó  dev-orchestrator  ó  sdd-verify
        │
        ▼
  judgment-day (coordina; SIN Edit ni Write)
        │
        ├──► jd-judge  ┐  en paralelo, ciegos, sin Edit/Write
        ├──► jd-judge  ┘  ninguno sabe del otro
        │
        └──► jd-fixer     solo los hallazgos CONFIRMADOS por ambos
```

**Una skill no crea una identidad**: se carga en el contexto de quien la invoca. Cuando Judgment
Day era skill y lo lanzaba `dev-orchestrator`, el "juez" **era** el orquestador con instrucciones
nuevas — mismo contexto, misma persona, mismo color en la UI. Un review adversarial hecho por el
mismo que orquesta el trabajo no es adversarial: es alguien revisándose a sí mismo.

La separación de roles es **estructural**, no una promesa en prosa:

| Agente | Rol | `Edit`/`Write` |
|---|---|---|
| `judgment-day` | Coordina. Nunca revisa ni arregla | ❌ No los tiene |
| `jd-judge` (×2) | Encuentra problemas. Nunca aprueba ni arregla | ❌ No los tiene |
| `jd-fixer` | Aplica solo los confirmados | ✅ Sí |

Acá **sí** alcanza con acotar `tools:`, porque la restricción es sobre la herramienta. Compará con
`sdd-verify`, donde es sobre el *destino* (necesita escribir su reporte) y hace falta un hook.

`skills/judgment-day/SKILL.md` quedó como **lanzador** de 20 líneas con `context: fork` +
`agent: judgment-day`: `/judgment-day` sigue funcionando, pero el protocolo vive en un solo lugar
y corre en contexto propio.

> **Costo del cambio: un nivel de anidamiento.** `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` pasó de
> `2` a `3`, porque la cadena más larga es `sdd-verify` (1) → `judgment-day` (2) → jueces (3).
> Como skill, JD se cargaba *dentro* de `sdd-verify` sin gastar nivel. Tener identidad propia se
> paga con profundidad.

### Triage: qué se arregla solo y qué te pregunta

Cada hallazgo confirmado por los dos jueces lleva una **clase**, y esa clase decide el camino:

| Clase | Qué es | Quién lo aplica |
|---|---|---|
| `MECANICO` | El fix es evidente y **local**: null check, error tragado, typo, naming, complejidad dentro del método | `jd-fixer`, en el acto. No te molesta |
| `DISENIO` | El fix **decide algo**: viola capas, cambia una firma o un DTO, toca el modelo de datos, contradice el spec | **Vos**, vía orquestador. JD no lo toca |

Clasifican **los dos jueces por separado**. Si discrepan en la clase, **gana `DISENIO`**.

> **Por qué un gap de arquitectura NUNCA va al fixer.** El mandato de `jd-fixer` es *"no
> refactorices más allá de lo estrictamente necesario"*. Aplicado a un problema de diseño produce
> un parche mínimo que lo **tapa**: el re-juicio da limpio, el gate aprueba, y la deuda llega a
> producción con sello de calidad. Un cambio de diseño lo hace `sdd-design`, que es el dueño de
> `design.md`.

Por eso hay **tres** estados terminales, y `NEEDS_DECISION` gana sobre `APPROVED`:

| Estado | Cuándo | Qué hace el orquestador |
|---|---|---|
| `APPROVED ✅` | Jueces limpios **y** cero `DISENIO` | Sigue el flujo |
| `NEEDS_DECISION ⚖️` | Quedan gaps de diseño | Te muestra cada uno con sus opciones y tradeoffs, y **espera tu respuesta** |
| `ESCALATED ⚠️` | 2 iteraciones sin converger | Revisión humana |

**El gate humano se mudó hacia arriba.** Un sub-agente no puede preguntar **ni esperar**: cuando JD
devuelve el control su contexto se termina, no queda nada suspendido. Tu decisión no lo "despierta"
— el orquestador te pregunta, rutea lo que decidiste, y **relanza JD** con un bloque
`## Decisiones del Usuario`. Mismo resultado para vos, pero es una corrida nueva, no una espera.

Y si JD corre **antes** de implementar (auto-trigger sobre `design.md` / `tasks.md`, sin código
todavía), `jd-fixer` **ni se lanza**: cuando lo que estás juzgando ES el diseño, todo hallazgo es
`DISENIO` por definición.

## Flujo SDD

```
init → explore → [propose] → spec ∥ design → tasks → apply → verify → archive
```

Artifacts en `.atl/changes/{change-name}/` dentro de cada proyecto. `state.md` es la fuente de
verdad del ESTADO; Engram guarda el APRENDIZAJE. No son intercambiables.

Modelos por fase: `opus` en design (el blueprint), `sonnet` en propose/apply/verify (deciden o
producen código), `haiku` en init/explore/spec/tasks/archive (transformaciones estructuradas).

## Comandos

| Comando | Qué hace |
|---------|----------|
| `/sdd-status` | Estado del flujo SDD: changes abiertos, fase, progreso, preguntas pendientes |
| `/arch-review` | Auditoría de Clean Architecture del diff actual |
| `/workshop-material` | Material de taller a partir de las skills |
| `/tdd` | Ciclo estricto red-green-refactor |
| `/form-audit` | Audita un formulario contra la API real: contrato, respuestas rotas provocadas con mocks, loops y `[object Object]` |

## Cosas que NO son negociables

- El agente **no** ejecuta `git commit/push/merge/rebase` en repos de proyecto (hook + permisos).
- **Nunca** `Co-Authored-By` ni atribución de AI (`includeCoAuthoredBy: false`).
- **Nunca** buildear para "verificar". `dotnet test` en la fase verify sí.
- Los sub-agentes **no pueden preguntarle nada al usuario**: registran supuestos en
  `## Assumptions & Open Questions` y el orquestador escala.
- `sdd-verify` **no escribe fuera de `.atl/`** (hook `atl-only-guard.js`). Verificar es reportar,
  no corregir: quien arregla lo que encontró es juez y parte, y borra la evidencia.
- La config **no se commitea rota** (hook `precommit-validate.js`).

## Créditos

La metodología SDD (los sub-agentes por fase) y **Engram** (la memoria persistente vía MCP) están
basadas en el trabajo de [Gentleman Programming](https://github.com/Gentleman-Programming):

- [Gentleman-Programming/engram](https://github.com/Gentleman-Programming/engram) — memoria
  persistente cross-sesión y cross-herramienta vía MCP.

Lo que hay en este repo es esa base adaptada a un stack .NET + Angular: las skills de arquitectura,
los hooks de enforcement y la resolución de reglas por stack son propias, pero el esqueleto
conceptual del flujo por fases y la capa de memoria no salieron de la nada.
