---
name: dotnet-api-security
description: >
  Seguridad de APIs en .NET: validación real de JWT, authorization policies, IDOR, SQL injection,
  mass assignment, secretos y manejo de errores que no filtra información.
  Trigger: cuando se crea o modifica un endpoint, se configura autenticación/autorización, se
  escribe SQL desde C#, se maneja un token, o se toca cualquier cosa con datos de otro usuario.
paths: "**/Controllers/**/*.cs, **/*Controller.cs, **/Program.cs, **/Startup.cs, **/*Repository.cs, **/*AppService.cs"
license: Apache-2.0
metadata:
  author: madian-velasquez
  version: "1.0"
---

# Seguridad de APIs en .NET

> ⚠️ **NOTA PARA EL AGENTE:** Los bloques de código son **SOLO ILUSTRATIVOS**. NUNCA copies nombres
> de clases, métodos o variables al proyecto real — adaptá el patrón al código concreto.

Complementa `frontend-security-performance` (que cubre XSS/CSRF/CSP del lado del navegador).
Acá va lo del servidor, que es donde un error no se puede compensar desde el cliente.

## 1. Validación de JWT — la configuración por defecto NO alcanza

El error más común: creer que porque el token "se valida", está seguro. Si no validás issuer y
audience, **cualquier token firmado con la misma clave por otro sistema entra**.

```csharp
// ❌ MAL — valida la firma y nada más
options.TokenValidationParameters = new TokenValidationParameters
{
    IssuerSigningKey = key,
    ValidateIssuerSigningKey = true
};

// ✅ BIEN — todo explícito, sin confiar en defaults
options.TokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuerSigningKey = true,
    IssuerSigningKey = key,
    ValidateIssuer = true,
    ValidIssuer = configuracion.Issuer,
    ValidateAudience = true,
    ValidAudience = configuracion.Audience,
    ValidateLifetime = true,
    ClockSkew = TimeSpan.FromSeconds(30)   // el default son 5 MINUTOS de gracia
};
```

**Reglas:**
- `ValidateIssuer`, `ValidateAudience` y `ValidateLifetime` SIEMPRE en `true`, explícitos.
- `ClockSkew` bajo (≤ 1 min). El default de 5 minutos deja un token revocado vivo 5 minutos más.
- La clave de firma **NUNCA** hardcodeada ni en `appsettings.json` versionado — variable de entorno,
  User Secrets en desarrollo o un vault.
- Algoritmo simétrico (HMAC): mínimo 256 bits de clave. `none` como algoritmo se rechaza siempre.

## 2. IDOR — el bug #1 de las APIs de negocio

Que el usuario esté autenticado NO significa que ese recurso sea suyo. Autenticación ≠ autorización.

```csharp
// ❌ MAL — cualquier usuario logueado lee la factura de cualquier otro
[Authorize]
[HttpGet("{facturaId}")]
public async Task<IActionResult> Obtener(int facturaId, CancellationToken ct)
{
    var factura = await _service.ObtenerAsync(facturaId, ct);
    return Ok(factura);
}

// ✅ BIEN — el scope del usuario entra en la consulta, no se chequea después
[Authorize]
[HttpGet("{facturaId}")]
public async Task<IActionResult> Obtener(int facturaId, CancellationToken ct)
{
    var sucursalId = User.ObtenerSucursalId();       // claim del token, NUNCA del request
    var resultado = await _service.ObtenerAsync(facturaId, sucursalId, ct);
    if (!resultado.Ok) return NotFound(resultado.Mensaje);   // 404, no 403: no confirmes que existe
    return Ok(resultado.Data);
}
```

**Reglas:**
- El identificador del propietario (usuario, sucursal, empresa) sale **SIEMPRE del token**, nunca
  de un parámetro que el cliente pueda cambiar.
- El filtro de pertenencia va **dentro de la query**, no como `if` después de traer el dato.
- Recurso ajeno → responder `404`, no `403`. Un 403 confirma que el ID existe (enumeración).
- Todo endpoint que recibe un ID de entidad necesita una respuesta explícita a: *¿qué impide que
  el usuario A pida el ID de B?*

## 3. Authorization: policies, no `[Authorize]` pelado

```csharp
// ❌ MAL — "está logueado" no es un permiso
[Authorize]
public async Task<IActionResult> AnularFactura(int id) { ... }

// ✅ BIEN — permiso explícito y nombrado
[Authorize(Policy = Politicas.PuedeAnularFacturas)]
public async Task<IActionResult> AnularFactura(int id) { ... }
```

- Nombres de policy en constantes (`static class Politicas`), nunca strings sueltos.
- Roles para agrupar, **policies para decidir**. Chequear `User.IsInRole("Admin")` desperdigado por
  los services es imposible de auditar.
- Endpoints públicos: `[AllowAnonymous]` **explícito**. Un endpoint sin atributo es una omisión
  ambigua; nadie sabe si es intencional.

## 4. SQL Injection — sigue vivo, incluso con ORM

```csharp
// ❌ MAL — concatenación. Clásico y letal.
var sql = $"SELECT * FROM Productos WHERE Descripcion LIKE '%{filtro}%'";
var r = await _conexion.QueryAsync<ProductoDto>(sql);

// ❌ MAL — EF Core con SQL crudo interpolado en string
var r = await _db.Productos.FromSqlRaw($"SELECT * FROM Productos WHERE Id = {id}").ToListAsync(ct);

// ✅ BIEN — Dapper con parámetros
var r = await _conexion.QueryAsync<ProductoDto>(
    "SELECT ProductoId, Descripcion FROM Productos WHERE Descripcion LIKE @Filtro",
    new { Filtro = $"%{filtro}%" });

// ✅ BIEN — EF Core con FromSqlInterpolated (parametriza automáticamente)
var r = await _db.Productos.FromSqlInterpolated($"SELECT * FROM Productos WHERE Id = {id}")
                           .ToListAsync(ct);
```

**Reglas:**
- **NUNCA** concatenar ni interpolar valores dentro de un string SQL con `FromSqlRaw` /
  `ExecuteSqlRaw` / `CommandText`.
- `FromSqlInterpolated` y `ExecuteSqlInterpolated` SÍ parametrizan — la diferencia con `Raw` es
  exactamente esa, y se confunden todo el tiempo.
- Nombres de tabla/columna **no se pueden parametrizar**: si vienen del cliente, mapealos con un
  `enum` + switch expression (ver `cc-architecture` §4). Nunca los pases directo.
- `ORDER BY` dinámico es el vector olvidado: misma regla, whitelist siempre.

## 5. Mass assignment

```csharp
// ❌ MAL — el cliente manda EsAdministrador = true y lo mapeás derecho a la entidad
public async Task<IActionResult> Actualizar([FromBody] Usuario usuario) { ... }

// ✅ BIEN — DTO explícito con solo los campos editables
public async Task<IActionResult> Actualizar([FromBody] ActualizarUsuarioDto dto, CancellationToken ct)
```

- **NUNCA** recibir una entidad de dominio directo del body (ya lo prohíbe `cc-architecture`; acá
  además es un agujero de seguridad).
- El DTO de request expone SOLO lo editable. Campos de control (roles, flags, precios, estados)
  se setean en el service, jamás desde el body.

## 6. Errores que no filtran información

```csharp
// ❌ MAL — le regalás el stack trace y el nombre de la tabla al atacante
catch (Exception ex)
{
    return BadRequest(ex.Message);
}

// ✅ BIEN — el detalle al log, un mensaje genérico al cliente
catch (Exception ex)
{
    _logger.LogError(ex, "Error al crear vale para sucursal {SucursalId}", dto.SucursalId);
    return BadRequest(Mensajes.ValeErrorCrear);
}
```

- **NUNCA** `ex.Message`, `ex.StackTrace` ni `ex.InnerException` en la respuesta HTTP.
- Mensajes genéricos desde `Mensajes.cs` (ver `cc-architecture`).
- En login: mismo mensaje para "usuario no existe" y "contraseña incorrecta". Distinguirlos permite
  enumerar usuarios.
- `UseDeveloperExceptionPage()` **solo** bajo `IsDevelopment()`, nunca condicionado a un flag de
  configuración que alguien pueda prender en producción.

## 7. Secretos

- **NUNCA** connection strings, API keys ni claves de firma en `appsettings.json` versionado.
- Desarrollo: User Secrets (`dotnet user-secrets`). Producción: variables de entorno o vault.
- Si encontrás un secreto hardcodeado: **paralo y avisá**. No lo "mejores" moviéndolo de lugar —
  un secreto que estuvo en git ya está comprometido y hay que rotarlo.
- `appsettings.Development.json` y `appsettings.Production.json` están en el `deny` de lectura de
  `settings.json` justamente por esto.

## 8. Checklist de endpoint nuevo

- [ ] ¿Tiene `[Authorize]` con policy, o `[AllowAnonymous]` explícito y justificado?
- [ ] ¿El scope del usuario (sucursal/empresa/usuario) sale del token y entra en la query?
- [ ] ¿El DTO de request expone solo campos editables?
- [ ] ¿Todo SQL está parametrizado y los campos dinámicos vienen de un enum?
- [ ] ¿Los errores devuelven mensaje genérico y loguean el detalle?
- [ ] ¿Hay rate limiting si es un endpoint de login, búsqueda pesada o export?
- [ ] ¿Se valida el tamaño de la entrada (paginado con tope, largo de strings)?
