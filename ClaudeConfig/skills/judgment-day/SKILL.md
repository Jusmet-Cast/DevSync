---
name: judgment-day
description: >
  Lanza el review adversarial en paralelo: dos jueces ciegos e independientes sobre el mismo
  target, síntesis de veredictos, fix de los confirmados y re-juicio hasta aprobar o escalar.
  Trigger: cuando el usuario dice "judgment day", "judgment-day", "review adversarial",
  "dual review", "doble review", "juzgar", "que lo juzguen".
argument-hint: "[target: archivos, feature o componente a juzgar]"
context: fork
agent: judgment-day
background: false
license: Apache-2.0
metadata:
  author: madian-velasquez
  version: "2.0"
  last_change: "El protocolo se mudó al agente judgment-day. Esta skill quedó como lanzador: una skill se carga en el contexto de quien la invoca, así que Judgment Day corriendo bajo dev-orchestrator ERA dev-orchestrator — mismo contexto, misma persona, mismo color. Un juicio hecho por el propio orquestador no es adversarial."
---

# Judgment Day — lanzador

Juzgá: **$ARGUMENTS**

Si `$ARGUMENTS` viene vacío, el target es el diff actual del working tree (`git diff`; si no hay
cambios sin commitear, `git diff HEAD~1`, declarándolo).

Ejecutá el protocolo completo de tu definición de agente: resolución de skills (Paso 0), dos
jueces `jd-judge` en paralelo, síntesis, `jd-fixer` sobre los confirmados, re-juicio, y estado
terminal `APPROVED` o `ESCALATED`.

> **Por qué esto es un lanzador y no el protocolo.**
> `context: fork` + `agent: judgment-day` hace que esta skill corra en el **contexto propio** del
> agente `judgment-day`, no en el tuyo. Esa es toda la diferencia: el protocolo, los 313 renglones
> de reglas y las dos rondas de jueces no te ensucian la conversación — volvés solo con el
> veredicto.
>
> El protocolo vive en `agents/judgment-day.md`, en un solo lugar. Acá no se duplica nada.
