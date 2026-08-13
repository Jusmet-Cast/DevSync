# Engram Persistent Memory — Protocol (MANDATORY, ALWAYS ACTIVE)

Tenés acceso a **Engram**, un sistema de memoria persistente vía MCP que sobrevive entre sesiones,
compactaciones y proyectos (comparte DB con GitHub Copilot CLI, así que la memoria es cross-tool).
Este protocolo es **OBLIGATORIO** y siempre está activo — no se activa bajo demanda.

Se carga vía `@import` desde `CLAUDE.md` (no como skill) justamente porque una skill solo entra
cuando su trigger matchea, y esto tiene que correr SIEMPRE.

Claude Code también trae memoria nativa basada en archivos, independiente de esto. Conviven sin
conflicto: Engram es la capa persistente y cross-tool.

## Setup

- **Proyecto**: [Gentleman-Programming/engram](https://github.com/Gentleman-Programming/engram)
- **Versión instalada**: `v1.12.0`
  ([release](https://github.com/Gentleman-Programming/engram/releases/tag/v1.12.0))
- Binario `engram` disponible en el `PATH`. Verificar con `engram --version`.
- Registrado como MCP server de usuario (`claude mcp add --scope user`), persistido en
  **`.claude.json`, dentro de esta misma carpeta de configuración** (`CLAUDE_CONFIG_DIR`).
  Ese archivo **NO se versiona** (tiene tokens): la definición reproducible del server vive en
  `mcp/engram.json` de este repo.
- La DB de Engram es de la herramienta Engram, no de Claude Code: su ubicación la resuelve el
  propio binario (variable `ENGRAM_DB` si querés fijarla). **No la busques dentro de `.claude/`.**
- Proyecto auto-detectado por `git remote` o nombre del `cwd`.

> ⚠️ **Toda la configuración de Claude Code vive dentro de esta carpeta.** No salgas a buscar
> archivos de config al home del usuario ni a rutas absolutas de la máquina. Ver README §
> "Todo vive dentro de la carpeta de configuración".

> **Si Engram no está disponible**, el hook `SessionStart` (`hooks/session-bootstrap.js`) lo
> detecta y te lo inyecta al contexto con un aviso explícito. En ese caso: **decíselo al usuario
> en tu primer mensaje y NUNCA simules haber cargado contexto de memoria.** Falla ruidoso, no
> silencioso.

## AL INICIO DE CADA SESIÓN (obligatorio)

1. Llamar `mem_context` (sin args) para recuperar contexto reciente del proyecto actual
2. Si el primer mensaje menciona un feature, bug o tema concreto, llamar `mem_search` con esas
   keywords ANTES de responder
3. Informar brevemente (1-2 oraciones) qué contexto cargó, si encontró algo relevante

## TRIGGERS DE GUARDADO PROACTIVO (sin que el usuario pida)

Llamar `mem_save` **INMEDIATAMENTE** y **SIN PREGUNTAR** cuando ocurra cualquiera de estos:

- Decisión de arquitectura o diseño tomada
- Convención de equipo documentada o establecida
- Cambio de workflow acordado
- Elección de tool/librería con tradeoffs
- Bug fix completado (incluir root cause)
- Feature implementado con approach no obvio
- Artifact de Notion/Jira/GitHub creado con contenido significativo
- Cambio de configuración o setup de entorno
- Descubrimiento no obvio sobre el codebase
- Gotcha, edge case o comportamiento inesperado
- Patrón establecido (naming, estructura, convención)
- Preferencia o restricción del usuario aprendida

**Auto-check después de CADA tarea**: "¿Tomé una decisión, arreglé un bug, aprendí algo no obvio
o establecí convención? Si sí → `mem_save` YA."

### Formato para `mem_save`

- **title**: Verbo + qué — corto, buscable (ej. "Fixed N+1 query in UserList")
- **type**: `bugfix | decision | architecture | discovery | pattern | config | preference`
- **scope**: `project` (default) | `personal`
- **topic_key** (recomendado para tópicos que evolucionan): clave estable como `architecture/auth-model`
- **content**:
  - **What**: Una oración — qué se hizo
  - **Why**: Qué lo motivó (pedido, bug, performance, etc.)
  - **Where**: Archivos o paths afectados
  - **Learned**: Gotchas, edge cases (omitir si no aplica)

### Reglas de tópicos

- Tópicos distintos NO deben sobreescribirse
- Mismo tópico evolucionando → mismo `topic_key` (upsert)
- Incerteza sobre la key → llamar `mem_suggest_topic_key` primero
- ID exacto conocido → usar `mem_update`

## WHEN TO SEARCH MEMORY

Ante cualquier variación de "recordás", "acordate", "qué hicimos", "cómo resolvimos", "remember",
"recall", o referencias a trabajo pasado:

1. `mem_context` — historial reciente de sesiones (rápido, barato)
2. Si no aparece → `mem_search` con keywords relevantes
3. Si aparece → `mem_get_observation` para el contenido completo sin truncar

También buscar **PROACTIVAMENTE** cuando:

- Empezás trabajo en algo que podría haberse hecho antes
- El usuario menciona un tópico del cual no tenés contexto
- El PRIMER mensaje referencia el proyecto, feature o problema

## SESSION CLOSE PROTOCOL (mandatory)

Antes de terminar sesión o decir "listo" / "done" / "eso es todo", llamar `mem_session_summary`:

```
## Goal
[En qué trabajamos esta sesión]

## Instructions
[Preferencias/restricciones del usuario descubiertas — omitir si ninguna]

## Discoveries
- [Hallazgos técnicos, gotchas, aprendizajes no obvios]

## Accomplished
- [Items completados con detalles clave]

## Next Steps
- [Qué queda para la próxima sesión]

## Relevant Files
- path/al/archivo — [qué hace o qué cambió]
```

**Esto NO es opcional.** Si lo salteás, la próxima sesión arranca a ciegas.

## PASSIVE CAPTURE — extracción automática de aprendizajes

Al completar una tarea o subtarea, incluir al final de tu respuesta una sección
`## Key Learnings:` con items numerados. Engram la extrae y guarda automáticamente.

```
## Key Learnings:

1. bcrypt cost=12 es el balance correcto para nuestro server
2. JWT refresh tokens necesitan rotación atómica para evitar races
```

También podés llamar `mem_capture_passive(content)` directo con cualquier texto que contenga
una sección de learnings.

## AFTER COMPACTION

Si ves un mensaje de compactación o "FIRST ACTION REQUIRED":

1. **INMEDIATAMENTE** llamar `mem_session_summary` con el contenido del resumen compactado —
   esto persiste lo que se hizo antes de compactar
2. Llamar `mem_context` para recuperar contexto adicional de sesiones previas
3. Recién **ahí** continuar trabajando

No salteés el paso 1. Sin él, todo lo hecho antes de la compactación se pierde.
