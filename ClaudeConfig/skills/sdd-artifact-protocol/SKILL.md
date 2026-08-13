---
name: sdd-artifact-protocol
description: >
  Protocolo transversal de artifacts SDD: formato de state.md, bloque Assumptions & Open Questions
  (porque los sub-agentes NO pueden preguntarle al usuario), persistencia de outputs y recovery
  tras compactación. Lo carga TODO sub-agente sdd-*. Agnóstico de stack.
  Trigger: cualquier fase SDD que escriba un artifact en .atl/changes/.
user-invocable: false
license: Apache-2.0
---

# Protocolo de Artifacts SDD (transversal)

Todo sub-agente `sdd-*` cumple esto, sin importar la fase. Es el contrato que hace que el flujo se
pueda **recuperar**: después de una compactación, de un sub-agente que falla, o de una sesión que
se cortó a la mitad.

## 1. NO podés preguntarle nada al usuario — restricción de plataforma

Esto no es estilo, es una limitación real: **Claude Code le remueve `AskUserQuestion` a TODOS los
sub-agentes**, aunque esté listado en `tools`. Si escribís una pregunta y te quedás esperando,
nadie la va a leer y el flujo se cuelga.

Ante una ambigüedad que cambie materialmente tu output:

1. Elegí la interpretación **más conservadora** (la que menos supone y menos rompe).
2. Seguí trabajando. Terminá tu fase completa.
3. Registrala en el artifact bajo `## Assumptions & Open Questions`.

```markdown
## Assumptions & Open Questions

- [ASSUMED] El límite diario se evalúa por sucursal, no por usuario.
  - Alternativa: por usuario dentro de la sucursal.
  - Impacto si es incorrecta: la validación deja pasar vales que deberían rechazarse; hay que
    cambiar la firma de ValidarLimiteDiario y la query del repositorio.
  - Necesita confirmación del usuario: SÍ

- [ASSUMED] Los vales anulados no cuentan para el límite.
  - Alternativa: contarlos igual.
  - Impacto si es incorrecta: filtro extra en la query. Cambio acotado.
  - Necesita confirmación del usuario: NO (bajo impacto, reversible)
```

El orquestador —que SÍ habla con el usuario— lee este bloque y escala solo las que dicen
`Necesita confirmación: SÍ`. **Sin este bloque, tus supuestos se vuelven decisiones invisibles.**

## 2. `state.md` — la única fuente de verdad del ESTADO

Se actualiza al terminar CADA fase. No al final del flujo.

```markdown
# SDD State: {change-name}

## Current Phase
{explore | propose | spec | design | tasks | apply | verify | archive | closed}

## Completed Phases
| Phase | Completed At | Artifact |
|-------|--------------|----------|
| explore | 2026-07-26 14:02 | explore.md |
| design  | 2026-07-26 15:10 | design.md |

## Skipped Phases
| Phase | Equivalente que la reemplaza | Motivo |
|-------|------------------------------|--------|
| spec | docs/PLAN.md del proyecto | ya define criterios de aceptación |

## Last Apply Audit Block
{el audit block textual de skills inyectadas a sdd-apply — sdd-verify lo necesita}

## Open Questions Pendientes
{las [ASSUMED] con "Necesita confirmación: SÍ" que el usuario todavía no respondió}
```

`.atl/` guarda el **ESTADO** (dónde está el change, determinístico, versionado). Engram guarda el
**APRENDIZAJE** (qué aprendimos, cross-proyecto). No son intercambiables: memoria no reemplaza una
máquina de estados.

## 3. Persistencia de output

Antes de tu respuesta final, guardá tu output completo con `Write`:

- Path: `~/.claude/session-state/agent-outputs/{agent-type}__{yyyyMMdd-HHmmss}.md`
- Contenido: header con agent type, timestamp, resumen de la tarea y status + sección `## Output`
  con el contenido completo, sin truncar.
- Si el `Write` falla, incluí todo en tu respuesta igual. **El archivo es backup, la respuesta es
  el canal principal.**

> El hook `SubagentStop` (`hooks/subagent-index.js`) además deja siempre una traza en
> `_index.jsonl` con tu tipo de agente, timestamp y transcript, corras bien o mal. Ese índice es la
> red de seguridad cuando el archivo `.md` no llegó a escribirse.

## 4. Recovery tras compactación

Si el orquestador no puede leer tu output (falla o compactación):

1. Buscar en `~/.claude/session-state/agent-outputs/` por `{agent-type}__*.md`
2. Si no está, revisar `_index.jsonl` para ubicar el transcript de esa corrida
3. Si tampoco, **re-ejecutar la tarea inline** (`Grep` + `Read` directo) — NUNCA re-delegar a otro
   sub-agente solo para "buscar el output perdido"

## 5. Reglas duras de artifacts

- Un artifact por fase, con el nombre canónico (`explore.md`, `proposal.md`, `spec.md`,
  `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, `archive-report.md`).
- **Nunca sobrescribas el artifact de otra fase.** Si necesitás corregir algo de una fase previa,
  lo anotás en el tuyo y lo marcás en `state.md`.
- Los artifacts son para HUMANOS también: resumen ejecutivo arriba, detalle abajo.
- Fechas en formato `yyyy-MM-dd HH:mm`, siempre. Ordenar por fecha es la mitad del recovery.
