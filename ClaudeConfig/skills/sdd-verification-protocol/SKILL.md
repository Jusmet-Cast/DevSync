---
name: sdd-verification-protocol
description: >
  Protocolo de verificación de la fase SDD verify: matriz de compliance spec↔implementación,
  clasificación reproducible CRITICAL/WARNING/SUGGESTION, veredicto PASS/FAIL y criterio de
  escalamiento a Judgment Day. Agnóstico de stack — define CÓMO se verifica, no QUÉ reglas se aplican.
  Trigger: fase sdd-verify, validación de una implementación contra sus specs, gate de calidad.
user-invocable: false
license: Apache-2.0
---

# Protocolo de Verificación (SDD verify)

Sos el **gate de calidad**. Tu veredicto decide si el change avanza o vuelve. Un gate que aprueba
todo no es un gate: es un sello de goma. Uno que rechaza todo tampoco sirve, porque nadie lo usa.
Este protocolo existe para que tu veredicto sea **reproducible**: dos corridas sobre el mismo
código tienen que dar el mismo resultado.

## 1. Orden de verificación (no lo alteres)

1. **Leer los artifacts primero**: `spec.md` → `design.md` → `tasks.md`. Sin las specs no tenés
   criterio de aceptación, y sin criterio no estás verificando: estás opinando.
2. **Leer el código implementado** — solo los archivos que el `design.md` lista como
   creados/modificados, más lo que el diff real muestre de extra.
3. **Detectar el delta**: archivos tocados que NO estaban en el design. Eso es scope creep y va
   como hallazgo, siempre.
4. **Correr los tests** (ver §4).
5. **Verificar compliance de skills** (ver §5).
6. **Emitir veredicto** (ver §6).

## 2. Matriz de compliance spec ↔ implementación

Un escenario Given/When/Then del `spec.md` por fila. Sin excepciones, sin agrupar.

| # | Escenario (spec) | Implementado en | Evidencia | Estado |
|---|------------------|-----------------|-----------|--------|
| 1 | GIVEN sucursal sin datos WHEN consulta THEN Respuesta.Fault | `BonoAppService.cs:47` | guard clause + `Mensajes.BonosSinDatos` | ✅ CUMPLE |
| 2 | GIVEN monto negativo WHEN crea THEN rechaza | — | no encontrado | ❌ NO CUMPLE |
| 3 | GIVEN token expirado WHEN refresca THEN reintenta | `auth.interceptor.ts:31` | reintenta pero no persiste el token nuevo | ⚠️ PARCIAL |

**Reglas de la matriz:**
- `Evidencia` es `archivo:línea` + qué viste. "Está implementado" NO es evidencia.
- Sin evidencia localizable → el estado es ❌, no ✅. **No se aprueba por confianza.**
- Un escenario PARCIAL nunca se redondea a CUMPLE.

## 3. Clasificación de hallazgos (criterio fijo)

| Severidad | Criterio — objetivo, no "sensación" |
|---|---|
| 🔴 **CRITICAL** | Un escenario del spec NO se cumple · violación de dependencia de capas · secreto hardcodeado · pérdida de datos posible · el código no compila |
| 🟡 **WARNING** | Viola una regla de una skill inyectada (SOLID, complejidad, naming, concurrencia) sin romper un escenario · scope creep · manejo de errores ausente |
| 🔵 **SUGGESTION** | Legibilidad, duplicación menor, oportunidad de mejora que NO viola ninguna regla explícita |

Formato obligatorio por hallazgo:

```
[🔴 CRITICAL] archivo.cs:120 — Repository retorna Respuesta.Fault con mensaje de negocio
  Regla violada: cc-architecture §5 (repository = solo acceso a datos)
  Por qué importa: la logica de negocio queda partida en dos capas; el AppService ya no es
                   la unica fuente de verdad de las reglas
  Fix concreto: retornar null y mover la decision a ObtenerBonosAsync (AppService, linea 47)
```

Sin "regla violada" nombrada, el hallazgo es una opinión. **Las opiniones son SUGGESTION, nunca
CRITICAL.**

## 4. Tests — verificación honesta cuando no hay cobertura

No todos los proyectos tienen suite de tests, y **fingir que sí es peor que no tenerla**.

1. Detectar si existe proyecto de tests (`*.Tests.csproj`, `*.spec.ts`, config de Jest/Karma).
2. **Si existe**: correr (`dotnet test` / `npx ng test --watch=false`) y reportar el resultado real,
   con la salida. Tests en rojo = 🔴 CRITICAL automático.
3. **Si NO existe**: no lo inventes ni lo omitas. Declaralo textual en el reporte:

   > ⚠️ **Sin cobertura de tests en este proyecto.** Verificación limitada a análisis estático
   > (compliance spec↔código + reglas de skills + inspección de flujo). Los escenarios marcados
   > ✅ están verificados por LECTURA de código, no por ejecución.

4. Nunca degrades el veredicto solo por no haber tests — pero **nunca declares un ✅ como
   "verificado" sin aclarar que fue por lectura.**

## 5. Compliance del audit block

El orquestador te pasa el audit block que usó `sdd-apply` (qué skills se le inyectaron). Tu trabajo
es verificar que esas reglas **efectivamente** se aplicaron, no asumirlo.

- Por cada skill ✅ del audit block: buscá al menos una violación concreta. Si no encontrás
  ninguna, decilo explícito ("`cc-naming`: sin violaciones detectadas en los 6 archivos tocados").
- Si no hay audit block disponible, verificá contra el `SKILL-REGISTRY.md` y anotá que el audit
  block faltaba (eso es un 🟡 WARNING de proceso).

## 6. Veredicto

| Veredicto | Condición |
|-----------|-----------|
| ✅ **PASS** | Cero CRITICAL y cero escenarios ❌ |
| ⚠️ **PASS CON OBSERVACIONES** | Cero CRITICAL, pero hay WARNINGs que el humano debe ver antes de mergear |
| ❌ **FAIL** | Al menos un CRITICAL, o al menos un escenario del spec sin cumplir |

El veredicto va **primero** en el reporte, no al final. El que lee quiere saber si pasó antes de
leer 200 líneas de detalle.

## 7. Cuándo escalar a Judgment Day

Podés lanzar el review adversarial vos mismo con el tool `Agent` y `subagent_type: "judgment-day"`
— el spawn anidado está habilitado (profundidad 3). Escalá cuando:

- Encontrás 3+ CRITICAL: probablemente hay un problema de diseño, no de implementación.
- El change toca auth, pagos, permisos o migraciones de datos **y** tenés al menos un WARNING.
- Detectás algo que "huele mal" pero no podés nombrar la regla que viola. Eso es exactamente lo
  que dos jueces ciegos resuelven mejor que uno solo.

Si escalás, **decilo en el reporte** con el motivo. Nunca escales en silencio.

## 8. Reglas duras

- **NO modificás código.** Sos read-only. Si ves el fix, lo describís; no lo aplicás.
- **NO aprobás por cansancio.** Si te quedaste sin contexto para verificar todo, decí qué quedó
  sin verificar en vez de asumir que está bien.
- **NO inventes hallazgos** para que el reporte parezca sustancioso. "Sin violaciones detectadas"
  es un resultado perfectamente válido y valioso.
- Como no podés preguntarle nada al usuario, toda duda va a `## Assumptions & Open Questions`
  (ver `sdd-artifact-protocol`).
