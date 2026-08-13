# DevCodex — Replicación del Workspace de Notion
**Versión:** 1.0 · 12 Ago 2026
**Capa 3 del sistema** — ver `INSTALL.md §1`

Cómo levantar la estructura de Notion que DevSync necesita, en un workspace nuevo.

---

## 1. Por qué hay dos caminos y no uno

La API de Notion tiene dos límites duros que hacen imposible automatizar esto por completo:

| Límite | Consecuencia |
|---|---|
| **`G-05`** — no se pueden **crear** bases de datos por API | Un script no puede levantar DevCodex de cero |
| Los **filtros de vista** no son configurables por API | Un script no puede reconstruir el Control Tower |

O sea: **el paso de creación es humano, sí o sí.** Lo que cambia es cuánto trabajo humano.

```
CAMINO A — Duplicar plantilla     15 segundos   ✅ recomendado
   Trae TODO: bases, schemas, relaciones, vistas, filtros, layout, iconos, callouts.

CAMINO B — Reconstrucción manual  ~30 minutos
   Para cuando no hay plantilla disponible o se quiere entender la estructura.
```

El **Camino A gana por goleada** justamente porque la duplicación de Notion transporta lo que la API no puede tocar. No es un atajo: es la única vía que reproduce el sistema completo.

---

## 2. Camino A — Duplicar la plantilla *(recomendado)*

### 2.1 · Publicar la plantilla *(lo hace el dueño del workspace, una sola vez)*

⚠️ **Esto es una acción de UI. No hay API para publicar plantillas.**

```
1. Abrir la página DevCodex
2. Menú (···) → arriba a la derecha
3. Activar "Share to web"   (o "Publicar en la web")
4. Activar "Allow duplicate as template"
5. Copiar el link público
6. Pegarlo abajo, en §2.2
```

> 🔴 **ANTES DE PUBLICAR — auditoría obligatoria (Regla #6).**
> Publicar en la web hace la página **legible por cualquiera con el link**, incluidos buscadores.
>
> Correr **`/audit-secrets`** (agente CIPHER) antes de activar nada. En este mismo workspace hubo credenciales de infraestructura en texto plano en `Quick Notes` — hallazgo `H-01`.
>
> Y ojo: la plantilla **copia también los datos**, no solo la estructura. Antes de publicar, decidí si querés compartir tus 21 proyectos y 17 documentos reales, o si conviene duplicar DevCodex a una copia limpia, vaciar las bases y publicar **esa**.

### 2.2 · Link de duplicación

```
https://app.notion.com/p/DevCodex-Temp-4ffef7d9a13c82efa12c0119cc3fa476?source=copy_link
```

> Verificá en incógnito (sin sesión) que se vea el botón **Duplicate** antes de confiar en este link — es la única prueba real de que quedó público.

### 2.3 · Duplicar *(lo hace quien instala)*

```
1. Abrir el link
2. "Duplicate" arriba a la derecha
3. Elegir el workspace destino
```

Listo. Bases, relaciones, vistas y filtros incluidos.

---

## 3. Camino B — Reconstrucción manual

Si no hay plantilla, se crean los **10 contenedores vacíos** y el schema se puebla después.

### 3.1 · Crear la página raíz y las 10 bases

En una página nueva llamada `DevCodex`, insertar **10 bases inline** (`/database inline`) con **exactamente** estos nombres:

```
Projects · Sprints · Repos · Dev Log · Document Hub
Technologies · Training · Notes · Toolkit · Resources
```

⚠️ **Los nombres importan y son literales** (Regla #7). El verificador matchea por nombre, no por id.

Solo el contenedor. Los campos vienen después.

### 3.2 · Poblar el schema

Dos opciones:

**a) Con un agente de DevSync** — pedile:
> *"Poblá los schemas de DevCodex según `Notion/devcodex-schema.json`"*

El agente lee el esquema canónico y aplica cada propiedad con `update-a-data-source`. Es lo que hicimos en la instancia original.

**b) A mano**, siguiendo `devcodex-schema.json`. Las 90 propiedades están ahí con su tipo, opciones y relaciones.

### 3.3 · Las dos propiedades que la API no puede crear

Por el gotcha `G-04`, las propiedades tipo **`status`** no son editables por API. Hay que crearlas **a mano**:

| Base | Propiedad | Opciones |
|---|---|---|
| `Projects` | `Status` | `Not started` · `Blocked` · `In progress` · `Done` |
| `Training` | `Status` | `Not started` · `In progress` · `Done` |

> Por eso `Sprints.Status` y `Document Hub.Status` son **`select` a propósito**: para que un agente pueda cerrar un ciclo o aprobar un documento sin intervención humana. No fue casualidad.

---

## 4. Pasos posteriores — valen para ambos caminos

### 4.1 · Conectar la integración

Ver `INSTALL.md §2.2`. Resumen:

```
1. Crear integración Internal → https://www.notion.so/profile/integrations
2. Compartir la página DevCodex con ella  (··· → Connections → Confirm)
3. claude mcp add --scope user notion -e NOTION_TOKEN=ntn_xxx -- npx -y @notionhq/notion-mcp-server
```

### 4.2 · Verificar la estructura

```bash
NOTION_TOKEN=ntn_xxx node Notion/verify-devcodex.mjs --root <page_id_de_tu_DevCodex>
```

Compara el workspace real contra el esquema canónico y reporta faltantes, tipos equivocados y relaciones inversas mal nombradas. **Solo lee, no escribe.**

> ⚠️ **Usá `--root` siempre que tengas más de un DevCodex accesible** — por ejemplo el operativo y esta plantilla. El matching es por **nombre** de base, así que sin `--root` el script no puede distinguir dos `Projects` y devuelve un resultado arbitrario que *parece* válido. Con `--root` solo mira las bases que cuelgan de esa página.
>
> Si detecta homónimos sin `--root`, lo reporta como error en vez de adivinar.
>
> El `page_id` sale de la URL de la página raíz, con o sin guiones.

Salida esperada:

```
DevCodex — verificacion contra esquema canonico v1.0

  Bases encontradas: 10/10

  ✅ Projects       211ef7d9-...
  ...
  ✅ Esquema consistente.
```

### 4.3 · Poblar el registro de instancia

El verificador imprime los **`data_source_id` reales** de tu copia. Copialos a `System/NOTION_DATA_REGISTRY.md §2`.

> **Este paso no es opcional.** Los IDs son únicos por workspace y cambian al duplicar. Los agentes leen el registro para saber a qué base escribir; con IDs de otra instancia, escriben en el vacío o fallan.

```
devcodex-schema.json     →  qué DEBE existir   (plantilla, sin IDs, reusable)
NOTION_DATA_REGISTRY.md  →  qué existe HOY     (instancia, con IDs reales)
```

### 4.4 · Aplicar los filtros de vista *(solo Camino B)*

La duplicación los trae; la reconstrucción manual no. Son 4 y se hacen en la UI:

| Vista | Filtro |
|---|---|
| `Sprints` en Control Tower | `Status = Active` |
| `Projects` · ACTIVE | `Status = In progress`, ordenar por `Priority` ↓ |
| `Projects` · NEXT | `Status = Not started` **AND** `Priority = High` |
| `Dev Log` | agrupar por `Sprint`, ordenar por `Date` ↓ |

### 4.5 · Las entradas de ejemplo

La plantilla trae **una entrada marcada `🔸 EJEMPLO`** en cada base operativa, todas **enlazadas entre sí** para que se vea el modelo funcionando de verdad:

```
Sprints  2026.01  ──┐
                    ├──  Projects  🔸 EJEMPLO · Migración del módulo de facturación
Repos    🔸 EJEMPLO ┘         │         (Progress 40 % — 2 de 5 checkboxes)
                              ├──  Dev Log       🔸 EJEMPLO · Implementar validación…
                              └──  Document Hub  🔸 EJEMPLO · Spec — Validación…
```

No son relleno: cada una **enseña una convención** en sus propios campos.

| Ejemplo | Qué enseña |
|---|---|
| `Sprints` | El título es `2026.01` **sin** la palabra EJEMPLO, a propósito: demuestra la convención real. La marca va en `Objective`. |
| `Repos` | Que `Provider` se lee y no se asume · para qué sirve `Requires VPN` · qué hace `Local Path` |
| `Projects` | Los 5 checkboxes moviendo `Progress` · y en el **cuerpo de la página**, los 4 encabezados canónicos con una decisión documentada al estilo correcto |
| `Dev Log` | Que `Verified` exige evidencia real — *"compiló" no es verificación* · para qué sirve `Author` |
| `Document Hub` | Qué merece promoverse y qué no · por qué `Source Path` se verifica contra el disco |

**Borralas al empezar.** Están para leerse una vez, no para quedarse.

### 4.6 · Lo mínimo para que los agentes no pregunten

```
1. Un ciclo en Sprints con Status = Active
   → sin esto, COMPASS pregunta y ECHO no puede delimitar el KPI

2. Al menos un Repo con Local Path y Provider
   → sin esto, FORGE y RELAY no encuentran el código
```

---

## 5. Higiene periódica — detectar drift

`verify-devcodex.mjs` no es solo de instalación. Es el **detector de drift** de la Regla #9.

Un campo renombrado a mano en la UI **no da error**: rompe la Regla #7 en silencio, y se descubre cuando un agente escribe en un campo que ya no existe. Ya pasó en esta instancia — al renombrar `Learning` → `Training`, las relaciones inversas quedaron llamándose `Learning`.

```bash
NOTION_TOKEN=ntn_xxx node Notion/verify-devcodex.mjs
```

Devuelve **exit code 1** si hay diferencias, así que sirve en CI o en un cron.

Los **avisos** (⚠️) son propiedades que existen pero no están en el esquema. **No siempre son un problema** — pueden ser extensiones legítimas. En la instancia original aparecen `Sprints.Blocked by` y `Sprints.Blocking`, que son las propiedades de dependencia nativas de Notion agregadas a mano.

---

## 6. Archivos de esta carpeta

```
Notion/
├── DEVCODEX_TEMPLATE.md      ← este archivo · guía de replicación
├── devcodex-schema.json      ← esquema canónico · 10 bases · 90 propiedades · sin IDs
└── verify-devcodex.mjs       ← verificador · solo lectura · exit 1 si hay drift
```
