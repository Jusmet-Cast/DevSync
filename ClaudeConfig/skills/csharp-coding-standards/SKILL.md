---
name: csharp-coding-standards
description: "Estándares modernos de C#: performance con Span/Memory, diseño de APIs públicas, value objects y patrones de tipos."
paths: "**/*.cs"
---

> ⚠️ **NOTA PARA EL AGENTE:** Los bloques de código son **SOLO ILUSTRATIVOS**. Nunca copies nombres de clases, métodos o variables de estos ejemplos al proyecto real. Adaptá siempre el patrón al código concreto que estás analizando.

## 1. Performance y Zero-Allocation con Span/Memory

Usá `Span<T>` y `Memory<T>` en lugar de `byte[]` o `string` para código crítico en performance.

```csharp
// MAL - aloca un nuevo array
byte[] ProcessData(byte[] input) { ... }

// BIEN - zero allocation
void ProcessData(Span<byte> input, Span<byte> output) { ... }
ReadOnlySpan<char> GetSubstring(ReadOnlySpan<char> source, int start, int length)
    => source.Slice(start, length);
```

**Reglas:**
- `Span<T>` para operaciones sincrónicas en stack
- `Memory<T>` cuando necesitás almacenar la referencia (async, campos de clase)
- Preferí `ReadOnlySpan<T>` si no modificás el contenido
- Nunca guardés un `Span<T>` como campo de una clase — usá `Memory<T>`

## 2. Diseño de APIs Públicas

**Parámetros de entrada — qué tipo aceptar:**

| Escenario | Tipo recomendado |
|---|---|
| Texto de solo lectura | `ReadOnlySpan<char>` o `string` |
| Buffer de bytes procesable | `Span<byte>` o `Memory<byte>` |
| Colección iterable | `IEnumerable<T>` |
| Colección con índice | `IReadOnlyList<T>` |
| Escritura en buffer del caller | `Span<T>` (output param) |

**Valores de retorno:**
- Devolvé el tipo **más específico** posible en implementaciones, el **más abstracto** posible en interfaces/contratos públicos
- Evitá devolver `List<T>` — devolvé `IReadOnlyList<T>` o `IEnumerable<T>`
- Para resultados opcionales: preferí `T?` con nullability annotations sobre excepciones como control de flujo

## 3. Firmas de Métodos — Best Practices

```csharp
// MAL - bool como flag de comportamiento
void SaveUser(User user, bool sendEmail, bool updateCache, bool logActivity) { ... }

// BIEN - parámetro encapsulado o flags tipados
void SaveUser(User user, SaveUserOptions options) { ... }

[Flags]
enum SaveUserOptions { None = 0, SendEmail = 1, UpdateCache = 2, LogActivity = 4 }
```

**Reglas:**
- Máximo 3-4 parámetros — si necesitás más, encapsulalos en un record/clase `Request`
- Evitá parámetros `bool` como flags de comportamiento — usá enums o clases de opciones
- Los parámetros opcionales van al final
- Usá `CancellationToken` como último parámetro en métodos async públicos

## 4. Value Objects y Patrones de Tipos

Preferí tipos que comuniquen intención sobre primitivos desnudos.

```csharp
// MAL - primitive obsession
void CreateOrder(string customerId, string productId, decimal amount) { ... }

// BIEN - value objects o records tipados
void CreateOrder(CustomerId customerId, ProductId productId, Money amount) { ... }

record CustomerId(Guid Value);
record Money(decimal Amount, string Currency);
```

**Cuándo crear un Value Object:**
- El primitivo tiene validaciones o restricciones propias (ej: email, edad, precio)
- El mismo tipo primitivo aparece en múltiples contextos con significados distintos
- Necesitás comparación por valor (records en C# son perfectos para esto)

**Patterns modernos de C#:**
```csharp
// Pattern matching para lógica de negocio
string Classify(int score) => score switch
{
    >= 90 => "Excelente",
    >= 70 => "Aprobado",
    _     => "Insuficiente"
};

// Primary constructors (C# 12+)
class OrderService(IOrderRepository repo, ILogger<OrderService> logger)
{
    public async Task<Order> GetAsync(OrderId id, CancellationToken ct = default)
        => await repo.FindAsync(id, ct) ?? throw new NotFoundException(id);
}
```

## 6. `sealed` — Cuándo usarlo (y cuándo NO)

```csharp
// ❌ MAL — sealed en services y controllers no aporta nada
public sealed class PedidosService : IPedidosService { ... }
public sealed class PedidosController : ControllerBase { ... }

// ✅ BIEN — sealed solo donde tiene sentido real
public sealed class NullLogger : ILogger { ... }  // implementación terminal conocida
```

**Reglas:**
- NUNCA `sealed` en **controllers** — no se heredan, el modificador es ruido
- NUNCA `sealed` en **services** concretos — el contrato es la interfaz; el `sealed` no agrega restricción útil cuando la DI ya desacopla
- `sealed` solo en clases que son **terminales por diseño de dominio** (ej: implementaciones Null Object, singletons internos, nodos de árbol de expresiones)

## 7. `record` vs `class` para DTOs

```csharp
// ❌ MAL — sealed record para un DTO de request (no necesita value equality)
public sealed record FiltrosDto([FromQuery] int SucursalId, [FromQuery] int Top);

// ✅ BIEN — class con propiedades para DTOs de request/response
public class FiltrosDto
{
    public int SucursalId { get; set; }
    public int Top { get; set; }
}

// ✅ BIEN — record cuando genuinamente necesitás value equality inmutable
record Money(decimal Amount, string Currency);  // value object de dominio
```

**Reglas:**
- DTOs de **request** (lo que entra al controller): siempre `public class` con `{ get; set; }`
- DTOs de **respuesta** (lo que sale del service): default `public class`; `record` solo si el diseño de dominio exige inmutabilidad y comparación estructural
- `sealed record` combinado en DTOs: casi nunca justificado — revisá si realmente lo necesitás

Prohibido el uso de query syntax (rom ... in). Usá **siempre** lambda syntax (.Where(), .Select(), etc.).

```csharp
// ❌ MAL - query syntax (prohibido)
var result = (from user in users
              where user.IsActive
              select new UserDto { Name = user.Name })
             .ToList();

// ✅ BIEN - lambda syntax
var result = users
    .Where(u => u.IsActive)
    .Select(u => new UserDto { Name = u.Name })
    .ToList();
```

**Por qué lambda es mejor:**
- Más composable — encadenás operadores fluídamente
- Menos overhead sintáctico
- Más cercano a functional programming
- Mejor para refactoring — lambdas son extraíbles a variables/métodos
- Performance equivalente (mismo IL compilado)

**Reglas:**
- NUNCA usar `from ... in ... where ... select`
- Siempre `.Where().Select().OrderBy()` etc.
- En queries complejas con joins → considera romper en pasos intermedios o usar métodos auxiliares
- Si el query es muy largo (5+ operadores), extraer a método privado con nombre descriptivo

## 8. Roslyn Analyzers — Reglas Frecuentes

### CA1869: Cachear JsonSerializerOptions
- NUNCA instanciar `new JsonSerializerOptions { ... }` dentro de un método que se ejecuta múltiples veces.
- Declarar como `private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };`
- Reutilizar la misma instancia en toda la clase.

### SYSLIB1045: GeneratedRegexAttribute
- NUNCA usar `new Regex(pattern, RegexOptions.Compiled)` — usar `[GeneratedRegex]` que genera código en compile-time.
- Requiere clase `partial` y método `private static partial Regex NombreRegex();`.
- Ejemplo:
```csharp
public partial class MiClase
{
    [GeneratedRegex(@"\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*")]
    private static partial Regex RegexCorreo();
}
```

### CA1850: Prefer static HashData
- NUNCA usar `SHA256.Create()` + `.ComputeHash(data)` — usar `SHA256.HashData(data)` estático.
- Aplica a todas las clases derivadas de `HashAlgorithm`: `SHA1`, `SHA256`, `SHA384`, `SHA512`, `MD5`.
- Elimina la necesidad de `using`/`Dispose` y reduce allocations.

### CA1826: No usar Enumerable en colecciones indexables
- NUNCA usar `.First()`, `.Last()`, `.ElementAt(n)`, `.Count()` en `List<T>`, arrays o `IReadOnlyList<T>`.
- Usar indexador directo: `list[0]`, `list[^1]`, `list.Count` (propiedad, no método).
- Para `FirstOrDefault()` → `collection.Count > 0 ? collection[0] : null`
- Para lookups repetidos en loop → `ToDictionary()` + `TryGetValue()`.
