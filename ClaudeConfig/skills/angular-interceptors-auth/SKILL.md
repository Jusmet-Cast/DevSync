---
name: angular-interceptors-auth
description: >
  Angular interceptors funcionales, manejo de JWT, refresh token y PLATFORM_ID para SSR.
  Trigger: Cuando se crean interceptors, se maneja autenticación HTTP, tokens JWT, o se configura HttpClient en Angular.
metadata:
  author: madian-velasquez
  version: "1.1"
  last_change: "Interceptor desacoplado de localStorage — usa AuthService.getToken() para centralizar la estrategia de almacenamiento de tokens; elimina la contradicción con frontend-security-performance"
paths: "**/*interceptor*.ts, **/*auth*.ts, **/*guard*.ts, **/app.config.ts"
---

## Interceptor Funcional (REQUIRED)

Angular moderno usa `HttpInterceptorFn` — NO clases con `implements HttpInterceptor`.

```typescript
// ✅ SIEMPRE: función, no clase
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken(); // ← centralizado, no acceso directo a storage
  const authReq = req.clone({
    headers: req.headers
      .set('Content-Type', 'application/json')
      .set('Authorization', token ? `Bearer ${token}` : '')
  });
  return next(authReq);
};

// ❌ NUNCA: clase interceptor (deprecado)
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler) { ... }
}
```

---

## PLATFORM_ID — Obligatorio con SSR

Siempre verificar el entorno antes de acceder a APIs del browser (`localStorage`, `window`, `document`).

```typescript
import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);

  // Si estamos en el servidor, pasar sin modificar
  if (isPlatformServer(platformId)) {
    return next(req);
  }

  const token = authService.getToken(); // ← la estrategia de storage vive en AuthService
  // ... lógica del browser
};
```

| Entorno | `isPlatformServer()` | Usar localStorage |
|---------|---------------------|-------------------|
| Browser | `false` | ✅ Sí |
| SSR (Node) | `true` | ❌ No — error en runtime |

---

## Refresh Token + Manejo de Errores 401/403

```typescript
import { catchError, switchMap, throwError } from 'rxjs';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const authService = inject(AuthService);

  if (isPlatformServer(platformId)) return next(req);

  const token = authService.getToken(); // ← sin acceso directo a storage
  const authReq = req.clone({
    headers: req.headers
      .set('Content-Type', 'application/json')
      .set('Authorization', token ? `Bearer ${token}` : '')
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        return authService.refreshToken().pipe(
          switchMap(newToken => {
            // refreshToken() persiste el token internamente — solo construimos el retry
            const retryReq = req.clone({
              headers: req.headers.set('Authorization', `Bearer ${newToken}`)
            });
            return next(retryReq);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
```

---

## AuthService — Gestión de Token

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseURL = 'https://api.example.com';

  // Centralizar lectura/escritura → cambiar storage en un solo lugar (ver frontend-security-performance)
  getToken(): string | null { return localStorage.getItem('token'); }
  private setToken(token: string): void { localStorage.setItem('token', token); }
  private getRefreshToken(): string | null { return localStorage.getItem('refreshToken'); }

  refreshToken(): Observable<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.logOut();
      return throwError(() => new Error('No refresh token'));
    }
    return this.http
      .post<{ accessToken: string }>(`${this.baseURL}/token`, { refreshToken })
      .pipe(
        map(res => res.accessToken),
        tap(newToken => this.setToken(newToken)),
        catchError(error => {
          this.logOut();
          return throwError(() => error);
        })
      );
  }

  logOut(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
```

---

## Registro en app.config.ts (REQUIRED)

```typescript
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor])
    ),
    provideRouter(routes),
    provideZonelessChangeDetection(),
  ]
};
```

---

## Estrategia de Almacenamiento de Token

El interceptor no sabe NI LE IMPORTA dónde está el token. Eso es responsabilidad de `AuthService`.
Para cambiar la estrategia, solo modificar `getToken()` / `setToken()` — el interceptor no cambia.

| Estrategia | XSS | CSRF | Nota |
|------------|-----|------|------|
| `localStorage` (default ilustrativo) | ❌ Vulnerable | ✅ Seguro | Simple pero inseguro |
| Cookie `httpOnly` | ✅ Seguro | ❌ (mitigar con `SameSite`) | Recomendado para producción |
| Memory (variable de servicio) | ✅ Seguro | ✅ Seguro | Se pierde al recargar |

> Ver `frontend-security-performance` para el análisis completo de cada opción.

---

## Interceptors Comunes — Cuándo Usar Cada Uno

| Interceptor | Responsabilidad |
|-------------|----------------|
| `authInterceptor` | Agregar token JWT, refresh en 401/403 |
| `loggingInterceptor` | Log de requests/responses en desarrollo |
| `errorInterceptor` | Manejo global de errores HTTP (500, network) |
| `loadingInterceptor` | Mostrar/ocultar spinner global |

**Regla:** Un interceptor = una responsabilidad. No mezclar auth + logging en el mismo interceptor.

---

## Resources

- https://angular.dev/guide/http/interceptors
- https://angular.dev/guide/ssr