---
name: cc-architecture
description: Reglas de arquitectura para Web APIs, manejo de parámetros y eliminación de números mágicos.
paths: "**/Controllers/**/*.cs, **/Endpoints/**/*.cs, **/*Controller.cs, **/Dtos/**/*.cs"
---

# Arquitectura y Diseño de Parámetros

> ⚠️ **NOTA PARA EL AGENTE:** Los bloques de código en esta skill son **SOLO ILUSTRATIVOS**. Sirven para explicar el concepto. **NUNCA copies los nombres de clases, métodos o variables de estos ejemplos al proyecto real.** Siempre adaptá el patrón al código concreto que estás analizando o generando.

## 1. Web APIs y DTOs

- **PROHIBIDO devolver Entidades de dominio directamente en los controladores.**
- Siempre se deben mapear las entidades y devolver DTOs (Data Transfer Objects).

### 1.1 Controllers — Única responsabilidad: HTTP orchestration

El controller SOLO recibe el request, delega al service y retorna la respuesta. Nada más.

```csharp
// ❌ MAL — validación de negocio en el controller
public async Task<IActionResult> ObtenerProductos([FromQuery] FiltrosDto p)
{
    if (p.SucursalId < 1 || p.Top < 1)
        return BadRequest("SucursalId y Top deben ser mayores a 0.");
    var result = await _service.ObtenerAsync(p, ct);
    ...
}

// ✅ BIEN — el controller solo orquesta
public async Task<IActionResult> ObtenerProductos([FromQuery] FiltrosDto p, CancellationToken ct)
{
    var result = await _service.ObtenerAsync(p, ct);
    if (!result.Ok) return BadRequest(result.Mensaje);
    return Ok(result.Data);
}
```

**Reglas:**
- Toda validación de negocio (rangos, valores requeridos, reglas de dominio) va en el **service**, no en el controller
- El controller nunca sabe de lógica de negocio — solo HTTP: deserializa → delega → serializa
- Las validaciones en el service retornan `Respuesta.Fault(mensaje)`, el controller lo propaga sin interpretarlo

### 1.2 DTOs de Request (los que recibe el controller)

```csharp
// ❌ MAL — record (innecesario para request), sufijo Params (no es convención)
public sealed record FiltrosParams([FromQuery] int SucursalId, [FromQuery] int Top);

// ✅ BIEN — class con propiedades, sufijo Dto
public class FiltrosDto
{
    public int SucursalId { get; set; }
    public int Top { get; set; }
}
```

**Reglas:**
- DTOs de request: SIEMPRE `public class` con propiedades `{ get; set; }`
- Sufijo `*Dto` — NUNCA `*Params`, `*Request`, `*Input` salvo convención explícita del proyecto
- NUNCA `sealed record` para DTOs que el controller recibe — `record` es para value objects con comparación por valor

### 1.3 DTOs de Respuesta (los que retorna el service)

- Default: `public class` con propiedades `{ get; set; }`
- `sealed record` solo cuando genuinamente tiene sentido: el DTO necesita comparación estructural por valor o es inmutable por diseño de dominio (muy raro en respuestas de API)

## 2. Parámetros de Método
- **Límite:** Máximo 3 a 4 parámetros por método.
- Si un método requiere más de 4 parámetros, encapsularlos en un **`public class` con sufijo `Dto`**
  y propiedades `{ get; set; }`.
  - Ubicación: `Features/{Feature}/{SubFeature}/Dtos/` — **un archivo por clase**, NUNCA dentro del
    archivo del service.
  - **NUNCA `record`** para DTOs, y **NUNCA** los sufijos `*Request` / `*Response` / `*Params` /
    `*Model` / `*Input`. Ver §1.2 de esta misma skill y `cc-naming` §2 — las tres reglas dicen
    exactamente lo mismo, a propósito.
- Caso aparte, **constructores**: el límite es 7 parámetros (SonarQube S107). Si un service
  orquestador necesita más dependencias, va `{ServiceName}Options` con `required init`.
  Ver `cc-complexity` §5.

## 3. Evitar Números Mágicos
- Prohibido dejar valores literales ("quemados") en validaciones lógicas (ej. `if (user.Age > 18)`).
- Extraer estos valores mágicos a constantes, enums, o diccionarios con nombres descriptivos (ej. `private const int LEGAL_AGE = 18;`).

## 4. Prohibido Exponer Nombres de Base de Datos en Contratos de API

- **NUNCA** usar nombres de columnas, tablas o vistas de la base de datos como valores de parámetros en la API pública (query strings, body, headers).
- Esto aplica especialmente a parámetros de ordenamiento (`orderBy`, `ordenCampo`, `sortBy`), filtrado y proyección donde el frontend podría enviar el nombre directo de una columna.
- **Information disclosure**: exponer nombres de columnas revela el esquema interno de la base de datos, facilitando ataques de enumeración de schema o SQL injection en otros endpoints menos protegidos.

### Solución: usar enums o alias semánticos

```csharp
// ❌ MAL — el frontend envía el nombre de la columna de DB
// URL: api/articulos?ordenCampo=art_Desc&ordenDescendente=true
public class FiltrosDto
{
    public string? OrdenCampo { get; set; } // "art_Desc", "art_Precio"
}

// ✅ BIEN — enum con nombres semánticos, validación automática del framework
public enum OrdenProducto { Relevancia, Descripcion, Precio }

public class FiltrosDto
{
    public OrdenProducto OrdenCampo { get; set; } // Descripcion, Precio
}
```

**Reglas:**
- Para conjuntos cerrados de opciones (sort, filter fields, status): usar `enum` — el model binding de ASP.NET valida automáticamente y devuelve 400 en valores inválidos
- Los nombres del enum deben ser semánticos y en PascalCase (`Descripcion`, `Precio`, `FechaCreacion`), NUNCA reflejar el naming de la DB (`art_Desc`, `art_precio`, `fecha_cre`)
- Si se detecta un string con forma de nombre de columna (prefijo corto + underscore, tipo `xxx_campo`, o cualquier underscore estilo SQL), refactorizar inmediatamente a enum o constante semántica
- En el service, el mapping de enum → propiedad del DTO/entidad se hace con switch expression

## 5. Repository Pattern — Responsabilidad Única: Acceso a Datos

El repository **SOLO** se encarga de interactuar con la base de datos. NUNCA valida lógica de negocio.

```csharp
// ❌ MAL — validación de negocio en el repository
public async Task<Respuesta<List<ItemDto>>> ObtenerPorUsuarioAsync(int usuarioId)
{
    if (usuarioId <= 0)
    {
        return Respuesta<List<ItemDto>>.Fault("Usuario inválido");
    }
    // query...
}

// ✅ BIEN — el repository solo hace la query
public async Task<List<ItemDto>> ObtenerPorUsuarioAsync(int usuarioId, CancellationToken ct)
{
    return await _dbContext.Items
        .Where(x => x.UsuarioId == usuarioId)
        .ToListAsync(ct);
}
```

**Reglas:**
- El repository NUNCA valida inputs (null checks de negocio, rangos de IDs, formato de strings). Eso va en el Service o DomainService
- El repository NUNCA retorna mensajes de error de negocio (`Respuesta.Fault("mensaje de negocio")`)
- El repository puede retornar `null`, colección vacía, o `bool` — el **service** decide qué hacer con eso
- Si un repository tiene `if (param <= 0) return Fault(...)` o `if (string.IsNullOrEmpty(...)) return Fault(...)` ANTES de una query, es una violación — mover al service
- Excepciones permitidas en repository: solo las propias de infraestructura (connection timeout, deadlock retry) — nunca lógica de dominio