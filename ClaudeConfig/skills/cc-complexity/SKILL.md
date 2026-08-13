---
name: cc-complexity
description: Reglas para evaluar y reducir la complejidad ciclomática y cognitiva del código.
paths: "**/*.cs"
---

# Complejidad Ciclomática y Cognitiva

> ⚠️ **NOTA PARA EL AGENTE:** Los bloques de código en esta skill son **SOLO ILUSTRATIVOS**. Sirven para explicar el concepto. **NUNCA copies los nombres de clases, métodos o variables de estos ejemplos al proyecto real.** Siempre adaptá el patrón al código concreto que estás analizando o generando.

## 1. Complejidad Ciclomática
- **Cálculo:** `if`, `else if`, `for`, `while`, `do-while`, `case`, `catch`, `&&`, `||`, `? :` suman +1.
- **Límites:**
  - 1-4: Excelente.
  - 5-7: Aceptable.
  - 8-10: Alta (Refactorizar).
  - 11-15: Muy alta (Refactorizar urgente).
  - 15+: Extrema (Rediseñar).
- **Estrategia de solución:** Usar "Extract Method" para separar validaciones complejas o usar polimorfismo/switch statements.

## 2. Complejidad Cognitiva
- **Cálculo:** Se penaliza (+1) adicional por cada nivel de anidamiento dentro de bucles o condicionales.
- **Límite:** Mantener estrictamente por debajo de 15.
- **Estrategia de solución:** Extraer lógicas anidadas a métodos privados descriptivos, o usar Streams/LINQ (ej. `Where().Select()`) para hacerlo más declarativo.

## 3. Límites de Tamaño — dos umbrales, NO se contradicen

Hay DOS umbrales distintos porque responden a dos preguntas distintas. Leé cuál aplica antes de actuar:

| Umbral | Qué es | Cuándo aplica |
|--------|--------|---------------|
| **600 líneas** por método / **1000** por clase | **ERROR bloqueante** | Refactor automático del agente. Por debajo de esto, el agente NO refactoriza por tamaño ni marca violación |
| **30-40 líneas** por método (ver `csharp-refactoring`) | **SEÑAL de review**, nunca error | Code review con criterio humano, o cuando el usuario pide explícitamente revisar mantenibilidad |

*Nota estricta para el agente:* aunque la literatura mencione 20-50 líneas por método o la Regla
de los 30, **esos números NO son criterio de bloqueo automático**. Un método de 80 líneas lineales
y legibles no es un bug: refactorizarlo sin que nadie lo pida es ruido en el diff y riesgo gratis.

- Por debajo de 600/1000: priorizar eliminar duplicación y expresar intención, no cortar por largo.
- La complejidad **ciclomática (§1) y cognitiva (§2) SÍ son criterio de bloqueo** en sus umbrales.
  El tamaño en líneas es la métrica más pobre de las tres — por eso tiene el umbral más laxo.

## 3.b Código legacy con saltos no estructurados (VB.NET, `GoTo`, `Continue For`)

`GoTo`, `Continue For` y `Exit For` **no cruzan procedimientos**. Por eso, en código legacy, la
regla "extraé el método" tiene un límite físico: si extraés un bucle `For` que adentro tiene
`Continue For` o `GoTo escape`, rompés la semántica — no hay forma de expresar ese salto desde un
helper.

**Estrategia correcta:**

- El bucle `For` **queda in situ** dentro del método original. No lo extraigas.
- Extraé el **CUERPO de la iteración** a un helper que devuelva un flag (`Boolean` o enum) señalando
  continuar / abortar.
- El call site evalúa ese retorno y ejecuta ahí el `Continue For` / `Exit For` / rollback.

Así bajás la complejidad cognitiva real (el cuerpo pesado sale del bucle) sin tocar el flujo de
control. Aplicar la regla genérica sin esta excepción produce código que no compila o que cambia
de comportamiento en silencio, que es peor que el método largo original.

> Origen: reportado por `sdd-apply` al refactorizar un formulario VB.NET legacy con `GoTo` y
> `Continue For`. La regla general asumía código estructurado sin saltos.

## 4. Merge de If Statements (SonarQube S1066)
- NUNCA escribir un `if` dentro de otro `if` cuando ambas condiciones pueden unirse con `&&`.
- SonarQube reporta: "Merge this if statement with the enclosing one."
- **Correcto:** `if (conditionA && conditionB) { ... }`
- **Incorrecto:** `if (conditionA) { if (conditionB) { ... } }`
- Excepción: cuando entre los dos ifs hay lógica intermedia que depende del primero.

## 5. Constructor Parameter Limit (SonarQube S107)
- Máximo **7 parámetros** por constructor (regla SonarQube S107).
- Si un service orquestador necesita >7 dependencias → crear `{ServiceName}Options` class:
  - Propiedades `public required {Interface} Nombre { get; init; }`
  - Registrar en DI con factory lambda: `services.AddTransient(sp => new XOptions { Prop = sp.GetRequiredService<I...>() })`
  - El service recibe UN solo parámetro `Options` en su constructor.
- Naming del patrón: `{NombreDelService}Options`, en el mismo folder que el service.
- DomainServices que son stateless y sin dependencias: instanciar con `new()` en field declaration, NO inyectar por constructor.