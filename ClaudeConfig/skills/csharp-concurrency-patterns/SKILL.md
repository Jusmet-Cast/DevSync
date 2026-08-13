---
name: csharp-concurrency-patterns
description: "Patrones de concurrencia en C#/.NET: async/await correcto, CancellationToken, manejo de Tasks, y antipatrones a evitar."
paths: "**/*.cs"
---

> ⚠️ **NOTA PARA EL AGENTE:** Los bloques de código son **SOLO ILUSTRATIVOS**. Nunca copies nombres de clases, métodos o variables de estos ejemplos al proyecto real. Adaptá siempre el patrón al código concreto que estás analizando.

## 1. async/await — Reglas Base

```csharp
// MAL - bloquea el thread pool, puede causar deadlock
var result = GetDataAsync().Result;
var result = GetDataAsync().GetAwaiter().GetResult();

// BIEN - async all the way down
var result = await GetDataAsync();
```

**Reglas:**
- Si una operación es async, **todo el call chain debe ser async** — nunca mezcles `.Result` o `.Wait()` salvo en `Main` o tests que lo requieran
- Nombrá los métodos async con sufijo `Async`: `GetUserAsync`, `SaveOrderAsync`
- Devolvé `Task` (no `void`) en métodos async — excepto event handlers donde `async void` es aceptable
- `async void` fuera de event handlers = bug silencioso esperando a explotar

## 2. CancellationToken — Siempre

```csharp
// MAL - operación no cancelable
public async Task<List<Order>> GetOrdersAsync()
{
    return await _db.Orders.ToListAsync();
}

// BIEN - cancelable y colaborativa
public async Task<List<Order>> GetOrdersAsync(CancellationToken ct = default)
{
    return await _db.Orders.ToListAsync(ct);
}
```

**Reglas:**
- Todo método async público **debe aceptar `CancellationToken`** como último parámetro
- Usá `ct = default` para que sea opcional en el caller
- Propagá el token a **todas** las llamadas internas async — no lo descartes a mitad del call chain
- En ASP.NET Core, obtenés el token desde `HttpContext.RequestAborted` o directo en el action parameter

## 3. ConfigureAwait

```csharp
// En librerías / código de infraestructura
var data = await _httpClient.GetStringAsync(url).ConfigureAwait(false);

// En código de aplicación ASP.NET Core / código que accede a HttpContext
var data = await GetDataAsync(); // sin ConfigureAwait - está bien
```

**Regla simple:**
- En **librerías reutilizables**: siempre `ConfigureAwait(false)` para evitar capturar el contexto de sincronización
- En **aplicaciones ASP.NET Core**: no necesitás `ConfigureAwait(false)` porque no hay SynchronizationContext

## 4. Task.WhenAll y Task.WhenAny

```csharp
// MAL - secuencial innecesario
var users = await GetUsersAsync(ct);
var orders = await GetOrdersAsync(ct);
var products = await GetProductsAsync(ct);

// BIEN - paralelo cuando son independientes
var (users, orders, products) = await (
    GetUsersAsync(ct),
    GetOrdersAsync(ct),
    GetProductsAsync(ct)
).WhenAll(); // o Task.WhenAll clásico

var usersTask = GetUsersAsync(ct);
var ordersTask = GetOrdersAsync(ct);
await Task.WhenAll(usersTask, ordersTask);
var users = await usersTask;
var orders = await ordersTask;
```

**Cuándo usarlo:**
- Las operaciones son **independientes entre sí**
- Todas las operaciones son necesarias (sino usá `Task.WhenAny`)
- Atención: si una tira excepción, `Task.WhenAll` esperará a que terminen todas antes de propagar

## 5. Antipatrones Clásicos a Detectar

| Antipatrón | Problema | Fix |
|---|---|---|
| `.Result` o `.Wait()` | Deadlock en contextos con SynchronizationContext | `await` |
| `async void` (no event) | Excepciones no capturables, no awaitable | `async Task` |
| `Task.Run` en ASP.NET Core | Mueve trabajo al thread pool innecesariamente | Solo para CPU-bound real |
| Fire-and-forget sin manejo | Excepciones silenciadas, pérdida de trabajo | Loggeá o usá un background service |
| CancellationToken ignorado | Operaciones que no responden a cancelación | Propagá el token |

## 6. Thread-Safety en Recursos Compartidos

```csharp
// Para contadores simples
private int _count = 0;
Interlocked.Increment(ref _count);

// Para colecciones concurrentes
private readonly ConcurrentDictionary<string, User> _cache = new();
_cache.TryAdd(key, user);
_cache.GetOrAdd(key, k => LoadUser(k));

// Para acceso exclusivo a secciones críticas
private readonly SemaphoreSlim _lock = new(1, 1);
await _lock.WaitAsync(ct);
try { /* sección crítica */ }
finally { _lock.Release(); }
```

**Regla:** Nunca uses `lock` en código async — bloqueás el thread. Usá `SemaphoreSlim` con `WaitAsync`.
