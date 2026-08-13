---
name: cc-domain-services
description: >
  Reglas para crear y ubicar Domain Services en C# / Clean Architecture.
  Cuándo crearlos, qué pueden recibir, qué deben retornar y qué está prohibido.
  Trigger: Domain Service, DomainService, validar lógica de negocio, lógica pura sin I/O,
  coordinación entre conceptos, validación cruzada entre entidades o DTOs.
license: Apache-2.0
metadata:
  author: madian-velasquez
  version: "1.0"
paths: "**/Domain/**/*.cs, **/Application/**/*.cs"
---

> ⚠️ **NOTA PARA EL AGENTE:** Los bloques de código son **SOLO ILUSTRATIVOS**. Nunca copies nombres de clases, métodos o propiedades de estos ejemplos al proyecto real. Adaptá el patrón al código concreto que estás analizando o generando.

## 1. ¿Cuándo crear un Domain Service?

Creá un Domain Service cuando la lógica cumple **todas** estas condiciones:

| Condición | Criterio |
|-----------|---------|
| (Puede variar en distintos escenarios) No pertenece a una entidad | El método no "suena natural" como método de ninguna entidad existente |
| No necesita I/O | No requiere consultar DB, llamar HTTP, leer archivos |
| No necesita DI | No necesita `IRepository`, `IService` ni ninguna abstracción inyectable |
| Coordina o valida | Valida datos, coordina resultados de múltiples fuentes, o enriquece un DTO | Valida logica de negocio de un o varios ApplicationService

**Señales concretas de que necesitás un Domain Service:**
- Una validación involucra 2+ conceptos distintos (ej: validar un carnet contra una aseguradora)
- Necesitás orquestar el resultado de múltiples queries ya ejecutadas
- Tenés lógica de transformación/enriquecimiento pura (ej: aplicar máscara a celular según país)
- El Application Service empieza a crecer con métodos privados de validación — extraerlos al Domain Service

## 2. Reglas Absolutas

### 2.1 NUNCA inyectar dependencias

```csharp
// ❌ MAL — nunca DI en un DomainService
public class PedidoDomainService
{
    private readonly IPedidoRepository _repo;  // PROHIBIDO
    public PedidoDomainService(IPedidoRepository repo) { ... }  // PROHIBIDO
}

// ✅ BIEN — sin constructor, sin inyecciones
public class PedidoDomainService
{
    public Respuesta<bool> ValidarPedido(PedidoDto pedido) { ... }
}
```

**Regla**: Si la lógica necesita consultar una dependencia, la consulta la hace el **Application Service** y le pasa el resultado ya resuelto al Domain Service. El Domain Service nunca sabe de dónde vino la data.

### 2.2 NUNCA hacer I/O — el Application Service trae la data primero

Si el Domain Service necesita datos de una dependencia (repositorio, servicio externo, etc.), el flujo correcto es:

1. **Application Service** hace el I/O (llama al repo, al HTTP client, etc.)
2. **Application Service** pasa el resultado ya obtenido como parámetro al Domain Service
3. **Domain Service** trabaja solo con lo que recibió — sin saber de dónde vino

```csharp
// ❌ MAL — el Domain Service hace I/O directamente
public Respuesta<bool> ValidarStock(int productoId)
{
    var stock = _stockRepo.ObtenerPorId(productoId);  // PROHIBIDO — I/O adentro
    return stock > 0 ? Respuesta<bool>.Success() : Respuesta<bool>.Fault(ApplicationMessage.SinStock);
}

// ✅ BIEN — el AppService trae la data, el DomainService solo valida
// En el Application Service:
var stockResult = await _stockRepo.ObtenerPorIdAsync(productoId, ct);
var validacion = _domainService.ValidarStock(stockResult);

// En el Domain Service:
public Respuesta<bool> ValidarStock(Respuesta<StockDto> stockResult)
{
    if (!stockResult.Ok) return Respuesta<bool>.Fault(stockResult.Mensaje);
    if (stockResult.Data is null || stockResult.Data.Cantidad <= 0)
        return Respuesta<bool>.Fault(ApplicationMessage.SinStock);
    return Respuesta<bool>.Success(true);
}
```

### 2.3 Mensajes de error: siempre constantes

```csharp
// ❌ MAL — string literal hardcodeado
return Respuesta<bool>.Fault("El carnet no tiene aseguradora asignada.");

// ✅ BIEN — constante de ApplicationMessage / Mensajes.cs
return Respuesta<bool>.Fault(ApplicationMessage.MSCR_023);
```

## 3. Parámetros: DTOs, Entidades y primitivos son todos válidos

La regla no es "solo entidades" ni "solo DTOs". La regla es: **aceptá lo que ya existe en el call site del Application Service**.
Pero preferiblemente que siempre procure mandar entidades o tipos de datos que no sean objetos (siempre habran excepciones, claro).

```csharp
// ✅ BIEN — acepta Entity (viene de la DB)
public Respuesta<bool> ValidarDireccion(DatosPersonalesDirecciones direccion) { ... }

// ✅ BIEN — acepta DTO (viene del request o de otra query)
public Respuesta<bool> ValidarAseguradora(CarnetFormDto carnetForm) { ... }

// ✅ BIEN — acepta Respuesta<T> directamente (resultado de otro service)
public Respuesta<List<PaisDto>> ValidarPaises(Respuesta<List<PaisDto>> paisesResult) { ... }

// ✅ BIEN — acepta primitivos cuando aplica
public Respuesta<bool> ValidarIds(int direccionId, int usuarioId) { ... }
```

## 4. Tipos de retorno

| Escenario | Retorno recomendado |
|-----------|---------------------|
| Validación pura (ok/fail) | `Respuesta<bool>` |
| Transformación / enriquecimiento | `Respuesta<TDto>` con el DTO modificado |
| Coordinar resultado de múltiples fuentes | `Respuesta<TDto>` con el dato final ensamblado |
| Método auxiliar interno sin error handling | `void` o tipo primitivo (private/static) |
** No siempre el tipo de retorno sera `Respuesta` esto va a variar de la api en que se trabaje, a veces incluso solo se necesitara un `bool`.
```csharp
// ✅ Validación
public Respuesta<bool> ValidarDatosParaGuardar(DireccionDto datos) { ... }

// ✅ Enriquecimiento
public Respuesta<PerfilDto> ObtenerPerfilEnriquecido(
    Respuesta<PerfilDto> perfilResult,
    Respuesta<List<PaisDto>> paisesResult) { ... }
```

## 5. Static vs Instancia

| Usar `static class` | Usar clase instancia |
|---------------------|----------------------|
| Todos los métodos son independientes entre sí | Algún método privado reutiliza estado interno mínimo |
| No hay estado compartido | Los métodos se llaman en cadena con datos compartidos |
| Los métodos son utilidades puras | El service actúa como "flujo de validación" cohesivo |

```csharp
// ✅ static — todos los métodos son puros e independientes
public static class CarnetDomainService
{
    private const int MAX_ARCHIVOS = 2;  // ✅ constante de negocio: sí va aquí

    public static Respuesta<bool> ValidarAseguradora(CarnetFormDto form) { ... }
    public static Respuesta<bool> ValidarArchivos(List<string> archivos) { ... }
}

// ✅ instancia — métodos se coordinan entre sí con datos compartidos
public class PerfilDomainService
{
    public Respuesta<PerfilDto> ObtenerPerfil(...) { ... }
    public static Respuesta<string> GetCelularEnmascarado(...) { ... }  // auxiliar static
}
```

## 6. Ubicación y Naming

**Naming**: siempre `{Feature}DomainService`.

**Ubicación**: **antes de crear, buscá en el proyecto si hay otros DomainService para seguir el mismo patrón de carpetas**.

Patrones habituales en este proyecto:

```
// Patrón 1 — mismo folder que el AppService
Application/Features/{Feature}/
├── {Feature}Service.cs
├── {Feature}DomainService.cs     ← acá
└── Dtos/

// Patrón 2 — subfolder Services/ cuando hay múltiples services
Application/Features/{Feature}/Services/
├── {Feature}AppService.cs
├── {Feature}DomainService.cs     ← acá
└── Dtos/
```

**SIEMPRE** buscar otros `*DomainService.cs` o `ServiceDomain` en el proyecto para determinar qué patrón usar. No inventar rutas nuevas.

## 7. Flujo típico: Application Service → Domain Service

```csharp
// ✅ Patrón correcto de uso desde el AppService
public async Task<Respuesta<DireccionDto>> ActualizarAsync(DireccionDto dto)
{
    // 1. El AppService hace el I/O
    var entidad = await _repo.ObtenerPorIdAsync(dto.DireccionId, ct);

    // 2. El DomainService valida la lógica de negocio (sin I/O)
    var validacion = _domainService.ValidarDatosParaActualizar(dto);
    if (!validacion.Ok)
        return Respuesta<DireccionDto>.Fault(validacion.Mensaje);

    // 3. El AppService persiste
    await _repo.ActualizarAsync(entidad, ct);
    return Respuesta<DireccionDto>.Success(dto);
}
```

## 8. Checklist antes de crear un Domain Service

- [ ] La lógica no encaja en ninguna entidad existente
- [ ] No requiere DI (ningún `IAlgo` en constructor)
- [ ] No hace I/O (no llama DB, HTTP, filesystem)
- [ ] Los mensajes de error usan constantes de `ApplicationMessage` / `Mensajes.cs` / O la clase de mensajes ya creada en la api
- [ ] Busqué otros `*DomainService.cs` / `ServiceDomain`  en el proyecto para respetar la ubicación
- [ ] El nombre sigue el patrón `{Feature}DomainService`
