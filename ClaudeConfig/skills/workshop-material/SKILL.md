---
name: workshop-material
description: Genera material para talleres internos de calidad de código a partir de las skills del ecosistema — ejemplos progresivos, ejercicios con solución y guía del facilitador.
argument-hint: "[tema: SOLID | Clean Architecture | complejidad | naming | seguridad | refactoring]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Write
---

# Material de Taller — **$ARGUMENTS**

Armá material para un taller interno de calidad de código sobre ese tema.

**Fuente de verdad**: las skills de `~/.claude/skills/` que cubren el tema. Leelas primero y usá
SUS reglas, con SU vocabulario. El taller tiene que ser coherente con lo que el equipo después va a
encontrarse aplicado en el código; si enseñás algo distinto a lo que dicen las skills, generás
ruido en vez de alineación.

## Estructura obligatoria

1. **El problema primero.** Código real, feo, que duele. **Sin nombrar todavía el principio.**
   Que primero lo sufran.
2. **La pregunta socrática.** "¿Qué pasa cuando el negocio pide X?" — el dolor tiene que sentirse
   ANTES de la teoría. Si nombrás el principio antes de que duela, memorizan la definición y no
   entienden nada.
3. **El concepto.** Recién ahora. Con una analogía de construcción/arquitectura.
4. **El refactor paso a paso.** 3-4 pasos, cada uno con su POR QUÉ. Nunca el "antes y después"
   mágico: el salto es donde se pierde el aprendizaje.
5. **Ejercicio.** Código para refactorizar + criterios de aceptación explícitos + solución en
   sección aparte (para que el facilitador no la muestre antes de tiempo).
6. **Guía del facilitador.** Timing por bloque, los 3 malentendidos más comunes con su respuesta,
   y la pregunta trampa que suele aparecer.

## Reglas

- **CONCEPTOS > CÓDIGO.** Si al terminar pueden copiar el patrón pero no explicar POR QUÉ, el
  taller falló. Todo bloque de código tiene que venir con su justificación.
- Ejemplos en el stack real del equipo (C#/.NET, Angular), no pseudocódigo de libro.
- Cada regla que enseñes tiene que ser rastreable a una skill del ecosistema. Citá cuál.
- Nada de "buenas prácticas" sin motivo técnico. "Porque lo dice Clean Code" no es una razón: la
  razón es qué se rompe cuando no lo hacés.
- Duración objetivo: 45-60 min salvo que se pida otra cosa.

## Salida

Un `.md` autocontenido que el facilitador pueda seguir sin material extra. Preguntá dónde
guardarlo solo si no es obvio por el contexto; si no, proponé un path y escribilo.
