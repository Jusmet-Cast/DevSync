# DEVSYNC — PLANTILLA CANÓNICA DE KPI MENSUAL
**Versión:** 1.0 · 10 Ago 2026
**Agente dueño:** ECHO (`/kpi [mes]`)
**Destino:** `Notas Finales` de la página del proyecto en DevCodex — máx. **1 nota activa por mes**

Derivada de **`FORMATO_Julio2026`**, que es el **único formato vigente** (confirmado por el usuario, 10 Ago 2026).

Los otros 12 reportes en `C:\Documentos Work\Documents\KPI's\` son **formatos deprecados**. Sirven como referencia histórica de tono, granularidad y nivel de detalle esperado — **nunca como plantilla estructural**. Cuando este archivo y un reporte viejo discrepan, gana este archivo.

---

## 1. QUÉ ES ESTE DOCUMENTO

El KPI mensual es un reporte **corporativo** que justifica el trabajo del mes ante el Product Owner y la auditoría interna de la organización contratante. No es una métrica interna: es un entregable con audiencia.

⚠️ **Esta plantilla describe el formato exigido por la organización corporativa actual del usuario** — derivada de sus reportes reales. **No es el formato universal de KPI.** Otra organización puede exigir secciones, métricas y cadencia distintas.

Ante un cliente corporativo nuevo, ECHO aplica la **Regla #13**: busca sus reportes previos en `Document Hub` (`Category = KPI Report`, filtrado por `Projects.Client`) y deriva SU formato por Protocolo de Espejo. Si no hay historial, **pregunta**. Nunca aplica el formato de un cliente a otro.

Este archivo define su **estructura canónica** para que ECHO la genere igual todos los meses, en vez de que la forma se decida de nuevo cada vez.

⚠️ **Aplica solo a proyectos `Engagement = Corporate`.** Los `Freelance` no rinden KPI ante nadie — su cierre de mes es distinto y más liviano (ver §6).

---

## 2. ESTRUCTURA CANÓNICA

```
1  CONTENIDO                          (índice autogenerado)

2  COMPROMISOS DEL MES
   2.N  <Título del compromiso>       ← uno por entregable, N = 1..n
        2.N.1  Departamento:          ← Farmacia · Retail · Corporativo · …
        2.N.2  Descripción:           ← qué se hizo, técnico y verificable
        2.N.3  Pull Request:
               Enlace:   <url del PR>
               Commit:   lista numerada — url + mensaje + (AAAA-MM-DD)

3  PRODUCT OWNER
   3.1  Satisfacción:                 ← evidencia (captura)

4  CUMPLIMIENTO DE POLÍTICAS          ← evidencia (capturas)

5  CUMPLIMIENTO DE TIEMPOS
        Horas meta del mes    <n>h
        Horas registradas     <n>h   ← nombre de la herramienta de time
                                       tracking según la organización
        Días de vacaciones    <n> (<n×jornada>h)
        Total                 <n>h
```

En la organización corporativa actual la herramienta es **Hubstaff** y la jornada **8 h**. Ambos son **datos de esa empresa**, no del sistema.

### Regla de anidamiento

Los compromisos van **anidados bajo `2 Compromisos del Mes`** (`2.1`, `2.2`, …). Esta es la forma correcta y es la que usa el formato de julio 2026.

⚠️ Junio 2026 y meses anteriores ponían cada compromiso como **sección de primer nivel** (`2`, `3`, `4`, `5`, `6`), lo que empuja la numeración de `Product Owner` y `Cumplimiento de Tiempos` un número distinto cada mes. **No replicar ese patrón** — hace imposible referenciar "sección 5" de forma estable entre meses.

---

## 3. NOMBRES DE SECCIÓN — CONGELADOS

La deriva de nombres entre meses es el problema más grave del histórico. Estos nombres **no se cambian**:

| # | Nombre canónico | Variantes históricas a NO usar |
|---|---|---|
| 2 | `Compromisos del Mes` | *(estable)* |
| 3 | `Product Owner` | *(estable)* |
| 3.1 | `Satisfacción` | `Reunión de retrospectiva` (jun-2026) |
| 4 | `Cumplimiento de Políticas` | `Auditoría Interna` (jun-2026) |
| 5 | `Cumplimiento de Tiempos` | *(estable)* |

Si el nombre debe cambiar, se cambia **acá primero** y se registra en la bitácora (§7). Nunca ad-hoc en el documento del mes.

---

## 3.5 DELIMITACIÓN DEL PERÍODO — EL SPRINT MANDA, NO EL CALENDARIO

**Decisión del usuario, 10 Ago 2026.** El período de un KPI lo definen los **sprints**, no el mes calendario.

```
KPI "Julio 2026"  ==  sprints 2026.07-S1 + 2026.07-S2
                      → todos los commits de esos sprints,
                        sin importar en qué mes caiga la fecha
```

Esto explica el hallazgo K-03: `FORMATO_Julio2026` trae commits de 2026-08-01 a 08-04 porque el sprint `2026.07-S2` **cerró en los primeros días de agosto**. No era un error de nombre — el mes calendario nunca fue el criterio.

### Consecuencias para ECHO

1. **`/kpi [mes]` resuelve primero los sprints de ese mes**, y de ahí saca el conjunto de trabajo. Nunca filtra `Dev Log.Date` por mes calendario — eso perdería el trabajo de cierre y contaría el del mes anterior.
2. **La base `Sprints` es una dependencia dura**, no un nice-to-have. Sin ella, `/kpi` no tiene de dónde derivar el período. Esta es la razón real por la que `Sprints` importa.
3. Un mes son normalmente **dos sprints** (`-S1` y `-S2`), lo que sigue siendo compatible con "una sola nota de KPI activa por mes": la nota cubre ambos.
4. Cuando un sprint queda **abierto** al momento de generar el KPI, ECHO lo declara explícitamente: `sprint 2026.08-S2 en curso — datos parciales`. Nunca reporta un sprint abierto como si estuviera cerrado.
5. Un proyecto con varios sprints (ej. `Migración Generales` está en `2026.05-S2`, `2026.06-S1` y `2026.07-S1`) aparece en el KPI de **cada** uno de esos meses, con el trabajo correspondiente a cada sprint.

---

## 4. CAMPOS Y SU ORIGEN DE DATOS

Ningún dato se inventa. Cada campo tiene una fuente:

| Campo | Fuente | Agente |
|---|---|---|
| **Período** | `Sprints` del mes (`AAAA.MM-S1` + `-S2`) — ver §3.5 | COMPASS |
| Título del compromiso | `Dev Log.Entry` agrupado por `Project` | ECHO |
| Departamento | `Projects.Client` → mapeo a departamento | PILOT |
| Descripción | `Dev Log.Summary` de las entradas del sprint | SCRIBE |
| Enlace del PR | `Repos` + PR real del proveedor | RELAY |
| Commits (url · mensaje · fecha) | historial git del repo | RELAY |
| Horas meta del mes | **días hábiles × jornada de la organización** — calculado | ECHO |
| Horas registradas | herramienta de time tracking — **input del usuario**, sin integración | — |
| Días de vacaciones | **input del usuario** | — |
| Total | `registradas + (vacaciones × jornada)` — calculado | ECHO |
| Satisfacción del PO | captura — **input del usuario** | — |
| Cumplimiento de Políticas | capturas — **input del usuario** | — |

### Regla de Confianza (Regla #8)

Toda descripción que ECHO genere desde `Dev Log` hereda el campo `Confidence` de esas entradas. Si **alguna** entrada del compromiso es `Estimated`, el compromiso se marca visiblemente como estimado. **Un KPI corporativo no puede contener afirmaciones estimadas sin declararlo** — eso es lo que lo vuelve auditable en vez de decorativo.

---

## 5. PROVEEDOR DE REPOSITORIOS — SE LEE, NO SE ASUME

El proveedor **siempre se resuelve desde `Repos.Provider`**, nunca por defecto. Lo que sigue es el caso de la organización corporativa actual, a modo de ejemplo de por qué importa.

Sus commits **no están en GitHub**. Están en **Azure DevOps / TFS on-premise**:

```
https://sertfs.grupofarsiman.com/tfs/GrupoFarsimanCollection/Farmacia/_git/<repo>/pullrequest/<id>
https://sertfs.grupofarsiman.com/tfs/GrupoFarsimanCollection/Farmacia/_git/<repo>/commit/<sha>
```

Consecuencias generales para RELAY:
- **No existe un proveedor por defecto.** Asumir GitHub es el error clásico: hoy el caso dominante de este usuario es Azure DevOps.
- Si el servidor es **on-premise**, requiere red corporativa o VPN → RELAY lee `Repos.Requires VPN` y degrada con gracia, en vez de morir en un timeout opaco.
- Cada proveedor tiene su **propio formato de URL** de PR y commit. RELAY lo deriva de `Repos.URL`, nunca de una plantilla hardcodeada.

Repo del caso actual: `EcommerceServiciosGenerales` — ver `Repos` en DevCodex para los datos vivos.

---

## 6. CIERRE DE MES PARA FREELANCE

Los proyectos `Engagement = Freelance` no rinden ante un PO. Su cierre es:

```
1  RESUMEN DEL MES
2  ENTREGABLES            (título · descripción · estado)
3  HORAS INVERTIDAS       (desde Dev Log.Time Spent (h))
4  PENDIENTES / BLOQUEOS
5  FACTURACIÓN            ← input del usuario
```

Sin `Departamento`, sin `Cumplimiento de Políticas`, sin `Satisfacción del PO`.

---

## 7. GESTIÓN DE LA NOTA EN NOTION

Requisito del usuario: **máximo una nota de KPI activa por mes**, dentro de `Notas Finales` de la página del proyecto.

```
# Notas Finales
  ## KPI · 2026.08              ← nota activa del mes
     ### Compromisos del Mes
     ### Product Owner
     ### Cumplimiento de Políticas
     ### Cumplimiento de Tiempos
  ## KPI · 2026.07 (cerrado)    ← congelada al cambiar de mes
```

- Al cambiar de mes: la nota anterior se marca `(cerrado)` y se abre una nueva.
- Si una nota crece más allá de lo manejable, se fragmenta en `KPI · 2026.08 — Parte 2.0`. **No se sigue estirando.**
- Los encabezados de las 4 secciones raíz de la página (`Descripción de Requerimiento`, `Información Preliminar`, `Documentación de Desarrollo`, `Notas Finales`) son **Heading 1**. Todo lo que cuelgue de ellas va como `##` / `###` **hijo**, nunca hermano.

---

## 8. HALLAZGOS DEL HISTÓRICO

| # | Hallazgo | Severidad |
|---|---|---|
| K-01 | El nivel de anidamiento de los compromisos cambia entre meses → la numeración de `Product Owner` y `Cumplimiento de Tiempos` se corre. Congelado en §2. | 🟡 MEDIO |
| K-02 | `Cumplimiento de Políticas` (jul) vs. `Auditoría Interna` (jun) y `Satisfacción` vs. `Reunión de retrospectiva`: la misma sección con dos nombres. Congelado en §3. | 🟡 MEDIO |
| K-03 | `FORMATO_Julio2026` contiene commits fechados 2026-08-01 a 2026-08-04 | ✅ **RESUELTO** 10 Ago 2026 — no era un error: el período lo define el **sprint**, no el mes calendario. Ver §3.5. |
| K-04 | Julio repite el **mismo PR (`16230`) en los 5 compromisos**. Si es correcto, un PR agrupa varios compromisos y la relación es 1:N — el modelo de datos debe soportarlo. | 🟢 BAJO |
| K-05 | En julio, algunos commits traen mensaje y fecha; en junio los commits son **solo URL, sin mensaje ni fecha**. El mensaje y la fecha son obligatorios de acá en adelante — son lo que hace verificable el reporte. | 🟡 MEDIO |
| K-06 | `Horas meta del mes` varía (192h jun → 200h jul) | ✅ **RESUELTO** 10 Ago 2026 — es **días hábiles × 8**, ECHO lo calcula. Verificado: jun-2026 = 24 días × 8 = 192h ✓ · jul-2026 = 25 días × 8 = 200h ✓. Sin tabla de feriados: si un mes cae feriado, el usuario lo ajusta a mano. |
| K-04 | Julio repite el mismo PR (`16230`) en los 5 compromisos | ✅ **RESUELTO** 10 Ago 2026 — confirmado por el usuario: a veces todo un mes o sprint va en **un solo PR separado por commits**. No siempre, pero pasa. Modelado como 1:N (`Dev Log.Pull Request` es url por entrada, no relación). |
| K-08 | Solo el formato de **julio 2026** es vigente. Los 12 reportes anteriores son **formatos deprecados** | ✅ Registrado 10 Ago 2026 — sirven como referencia histórica de tono y granularidad, **nunca como plantilla**. Si se suben al Document Hub van con `Status = Deprecated`. |
| K-07 | Las secciones 3 y 4 son **solo capturas de imagen** — cero texto extraíble. ECHO nunca podrá generarlas; siempre serán input manual del usuario. Documentado, no es un defecto. | 🟢 BAJO |

---

## 9. HISTÓRICO DISPONIBLE

13 reportes en `C:\Documentos Work\Documents\KPI's\`:

```
2025:  Julio · Agosto · Septiembre · #FORMATO (mayo-2025) · #FORMATO-EJEMPLO (KPI_Guillermo_junio)
2026:  Enero · Febrero · Marzo · Abril · Mayo (+#FORMATO) · Junio (+#FORMATO docx) · Julio (FORMATO docx+pdf)
```

Esta es la **base de conocimiento retroactiva**: sirve para que ECHO calibre tono, granularidad y nivel de detalle esperado antes de generar el mes en curso — el Protocolo de Espejo (`NOTION_DATA_REGISTRY.md §6`) aplicado a documentos, no a filas.

Extracción: `pdftotext -layout` (disponible en `/mingw64/bin`). `poppler`/`pdftoppm` **no** está instalado, así que no hay render de páginas a imagen — solo texto.
