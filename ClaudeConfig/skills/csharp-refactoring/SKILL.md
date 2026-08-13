---
name: csharp-refactoring
description: >
  Detección de code smells, deuda técnica y estrategias de refactoring seguro en C#/.NET.
  Trigger: Cuando se revisa código existente, se detectan problemas de mantenibilidad, se refactoriza una clase/método, o se trabaja con código heredado en C#.
metadata:
  author: madian-velasquez
  version: "1.1"
  last_change: "Corregido checklist: reemplazado 'any' (TypeScript) por 'object'/'dynamic' (C#) en el ítem de tipado fuerte"
paths: "**/*.cs"
---

## Code Smells — Cómo Detectarlos

> ⚠️ Los bloques de código son SOLO ILUSTRATIVOS. Adaptá los patrones al código concreto que estás analizando.

### Long Method
**Señal (NO error bloqueante):** Método de más de 30-40 líneas, comentarios que dividen secciones.

> ⚠️ **Alcance de este umbral.** Las 30-40 líneas son una señal de review para criterio humano,
> **no un criterio de refactor automático**. El umbral bloqueante lo fija `cc-complexity` §3:
> 600 líneas por método / 1000 por clase. Un método de 80 líneas legibles NO se refactoriza solo
> porque sea largo — se refactoriza si además viola complejidad ciclomática/cognitiva o SRP.
> Lo que importa acá es el patrón "comentarios que dividen secciones": eso SÍ delata pasos que
> quieren ser métodos con nombre.
```csharp
// ❌ Un método que hace todo
public async Task ProcessOrder(Order order)
{
    // Validar
    if (order.Items.Count == 0) throw new ...
    if (order.CustomerId == null) throw new ...

    // Calcular
    var subtotal = order.Items.Sum(i => i.Price * i.Qty);
    var tax = subtotal * 0.15m;
    var total = subtotal + tax;

    // Persistir
    await _db.Orders.AddAsync(order);
    await _db.SaveChangesAsync();

    // Notificar
    await _emailService.SendConfirmationAsync(order.CustomerId, total);
}

// ✅ Extract Method
public async Task ProcessOrder(Order order)
{
    ValidateOrder(order);
    var total = CalculateTotal(order);
    await SaveOrderAsync(order);
    await NotifyCustomerAsync(order.CustomerId, total);
}
```

### God Class
**Señal:** Clase con más de 5 inyecciones, nombre genérico (`Manager`, `Helper`, `Processor`), más de 500 líneas.
```csharp
// ❌ Clase que sabe demasiado
public class UserManager
{
    private readonly IUserRepository _repo;
    private readonly IEmailService _email;
    private readonly ILogger _logger;
    private readonly IReportService _reports;
    private readonly ICacheService _cache;
    // 600 líneas...
}

// ✅ Separar por responsabilidad
public class UserRepository { ... }
public class UserNotificationService { ... }
public class UserReportService { ... }
```

### Primitive Obsession
**Señal:** `string email`, `decimal amount`, `int userId` pasados como primitivos por toda la app.
```csharp
// ❌
void CreateInvoice(string customerId, decimal amount, string currency) { ... }

// ✅ Value Objects
void CreateInvoice(CustomerId customerId, Money amount) { ... }

record CustomerId(Guid Value);
record Money(decimal Amount, string Currency)
{
    public static Money Usd(decimal amount) => new(amount, "USD");
}
```

### Feature Envy
**Señal:** Un método accede más a datos de otra clase que a los propios.
```csharp
// ❌ OrderService envidia los datos de Customer
public decimal CalculateDiscount(Order order)
{
    if (order.Customer.MembershipLevel == "Gold" && order.Customer.YearsActive > 2)
        return order.Total * 0.10m;
    return 0;
}

// ✅ Mover la lógica a donde están los datos
public class Customer
{
    public decimal CalculateDiscount(decimal orderTotal) { ... }
}
```

### Magic Numbers / Magic Strings
**Señal:** Literales numéricos o de texto directamente en lógica de negocio.
```csharp
// ❌
if (user.Age >= 18 && order.Total > 1000)
    discount = order.Total * 0.15m;

// ✅
private const int MinimumLegalAge = 18;
private const decimal DiscountThreshold = 1000m;
private const decimal DiscountRate = 0.15m;
```

---

## Técnicas de Refactoring

### Extract Method
Cuando un método hace más de una cosa o tiene comentarios que dividen secciones → cada sección es un método.

### Extract Class
Cuando una clase tiene grupos de métodos/campos que trabajan juntos pero son independientes del resto → extraer a clase propia.

### Replace Conditional with Polymorphism
```csharp
// ❌ Switch que crece con cada nuevo tipo
public decimal CalculatePay(Employee emp)
{
    return emp.Type switch
    {
        "full-time" => emp.Salary,
        "part-time" => emp.HoursWorked * emp.HourlyRate,
        "contractor" => emp.HoursWorked * emp.ContractRate * 1.3m,
        _ => throw new InvalidOperationException()
    };
}

// ✅ Polimorfismo — agregar un nuevo tipo = nueva clase, sin tocar lo existente
public abstract class Employee { public abstract decimal CalculatePay(); }
public class FullTimeEmployee : Employee { public override decimal CalculatePay() => Salary; }
public class PartTimeEmployee : Employee { public override decimal CalculatePay() => HoursWorked * HourlyRate; }
```

### Introduce Parameter Object
```csharp
// ❌ Demasiados parámetros
void SearchUsers(string name, string email, string role, bool isActive, int page, int pageSize) { ... }

// ✅ Encapsular en record/clase
record UserSearchQuery(string? Name, string? Email, string? Role, bool? IsActive, int Page = 1, int PageSize = 20);
void SearchUsers(UserSearchQuery query) { ... }
```

---

## Refactoring Seguro — Proceso

```
1. Escribir tests que cubran el comportamiento actual (antes de tocar código)
2. Asegurar que los tests pasan en verde
3. Refactorizar en pasos pequeños
4. Correr tests después de cada paso
5. Si un test falla → revertir ese paso, no avanzar
```

### TDD como red de seguridad
Los tests actúan como especificación. Si el refactor rompe un test → sabés exactamente qué comportamiento cambió.

```csharp
// Antes de refactorizar CalculateDiscount — escribir tests
[Fact]
public void CalculateDiscount_GoldMemberOver2Years_Returns10Percent()
{
    var customer = new Customer { MembershipLevel = "Gold", YearsActive = 3 };
    var result = customer.CalculateDiscount(1000m);
    Assert.Equal(100m, result);
}
```

---

## Deuda Técnica — Priorización

| Tipo | Descripción | Cuándo pagar |
|------|-------------|--------------|
| **Deliberada** | Solución rápida consciente ("esto lo arreglamos después") | Sprint siguiente |
| **Accidental** | Mala decisión sin saberlo en el momento | Al descubrirla |
| **Bit rot** | Código que envejeció con los cambios del sistema | Al tocarlo (Boy Scout Rule) |

### Boy Scout Rule
> Dejá el código un poco mejor de como lo encontraste.

No necesitás un sprint de refactoring masivo. Cada vez que tocás un archivo, mejorá algo pequeño: renombrá una variable, extraé un método, eliminá código muerto.

---

## Checklist de Revisión de Código C#

- [ ] ¿El método tiene más de 30-40 líneas? → Extract Method
- [ ] ¿La clase tiene más de 5 inyecciones? → Dividir responsabilidades (SRP)
- [ ] ¿Hay `object`/`dynamic` donde debería haber un tipo concreto? → Tipado fuerte
- [ ] ¿Hay números/strings mágicos? → Extraer a constantes/enums
- [ ] ¿Hay código duplicado en 2+ lugares? → Extraer a método/servicio compartido
- [ ] ¿El nombre describe QUÉ hace, no CÓMO? → Renombrar
- [ ] ¿Hay comentarios que explican código oscuro? → El código debería ser autoexplicativo

---

## Project Conventions — ERP Generales APIs

### Parameter Objects
- Métodos con más de 4 parámetros → crear un `sealed record` Parameter Object
- El archivo del record va en `Features/{Feature}/{SubFeature}/Dtos/` — un archivo individual por cada record
- NO crear el record en el mismo archivo del service
- Nombre descriptivo que indique su propósito: `ContextoEvaluacion`, `FiltroReporte`, etc.

### Mensajes Hardcodeados
- NUNCA strings literales en services o métodos de negocio
- Todos los mensajes van en `Common/Mensajes.cs` (static class con public const string)
- Naming de constantes: PascalCase agrupado por feature → `BonosSinDatosAgente`, `ValesErrorCrear`
- Usar `string.Format(Mensajes.Constante, param1, param2)` para mensajes con parámetros
- Si no existe `Common/Mensajes.cs` en la API: crearlo con la misma estructura

### Logging con Serilog / Seq
- TODOS los AppServices deben inyectar `ILogger<NombreDelService>` vía constructor
- Solo se loguean ERRORES: `_logger.LogError(ex, "Descripción corta", params)` en cada catch
- NUNCA LogInformation, LogWarning, LogDebug en el catch — solo LogError
- El mensaje retornado al cliente en el catch NO es ex.Message — usar constante genérica de Mensajes.cs
- Patrón del catch:
  ```csharp
  catch (Exception ex)
  {
      _logger.LogError(ex, "Error al {Accion} {Entidad} con {Param}", valorParam);
      return Respuesta<T>.Excepcion(Mensajes.ErrorGenericoDelMetodo);
  }
  ```

### Interfaz del Service
- Todo AppService DEBE tener su interfaz `I{NombreService}` en el mismo folder del service
- La interfaz solo expone los métodos públicos