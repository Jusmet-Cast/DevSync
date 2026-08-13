# DEVSYNC — REGISTRO MAESTRO DE BASES DE DATOS NOTION
**Versión:** 1.0
**Fecha de emisión:** 8 Ago 2026
**Estatus:** 🔴 ARCHIVO CANÓNICO — Todo agente de DevSync con acceso a Notion debe consultar este archivo ANTES de leer o escribir cualquier base.

Datos verificados en vivo contra el workspace real (DevCodex) el **8 Ago 2026** vía Notion MCP.

---

## 1. PROPÓSITO

Mismo rol que `NOTION_DATA_REGISTRY.md` en AreSync: el mapa que permite que cualquier agente sepa qué base gobierna qué dominio, el schema exacto tal como existe hoy en Notion, y cómo generar entradas consistentes con el estilo del usuario en vez de inventar estructura nueva.

**Regla de oro:** los nombres de campo se copian carácter por carácter desde este archivo. No se traducen, no se normalizan, no se "corrigen". Ver §5 — hay campos con espacios iniciales que rompen escrituras si se limpian.

---

## 2. MAPA DE MÓDULOS DEVCODEX

Root DevCodex (page): `210ef7d9-a13c-80ce-b255-f2c311e0b458`

| Módulo | Database ID | Data Source ID | Agente(s) dueño(s) |
|---|---|---|---|
| **Projects** | `211ef7d9-a13c-8060-87d2-fd5ceae22122` | `211ef7d9-a13c-80fb-964b-000b5d4881de` | PILOT, RELAY, ECHO |
| **Training** | `210ef7d9-a13c-810d-af8b-d512eaf2ad25` | `210ef7d9-a13c-8142-a380-000b59a8e614` | MENTOR |
| **Notes** | `210ef7d9-a13c-81d5-b7fd-ddd537c1d174` | `210ef7d9-a13c-8148-bf97-000baefa35dc` | MENTOR |
| **Toolkit** | `211ef7d9-a13c-8014-b297-d57f6be57ea4` | `211ef7d9-a13c-8076-90fd-000bb40fd1f3` | SCRIBE |
| **Technologies** | `211ef7d9-a13c-8032-9f57-d5c00f034a6c` | `211ef7d9-a13c-800d-9777-000bfcca0c25` | SCRIBE, MENTOR |
| **Resources** | `210ef7d9-a13c-8182-8a38-f6dfec266ae7` | `210ef7d9-a13c-819b-a7a1-000b8afa95fc` | MENTOR |
| **Sprints** | `3b8ef7d9-a13c-80b3-9c87-d6fb25a3451a` | `3b8ef7d9-a13c-80f7-b973-000b1bae4b06` | COMPASS, PILOT |
| **Repos** | `3b8ef7d9-a13c-802d-b601-d008db8fbb70` | `3b8ef7d9-a13c-804b-b54a-000b6dd35777` | RELAY |
| **Dev Log** | `3b8ef7d9-a13c-80e4-9d74-f17b82058b85` | `3b8ef7d9-a13c-800b-89f3-000b4e6dcbfc` | FORGE, SCRIBE |
| **Document Hub** | `3b8ef7d9-a13c-80a8-bef8-cab4cf18e882` | `3b8ef7d9-a13c-80a6-a71e-000bb4dbd355` | SCRIBE, ECHO |

✅ Las **10 bases** fueron leídas en vivo y normalizadas a inglés técnico (8–10 Ago 2026). Cero campos en español en todo DevCodex.

Las 4 nuevas las creó el usuario a mano (obligado por `G-05`) y el agente les pobló el schema completo el 10 Ago 2026.

### Grafo de relaciones

```
                        Projects
        ┌──────────┬────────┴────────┬──────────────┐
        │          │                 │              │
     Sprints    Repos            Dev Log       Document Hub
        │          │                 │              │
        └──────────┴────────┬────────┴──────────────┘
                            │
                      Technologies ──┬── Toolkit
                                     ├── Resources
                                     └── Training ── Notes
```

`Projects` es el hub. Todo cuelga de ahí o de `Technologies`. Ninguna relación es huérfana.

---

## 3. SCHEMAS EXACTOS

### Projects ✅ verificado y normalizado 8 Ago 2026

```
Project name   (title)
Status         (status: Not started · Stop · In progress · Done)
               grupos: To-do [Stop, Not started] · In progress · Complete [Done]
Priority       (select: High · Medium · Low)
Sprints        (relation → Sprints, dual ↔ "Projects")   ← ver §3.1
Engagement     (select: Corporate · Freelance · Internal)
Client         (select — 14 opciones, ver §3.2)
Repos          (relation → Repos, dual ↔ "Projects")
Dev Log        (relation → Dev Log, dual ↔ "Project")
Documents      (relation → Document Hub, dual ↔ "Projects")
Assignee       (people)
Start Date     (date)
Files & media  (files)
Initiated      (checkbox)
Development    (checkbox)
Review         (checkbox)
Finalized      (checkbox)
Deployed       (checkbox)
Progress       (formula, read-only — promedio de los 5 checkboxes / 5)
```

`Progress` es **calculado**: no se escribe. Se mueve marcando los 5 checkboxes de ciclo de vida. Cada checkbox vale exactamente 20 %.

`Engagement` gobierna qué metodología aplica al ciclo de vida:
- `Corporate` → organización contratante. El ciclo, la metodología y el formato de reporte **los define ella** y se resuelven desde `Client`, `Sprints.Methodology` y el historial en `Document Hub`. Ciclo obligatorio.
- `Freelance` → cliente directo. Ciclo gestionado por el usuario. Ciclo opcional.
- `Internal` → herramienta o proyecto propio, sin cliente externo.

⚠️ **Regla #13:** ningún agente hardcodea el nombre de una organización ni sus convenciones. `Client` dice cuál es; el resto se deriva de los datos de esa organización.

#### 3.1 `Sprints` — relación, no multi_select

El campo `Sprint` (multi_select) fue **eliminado el 10 Ago 2026** tras migrar las 15 asignaciones a la relación `Sprints`. Era denormalización: el mismo dato en dos lados.

Convención de nombre — ver §3.6. `Sprints` es **exclusivamente temporal**; la modalidad de trabajo vive en `Engagement`, nunca acá.

#### 3.2 Opciones de `Client`

```
Personas:    Isai Carrasco · Ing. Guillermo Sandoval · Ing. Sofía Cruz ·
             Lic. Blanca Chicas · Lic. Teresa Rocha · Karen Rodriguez ·
             Wiliam Maldonado · Lic. Karen Hernández · Carlos Amaya
Entidades:   Grupo Dimanza · Nasas y Suministros del Caribe ·
             Avicola Cañaveral
Mixtos:      Feria Ing. Civil - UNITEC / Miguel y Juan ·
             Operadora Portuaria Centroamericana / Yailyn Mejia
```

⚠️ `Client` queda vacío en varios proyectos corporativos internos — es válido, no se rellena por inercia.

### Training ✅ verificado 10 Ago 2026 *(ex-`Learning`)*

```
Name          (title)
Platform      (multi_select: DevTalles · Edutin Academy · NetMentor ·
               YouTube · Universidad Grupo Farsiman)
Instructor    (rich_text)
Status        (status: Not started · In progress · Done)
Start Date    (date)
Link          (url)
Notes         (relation → Notes, dual_property ↔ "Training")
Technologies  (relation → Technologies, dual_property ↔ "Training")
Projects      (relation → Projects, single_property)
```

⚠️ **Renombrada por el usuario el 10 Ago 2026:** `Learning` → `Training`. El **ID no cambió**, así que ninguna referencia por ID se rompió. Lo que sí quedó inconsistente fueron las relaciones inversas (propiedades llamadas `Learning` apuntando a una base llamada `Training`) — corregidas en `Notes` y `Technologies` el mismo día.

La sección de la página sigue titulada `📚 Learning`; eso es el **encabezado visual**, no el nombre de la base. Los agentes usan `Training`.

⚠️ `Projects` sigue siendo `single_property`: Projects **no ve** la relación de vuelta. Convertirla a `dual_property` queda como H-05.

Los valores de `Platform` son nombres propios de instituciones — **no se traducen**.

### Notes ✅ verificado y normalizado 8 Ago 2026

```
Title           (title)
Start Date      (date)
End Date        (date)
Files & media   (files)
Training        (relation → Training, dual_property ↔ "Notes")
```

### Technologies ✅ verificado y normalizado 8 Ago 2026

```
Name           (title)
Type           (select: IDE · Framework · Tool · Query Language ·
                Platform · Language · Methodology · Concept · Other)
Documentation  (url)
Training       (relation → Training, dual_property ↔ "Technologies")
Toolkit        (relation → Toolkit, dual_property ↔ "Technologies")
Resources      (relation → Resources, dual_property ↔ "Technologies")
```

`Technologies` no es un catálogo de tecnologías en sentido estricto — es un catálogo de **"cosas con las que se trabaja"**. Por eso conviven un lenguaje (C#), un IDE (VS Code), una metodología (Scrum) y un concepto de arquitectura (API). Los tipos `Methodology` y `Concept` existen para que eso no obligue a mentir.

✅ Reclasificado 10 Ago 2026 con aprobación del usuario: `Scrum` → `Methodology` · `API` → `Concept` · `IA` → `Concept`.

### Toolkit ✅ verificado y normalizado 8 Ago 2026

```
Name          (title)
Created       (created_time, read-only)
Technologies  (relation → Technologies, dual_property ↔ "Toolkit")
```

### Resources ✅ verificado y normalizado 8 Ago 2026

```
Name          (title)
Created       (created_time, read-only)
Technologies  (relation → Technologies, dual_property ↔ "Resources")
```

---

### Sprints ✅ creada y poblada 10 Ago 2026

```
Sprint         (title — ver §3.6 para el formato)
Start Date     (date)
End Date       (date)
Objective      (rich_text)
Status         (select: Planned · Active · Closed)
Cadence        (select: Monthly · Biweekly · Custom)
Methodology    (select: Canvas · Scrum · Kanban · Ad-hoc)
Retrospective  (rich_text)
Projects       (relation → Projects, dual ↔ "Sprints")
Dev Log        (relation → Dev Log, dual ↔ "Sprint")
Documents      (relation → Document Hub, dual ↔ "Sprint")
```

`Status` es **`select`, no `status`** — decisión deliberada por `G-04`: las propiedades tipo `status` no son editables por API, así que un agente no podría cerrar un sprint. Con `select` sí puede.

---

## 3.6 AGNOSTICISMO DE METODOLOGÍA — principio de diseño

**Requisito explícito del usuario (10 Ago 2026):** DevSync no asume ninguna metodología. La metodología es **un dato del ciclo**, no una suposición del sistema.

Historia real del usuario, reconstruida desde sus propios datos:

| Período | Metodología | Cadencia | Formato de nombre |
|---|---|---|---|
| jul 2025 – may 2026 | Scrum | Quincenal (2/mes) | `AAAA.MM-S1` · `AAAA.MM-S2` |
| jun 2026 – hoy | Canvas | Mensual (1/mes) | `AAAA.MM` |

El corte está en **junio 2026** y es visible en el histórico: hasta mayo las etiquetas eran `Mayo 01 (2026)` / `Mayo 02 (2026)`; desde junio pasaron a `Jun (2026)` / `Jul (2026)` — mes entero, sin quincena.

### Reglas de nombre

```
Cadencia mensual:   AAAA.MM         →  2026.08
Cadencia quincenal: AAAA.MM-S1/-S2  →  2026.05-S2
Cadencia custom:    AAAA.MM-<slug>  →  2026.09-hotfix
```

Todas ordenan alfabéticamente = cronológicamente. Los campos `Cadence` y `Methodology` guardan **qué era** cada ciclo, así que un cambio de metodología **no reescribe la historia**: los ciclos viejos siguen diciendo `Scrum / Biweekly` y los nuevos `Canvas / Monthly`.

### Qué NO puede hacer un agente

- Asumir que un mes tiene dos ciclos, o uno.
- Asumir que un ciclo dura 15 o 30 días.
- Asumir que existe retrospectiva, daily o planning.
- Inferir la cadencia del nombre. **Se lee de `Cadence`.**

Al abrir un ciclo nuevo, COMPASS **lee la cadencia del ciclo anterior** y la propone; si el usuario la cambia, la registra en el ciclo nuevo sin tocar los anteriores.

### Repos ✅ creada y poblada 10 Ago 2026

```
Repository      (title)
URL             (url)
Provider        (select: Azure DevOps · GitHub · GitLab · Bitbucket · Local only)
Default Branch  (rich_text)
Active Branch   (rich_text)
Visibility      (select: Private · Internal · Public)
CI Status       (select: Passing · Failing · Not configured · Unknown)
Requires VPN    (checkbox)
Last Deploy     (date)
Local Path      (rich_text)
Notes           (rich_text)
Projects        (relation → Projects, dual ↔ "Repos")
Stack           (relation → Technologies, dual ↔ "Repos")
Dev Log         (relation → Dev Log, dual ↔ "Repository")
Documents       (relation → Document Hub, dual ↔ "Repository")
```

`Requires VPN` existe porque un proveedor puede ser **on-premise** y exigir red corporativa. RELAY lo consulta **antes** de intentar conectarse y degrada con gracia, en vez de morir en un timeout opaco. En el workspace actual el caso dominante es Azure DevOps on-premise, pero el campo es genérico: **el proveedor se lee de `Provider`, nunca se asume**.

`Local Path` mapea el repo al disco — es lo que permite que los agentes SDD encuentren el código del proyecto que están documentando.

### Dev Log ✅ creada y poblada 10 Ago 2026

```
Entry           (title)
Date            (date)
Type            (select: Feature · Bugfix · Refactor · Test · Deploy ·
                 Spike · Docs · Config · Support)
Summary         (rich_text)
Confidence      (select: Verified · Estimated)     ← Regla #8
Time Spent (h)  (number)
Pull Request    (url)
Author          (select: Human · FORGE · SENTRY · RELAY · SCRIBE ·
                 PILOT · COMPASS · ECHO · MENTOR · CIPHER)
Project         (relation → Projects, dual ↔ "Dev Log")
Sprint          (relation → Sprints, dual ↔ "Dev Log")
Repository      (relation → Repos, dual ↔ "Dev Log")
Technologies    (relation → Technologies, dual ↔ "Dev Log")
```

`Pull Request` es **url por entrada, no relación**: un mismo PR agrupa varias entradas (confirmado por el usuario — a veces todo un sprint va en un solo PR separado por commits). La relación PR↔entrada es **1:N** y así queda modelada.

`Author` es lo que hace auditable la autoría: se ve de un golpe qué escribió un humano y qué generó un agente.

### Document Hub ✅ creada y poblada 10 Ago 2026

```
Doc name           (title)
Category           (multi_select — 14 opciones, ver abajo)
Status             (select: Draft · In Review · Approved · Superseded · Deprecated)
Confidence         (select: Verified · Estimated)
Source Format      (select: Markdown · PDF · DOCX · XLSX · Image · Native Notion)
Source Path        (rich_text — ruta del archivo original en disco)
Notes              (rich_text)
Created time       (created_time, read-only)
Last updated time  (last_edited_time, read-only)
Created by / Last edited by  (read-only)
Projects           (relation → Projects, dual ↔ "Documents")
Sprint             (relation → Sprints, dual ↔ "Documents")
Repository         (relation → Repos, dual ↔ "Documents")
Technologies       (relation → Technologies, dual ↔ "Documents")
```

`Category` (multi_select, un doc puede ser varias cosas a la vez):
```
Validation · Test Plan · KPI Report · Architecture · Spec ·
Migration Status · Runbook · Postmortem · Meeting Notes · Reference ·
Proposal · Planning · Strategy doc · Customer research
```

Las últimas cuatro venían de la plantilla original de Notion y se conservaron: sirven para el trabajo de producto y preventa, no solo de código.

---

## 3.9 DOCTRINA — PÁGINA DE PROYECTO vs. DOCUMENT HUB

Las dos guardan documentación, y sin una regla clara se pisan. La regla es el **estado del documento**, no su tema:

| | Página del proyecto | Document Hub |
|---|---|---|
| **Qué guarda** | Documentación **sobre la marcha** — lo que se está pensando y decidiendo ahora | Documentación **precisa y entregable** — lo que ya está resuelto |
| **Naturaleza** | Viva, se reescribe, es un borrador permanente | Versionada, se aprueba, se supersede pero no se reescribe |
| **Ejemplos** | notas de sesión, hallazgos en curso, decisiones a medio tomar, KPI del mes en curso | `ValidacionCodigo.md`, `PlanDePruebas.md`, KPI cerrado, ADR, postmortem, runbook |
| **Ciclo** | muere cuando el proyecto cierra | sobrevive al proyecto — es base de conocimiento |
| **Dueño** | SCRIBE (`/doc`) | SCRIBE (`/publish`) |

**El movimiento canónico:** un documento **nace** en la página del proyecto y **se promueve** al Hub cuando queda firme.

```
página del proyecto            Document Hub
(Documentación de Desarrollo)  (Status = Approved)
        │                              ▲
        │  el doc madura, se valida    │
        └──────────  /publish  ────────┘
```

Al promover, SCRIBE:
1. Crea la entrada en el Hub con `Source Path` apuntando al archivo real en disco.
2. Setea `Source Format` y `Category`.
3. Hereda `Confidence` de las entradas de `Dev Log` que lo respaldan.
4. Enlaza `Projects`, `Sprint`, `Repository` y `Technologies`.
5. Deja en la página del proyecto un **link al Hub**, no una copia. Duplicar el contenido garantiza drift.

**Nunca se duplica contenido entre los dos lados.** La página apunta al Hub; el Hub apunta al disco vía `Source Path`. Una sola fuente de verdad por documento.

### Casos ya identificados para el Hub

| Documento | Category | Format |
|---|---|---|
| `D:\JACASTRO\Farmacia\Desarrollo\Migracion\EcommerceServiciosGenerales\IA\ValidacionCodigo.md` | Validation | Markdown |
| `D:\JACASTRO\Farmacia\Desarrollo\Migracion\EcommerceServiciosGenerales\IA\PlanDePruebas.md` | Test Plan | Markdown |
| `CHECKOUT_STATUS.md` · `migration-status.md` | Migration Status | Markdown |
| `C:\Documentos Work\Documents\KPI's\FORMATO_Julio2026.docx` | KPI Report | DOCX |

⚠️ Los KPI previos a julio 2026 son **formatos deprecados**. Si se suben al Hub, van con `Status = Deprecated`. El único formato vigente es el de julio 2026 — ver `DEVSYNC_KPI_TEMPLATE.md`.

---

## 4. ESTRUCTURA DE PÁGINA DE PROYECTO (bloc de notas)

Cada entrada de `Projects` es también documento. El formato canónico del cuerpo es:

```
Descripción de Requerimiento:
### Información Preliminar:
### Documentación de Desarrollo:
### Notas Finales:
```

Convención acordada (pendiente de aplicar):
- Los cuatro encabezados pasan de `###` (Heading 3) a `#` (Heading 1).
- Todo lo que un agente genere dentro de una sección se cuelga como `##` / `###` **hijo** del encabezado que le corresponde — nunca como hermano.
- `Notas Finales` es el contenedor de KPIs: **máximo una nota de KPI activa por mes**. Al cerrar el mes, la nota se congela y se abre una nueva. Si una nota supera el tamaño manejable, se fragmenta en `Parte 2.0` en vez de seguir creciendo.

---

## 5. REGLAS DE ESCRITURA (aplican a todos los agentes DevSync)

1. **Nombres de campo literales.** Se copian carácter por carácter de §3. No se traducen ni se normalizan.
2. **`Progress` nunca se escribe** — es fórmula. Se mueve marcando checkboxes.
3. **Multi-select:** array de strings exactamente como aparecen en §3.1 / §3.2. Un valor inexistente **crea una opción nueva sin avisar** — verificar contra este archivo primero.
4. **Parent en creación:** usar `data_source_id`, no `database_id`, cuando la base tenga múltiples data sources.
5. **Confirmar el borrador con el usuario antes de escribir**, salvo que el comando lo prevea explícitamente.
6. **Protocolo de Espejo obligatorio** — ver §6.

### 5.1 ⚠️ Gotchas verificados de la API de Notion

Descubiertos en la normalización del 8 Ago 2026. No son teoría — cada uno se rompió en vivo:

| # | Comportamiento | Consecuencia |
|---|---|---|
| G-01 | **Renombrar una opción existente de select/multi_select vía `update-a-data-source` NO funciona.** Devuelve `200 OK` con la opción intacta. | Falla silenciosa. Verificar SIEMPRE la respuesta; nunca asumir éxito por el status code. |
| G-02 | Cambiar el `color` de una opción existente sí falla, pero con `400`: `Cannot update color of select with id: X`. | Al enviar opciones existentes, mandar solo `{"id": "..."}` sin `color`. |
| G-03 | Omitir una opción del array la **elimina** junto con su asignación en todas las páginas. | Solo omitir después de haber migrado las páginas. Es la vía legítima de borrado. |
| G-04 | Las opciones de una propiedad `status` **no son editables por API** en absoluto (ni nombre ni color ni grupos). | Renombrar opciones de status = cambio manual en la UI, sin excepción. |
| G-05 | **No se pueden crear bases de datos nuevas.** `API-create-a-data-source` responde `400`: *"Creating new databases with data sources is not supported in this endpoint for API version 2025-09-03 and later. Use the Create Database API instead"* — y esa API no está expuesta en el MCP. | El humano crea la base vacía en la UI; el agente después le puebla el schema con `update-a-data-source`. |

**Patrón correcto para renombrar opciones de un multi_select:**
```
1. Crear las opciones nuevas (mismo update, entradas sin id)
2. Migrar cada página: patch-page reasignando old → new
3. Segundo update omitiendo las opciones viejas → se borran
```
Nunca en un solo paso.

---

## 6. PROTOCOLO UNIVERSAL — GENERACIÓN DE ENTRADA POR ESPEJO

```
PASO 1 — Leer las 2-3 entradas más recientes de la BD objetivo
         (ordenadas por su campo de fecha propio, o createdTime si no tiene)

PASO 2 — Extraer el patrón:
         - Qué campos se llenan siempre vs. cuáles suelen quedar vacíos
         - Formato de valores (unidades, redondeo, estilo de notas)
         - Selects/status más frecuentes → default coherente

PASO 3 — Mapear el input del usuario a esos campos exactos.
         Nunca inventar nombres de campo ni traducir los existentes.

PASO 4 — Mostrar el borrador ANTES de escribir.

PASO 5 — Escribir con parent = {"data_source_id": "..."}
```

Este es el mecanismo central: el sistema no solo lee Notion, aprende su propio patrón de registro y lo repite con consistencia.

---

## 7. HALLAZGOS ABIERTOS (bloquean ampliación de acceso)

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| H-01 | Credenciales de infraestructura en texto plano en `Quick Notes → Qote 3` | 🔴 CRÍTICO | ✅ **CERRADO** 8 Ago 2026 — verificado vacío. Pendiente: rotar la contraseña expuesta. |
| H-02 | `Client` duplicado por tilde: `Ing. Sofia Cruz` / `Ing. Sofía Cruz` | 🟡 MEDIO | ✅ **CERRADO** 8 Ago 2026 |
| H-03 | Campos ` Initiated` / ` Development` con espacio inicial | 🟡 MEDIO | ✅ **CERRADO** 8 Ago 2026 |
| H-04 | `Sprint` con 3 convenciones mezcladas, sin mes en curso, y con la modalidad de trabajo embebida | 🟡 MEDIO | ✅ **CERRADO** 8 Ago 2026 — migradas las 20 páginas a `AAAA.MM-S#`; modalidad extraída a `Engagement` |
| H-05 | `Projects (TODO: INTEGRAR)` en Learning: relation `single_property`, sin vuelta desde Projects | 🟢 BAJO | Abierto |
| H-06 | Callout "NEXT" apunta a una **vista enlazada** del mismo Projects, no a una base duplicada | 🟢 BAJO | Corrige el diagnóstico v1 de la propuesta |
| H-07 | `Status` conserva la opción `Stop` en vez de `Blocked` | 🟢 BAJO | ✅ **CERRADO** 8 Ago 2026 — corregido manualmente por el usuario |
| H-08 | Schemas de `Toolkit`, `Technologies` y `Resources` sin leer en vivo | 🟡 MEDIO | ✅ **CERRADO** 8 Ago 2026 — leídos y normalizados |
| H-09 | `Scrum` / `API` / `IA` clasificados como `Type = Tool` (herencia de `Herramienta`) | 🟢 BAJO | Abierto — reclasificación semántica, decisión del usuario |
| H-10 | Faltan las bases `Dev Log`, `Sprints` y `Repos` | 🟡 MEDIO | Abierto — bloqueado por G-05, requiere creación manual |

**Regla #6 desbloqueada:** con H-01 cerrado, los agentes de DevSync ya pueden recibir acceso de lectura amplio a DevCodex.

---

## 8. BITÁCORA DE NORMALIZACIÓN

**8 Ago 2026 — Normalización a inglés técnico y separación de dimensiones**

Renombres de propiedad: `Cliente`→`Client` · `Fecha Inicio`→`Start Date` · `Deployed/Certificate`→`Deployed` · ` Initiated`→`Initiated` · ` Development`→`Development`.

Campo nuevo: `Engagement` (Corporate / Freelance / Internal).

Migración de `Sprint`: 13 opciones renombradas a `AAAA.MM-S#` + 2 nuevas (`2026.08-S1/S2`) · 20 páginas reasignadas · 14 opciones legacy eliminadas · opción `Personal` promovida a `Engagement = Freelance` en los 6 proyectos que la tenían (VigaSoft F1, UovOs, NextPorta, TerramarSystems, FlowEmbarque, PostFlow). Los 14 restantes quedaron `Corporate`.

Criterio de la clasificación: declarado por el usuario — *"en esa sprint de Personal metía los proyectos de freelance"*. No fue inferencia del agente.

**8 Ago 2026 — Normalización completa de DevCodex a inglés técnico**

Segunda pasada, sobre las 5 bases restantes. Cero campos en español en todo el workspace.

| Base | Renombres |
|---|---|
| Learning | `Plataforma`→`Platform` · `Catedrático`→`Instructor` · `Estado`→`Status` · `Inicio`→`Start Date` · `Enlace`→`Link` · `Notas`→`Notes` · `Tecnología/s`→`Technologies` · `Projects (TODO: INTEGRAR)`→`Projects` |
| Notes | `Título`→`Title` · `Fecha Inicio`→`Start Date` · `Fecha Fin`→`End Date` |
| Technologies | `Documentación`→`Documentation` · `Tipo`→`Type` · `🛠 Resources`→`Resources` · `📚 Learning`→`Learning` |
| Toolkit | `Tecnología/s`→`Technologies` |
| Resources | `Fecha Creado`→`Created` · `Tecnologías`→`Technologies` |

Opciones de `Technologies.Type` migradas con el patrón de 3 pasos: `Herramienta`→`Tool` (6 págs) · `Lenguaje`→`Language` (2) · `Lenguaje de Consulta`→`Query Language` (1) · `Otro`→`Other` (1) · `Plataforma`→`Platform` (0) · `IDE` y `Framework` sin cambio. 5 opciones legacy eliminadas.

Los emojis se quitaron de los nombres de propiedad: rompen el matching literal exigido por la Regla #7 y obligan a escapar Unicode en cada llamada.

**10 Ago 2026 — Reorganización de la página y renombre `Learning` → `Training`**

El usuario reorganizó la página principal por bloques de usabilidad. Auditoría posterior: **las 10 bases intactas**, cero pérdidas de datos, todas las relaciones vivas.

Cambios detectados y propagados por el agente (Regla #3 — gana Notion):

| Cambio del usuario | Propagación |
|---|---|
| Base `Learning` renombrada a `Training` (mismo ID) | `Technologies.Learning` → `Technologies.Training` · `Notes.Learning` → `Notes.Training` · registro y system prompt actualizados |
| Secciones renombradas: `Bitácora` → `Dev Center` · `Entregables` → `Outputs` · `Playlist to Code` → `Code Sounds` | Solo encabezados visuales, sin impacto en agentes |
| Vista enlazada `NEXT` eliminada de la página | Sin pérdida de datos — era una vista de `Projects`, no una base |
| `Quick Notes` movido arriba de `Dev Center`; `Formato de Daily` movido a `Quick Notes` | Preferencia de layout, sin impacto |
| Iconos cambiados (`Projects` 🏗️ · `Dev Log` ✏️ · `Training` 🎒 · `Document Hub` 📄) | Cosméticos |

⚠️ **Distinción importante:** el encabezado visual de la sección sigue diciendo `📚 Learning`, pero la base se llama `Training`. Los agentes usan **siempre el nombre de la base**, nunca el del encabezado.
