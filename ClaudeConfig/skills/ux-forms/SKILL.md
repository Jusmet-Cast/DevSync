---
name: ux-forms
description: >
  UX y accesibilidad de formularios: timing de validación, mensajes de error, labels vs placeholders,
  agrupación de campos, formularios multi-paso, patrones móviles y leyes de UX aplicadas — agnóstico
  de framework (Angular, React, Vue, Blazor/Razor, etc).
  Trigger: Al crear o modificar un formulario, diseñar validación de inputs, escribir mensajes de
  error, decidir entre página única vs wizard multi-paso, o revisar accesibilidad de un form existente.
metadata:
  author: madian-velasquez
  version: "1.0"
paths: "**/*form*.ts, **/*Form*.cs, **/*.component.html, **/*.tsx, **/*.jsx, **/*.vue, **/*.razor, **/*.cshtml"
---

## Principio rector

Un formulario es una conversación, no un examen. Cada fricción evitable (campo de más, error tardío,
label ambiguo) es una razón para que el usuario abandone. Todo lo de acá aplica **sin importar el
framework** — lo único que cambia entre stacks es DÓNDE se engancha la lógica (ver "Notas por stack"),
no el criterio de UX.

---

## Timing de validación (REQUIRED)

| Momento | Cuándo usarlo | Por qué |
|---------|---------------|---------|
| `on blur` (al perder foco) | Default para la mayoría de los campos | Da tiempo a terminar de escribir antes de juzgar |
| `on change` (mientras escribe) | Solo para feedback positivo (fortaleza de password, contador de caracteres) | Validar en negativo mientras se escribe genera ansiedad |
| `on submit` | Errores de servidor, validación cruzada entre campos | No se puede resolver antes de tener todos los datos |
| Nunca | Marcar error en un campo vacío que el usuario todavía no tocó | Castiga antes de que haya "cometido" el error |

```
// ❌ Mal: error apenas se renderiza el form, antes de que el usuario toque nada
// ✅ Bien: el campo se marca "touched" recién al blur o al intentar submit
```

---

## Labels, placeholders y hints (REQUIRED)

- El **label es obligatorio y siempre visible** — nunca reemplazarlo por un placeholder que
  desaparece al escribir (el usuario pierde contexto a mitad de carga).
- El placeholder es para un **ejemplo de formato**, no para la instrucción: `Ej: juan@empresa.com`,
  no `Ingresá tu email`.
- Asociar label ↔ input SIEMPRE de forma explícita y programática (`for`/`id` en HTML, `<label>`
  envolvente, o el equivalente del framework) — un click en el label debe enfocar el input.
- Campos opcionales marcados como `(opcional)` — no marcar los obligatorios con `*` sin una
  referencia visible de qué significa el asterisco.

---

## Mensajes de error (REQUIRED)

- **Específico, no genérico**: "La contraseña necesita al menos un número" en vez de "Campo inválido".
- **Ubicado junto al campo**, no en un banner genérico arriba del formulario (el usuario tiene que
  poder ver el error y el campo al mismo tiempo, sin scrollear).
- **No depender solo del color** para indicar error (rojo) — acompañar con ícono + texto. Usuarios
  con daltonismo o baja visión no perciben el color como única señal (WCAG 1.4.1).
- Anunciar el error a lectores de pantalla: `aria-describedby` apuntando al mensaje + `aria-invalid="true"`
  en el input mientras el error esté activo.
- Al fallar el submit, **mover el foco al primer campo con error** — si el usuario no ve dónde está
  el problema, no hay mensaje que sirva.

```html
<label for="email">Email</label>
<input id="email" type="email" aria-invalid="true" aria-describedby="email-error" />
<span id="email-error" role="alert">Ingresá un email válido, ej: juan@empresa.com</span>
```

---

## Accesibilidad de formularios (REQUIRED — WCAG 2.2 AA)

- Todo input tiene label programáticamente asociado (nunca solo un `<div>` visual al lado).
- `autocomplete` con el token correcto (`email`, `given-name`, `tel`, `postal-code`, etc.) — reduce
  fricción y es requisito WCAG 1.3.5.
- Orden de tabulación (`tab order`) sigue el orden visual — nunca `tabindex` positivo a mano.
- Tamaño mínimo de objetivo táctil: 24x24px (WCAG 2.2 AA), ideal 44x44px en mobile.
- Grupos de campos relacionados (radio buttons, checkboxes de una misma pregunta) envueltos en
  `fieldset` + `legend` (o el equivalente semántico del framework) — un lector de pantalla necesita
  saber que "Visa", "Mastercard", "Amex" pertenecen a la pregunta "Método de pago".
- Nunca deshabilitar el zoom (`user-scalable=no`) para "que no se rompa el layout del form".

---

## Agrupación y progressive disclosure

- **Ley de Miller**: agrupar campos relacionados en bloques de 5-7 (datos personales / dirección /
  pago) en vez de una lista plana de 20 inputs.
- **Ley de Hick**: menos campos visibles a la vez = decisión más rápida. Ocultar campos avanzados
  detrás de un "Mostrar más opciones" en vez de mostrarlos siempre.
- **Ley de Fitts**: el botón de submit tiene que ser el elemento más grande/prominente del formulario
  y estar en la posición esperada (abajo a la derecha en LTR, o full-width en mobile).

### Decisión: ¿página única, acordeón, o wizard multi-paso?

```
¿Menos de 7 campos? ────────────────────────────► Página única
        │ no
        ▼
¿Los campos tienen dependencias claras entre grupos
(ej: dirección de envío → método de envío → pago)? ─► Wizard multi-paso, con indicador de progreso
        │ no                                          y posibilidad de volver atrás sin perder datos
        ▼
¿Son secciones independientes sin orden obligatorio? ─► Acordeón / secciones colapsables
```

Reglas del wizard multi-paso:
- Mostrar progreso (`Paso 2 de 4`), nunca dejar al usuario sin saber cuánto falta.
- Persistir los datos de pasos anteriores al volver atrás — nunca resetear el form.
- Validar cada paso antes de avanzar, no acumular todos los errores para el final.

---

## Formularios en mobile

- `type` de input correcto para que aparezca el teclado adecuado: `email`, `tel`, `number`, `url` —
  nunca `text` genérico para todo.
- `inputmode` cuando el `type` semántico no aplica pero el teclado sí (ej: `inputmode="numeric"` en
  un campo de código postal que acepta letras en algunos países).
- Evitar múltiples columnas de campos en mobile — una columna, orden vertical claro.
- Botón de submit siempre visible o accesible con un scroll mínimo — no enterrado al final de un
  formulario larguísimo sin sticky footer.

---

## Estado del botón de submit

| Enfoque | Cuándo usarlo |
|---------|---------------|
| Deshabilitado hasta que el form sea válido | Formularios cortos (login, búsqueda) donde el usuario entiende rápido qué falta |
| Siempre habilitado, valida al hacer click y muestra errores | Formularios largos — un botón deshabilitado sin explicación es la queja #1 en tests de usabilidad ("¿por qué no puedo enviar?") |
| Loading state + deshabilitado DURANTE el submit | SIEMPRE, sin excepción — previene doble submit |

```
// ✅ Durante el submit: botón deshabilitado + spinner/texto "Enviando..."
// ❌ Nunca dejar el botón clickeable mientras la request está en vuelo
```

---

## Notas por stack (mapeo, no implementación)

Los criterios de arriba son universales. Dónde se enganchan:

| Stack | Validación | Asociación label/error |
|-------|-----------|------------------------|
| Angular (Reactive Forms) | `Validators` custom + `FormGroup.errors` | `aria-describedby` manual en el template |
| React | React Hook Form + resolver (Zod/Yup) | `register()` + `errors[field]` mapeado a `aria-describedby` |
| Vue | VeeValidate / vue-hook-form + Yup/Zod | `ErrorMessage` component ligado por `name` |
| Blazor / Razor Pages | `DataAnnotations` o FluentValidation | `ValidationMessageFor` / `<ValidationMessage For="..."/>` ya asocia por convención |

Para performance percibida durante la carga/submit del formulario (skeleton screens, optimistic UI,
debounce) ver `frontend-security-performance`. Para acelerar la construcción en sí (schema-first,
componente Field reusable, catálogo de estados) ver `ux-forms-velocity`.

---

## Checklist rápido antes de dar un formulario por terminado

- [ ] Todo label asociado programáticamente a su input
- [ ] Validación con timing correcto por campo (blur/submit, nunca error prematuro)
- [ ] Mensajes de error específicos, junto al campo, no solo por color
- [ ] Foco se mueve al primer error al fallar el submit
- [ ] `autocomplete` correcto en campos comunes (email, nombre, dirección, teléfono)
- [ ] Botón de submit se deshabilita y muestra loading durante el envío
- [ ] Probado con teclado únicamente (sin mouse) de punta a punta
- [ ] Campos opcionales marcados como tales

---

## Resources

- https://www.nngroup.com/articles/web-form-design/
- https://www.w3.org/WAI/tutorials/forms/
- https://web.dev/learn/forms/
- https://webaim.org/techniques/forms/
