---
name: ux-forms-velocity
description: >
  Patrones para acelerar la construcción de formularios: validación schema-first como única fuente
  de verdad, componente Field genérico config-driven, catálogo de estados obligatorios, autosave/draft,
  debounce en validaciones async — agnóstico de framework (Angular, React, Vue, Blazor/Razor, etc).
  Trigger: Al armar un formulario nuevo desde cero, cuando la validación está duplicada entre campos
  o entre cliente/servidor, o cuando agregar un campo nuevo a un form existente toma más de lo esperado.
metadata:
  author: madian-velasquez
  version: "1.0"
paths: "**/*form*.ts, **/*Form*.cs, **/*.component.html, **/*.tsx, **/*.jsx, **/*.vue, **/*.razor, **/*.cshtml"
---

## Principio rector

Esta skill es sobre **velocidad sin sacrificar UX** — no repite los criterios de `ux-forms`
(timing de validación, errores, accesibilidad), asume que ya los conocés y ataca la fricción de
CONSTRUIR el formulario: cuánto tarda agregar un campo, cuánta lógica se repite entre campos, y
cuánta se duplica entre cliente y servidor.

---

## Schema-first: una sola fuente de verdad (REQUIRED)

El error más común que hace lento iterar sobre un formulario: la validación vive en 3 lugares
distintos (template, componente, backend) y hay que tocar los 3 para cambiar una regla.

```
// ❌ Lento de mantener
// - Regla "email requerido" en el template (required)
// - Regla "formato email" en el componente (regex a mano)
// - Regla "email único" solo en el backend, sin reflejo en el cliente

// ✅ Rápido de mantener: UN schema declarativo por formulario
const schema = {
  email: { required: true, format: "email", asyncCheck: "emailDisponible" },
  password: { required: true, minLength: 8, pattern: "al menos un número" },
};
// El componente Field lee este schema para required/format.
// El backend valida el mismo contrato (DTO/DataAnnotations/Zod compartido si el stack lo permite).
```

Beneficio directo: agregar un campo nuevo = una entrada en el schema, no tocar 3 archivos.

---

## Componente Field genérico, config-driven (REQUIRED)

En vez de un componente por campo (`EmailField`, `PasswordField`, `PhoneField`...), un único
`Field` que recibe configuración:

```
<Field
  name="email"
  label="Email"
  type="email"
  hint="Ej: juan@empresa.com"
  validators={schema.email}
/>
```

El `Field` internamente resuelve: label asociado, mensaje de error posicionado, `aria-describedby`,
`aria-invalid`, timing de validación (blur/submit) — todo lo que pide `ux-forms`, una sola vez,
para todos los campos futuros.

Señal de que hace falta esta abstracción: el tercer campo copy-pasteado con el mismo bloque de
label + input + span de error + lógica de touched/error.

---

## Catálogo de estados obligatorio (REQUIRED)

Todo formulario, sin importar el stack, pasa por estos estados — si falta uno, es un bug de UX
esperando pasar:

| Estado | Qué debe pasar |
|--------|----------------|
| `idle` | Formulario recién montado, sin errores visibles, sin campos marcados touched |
| `validating` | Mientras corre una validación async (ej: chequeo de disponibilidad) — mostrar indicador puntual en el campo, no bloquear el resto del form |
| `submitting` | Botón deshabilitado + loading, inputs deshabilitados o al menos no editables mientras se envía |
| `success` | Confirmación clara (toast, redirect, mensaje inline) — nunca dejar el form "colgado" sin feedback |
| `error` (servidor) | Error de servidor mapeado a campo(s) específicos si aplica, o mensaje general si es error no relacionado a un campo (ej: 500) |
| `disabled` | Formulario de solo lectura o dependiente de una condición externa (ej: falta seleccionar algo antes) |

Un formulario que solo maneja `idle` → `submitting` → `success` y trata cualquier falla como
"error genérico" está incompleto — no distingue error de validación de error de red.

---

## Autosave / draft

Usar cuando:
- El formulario es largo (más de ~10 campos) o el usuario puede tardar en completarlo (ej: creación
  de contenido, wizard multi-paso).
- Perder el progreso tiene costo real (usuario escribe un texto largo, arma un pedido complejo).

NO usar cuando:
- Datos sensibles que no deberían persistir sin confirmación explícita (pagos, contraseñas).
- Formularios cortos donde el costo de re-llenar es trivial (login, búsqueda).

```
// Patrón: debounce (300-500ms) + guardar en localStorage/sessionStorage o borrador en servidor
// Restaurar al montar, con indicador visible: "Borrador guardado hace 2 minutos"
// Limpiar el draft al hacer submit exitoso
```

---

## Debounce en validaciones async (REQUIRED)

Cualquier validación que pega a un servidor (username disponible, código promocional válido) DEBE
tener debounce (300ms mínimo) — sin esto, cada tecla dispara una request y el "estado validating"
parpadea sin parar.

```
// ❌ Validar en cada keystroke sin debounce → request por letra
// ✅ Debounce 300-500ms → una request cuando el usuario deja de escribir
// Cancelar la validación en curso si el valor cambió antes de que responda (evitar race condition)
```

---

## Mensajes de error: catálogo centralizado, no strings sueltos

Igual que en backend (ver `cc-architecture`: mensajes en `Mensajes.cs`), el frontend necesita UN
lugar para los textos de error de validación — no un string literal repetido en cada campo:

```
// ❌ Cada campo con su propio string hardcodeado, inconsistente entre formularios
// ✅ Catálogo central (constantes o claves i18n) reusado por todos los Field
const ValidationMessages = {
  required: (campo) => `${campo} es obligatorio`,
  emailFormat: "Ingresá un email válido, ej: juan@empresa.com",
  minLength: (n) => `Necesita al menos ${n} caracteres`,
};
```

Esto evita el problema de "arreglé el mensaje en un formulario pero quedó viejo en los otros 5".

---

## Checklist: de spec a formulario andando (rápido)

1. Definir el schema de campos (nombre, tipo, validadores, mensaje de error por regla).
2. Si ya existe un componente `Field` genérico en el proyecto → usarlo. Si no existe y este es el
   segundo o tercer formulario del proyecto → crearlo ahora, no seguir copy-pasteando.
3. Mapear cada estado del catálogo (idle/validating/submitting/success/error/disabled) — no asumir
   que "andá" cubre todos.
4. Validaciones async → debounce + cancelación de la anterior.
5. Mensajes de error → catálogo central, no strings sueltos.
6. Correr el checklist de `ux-forms` (labels, foco en error, accesibilidad) antes de dar por cerrado.

---

## Anti-patrones que frenan la iteración

- **Un componente por campo** en vez de uno genérico config-driven — cada campo nuevo es un archivo
  nuevo con el mismo boilerplate.
- **Validación duplicada cliente/servidor** sin schema compartido — cambiar una regla implica
  recordar tocarla en dos lugares (y eventualmente alguien se olvida).
- **Estado de error como boolean único** (`hasError: true`) en vez de por campo — no permite mostrar
  múltiples errores simultáneos ni saber cuál mensaje mostrar.
- **Validación manual del DOM** (leer `.value` a mano, comparar strings) en vez de usar el sistema
  de formularios del framework — reinventa lo que Reactive Forms / React Hook Form / VeeValidate /
  DataAnnotations ya resuelven.
- **Sin debounce en validación async** — genera requests de sobra y estados que parpadean.

---

## Notas por stack (dónde enganchar el schema-first)

| Stack | Dónde vive el schema | Componente Field genérico |
|-------|----------------------|---------------------------|
| Angular | Validators custom reusables + `FormGroup` tipado | Componente standalone con `input()`/`model()`, ver `angular-core` |
| React | Zod/Yup schema + React Hook Form resolver | Componente `Field` que envuelve `register()` |
| Vue | Yup/Zod + VeeValidate | Componente con `defineProps` + slot de error |
| Blazor / Razor Pages | DataAnnotations en el modelo, o FluentValidation compartida con backend | `<InputText>` custom o partial view reusable |

---

## Resources

- https://www.nngroup.com/articles/progress-indicators/
- https://web.dev/learn/forms/
- https://fluentvalidation.net/
