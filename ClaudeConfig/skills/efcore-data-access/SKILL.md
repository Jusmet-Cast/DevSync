---
name: efcore-data-access
description: >
  Acceso a datos desde .NET con EF Core y Dapper sobre SQL Server: N+1, AsNoTracking, proyección,
  fuga de IQueryable fuera de Infrastructure, paginado, transacciones y cuándo bajar a Dapper.
  Trigger: cuando se escribe o modifica un repositorio, una query LINQ contra la base, una
  migración, o se investiga un problema de performance de consultas.
paths: "**/*Repository.cs, **/Infrastructure/**/*.cs, **/Persistence/**/*.cs, **/*DbContext.cs"
license: Apache-2.0
metadata:
  author: madian-velasquez
  version: "1.0"
---

# Acceso a Datos — EF Core y Dapper sobre SQL Server

> ⚠️ **NOTA PARA EL AGENTE:** Los bloques de código son **SOLO ILUSTRATIVOS**. NUNCA copies nombres
> de clases o variables al proyecto real — adaptá el patrón al código concreto.

Complementa `sql-standards` (que cubre DDL: tipos, naming, constraints). Acá va el consumo desde C#,
que es donde nacen los problemas de performance de un ERP.

## 1. N+1 — el bug de performance número uno

```csharp
// ❌ MAL — 1 query para las facturas + 1 por cada cliente. 200 facturas = 201 queries.
var facturas = await _db.Facturas.ToListAsync(ct);
foreach (var f in facturas)
{
    Console.WriteLine(f.Cliente.Nombre);   // lazy load: query oculta acá
}

// ✅ BIEN — proyección: una sola query, solo las columnas que se usan
var facturas = await _db.Facturas
    .Where(f => f.SucursalId == sucursalId)
    .Select(f => new FacturaDto
    {
        FacturaId = f.FacturaId,
        Total = f.Total,
        ClienteNombre = f.Cliente.Nombre    // se resuelve con JOIN, no con query extra
    })
    .ToListAsync(ct);
```

**Reglas:**
- **Lazy loading DESHABILITADO** en el `DbContext`. Es la causa raíz del N+1 y es invisible al leer.
- Si necesitás la entidad completa con relaciones: `Include()` explícito. Si solo necesitás campos:
  `Select()` (mejor — no trae lo que no usás).
- Un `foreach` sobre entidades que accede a una propiedad de navegación es **siempre** sospechoso.

## 2. `AsNoTracking()` en todo lo que sea solo lectura

```csharp
// ❌ MAL — EF arma el change tracker para 5000 filas que solo vas a serializar
var productos = await _db.Productos.Where(p => p.Activo).ToListAsync(ct);

// ✅ BIEN
var productos = await _db.Productos.AsNoTracking().Where(p => p.Activo).ToListAsync(ct);
```

- Toda query de consulta (`Obtener*`, `Listar*`, `Buscar*`) lleva `AsNoTracking()`.
- Con `Select()` a un DTO, EF ya no trackea — ahí es redundante, no lo agregues por reflejo.
- El tracking SOLO donde vas a modificar y guardar.

## 3. `IQueryable` NO se escapa de Infrastructure

```csharp
// ❌ MAL — la query se arma en la capa equivocada y se ejecuta cuando nadie sabe
public IQueryable<Factura> ObtenerTodas() => _db.Facturas;

// ✅ BIEN — el repositorio decide, ejecuta y devuelve material
public async Task<List<FacturaDto>> ObtenerPorSucursalAsync(int sucursalId, CancellationToken ct)
    => await _db.Facturas.AsNoTracking()
        .Where(f => f.SucursalId == sucursalId)
        .Select(f => new FacturaDto { ... })
        .ToListAsync(ct);
```

Devolver `IQueryable` es una **fuga de abstracción**: la capa Application termina componiendo SQL
sin saberlo, el `DbContext` puede estar disposed cuando se materializa, y no podés cambiar el motor
de persistencia sin tocar todo. El repositorio retorna `List<T>`, `T`, `bool` o `null` — nunca
`IQueryable`.

## 4. Paginado — siempre con tope

```csharp
// ❌ MAL — el cliente pide Top=999999 y te tumba la API
var items = await query.Take(filtros.Top).ToListAsync(ct);

// ✅ BIEN — tope duro del servidor, orden estable
const int TopMaximo = 500;
var top = Math.Clamp(filtros.Top, 1, TopMaximo);

var items = await query
    .OrderBy(p => p.Descripcion).ThenBy(p => p.ProductoId)   // desempate estable
    .Skip((filtros.Pagina - 1) * top)
    .Take(top)
    .ToListAsync(ct);
```

- Todo listado tiene tope máximo del **servidor**, no del cliente.
- `Skip/Take` **sin `OrderBy` no es determinístico**: SQL Server no garantiza orden sin ORDER BY,
  y vas a ver filas repetidas entre páginas.
- El `OrderBy` necesita desempate por clave única, o dos filas con el mismo valor bailan entre páginas.

## 5. `CancellationToken` hasta el fondo

Toda operación async de EF acepta `CancellationToken` y **hay que pasárselo**: `ToListAsync(ct)`,
`FirstOrDefaultAsync(ct)`, `SaveChangesAsync(ct)`, `AnyAsync(ct)`. Sin eso, si el cliente corta la
request, la query sigue ocupando conexión y CPU del servidor. Ver `csharp-concurrency-patterns`.

## 6. Existencia y conteo

```csharp
// ❌ MAL — trae la fila entera para saber si existe
var existe = await _db.Vales.FirstOrDefaultAsync(v => v.Codigo == codigo, ct) != null;

// ❌ MAL — cuenta TODO para saber si hay al menos uno
var existe = await _db.Vales.CountAsync(v => v.Codigo == codigo, ct) > 0;

// ✅ BIEN
var existe = await _db.Vales.AnyAsync(v => v.Codigo == codigo, ct);
```

## 7. Transacciones

- Un `SaveChangesAsync()` ya es atómico para todos sus cambios: **no envuelvas eso en una
  transacción explícita** por las dudas.
- Transacción explícita SOLO cuando hay varios `SaveChanges` o mezclás EF con Dapper y necesitan
  ser atómicos entre sí.
- Nada de llamadas HTTP ni envío de mails **dentro** de una transacción: mantiene la conexión y los
  locks abiertos mientras esperás a un tercero.

## 8. Cuándo bajar a Dapper

EF Core es el default. Bajá a Dapper cuando:

- Reportes con agregaciones pesadas o pivots que en LINQ quedan ilegibles.
- Necesitás un hint específico del motor o una CTE compleja.
- Perfilaste y el SQL generado por EF es objetivamente malo. **Perfilaste**, no "me parece".

Reglas: siempre parametrizado (ver `dotnet-api-security` §4), siempre dentro de Infrastructure, y
mapeando a un DTO — nunca a una entidad de dominio.

## 9. Migraciones

- Migración generada = migración **revisada**. Leé el SQL antes de aplicarla.
- `dotnet ef database update` está en la lista `ask` de permisos: nunca se corre solo.
- Cambios destructivos (drop de columna, cambio de tipo con pérdida) necesitan plan de rollback
  explícito y aviso al usuario ANTES.
- El SQL generado también cumple `sql-standards` (`VARCHAR` y no `NVARCHAR`, constraints con
  nombre): si el generador no lo respeta, se corrige a mano en la migración.

## 10. Checklist de repositorio nuevo

- [ ] ¿Devuelve material (`List<T>`, `T`, `bool`) y no `IQueryable`?
- [ ] ¿Las consultas de lectura llevan `AsNoTracking()` o proyectan a DTO?
- [ ] ¿Proyecta solo las columnas necesarias en vez de traer la entidad completa?
- [ ] ¿Propaga `CancellationToken` en todas las llamadas async?
- [ ] ¿Los listados tienen tope de servidor y `OrderBy` con desempate único?
- [ ] ¿Cero lógica de negocio y cero `Respuesta.Fault` con mensajes de negocio? (`cc-architecture` §5)
- [ ] ¿Todo SQL crudo está parametrizado?
