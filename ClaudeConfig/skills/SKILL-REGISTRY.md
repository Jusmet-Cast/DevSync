# Skill Registry — Stack C# / Angular

**Solo para el orquestador.** El `dev-orchestrator` (y cualquier subagente que a su vez delegue)
lee este registry para resolver compact rules de **skills de STACK** e inyectarlas en el prompt de
invocación. Los sub-agentes `sdd-*` NO leen este registry — reciben las reglas pre-digeridas.

> ⚠️ **Dos canales distintos, no los mezcles:**
>
> | Tipo de skill | Cómo llega al sub-agente | Por qué |
> |---|---|---|
> | **Stack** (`cc-*`, `csharp-*`, `angular-*`, `sql-*`, `typescript-*`, `dotnet-*`, `efcore-*`) | El orquestador las resuelve de este registry e inyecta las compact rules en el prompt | Dependen de la tecnología del change: no se pueden fijar de antemano |
> | **Metodología** (`sdd-*-protocol`) | Precargadas vía el campo `skills:` del frontmatter de cada `sdd-*.md` | Son agnósticas de stack: definen CÓMO trabaja cada fase, no qué tecnología usa |
>
> Las skills de stack además declaran `paths:`, así que se autoactivan al tocar archivos que
> matcheen aunque nadie las inyecte. La inyección del orquestador es el refuerzo, no el único canal.

> Las skills específicas de un proyecto puntual (ej. un `angular-new-feature` propio de un repo
> Angular, o skills de dominio de una app concreta) no viven en este registry global — si se
> necesitan, van en `.claude/skills/` a nivel de ESE proyecto y se resuelven igual.

---

## User Skills — Coding Standards

| Trigger | Skill | Path |
|---------|-------|------|
| Web API, controllers, endpoints, minimal API, rutas HTTP, parámetros de ruta/query | cc-architecture | `~/.claude/skills/cc-architecture/SKILL.md` |
| Complejidad ciclomática, cognitive complexity, if/else anidados, métodos largos, refactor, crear método, modificar método, editar service/repository/controller C# | cc-complexity | `~/.claude/skills/cc-complexity/SKILL.md` |
| Nombres de clases, métodos, variables, interfaces, formato Allman, convenciones C# | cc-naming | `~/.claude/skills/cc-naming/SKILL.md` |
| SOLID, SRP, OCP, LSP, ISP, DIP, diseño de clases e interfaces, herencia vs composición | cc-solid | `~/.claude/skills/cc-solid/SKILL.md` |
| Performance, Span<T>, Memory<T>, record, value objects, nullable, C# moderno, APIs públicas | csharp-coding-standards | `~/.claude/skills/csharp-coding-standards/SKILL.md` |
| SQL, CREATE TABLE, ALTER TABLE, queries, INSERT, UPDATE, stored procedures, views, scripts de migración, seed data, tipos de datos SQL | sql-standards | `~/.claude/skills/sql-standards/SKILL.md` |
| async/await, Task, CancellationToken, deadlock, concurrencia, hilos, parallel, race condition | csharp-concurrency-patterns | `~/.claude/skills/csharp-concurrency-patterns/SKILL.md` |
| Angular standalone components, signals, inject(), control flow (@if/@for), zoneless, OnPush, DestroyRef, input/output functions, computed(), effect(), RxJS + toSignal() | angular-core | `~/.claude/skills/angular-core/SKILL.md` |
| NgOptimizedImage, @defer, lazy routes, loadComponent, loadChildren, SSR, hydration, Angular performance optimization | angular-performance | `~/.claude/skills/angular-performance/SKILL.md` |
| HttpInterceptorFn, interceptors funcionales, JWT auth, refresh token 401/403, PLATFORM_ID, SSR guard, AuthService | angular-interceptors-auth | `~/.claude/skills/angular-interceptors-auth/SKILL.md` |
| Revisión código existente, deuda técnica, code smells, Long Method, God Class, Primitive Obsession, refactorizar C# | csharp-refactoring | `~/.claude/skills/csharp-refactoring/SKILL.md` |
| Domain Service, DomainService, validar lógica de negocio, lógica pura sin I/O, coordinación entre entidades o DTOs, validación cruzada, cuándo crear un domain service | cc-domain-services | `~/.claude/skills/cc-domain-services/SKILL.md` |
| XSS, CSRF, CSP, OWASP, tokens JWT, cookies httpOnly, Core Web Vitals, skeleton screens, optimistic UI, seguridad frontend | frontend-security-performance | `~/.claude/skills/frontend-security-performance/SKILL.md` |
| Crear/modificar formulario, validación de inputs, mensajes de error, labels, wizard multi-paso, accesibilidad de forms (WCAG) — agnóstico de framework | ux-forms | `~/.claude/skills/ux-forms/SKILL.md` |
| Armar formulario desde cero, validación duplicada cliente/servidor, componente Field reusable, schema-first, autosave/draft, debounce en validación async — agnóstico de framework | ux-forms-velocity | `~/.claude/skills/ux-forms-velocity/SKILL.md` |
| Tipos complejos TypeScript, ReturnType, generics, utility types, as const, type guards, satisfies, discriminated unions | typescript-advanced | `~/.claude/skills/typescript-advanced/SKILL.md` |
| Endpoint nuevo, JWT del lado servidor, authorization policy, IDOR, SQL injection, mass assignment, secretos, manejo de excepciones en API | dotnet-api-security | `~/.claude/skills/dotnet-api-security/SKILL.md` |
| Repositorio, query LINQ, EF Core, Dapper, N+1, AsNoTracking, paginado, migraciones, performance de consultas | efcore-data-access | `~/.claude/skills/efcore-data-access/SKILL.md` |

## Skills de Metodología (NO se inyectan por prompt)

Precargadas vía el campo `skills:` del frontmatter de cada sub-agente. Listadas acá solo como
referencia humana — el orquestador **no** las resuelve ni las copia.

| Skill | La precarga | Qué define |
|-------|-------------|------------|
| `sdd-verification-protocol` | `sdd-verify` | Matriz de compliance, clasificación de hallazgos, veredicto, escalamiento a Judgment Day |
| `sdd-design-protocol` | `sdd-design` | Cómo documentar decisiones (elegido + rechazado), tabla de archivos, cuándo va diagrama |
| `sdd-spec-protocol` | `sdd-spec` | RFC 2119 con intención, Given/When/Then verificable, cobertura mínima |
| `sdd-artifact-protocol` | **todos** los `sdd-*` + orquestador | `state.md`, `Assumptions & Open Questions`, persistencia y recovery |

## Skills Invocables por el Usuario (`/comando`)

No se auto-cargan (`disable-model-invocation: true`) — las disparás vos.

| Comando | Qué hace |
|---------|----------|
| `/sdd-status` | Estado del flujo SDD del proyecto: changes abiertos, fase, progreso de tasks, preguntas pendientes |
| `/arch-review` | Auditoría de Clean Architecture sobre el diff actual, con severidades y regla violada |
| `/workshop-material` | Material de taller a partir de las skills del ecosistema |
| `/tdd` | Ciclo estricto red-green-refactor con gates (verifica primero que haya harness de tests) |
| `/form-audit` | Audita un formulario web contra la API real con Playwright MCP: contrato de la respuesta, 9 respuestas rotas provocadas con mocks, loops infinitos y `[object Object]` |

## User Skills — Foundation (Workflow / Meta)

| Trigger | Skill | Path |
|---------|-------|------|
| Crear PR, abrir pull request, preparar branch para review, naming de branches, conventional commits | branch-pr | `~/.claude/skills/branch-pr/SKILL.md` |
| "judgment day", "review adversarial", "doble review", "que lo juzguen" — review paralelo con dos jueces independientes | judgment-day | `~/.claude/skills/judgment-day/SKILL.md` |

---

## Compact Rules

Reglas pre-digeridas. El orquestador copia los bloques relevantes en el prompt de cada
sub-agente como `## Project Standards (auto-resolved)`.

### cc-architecture
- Nunca lógica de negocio en controllers — solo coordinación: HTTP → Application → Response
- Parámetros de query/body en objetos tipados (class con sufijo `Dto`), no como parámetros sueltos
- Sin números mágicos — siempre constantes con nombre o enums descriptivos
- Web API devuelve `ActionResult<T>` o `IActionResult`, nunca tipos concretos directamente
- Separación estricta: Presentation → Application → Domain → Infrastructure
- Handlers de Application NO dependen de `HttpContext`, `HttpRequest` ni nada de HTTP
- Validaciones de entrada en capa Application (FluentValidation o DataAnnotations), no en controllers
- Parámetros opcionales con valor por defecto explícito en los objetos de request
- Los endpoints deben ser delgados: máximo 3-5 líneas antes de delegar al handler
- Métodos con más de 4 parámetros → crear un `public class` con sufijo `Dto` y propiedades `{ get; set; }`; ubicarlo en `Features/{Feature}/{SubFeature}/Dtos/`; un archivo individual por cada clase; NUNCA en el mismo archivo del service; NUNCA usar `record` para DTOs
- NUNCA strings literales hardcodeados en services — todos los mensajes van en `Common/Mensajes.cs` (static class `public const string`); si no existe en la API, crearla; usar `string.Format(Mensajes.Constante, param1)` para mensajes con parámetros; naming PascalCase agrupado por feature: `BonosSinDatos`, `ValesErrorCrear`
- Todo AppService DEBE tener su interfaz `I{NombreService}` declarada en el mismo folder del service; la interfaz expone solo los métodos públicos
- NUNCA exponer nombres de columnas, tablas o vistas de la base de datos como valores de parámetros en la API pública (query strings, body, headers) — esto es information disclosure del esquema interno; aplica especialmente a parámetros de ordenamiento (`orderBy`, `ordenCampo`, `sortBy`), filtrado y proyección
- Para conjuntos cerrados de opciones (sort fields, filter fields, status): usar `enum` con nombres semánticos PascalCase (`Descripcion`, `Precio`), NUNCA naming de DB (`art_Desc`, `art_precio`); si se detecta un string con forma de columna (prefijo corto + underscore, tipo `xxx_campo`) o underscores SQL, refactorizar inmediatamente a enum

### cc-complexity
- Complejidad ciclomática máxima de 10 por método; refactorizar si supera ese umbral
- Nunca más de 3 niveles de indentación — extraer método o usar guard clauses
- Reemplazar cadenas if/else if por switch expressions o diccionarios de estrategia
- Un método hace UNA sola cosa — si necesitás "y" para describirlo, dividirlo
- Early return (guard clauses) para validaciones: validar, retornar o lanzar, no continuar
- Complejidad cognitiva máxima de 15 por método (SonarQube)
- Preferir composición de funciones pequeñas sobre un método monolítico
- NUNCA ifs anidados que puedan mergearse con `&&` — SonarQube los detecta como "Merge this if statement with the enclosing one"
- Constructores con >7 parámetros → crear `{ServiceName}Options` class con propiedades `required init`; registrar en DI con factory lambda `services.AddTransient(sp => new XOptions { ... })`; el service recibe UN solo parámetro Options

### cc-naming
- Interfaces con prefijo `I`: `IUserRepository`, `IOrderService`
- Clases abstractas con sufijo `Base`: `RepositoryBase<T>`, `HandlerBase`
- Métodos async con sufijo `Async`: `GetUserAsync`, `SaveOrderAsync`
- Variables booleanas con prefijo `is`/`has`/`can`: `isActive`, `hasPermission`, `canDelete`
- Formato Allman: llaves SIEMPRE en línea nueva (también en if/for de una sola línea en C#)
- PascalCase: clases, métodos, propiedades, eventos; camelCase: variables locales y parámetros
- Sin abreviaciones crípticas — nombres completos y descriptivos (`userId`, no `uid`)
- Constantes en PascalCase en C# moderno; evitar UPPER_SNAKE_CASE salvo enum flags
- Sufijo `*Dto` OBLIGATORIO para objetos de transferencia; NUNCA `*Request`, `*Response`, `*Params`, `*Model`, `*Input`
- DTOs son PUROS: solo propiedades `{ get; set; }` — NUNCA métodos, NUNCA lógica en setters/getters, NUNCA propiedades calculadas condicionales

### cc-solid
- SRP: cada clase tiene UNA razón para cambiar — si usás "y" en la descripción, dividir
- OCP: extender con herencia o composición, nunca modificar código ya testeado
- LSP: los subtipos DEBEN sustituir al tipo base sin cambiar el comportamiento observable
- ISP: interfaces pequeñas y específicas — sin `NotImplementedException` ni métodos vacíos
- DIP: depender de abstracciones (interfaces), inyectar vía constructor (no service locator)
- Preferir composición sobre herencia para comportamiento compartido
- Repositorios siempre detrás de interfaces — nunca `DbContext` directo desde Application

### csharp-coding-standards
- Usar `record` para value objects y DTOs inmutables: `record UserId(Guid Value)`
- `Span<T>` y `Memory<T>` para operaciones sobre buffers sin allocations heap
- Preferir pattern matching moderno: switch expressions, property patterns, positional patterns
- `sealed` en clases cuando no hay herencia planeada — elimina overhead de vtable
- Nullable reference types HABILITADO — nunca operador `!` sin justificación en comentario
- `required` modifier para propiedades obligatorias en records/classes (C# 11+)
- Expresiones de colección (C# 12): `[item1, item2]` en vez de `new List<T> { ... }`
- Evitar LINQ en hot paths — preferir bucles con Span o List directo para performance crítica
- NUNCA usar query syntax LINQ (`from ... in`), SIEMPRE lambda syntax (`.Where()`, `.Select()`)
- Todo AppService DEBE inyectar `ILogger<T>` vía constructor (`ILogger<NombreDelService> logger`); en el catch llamar `_logger.LogError(ex, "Descripción corta {Param}", valorParam)`; NUNCA `LogInformation`/`LogWarning`/`LogDebug` en catches — solo `LogError`; NUNCA retornar `ex.Message` al cliente — usar constante genérica de `Mensajes.cs`; verificar primero si otros services del proyecto ya usan `ILogger` para respetar el mismo patrón
- NUNCA instanciar `new JsonSerializerOptions` por cada llamada — cachear como `private static readonly` field; reusar la misma instancia en toda la clase
- Usar `[GeneratedRegex("pattern")]` con clase `partial` en vez de `new Regex(pattern, RegexOptions.Compiled)` — compile-time regex genera código optimizado sin allocations en runtime
- Preferir métodos estáticos de criptografía (`SHA256.HashData(data)`) sobre instanciar `SHA256.Create()` + `.ComputeHash()` — elimina `using`/`Dispose` y es más performante
- NUNCA usar `.First()`, `.Last()`, `.ElementAt()` en colecciones indexables (List, Array, IReadOnlyList) — usar indexador directo `[0]`, `[^1]`, o `ToDictionary` + `TryGetValue` para lookups repetidos; Roslyn analyzer CA1826

### sql-standards
- NUNCA `NVARCHAR` ni `NCHAR` ni `NTEXT` — SIEMPRE `VARCHAR`, `CHAR`, `VARCHAR(MAX)`
- NUNCA prefijo `N` en literales de texto: `'Bronce'` no `N'Bronce'`
- `DECIMAL(p,s)` para montos y porcentajes — nunca `FLOAT` ni `REAL`
- `BIT` para booleanos — nunca `TINYINT` como sustituto
- Columnas `Activo BIT NOT NULL` siempre con `CONSTRAINT [DF_Tabla_Activo] DEFAULT 1`
- PKs: `[NombreTablaEnSingular]Id`, constraints con nombre explícito siempre
- Keywords SQL en UPPERCASE; nunca `SELECT *`; alias explícito en JOINs

### csharp-concurrency-patterns
- SIEMPRE propagar `CancellationToken` hasta el fondo de la cadena async
- NUNCA `.Result` ni `.Wait()` — siempre `await`; provoca deadlock en contextos sincronizados
- `ConfigureAwait(false)` en código de librería/infraestructura, NO en controllers ni application
- NUNCA `async void` — siempre `async Task` o `async Task<T>` (salvo event handlers UI)
- `SemaphoreSlim` para mutual exclusion en async, nunca `lock {}` con await adentro
- `Task.WhenAll` para operaciones paralelas independientes, no loops de `await` secuencial
- `IAsyncEnumerable<T>` para streaming de colecciones grandes, no cargar todo en memoria

### angular-core
- Components are standalone by default — do NOT set `standalone: true` explicitly
- Input/Output MUST use function-based API: `input()`, `input.required()`, `output()`, `model()` — NEVER `@Input()`/`@Output()` decorators
- State MUST use signals: `signal()`, `computed()`, `effect()` — NO `ngOnInit`/`ngOnChanges`/`ngOnDestroy`
- Dependency injection via `inject()` — NEVER constructor injection
- Template control flow via `@if`/`@for`/`@switch` — NEVER `*ngIf`/`*ngFor`
- App MUST be zoneless: `provideZonelessChangeDetection()` — remove zone.js
- Cleanup via `DestroyRef` + `inject()`, NOT `ngOnDestroy`
- RxJS only for complex async (debounce, streams, race conditions) — signals for everything else
- Convert observables to signals with `toSignal()` for template use

### angular-performance
- Images MUST use `NgOptimizedImage` with `ngSrc`, explicit `width`+`height` (or `fill`), `priority` on LCP image
- Heavy/below-fold components MUST use `@defer` with appropriate trigger (on viewport, on interaction, on idle)
- Routes MUST use `loadComponent` (single) or `loadChildren` (feature) for lazy loading — NEVER eagerly import feature components
- SEO-critical pages require SSR + `provideClientHydration()`
- NEVER trigger reflows/repaints in lifecycle hooks
- Heavy computations → `computed()` signals or pure pipes for memoization

### angular-interceptors-auth
- Usar `HttpInterceptorFn` funcional — NUNCA clase con `implements HttpInterceptor` (deprecado)
- SIEMPRE verificar `isPlatformServer(platformId)` antes de acceder a `localStorage`/`window`/`document`
- El interceptor accede al token VÍA `authService.getToken()` — NUNCA `localStorage` directo
- `AuthService` centraliza `getToken()` (public), `setToken()` (private), `getRefreshToken()` (private)
- Refresh en 401/403: `authService.refreshToken()` ya persiste el token — el interceptor solo reintenta la request
- Un interceptor = una responsabilidad — no mezclar auth + logging + error handling en el mismo
- Registrar en `app.config.ts` con `withFetch()` + `withInterceptors([...])`

### csharp-refactoring
- Long Method (>30-40 líneas o comentarios que dividen secciones): Extract Method
- God Class (>5 inyecciones, nombre genérico `Manager`/`Helper`, >500 líneas): Extract Class
- Primitive Obsession: encapsular en Value Objects con `record` — `CustomerId`, `Money`, etc.
- Feature Envy: mover la lógica a la clase donde viven los datos
- Magic Numbers/Strings: extraer a `const` o `enum` con nombre descriptivo
- Refactoring seguro: tests primero → pasos pequeños → correr tests → revertir si falla
- Boy Scout Rule: dejar el código un poco mejor de como lo encontraste
- `object`/`dynamic` sin tipo concreto → tipado fuerte

### frontend-security-performance
- XSS: NUNCA `element.innerHTML = userInput` — usar `textContent` o `DomPurify.sanitize()`
- Angular escapa `{{ userInput }}` automáticamente; `[innerHTML]` requiere `DomSanitizer`
- CSRF: cookies con `sameSite: 'strict'`, `httpOnly: true`, `secure: true`
- JWT storage: decisión centralizada en `AuthService` — ver `angular-interceptors-auth`
- Skeleton Screen: `toSignal()` + `computed()` — NUNCA `effect()+subscribe` (anti-pattern, leak garantizado)
- Optimistic UI: actualizar UI antes de confirmar con servidor, revertir en `catch` — solo acciones no críticas
- LCP: atributo `priority` en imagen principal; reservar espacio con `aspect-ratio` para evitar CLS

### ux-forms
- Validación: `on blur` por default, `on change` solo para feedback positivo, `on submit` para validación cruzada/servidor — NUNCA marcar error en un campo que el usuario todavía no tocó
- Label SIEMPRE visible y asociado programáticamente al input — placeholder es solo ejemplo de formato, nunca reemplazo del label
- Error específico y ubicado junto al campo, nunca solo por color — acompañar con `aria-invalid` + `aria-describedby`
- Al fallar el submit, mover el foco al primer campo con error
- `autocomplete` con token correcto (`email`, `given-name`, `tel`, etc.) — requisito WCAG 1.3.5
- Campos relacionados agrupados en `fieldset`/`legend` o equivalente semántico; bloques de 5-7 campos (Ley de Miller)
- Botón de submit: deshabilitado + loading DURANTE el submit, siempre, sin excepción — previene doble submit
- Wizard multi-paso: mostrar progreso, persistir datos de pasos previos, validar cada paso antes de avanzar
- Mobile: `type`/`inputmode` correcto para teclado nativo, una sola columna de campos

### ux-forms-velocity
- Schema-first: UN schema declarativo por formulario (reglas + mensajes) como única fuente de verdad — nunca validación repetida en template + componente + backend sin schema compartido
- Componente `Field` genérico config-driven en vez de un componente por campo — señal de que hace falta: tercer campo copy-pasteado con el mismo boilerplate
- Catálogo de estados obligatorio por formulario: `idle` / `validating` / `submitting` / `success` / `error` / `disabled` — nunca colapsar todo a un boolean `hasError`
- Autosave/draft solo en formularios largos o con costo real de perder progreso — nunca en datos sensibles (pagos, contraseñas)
- Validación async (username/email disponible) SIEMPRE con debounce (300-500ms) + cancelación de la validación anterior si el valor cambió
- Mensajes de error en catálogo central (constantes o claves i18n), nunca strings hardcodeados repetidos por campo

### typescript-advanced
- `as const` para constantes literales e inmutables — preferir sobre enums para strings de configuración
- `ReturnType<typeof fn>` para inferir tipos de retorno — evita duplicar interfaces
- Discriminated unions (`status: 'success' | 'error' | 'loading'`) para estados de API en templates
- `satisfies` (TS 4.9+): valida la forma del objeto SIN perder el tipo literal más específico
- Generics con `extends` para restringir los tipos aceptados por funciones/servicios genéricos
- `Partial<T>` para PATCH/updates, `Pick`/`Omit` para DTOs y ViewModels, `NonNullable<T>` con datos de API
- NUNCA `any` — `unknown` + type guard cuando el tipo es genuinamente desconocido

### branch-pr
- El agente NUNCA ejecuta `git commit/push/merge/rebase/cherry-pick` en repos de proyecto — prepara el working tree y el humano ejecuta (bloqueado por el hook `git-guard.js`)
- Branch naming: `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)/[a-z0-9._-]+$`
- Conventional commits obligatorio: `type(scope): subject` en imperativo, ≤72 chars — sin AI attribution / Co-Authored-By
- Un commit = un cambio coherente; si el asunto necesita "y", son dos commits
- El cuerpo del commit explica el POR QUÉ, no el qué (el qué ya está en el diff)
- Antes de entregar: diff revisado sin código comentado ni secretos, formato aplicado, tests en verde si existen
- Entregar siempre: resumen + archivos por responsabilidad + mensaje de commit propuesto + lo que quedó fuera de scope

### dotnet-api-security
- JWT: `ValidateIssuer` + `ValidateAudience` + `ValidateLifetime` SIEMPRE explícitos en `true`; `ClockSkew` ≤ 1 min (el default son 5 minutos de gracia)
- El identificador del propietario (usuario/sucursal/empresa) sale SIEMPRE del token, NUNCA de un parámetro del request
- El filtro de pertenencia va DENTRO de la query, no como `if` después de traer el dato — recurso ajeno responde 404, nunca 403 (un 403 confirma que el ID existe)
- `[Authorize(Policy = ...)]` con constantes nombradas, nunca `[Authorize]` pelado; endpoints públicos con `[AllowAnonymous]` explícito
- NUNCA concatenar ni interpolar en `FromSqlRaw`/`ExecuteSqlRaw`/`CommandText` — usar parámetros, o `FromSqlInterpolated` (que sí parametriza)
- Nombres de tabla/columna no se parametrizan: si vienen del cliente, mapear con `enum` + switch expression
- NUNCA recibir una entidad de dominio en el body — DTO con solo los campos editables (mass assignment)
- NUNCA devolver `ex.Message`/`ex.StackTrace` al cliente: detalle al log con `LogError`, mensaje genérico desde `Mensajes.cs`
- Login: mismo mensaje para "usuario inexistente" y "contraseña incorrecta" (enumeración de usuarios)
- Secreto hardcodeado detectado → PARAR y avisar; un secreto que estuvo en git ya está comprometido y hay que rotarlo

### efcore-data-access
- Lazy loading DESHABILITADO — es la causa raíz del N+1 y es invisible al leer el código
- Un `foreach` sobre entidades que accede a una propiedad de navegación es SIEMPRE sospechoso de N+1
- Toda query de solo lectura lleva `AsNoTracking()` (redundante si ya proyectás a DTO con `Select()`)
- El repositorio NUNCA devuelve `IQueryable` — retorna `List<T>`, `T`, `bool` o `null` (fuga de abstracción)
- Proyectar con `Select()` a DTO en vez de traer la entidad completa
- Propagar `CancellationToken` en TODAS las llamadas async de EF
- Listados: tope máximo del SERVIDOR (no del cliente) + `OrderBy` con desempate por clave única (sin ORDER BY, `Skip/Take` no es determinístico)
- Existencia con `AnyAsync()`, nunca `CountAsync() > 0` ni `FirstOrDefaultAsync() != null`
- No envolver un solo `SaveChangesAsync` en transacción explícita — ya es atómico; nada de HTTP ni mails dentro de una transacción
- Bajar a Dapper solo con perfilado que lo justifique, siempre parametrizado y dentro de Infrastructure
- Migración generada = migración revisada; el SQL también cumple `sql-standards` (`VARCHAR`, constraints con nombre)

### judgment-day
- Es un LANZADOR: el protocolo vive en el agente `judgment-day` (`agents/judgment-day.md`)
- SIEMPRE lanzar DOS jueces `jd-judge` en PARALELO (nunca secuencial) — vía el tool `Agent`
- Los jueces NO se conocen entre sí (review ciego e independiente)
- El orquestador NO hace el review — solo coordina y sintetiza veredictos
- Inyectar las mismas Project Standards en ambos jueces + en el Fix Agent
- Cada hallazgo se clasifica MECANICO o DISENIO; si los jueces discrepan en la clase, gana DISENIO
- Solo los MECANICOS van a jd-fixer. Los DISENIO vuelven como NEEDS_DECISION → decide el humano
- Un gap de arquitectura NUNCA va al fixer: lo parchea y la deuda cruza el gate como aprobada
- Máximo 2 iteraciones (review → fix → re-review) — escalá si no convergen
- Útil cuando el costo de un bug en prod > costo de dos rondas de review

### form-audit
- Requiere el MCP `playwright` registrado y la app **ya corriendo** — el agente NO la levanta
- Cruzar SIEMPRE tres fuentes: request enviado, body real de la respuesta, y snapshot renderizado.
  El bug vive en el DESACUERDO entre la respuesta y lo que se muestra, no en ninguna por separado
- Las respuestas rotas se PROVOCAN con `browser_route` (status + body + contentType), no se esperan
- `browser_unroute` después de CADA escenario: un route colgado hace mentir al siguiente caso
- Loops: `browser_network_requests` con `filter` — el mismo endpoint repetido N veces ES la evidencia
- Strings que delatan en el snapshot: `[object Object]`, `[object Promise]`, `undefined`, `null`, `NaN`
- Loop de refresh en 401 → cargar `angular-interceptors-auth`, ahí está el patrón de corte
- Snapshots y listas de red son verbosos: usar el parámetro `filename` y grepear, no volcar al contexto
- Se reporta, NO se arregla. Un hallazgo sin repro exacto no es un hallazgo

### cc-domain-services
- Crear DomainService cuando la lógica de validación/coordinación no pertenece naturalmente a ninguna entidad y no requiere I/O
- NUNCA inyectar dependencias en DomainService — sin constructor, sin IRepository, sin IService — ninguna abstracción inyectable
- NUNCA hacer I/O en el DomainService — si necesitás data de un repo o servicio externo: el AppService hace la consulta primero y le pasa el resultado ya resuelto como parámetro al DomainService
- Aceptar DTOs, Entidades o primitivos como parámetros — lo que ya esté disponible en el call site del AppService
- Retornar `Respuesta<T>` o `Respuesta<bool>` para validaciones; `Respuesta<TDto>` para enriquecimiento/transformación
- Puede ser `static class` si todos los métodos son puros e independientes; clase instancia si los métodos se coordinan entre sí
- Naming: `{Feature}DomainService` — SIEMPRE buscar otros `*DomainService.cs` en el proyecto antes de decidir la ubicación
- Ubicación: mismo folder que el AppService (`Application/Features/{Feature}/`) o en `Services/` subfolder — seguir el patrón existente
- Mensajes de error: SIEMPRE usar constantes de `ApplicationMessage` / `Mensajes.cs` — nunca strings literales hardcodeados
- Señales para crear uno: validación cruzada entre 2+ conceptos, orquestar resultados de múltiples queries ya ejecutadas, transformar/enriquecer datos sin I/O

---

## Tabla de Resolución por Fase SDD

El orquestador usa esta tabla para decidir qué compact rules inyectar en cada sub-agente.

| Fase / Tipo de tarea | Skills a inyectar |
|----------------------|-------------------|
| `sdd-init` | _(ninguna — solo detección de stack)_ |
| `sdd-explore` | _(ninguna — solo análisis, no implementación)_ |
| `sdd-propose` (backend C#) | `cc-architecture` + `cc-solid` |
| `sdd-propose` (frontend Angular) | `angular-core` + `angular-performance` |
| `sdd-spec` (backend C#) | `cc-architecture` + `cc-solid` |
| `sdd-spec` (frontend Angular) | `angular-core` + `typescript-advanced` |
| `sdd-design` (backend C#) | `cc-architecture` + `cc-solid` + `cc-complexity` + `cc-domain-services` |
| `sdd-design` (frontend Angular) | `angular-core` + `angular-performance` + `typescript-advanced` |
| `sdd-tasks` | _(ninguna — agregador organizativo)_ |
| `sdd-apply` (backend C#) | `cc-architecture` + `cc-solid` + `cc-complexity` + `csharp-coding-standards` + `csharp-concurrency-patterns` + `cc-domain-services` |
| `sdd-apply` (backend C# con endpoint nuevo o auth) | lo anterior + `dotnet-api-security` |
| `sdd-apply` (backend C# con acceso a datos) | lo anterior + `efcore-data-access` |
| `sdd-apply` (frontend Angular) | `angular-core` + `angular-performance` + `typescript-advanced` |
| `sdd-apply` (frontend Angular con auth) | `angular-core` + `angular-performance` + `angular-interceptors-auth` + `typescript-advanced` |
| `sdd-verify` (backend C#) | `cc-complexity` + `cc-naming` |
| `sdd-verify` (frontend Angular) | `angular-core` + `typescript-advanced` |
| `sdd-archive` | _(ninguna — solo lectura y guardado)_ |
| Naming review | `cc-naming` |
| Code review general C# | `cc-architecture` + `cc-solid` + `cc-complexity` + `cc-naming` |
| Refactor | `cc-complexity` + `cc-solid` + `csharp-coding-standards` + `csharp-refactoring` |
| Refactor / deuda técnica C# | `csharp-refactoring` + `cc-complexity` + `cc-solid` + `cc-naming` |
| Angular auth / interceptors | `angular-interceptors-auth` + `angular-core` + `frontend-security-performance` |
| Seguridad frontend / performance Angular | `frontend-security-performance` + `angular-core` + `angular-performance` |
| Crear/mejorar formulario (cualquier stack frontend) | `ux-forms` + `ux-forms-velocity` (+ skill de stack si aplica: `angular-core`, `typescript-advanced`, etc.) |
| `sdd-apply` (frontend Angular con formularios) | `angular-core` + `typescript-advanced` + `ux-forms` + `ux-forms-velocity` |
| TypeScript avanzado / tipado | `typescript-advanced` + `angular-core` |
| New API endpoint | `cc-architecture` + `cc-solid` + `cc-naming` + `cc-domain-services` + `dotnet-api-security` |
| Repositorio / query / performance de datos | `efcore-data-access` + `sql-standards` + `cc-architecture` |
| Review de seguridad backend | `dotnet-api-security` + `cc-architecture` + `efcore-data-access` |
| Async code review | `csharp-concurrency-patterns` |
| Crear PR / preparar branch | `branch-pr` |
| Review adversarial / "judgment day" | `judgment-day` (+ las skills del stack del target) |
| Auditar un formulario web contra la API | `form-audit` (+ `angular-interceptors-auth` si hay loop de refresh) |

> Skills de proyecto (ej. un `angular-new-feature` propio de un repo Angular puntual) se agregan
> acá como filas nuevas cuando corresponda — viven en `.claude/skills/` a nivel de ESE proyecto,
> no en este registry global.

---

## Project Conventions

| Archivo | Path | Notas |
|---------|------|-------|
| CLAUDE.md (proyecto) | `(workspace-root)/CLAUDE.md` | Convenciones específicas del proyecto activo — leer primero si existe |

---

_Para regenerar este registry con los SKILL.md reales: pedirle al orquestador "actualizá el skill registry"._
