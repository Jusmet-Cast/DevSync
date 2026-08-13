---
name: cc-solid
description: Aplica estrictamente los principios SOLID en el diseño de clases e interfaces.
paths: "**/*.cs"
---

# Principios SOLID

Todo código debe ser evaluado bajo los siguientes principios. Para cada principio se define qué buscar (detección) y cómo corregirlo (acción).

> ⚠️ **NOTA PARA EL AGENTE:** Los bloques de código en esta skill son **SOLO ILUSTRATIVOS**. Sirven para explicar el concepto. **NUNCA copies los nombres de clases, métodos o variables de estos ejemplos al proyecto real.** Siempre adaptá el patrón al código concreto que estás analizando o generando.

---

## S — Single Responsibility Principle (SRP)
**Definición:** Una clase debe tener una sola razón para cambiar.

**Cómo detectar una violación:**
- Una clase inyecta más de 3 dependencias de tipos distintos (ej. repositorio + servicio de email + logger + servicio externo).
- El nombre de la clase es vago o genérico: `UserManager`, `DataProcessor`, `Helper`, `Utils`.
- Un mismo método hace más de una cosa: consulta a DB, transforma datos Y envía un email.
- La clase tiene más de ~300 líneas con lógica mezclada.

**Cómo corregir:**
- Separar en clases con responsabilidades bien nombradas: `UserRepository`, `EmailNotificationService`, `UserReportBuilder`.
- Extraer lógica de transformación/mapeo a un mapper o builder dedicado.

```csharp
// MAL: una clase que hace todo
public class UserService
{
    public void ProcessUser(User user)
    {
        _db.Save(user);           // persistencia
        _email.Send(user.Email);  // notificación
        _logger.Log("Guardado");  // logging
        _report.Generate(user);   // reporte
    }
}

// BIEN: cada cosa en su lugar
public class UserRepository { ... }
public class UserNotificationService { ... }
public class UserReportService { ... }
```

---

## O — Open/Closed Principle (OCP)
**Definición:** Abierto para extensión, cerrado para modificación.

**Cómo detectar una violación:**
- Existe un `if/else if` o `switch` que evalúa un tipo, string o enum para ejecutar lógica diferente.
- Agregar un nuevo "tipo" de comportamiento obliga a modificar la clase existente.

**Cómo corregir:**
- Extraer una interfaz común e implementarla por cada variante.
- El código que orquesta llama a la abstracción, no al tipo concreto.

```csharp
// MAL: agregar PayPal → modificar este método
public void ProcessPayment(string type)
{
    if (type == "credit") { ... }
    else if (type == "paypal") { ... }
}

// BIEN: agregar PayPal → crear nueva clase, sin tocar lo existente
public interface IPaymentProcessor { void Process(); }
public class CreditCardProcessor : IPaymentProcessor { ... }
public class PayPalProcessor : IPaymentProcessor { ... }
```

---

## L — Liskov Substitution Principle (LSP)
**Definición:** Los objetos derivados deben poder reemplazar a los base sin romper la aplicación.

**Cómo detectar una violación:**
- Una clase derivada lanza `NotImplementedException` o `NotSupportedException` en métodos heredados.
- Una clase derivada ignora o vacía la implementación de un método de la base.
- Se necesita hacer un cast (`as` o `is`) para usar la clase derivada correctamente.

**Cómo corregir:**
- Si una clase derivada no puede cumplir el contrato completo, la jerarquía está mal diseñada.
- Separar en interfaces más pequeñas (ver ISP) o romper la herencia y usar composición.

```csharp
// MAL: Penguin rompe el contrato de Bird
public class Bird { public virtual void Fly() { ... } }
public class Penguin : Bird
{
    public override void Fly() => throw new NotSupportedException(); // VIOLACIÓN
}

// BIEN: separar la capacidad de volar
public interface IFlyable { void Fly(); }
public class Sparrow : IFlyable { public void Fly() { ... } }
public class Penguin { /* no implementa IFlyable */ }
```

---

## I — Interface Segregation Principle (ISP)
**Definición:** Preferir muchas interfaces específicas en lugar de una interfaz "gorda".

**Cómo detectar una violación:**
- Una interfaz tiene más de 5-7 métodos.
- Una clase que implementa la interfaz deja algunos métodos vacíos o con `throw new NotImplementedException()`.
- El nombre de la interfaz es genérico: `IService`, `IManager`, `IProcessor`.

**Cómo corregir:**
- Partir la interfaz grande en interfaces pequeñas y cohesivas.
- Cada clase implementa solo las interfaces que realmente necesita.

```csharp
// MAL: interfaz gorda, no todos la usan completa
public interface IUserService
{
    void Create(User user);
    void Delete(int id);
    void SendEmail(string email);
    byte[] ExportReport();
}

// BIEN: interfaces específicas
public interface IUserWriter { void Create(User user); void Delete(int id); }
public interface IUserNotifier { void SendEmail(string email); }
public interface IUserReporter { byte[] ExportReport(); }
```

---

## D — Dependency Inversion Principle (DIP)
**Definición:** Las clases de alto nivel no deben depender de implementaciones concretas. Ambas deben depender de abstracciones.

**Cómo detectar una violación:**
- Una clase instancia sus dependencias internamente con `new` (salvo POCOs/DTOs/entidades).
- Un servicio de dominio o aplicación importa directamente una clase de infraestructura (`SqlUserRepository`, `SmtpEmailService`).
- Las dependencias no están inyectadas en el constructor.

**Cómo corregir:**
- Inyectar siempre la abstracción (interfaz) por constructor.
- Registrar la implementación concreta en el contenedor de DI.

```csharp
// MAL: acoplado a la implementación concreta
public class UserService
{
    private readonly SqlUserRepository _repo = new SqlUserRepository(); // VIOLACIÓN
}

// BIEN: depende de la abstracción, recibe la implementación por DI
public class UserService
{
    private readonly IUserRepository _repo;
    public UserService(IUserRepository repo) => _repo = repo;
}
```