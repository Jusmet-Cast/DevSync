---
name: form-audit
description: Audita un formulario de una app web contra la API real con Playwright MCP — verifica el contrato de la respuesta, provoca respuestas rotas con mocks, y caza loops infinitos y mensajes tipo "[object Object]".
argument-hint: "[URL del formulario] [opcional: qué probar]"
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, Skill, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_find, mcp__playwright__browser_fill_form, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_select_option, mcp__playwright__browser_press_key, mcp__playwright__browser_wait_for, mcp__playwright__browser_network_requests, mcp__playwright__browser_network_request, mcp__playwright__browser_console_messages, mcp__playwright__browser_route, mcp__playwright__browser_unroute, mcp__playwright__browser_route_list, mcp__playwright__browser_network_state_set, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_handle_dialog, mcp__playwright__browser_close
---

# Form Audit — **$ARGUMENTS**

Auditá un formulario contra la API real. Buscás **tres cosas que los tests unitarios no ven**,
porque solo existen cuando el navegador, la app y la API se hablan de verdad:

1. Que lo que la API devuelve sea lo que la app **muestra**.
2. Que una respuesta no contemplada no dispare un **loop infinito**.
3. Que ningún mensaje termine siendo `[object Object]`, `undefined` o `NaN`.

## Paso 0 — Precondiciones (paralo acá si falta algo)

| Necesitás | Cómo |
|---|---|
| La app **corriendo** | La levanta el humano, NO vos |
| La URL del form | De `$ARGUMENTS`, o preguntá |
| El patrón del endpoint | Ej. `**/api/vales`. Si no lo sabés, sale solo del Paso 2 |

> **NO levantes la app vos.** `CLAUDE.md` prohíbe buildear para verificar, y un `ng serve` que
> arrancás vos compila igual. Además, si el server lo levantás en background y se cae, vas a
> reportar "form roto" cuando lo roto era tu server. Pedile al humano que la tenga andando y que
> te pase la URL.

Si el MCP de Playwright no está registrado, decilo y pará: `claude mcp list` para confirmar.

## Paso 1 — Línea de base

1. `browser_navigate` a la URL.
2. `browser_snapshot` → de acá salen las **refs** de los campos. Es árbol de accesibilidad, así
   que ya ves roles, labels y textos: no hace falta screenshot para razonar.
3. `browser_console_messages` con `level: "error"` → si la página **ya** arranca con errores,
   eso va al reporte y contamina todo lo que sigue. Declaralo antes de tocar nada.

## Paso 2 — Camino feliz, y el contrato de verdad

Llená con datos válidos (`browser_fill_form`) y mandá. Después, **en este orden**:

1. `browser_network_requests` con `filter` (regex tipo `/api/.*`) → la lista numerada.
2. `browser_network_request` con el índice → **headers y body completos**, del request y la respuesta.
3. `browser_snapshot` → qué quedó renderizado.

Y comparás las tres cosas. **El bug vive en el desacuerdo entre la 2 y la 3:**

| Chequeo | Qué buscás |
|---|---|
| Request | ¿El payload tiene los campos que llenaste, con los nombres que la API espera? |
| Status | ¿200 con body de error adentro? Eso ya es un bug de contrato |
| Respuesta → UI | ¿El mensaje que muestra la pantalla **es** el que mandó la API? |
| Campos silenciosos | ¿La API devolvió un error de validación por campo y la UI lo tiró a la basura? |

## Paso 3 — Provocá las respuestas rotas (el corazón de esto)

Acá está la diferencia entre observar y **testear**. Con `browser_route` forzás la respuesta rara
en vez de esperar a que ocurra en producción.

Corré esta matriz. Por cada fila: `browser_route` → llenar y mandar → `browser_snapshot` →
`browser_console_messages` → `browser_unroute`.

| # | Escenario | `browser_route` | Qué NO debe pasar |
|---|---|---|---|
| 1 | Error de negocio normal | `status:400`, `body:'{"message":"El vale ya existe"}'` | Que muestre otra cosa que ese texto |
| 2 | **Error como objeto** | `status:400`, `body:'{"message":{"code":"E1","detail":"x"}}'` | **`[object Object]` en pantalla** |
| 3 | Error anidado | `status:422`, `body:'{"errors":{"monto":["Requerido"]}}'` | Que se pierda el error del campo |
| 4 | Body vacío | `status:500`, `body:''` | Pantalla en blanco o `undefined` |
| 5 | No es JSON | `status:500`, `body:'<html>502 Bad Gateway</html>'`, `contentType:'text/html'` | Excepción de parseo sin mensaje al usuario |
| 6 | `null` donde va texto | `status:400`, `body:'{"message":null}'` | Literal `null` en pantalla |
| 7 | Array de errores | `status:400`, `body:'{"message":["A","B"]}'` | Que muestre `A,B` pegado o `[object Object]` |
| 8 | **401** | `status:401`, `body:'{"message":"Token expirado"}'` | **Loop de refresh** (ver Paso 4) |
| 9 | Sin red | `browser_network_state_set: "offline"` | Spinner infinito sin mensaje |

**Después de cada escenario, `browser_unroute`.** Un route que queda vivo hace que el siguiente
caso mienta, y vas a perder media hora buscando un bug que creaste vos.

### Los strings que delatan

Buscá en el snapshot, **literal**:

```
[object Object]     [object Promise]     undefined     null     NaN
Error: [object      ,,                   {{            }}
```

Aparecen tal cual en el árbol de accesibilidad. Si encontrás uno, es **CRÍTICO**: significa que
alguien interpoló un objeto en un template esperando un string. El culpable casi siempre es
`error.message` cuando `message` no es un string.

## Paso 4 — Loops infinitos

Después de **cada** escenario, sobre todo el 401:

```
browser_network_requests con filter del endpoint
```

**Contá las repeticiones.** Una acción del usuario = un puñado de requests. Si el mismo endpoint
aparece 10, 30 o 200 veces, ahí está el loop, y la lista numerada **es** la evidencia — no hay que
deducirla.

Los tres patrones que vas a encontrar, por frecuencia:

1. **Interceptor de refresh que no corta.** 401 → refresh → el refresh también da 401 → refresh…
   Si el proyecto es Angular, cargá `angular-interceptors-auth` con el tool `Skill`: ahí está el
   patrón correcto de rotación y corte.
2. **Retry sin límite** ante 500 o error de red.
3. **`effect()` / `useEffect` que se re-dispara** porque el handler de error escribe el mismo
   signal o estado que lo disparó.

Si detectás loop: `browser_unroute` y `browser_close` **ya**, antes de seguir. Un loop corriendo
te llena el contexto de requests y te come la sesión.

## Ojo con el contexto

Los snapshots y las listas de red son **verbosos**, y esta skill los pide muchas veces.

`browser_snapshot`, `browser_network_requests` y `browser_console_messages` aceptan **`filename`**:
guardan a archivo en vez de devolver todo al contexto. Usalo cuando el volumen sea grande y después
leé con `Grep` solo lo que buscás. Mirá el segmento `ctx` de la statusline mientras trabajás.

## Formato del reporte

```markdown
## Form Audit — {form} · {URL}

**Endpoint**: `{método} {ruta}`
**Estado inicial de consola**: limpio / {n} errores preexistentes

### Camino feliz
| Chequeo | Resultado |
|---|---|
| Payload del request | ✅ / ❌ {qué falta o sobra} |
| Status | ✅ 200 |
| Respuesta → UI | ✅ / ❌ {qué mostró vs qué mandó la API} |

### Matriz de respuestas rotas
| # | Escenario | Qué mostró la UI | Veredicto |
|---|---|---|---|
| 2 | Error como objeto | `[object Object]` | 🔴 CRITICAL |
| 8 | 401 | Loop: 47 llamadas a `/api/auth/refresh` | 🔴 CRITICAL |
| 4 | Body vacío | "Ocurrió un error" | ✅ |

### Hallazgos
[🔴 CRITICAL] `vale-form.component.ts:88` — `[object Object]` con error no-string
  Repro: escenario 2 (`status:400`, `message` como objeto)
  Causa: `{{ error.message }}` asume string; la API manda objeto en errores de negocio
  Fix: normalizar la respuesta de error en un solo lugar antes de que llegue al template

### Veredicto
✅ limpio · ⚠️ warnings · ❌ críticos, no mergear
```

## Reglas duras

- **Reportás, no arreglás.** Esto es auditoría. Si el humano quiere el fix, es otro pedido.
- **Un hallazgo sin repro no es un hallazgo.** Siempre el escenario exacto que lo dispara.
- **No inventes hallazgos para llenar la tabla.** "Los 9 escenarios pasaron" es un resultado
  excelente y se dice en una línea.
- **Limpiá al terminar**: `browser_unroute` sin patrón (borra todos) y `browser_close`. Dejar un
  route colgado envenena la próxima corrida.
