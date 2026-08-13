---
name: frontend-security-performance
description: >
  Seguridad web (XSS, CSRF, CSP, OWASP) y performance frontend (Core Web Vitals, Skeleton Screens, Optimistic UI).
  Trigger: Cuando se manejan inputs de usuario, tokens JWT, cookies, se optimiza carga o se implementan mejoras de UX percibida.
metadata:
  author: madian-velasquez
  version: "1.1"
  last_change: "Corregido anti-pattern en Skeleton Screen: reemplazado effect()+subscribe por toSignal() con computed(); actualizado JWT storage para alinearse con angular-interceptors-auth"
paths: "**/*.ts, **/*.html"
---

## XSS — Cross-Site Scripting

El atacante inyecta código JavaScript malicioso que se ejecuta en el browser de otros usuarios.

### Tipos
- **Stored**: código guardado en DB, afecta a todos
- **Reflected**: código en URL, afecta a víctima específica
- **DOM-based**: manipula el DOM directamente

```typescript
// ❌ Vulnerable
element.innerHTML = userInput;

// ✅ Seguro — trata el contenido como texto, no HTML
element.textContent = userInput;

// ✅ Si necesitás HTML dinámico — sanitizar obligatorio
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userInput);
```

### Angular y XSS
Angular escapa automáticamente el contenido en templates. `{{ userInput }}` es seguro.

```html
<!-- ✅ Seguro — Angular lo escapa -->
<p>{{ userInput }}</p>

<!-- ❌ Peligroso — saltea el escape de Angular -->
<p [innerHTML]="userInput"></p>

<!-- ✅ Si necesitás innerHTML — usar DomSanitizer -->
```

```typescript
import { DomSanitizer } from '@angular/platform-browser';

private readonly sanitizer = inject(DomSanitizer);

get safeHtml() {
  return this.sanitizer.bypassSecurityTrustHtml(this.trustedContent);
}
```

---

## CSRF — Cross-Site Request Forgery

Sitio malicioso hace que el browser del usuario envíe requests a tu API usando sus cookies.

```typescript
// 1. SameSite Cookies — defensa principal
res.cookie('session', token, {
  sameSite: 'strict',  // Cookie solo se envía al mismo sitio
  httpOnly: true,       // No accesible desde JS
  secure: true,         // Solo HTTPS
});

// 2. CSRF Token en formularios
<input type="hidden" name="_csrf" value={csrfToken}>
```

---

## Content Security Policy (CSP)

Le dice al browser QUÉ recursos puede cargar y DE DÓNDE.

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://api.miapp.com;
  "
>
```

---

## Security Headers Esenciales

```typescript
// En tu API .NET o middleware
res.setHeader('X-Frame-Options', 'DENY');                              // Prevenir clickjacking
res.setHeader('X-Content-Type-Options', 'nosniff');                    // Prevenir MIME sniffing
res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // Forzar HTTPS
```

---

## JWT — Almacenamiento Seguro

| Opción | XSS | CSRF | Recomendado |
|--------|-----|------|-------------|
| `localStorage` | ❌ Vulnerable | ✅ Seguro | ❌ No |
| Cookie `httpOnly` | ✅ Seguro | ❌ Vulnerable (mitigar con SameSite) | ✅ Sí |
| Memory (variable) | ✅ Seguro | ✅ Seguro | ✅ Sí (se pierde al recargar) |

---

## OWASP Top 10 — Los más relevantes para Frontend

| Vulnerabilidad | Mitigation |
|----------------|-----------|
| A03 - Injection (XSS) | Sanitizar inputs, usar `textContent`, DomSanitizer |
| A02 - Cryptographic Failures | HTTPS siempre, no guardar datos sensibles en localStorage |
| A07 - Auth Failures | Tokens con expiración corta, refresh tokens, logout limpio |
| A05 - Security Misconfiguration | CSP, security headers, deshabilitar source maps en prod |

---

## Core Web Vitals

Google mide estos 3 para ranking y UX:

| Métrica | Qué mide | Meta |
|---------|----------|------|
| **LCP** (Largest Contentful Paint) | Cuándo el contenido principal es visible | < 2.5s |
| **FID** (First Input Delay) | Qué tan rápido responden las interacciones | < 100ms |
| **CLS** (Cumulative Layout Shift) | Cuánto se mueve el contenido al cargar | < 0.1 |

### Mejorar LCP
```html
<!-- Imagen LCP: agregar priority para preload -->
<img ngSrc="hero.jpg" width="800" height="400" priority>
```

### Mejorar CLS
```css
/* Siempre reservar espacio para imágenes y embeds */
img { width: 100%; aspect-ratio: 16/9; }
.skeleton { min-height: 200px; } /* Evita saltos al cargar */
```

---

## Skeleton Screens

Mostrar estructura mientras carga se percibe 2x más rápido que un spinner.

```typescript
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  template: `
    @if (isLoading()) {
      <app-product-list-skeleton />
    } @else {
      <app-product-list [products]="products()" />
    }
  `
})
export class ProductPageComponent {
  private readonly productService = inject(ProductService);

  // toSignal: undefined mientras el Observable no emite → indicador de carga natural
  private readonly productsData = toSignal(this.productService.getAll());
  readonly isLoading = computed(() => this.productsData() === undefined);
  readonly products = computed(() => this.productsData() ?? []);
}

// ❌ Anti-pattern — effect() no es para subscriptions
// constructor() {
//   effect(() => { this.productService.getAll().subscribe(...) }); // leak garantizado
// }

// Skeleton component — imitar estructura real
@Component({
  selector: 'app-product-list-skeleton',
  template: `
    @for (item of skeletonItems; track $index) {
      <div class="skeleton-card">
        <div class="skeleton-image pulse"></div>
        <div class="skeleton-title pulse"></div>
        <div class="skeleton-price pulse"></div>
      </div>
    }
  `
})
export class ProductListSkeletonComponent {
  readonly skeletonItems = Array(6).fill(null);
}
```

---

## Optimistic UI

Actualizar la UI antes de confirmar con el servidor. La UX se siente instantánea.

```typescript
async addToCart(product: Product) {
  // 1. Actualización optimista — inmediata
  this.cartItems.update(items => [...items, product]);

  try {
    // 2. Persistir en servidor — segundo plano
    await firstValueFrom(this.cartService.add(product.id));
  } catch (error) {
    // 3. Revertir si falla
    this.cartItems.update(items => items.filter(p => p.id !== product.id));
    this.notificationService.error('No se pudo agregar al carrito');
  }
}
```

### Cuándo usar Optimistic UI

| ✅ Usar | ❌ No usar |
|---------|-----------|
| Like / favorito | Pago / transacción financiera |
| Agregar a carrito | Eliminación permanente |
| Actualizar perfil | Acción con consecuencias irreversibles |

---

## Resources

- https://owasp.org/www-project-top-ten/
- https://web.dev/vitals/
- https://angular.dev/best-practices/security