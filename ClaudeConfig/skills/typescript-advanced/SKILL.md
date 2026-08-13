---
name: typescript-advanced
description: >
  TypeScript avanzado: as const, ReturnType, type guards, generics, utility types y patrones de tipado seguro.
  Trigger: Cuando se trabaja con tipos complejos en TypeScript, se infieren tipos de funciones, se usan generics, o se necesita tipado preciso en Angular/servicios.
metadata:
  author: madian-velasquez
  version: "1.1"
  last_change: "Agregado satisfies operator (TS 4.9+) y NonNullable<T> a utility types; ambos frecuentes en servicios Angular que consumen APIs del ERP"
paths: "**/*.ts"
---

## as const — Inmutabilidad y Tipos Literales

`as const` convierte valores a su tipo literal más específico e inmutable.

```typescript
// Sin as const — tipo amplio
const colores = ['rojo', 'verde', 'azul'];
// tipo: string[]  ← permite cualquier string

// Con as const — tipo literal
const colores = ['rojo', 'verde', 'azul'] as const;
// tipo: readonly ["rojo", "verde", "azul"]  ← exacto e inmutable

// En objetos — muy útil para configuración
const CONFIG = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  env: 'production',
} as const;
// CONFIG.env es "production", no string
// CONFIG.timeout es 5000, no number
```

### Caso de uso real — Rutas y constantes de dominio

```typescript
// ✅ Patrón recomendado para constantes de app
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  USERS: '/users',
} as const;

type AppRoute = typeof ROUTES[keyof typeof ROUTES];
// tipo: "/login" | "/dashboard" | "/users"

// Ahora router.navigate solo acepta rutas válidas
function navigate(route: AppRoute) { ... }
navigate(ROUTES.LOGIN);    // ✅
navigate('/inexistente');  // ❌ Error en compilación
```

---

## ReturnType — Inferir Tipo de Retorno

Extrae automáticamente el tipo de retorno de una función. Si la función cambia, el tipo se actualiza solo.

```typescript
function crearUsuario(nombre: string, rol: string) {
  return {
    id: crypto.randomUUID(),
    nombre,
    rol,
    creadoEn: new Date(),
  };
}

// ✅ En lugar de definir la interfaz a mano:
type Usuario = ReturnType<typeof crearUsuario>;
// tipo: { id: string; nombre: string; rol: string; creadoEn: Date }

// Ahora Usuario se mantiene sincronizado con crearUsuario automáticamente
function actualizarUsuario(usuario: Usuario): Usuario { ... }
```

### Combinado con servicios Angular

```typescript
// En un servicio
getUser(id: string) {
  return this.http.get(`/api/users/${id}`).pipe(
    map(data => ({ ...data, fullName: `${data.firstName} ${data.lastName}` }))
  );
}

// En el componente — sin duplicar el tipo
type UserViewModel = ReturnType<UserService['getUser']> extends Observable<infer T> ? T : never;
```

---

## Type Guards — Narrowing Seguro

Permiten discriminar tipos en runtime de forma type-safe.

```typescript
// typeof guard — para primitivos
function procesar(valor: string | number) {
  if (typeof valor === 'string') {
    return valor.toUpperCase(); // TypeScript sabe que es string aquí
  }
  return valor * 2; // TypeScript sabe que es number aquí
}

// instanceof guard — para clases
function manejarError(error: Error | HttpErrorResponse) {
  if (error instanceof HttpErrorResponse) {
    return `HTTP ${error.status}: ${error.message}`;
  }
  return error.message;
}

// Discriminated union — patrón más robusto
type ApiResult<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }
  | { status: 'loading' };

function handleResult<T>(result: ApiResult<T>) {
  switch (result.status) {
    case 'success': return result.data;   // TypeScript sabe que data existe
    case 'error':   return result.message; // TypeScript sabe que message existe
    case 'loading': return null;
  }
}

// Custom type guard — función predicado
function esUsuarioAdmin(user: User | AdminUser): user is AdminUser {
  return 'permissions' in user;
}

if (esUsuarioAdmin(currentUser)) {
  currentUser.permissions; // ✅ Acceso seguro
}
```

---

## Generics — Componentes Reutilizables

```typescript
// Función genérica básica
function primerElemento<T>(arr: T[]): T | undefined {
  return arr[0];
}

// Con constraints — restringir qué tipos acepta
interface ConId {
  id: string | number;
}

function buscarPorId<T extends ConId>(items: T[], id: T['id']): T | undefined {
  return items.find(item => item.id === id);
}

// Interfaz genérica — muy útil para respuestas de API
interface ApiResponse<T> {
  data: T;
  total: number;
  page: number;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  hasNextPage: boolean;
}

// Servicio Angular con genéricos
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(url: string): Observable<T> {
    return this.http.get<T>(url);
  }

  getPaginated<T>(url: string, page: number): Observable<PaginatedResponse<T>> {
    return this.http.get<PaginatedResponse<T>>(url, { params: { page } });
  }
}
```

---

## Utility Types Esenciales

```typescript
interface Usuario {
  id: string;
  nombre: string;
  email: string;
  password: string;
  rol: 'admin' | 'user';
}

// Partial — todos los campos opcionales (útil para PATCH/updates)
type UsuarioUpdate = Partial<Usuario>;

// Required — todos los campos obligatorios
type UsuarioCompleto = Required<Usuario>;

// Pick — seleccionar campos (útil para DTOs/ViewModels)
type UsuarioPublico = Pick<Usuario, 'id' | 'nombre' | 'email'>;

// Omit — excluir campos (útil para formularios sin ID)
type UsuarioForm = Omit<Usuario, 'id'>;

// Readonly — inmutable
type UsuarioCongelado = Readonly<Usuario>;

// NonNullable — eliminar null/undefined del tipo (útil con datos de API)
type IdSeguro = NonNullable<string | null | undefined>; // → string

// Record — mapas tipados
type RolePermissions = Record<Usuario['rol'], string[]>;
const permisos: RolePermissions = {
  admin: ['read', 'write', 'delete'],
  user: ['read'],
};
```

---

## satisfies — Validación sin Perder el Tipo Literal

`satisfies` valida que un objeto cumple una forma, pero preserva el tipo inferido más específico.

```typescript
type RouteMap = Record<string, string>;

// ❌ Sin satisfies — TypeScript infiere Record<string, string>, pierde los literales
const ROUTES: RouteMap = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
};
ROUTES.LOGIN; // tipo: string — perdiste el literal '/login'

// ✅ Con satisfies — valida la forma Y preserva el tipo literal
const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
} satisfies RouteMap;
ROUTES.LOGIN; // tipo: "/login" ✅ — TypeScript sabe el valor exacto

// Caso real: configuración de endpoints
type ApiEndpoints = Record<string, string>;
const API = {
  users: '/api/users',
  products: '/api/products',
  orders: '/api/orders',
} satisfies ApiEndpoints;

// Ahora podés autocompletar y tipar parámetros con los valores reales
function fetch(endpoint: typeof API[keyof typeof API]) { ... }
fetch(API.users);    // ✅
fetch('/inventado'); // ❌ Error en compilación
```

---

## Reglas Generales

| ❌ Evitar | ✅ Preferir |
|-----------|------------|
| `any` | `unknown` + type guard |
| Interfaces manuales duplicadas | `ReturnType<typeof fn>` |
| Strings sin restricción | `as const` + union types |
| Función que acepta todo | Generic con `extends` |
| Repetir tipos en múltiples archivos | Utility types (`Pick`, `Omit`) |
| Tipar con `: RouteMap` perdiendo literales | `satisfies RouteMap` |
| Acceder a valor nullable sin guard | `NonNullable<T>` + optional chaining |

---

## Resources

- https://www.typescriptlang.org/docs/handbook/2/generics.html
- https://www.typescriptlang.org/docs/handbook/utility-types.html