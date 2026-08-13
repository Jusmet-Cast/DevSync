---
name: sdd-spec-protocol
description: >
  Protocolo de la fase SDD spec: requisitos RFC 2119 correctamente aplicados y escenarios
  Given/When/Then verificables. Define qué hace verificable a un requisito y qué lo vuelve inútil.
  Agnóstico de stack.
  Trigger: fase sdd-spec, escribir especificaciones formales, criterios de aceptación de un change.
user-invocable: false
license: Apache-2.0
---

# Protocolo de Especificación (SDD spec)

Tus specs son los **criterios de aceptación** que `sdd-verify` va a usar para aprobar o rechazar.
Un escenario que no se puede verificar objetivamente no es un criterio: es una expresión de deseo.

Regla mental: **si verify no puede decir CUMPLE / NO CUMPLE mirando el código, el escenario está
mal escrito.**

## 1. RFC 2119 — cada palabra tiene peso legal

| Palabra | Significado | Consecuencia si no se cumple |
|---------|-------------|------------------------------|
| **MUST / DEBE** | Requisito absoluto | verify marca 🔴 CRITICAL |
| **MUST NOT / NO DEBE** | Prohibición absoluta | verify marca 🔴 CRITICAL |
| **SHOULD / DEBERÍA** | Recomendado; se puede omitir con justificación | verify marca 🟡 WARNING |
| **MAY / PUEDE** | Opcional de verdad | verify no marca nada |

**No uses MUST para todo.** Si todo es crítico, nada lo es, y verify termina con 15 CRITICAL de
los cuales 12 son opinables. Reservá MUST para lo que rompe el negocio o los datos.

```markdown
- **REQ-1** El sistema DEBE rechazar un vale cuyo monto sea menor o igual a cero.
- **REQ-2** El sistema DEBE registrar en log el rechazo con el identificador de sucursal.
- **REQ-3** El endpoint DEBERÍA responder en menos de 400ms con hasta 500 vales del día.
- **REQ-4** La respuesta PUEDE incluir el detalle de vales evaluados.
```

## 2. Given/When/Then verificable

**Un escenario = un comportamiento observable.** Given es el estado previo, When es UNA acción,
Then es el resultado comprobable.

```markdown
### ESC-1: Vale con monto inválido
- **GIVEN** una sucursal activa con límite diario configurado en 5000
- **WHEN** se solicita crear un vale con monto = 0
- **THEN** la respuesta es `Ok = false` con el mensaje `Mensajes.ValeMontoInvalido`
- **AND** no se inserta ningún registro en la tabla de vales
```

**Qué lo vuelve verificable:** valores concretos (0, 5000), resultado nombrado
(`Mensajes.ValeMontoInvalido`), y un efecto colateral comprobable (no se inserta).

### Anti-patrones — no los escribas

| ❌ Mal | Por qué es inútil | ✅ Bien |
|--------|-------------------|---------|
| "THEN el sistema maneja el error correctamente" | ¿Qué es "correctamente"? No se puede verificar | "THEN retorna `Ok = false` con `Mensajes.X` y no persiste" |
| "THEN la performance es aceptable" | Sin número, no es criterio | "THEN responde en < 400ms con 500 registros" |
| "WHEN el usuario usa el módulo" | No es UNA acción | "WHEN se invoca POST /api/vales con body válido" |
| "GIVEN el sistema configurado" | Estado indefinido | "GIVEN sucursal 12 activa con límite 5000" |

## 3. Cobertura mínima obligatoria

Por cada requisito, al menos:

1. **Happy path** — el caso que motivó el change
2. **Al menos un caso de error** — validación fallida, recurso inexistente, permiso denegado
3. **Al menos un borde** — cero, vacío, null, límite exacto, máximo

Si un requisito solo tiene happy path, **está incompleto**. El bug siempre vive en el borde.

## 4. Trazabilidad

Cada escenario lleva ID (`ESC-n`) y apunta a su requisito (`REQ-n`). `sdd-tasks` mapea tasks a
escenarios y `sdd-verify` arma la matriz con esos mismos IDs. Sin IDs estables, la matriz de
compliance no se puede construir y toda la cadena se rompe.

## 5. Qué NO hace una spec

- **NO decide implementación.** "DEBE usar un Domain Service" es diseño, no requisito. El requisito
  es *qué* tiene que pasar; el *cómo* lo decide `sdd-design`.
- **NO redefine el scope** de la propuesta. Si detectás algo faltante, va a
  `## Assumptions & Open Questions`.
- **NO inventa requisitos** para que la spec se vea completa. Una spec de 3 requisitos reales vale
  más que una de 15 inflada.

## 6. Checklist antes de cerrar el artifact

- [ ] Cada requisito usa DEBE / DEBERÍA / PUEDE con intención, no por costumbre
- [ ] Cada escenario tiene valores concretos, no adjetivos
- [ ] Cada requisito tiene happy path + error + borde
- [ ] Todos los escenarios tienen ID estable y apuntan a un requisito
- [ ] Ningún escenario describe CÓMO implementar
