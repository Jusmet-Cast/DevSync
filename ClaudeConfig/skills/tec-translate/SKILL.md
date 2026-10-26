---
name: tec-translate
description: >
  Transcribe reuniones grabadas (.mp4/.mp3/.wav) con Whisper local (faster-whisper,
  100% offline, sin costo por minuto), opcionalmente diarizando (distinguiendo quién
  habla con pyannote.audio, requiere HF_TOKEN), y arma un borrador de "traducción técnica":
  qué proyecto(s) de DevCodex toca, qué entraría en Dev Log, y qué backlog/tareas
  técnicas se podrían delegar a los agentes de DevSync (FORGE, PILOT, etc.). Nunca
  escribe en Notion por su cuenta -- siempre muestra el borrador y espera confirmación
  (Regla #10). Pensada para reuniones de levantamiento de requerimientos con gente de
  negocio no técnica (entrevistas, validación de funcionalidad, reglas de negocio).
  Trigger: "transcribí esta reunión", "tec-translate", "pasame el backlog de esta
  reunión", "traducime esto a tareas técnicas", o cuando el usuario da un .mp4/.mp3
  de una reunión y pide sacarle contexto accionable.
license: Apache-2.0
metadata:
  author: Justyn A. Castro
  version: "1.1"
  last_change: "23-Oct-2026: agregada diarización con pyannote.audio (distingue quién habla, requiere HF_TOKEN) sobre la v1.0 creada el mismo día a partir de una necesidad real detectada en reunión con Contabilidad General sobre registro-comisiones-delivery-sucursal"
---

# TecTranslate — de reunión grabada a backlog técnico

## Qué resuelve

Las reuniones de levantamiento de requerimientos con negocio (Contabilidad, Créditos y
Cobros, etc.) generan contexto valioso que hoy se pierde o queda solo en la cabeza de
quien participó. Esta skill lo convierte en:

1. Un **transcript completo** del audio/video (texto + timestamps).
2. Un **borrador de clasificación**: a qué proyecto(s) de DevCodex pertenece, qué
   reglas de negocio se mencionaron, qué iría al Dev Log.
3. Un **borrador de backlog técnico**: las necesidades de negocio traducidas a tareas
   concretas, con el agente de DevSync sugerido para cada una (FORGE para desarrollo,
   SCRIBE para documentación, COMPASS si implica planificación de sprint, etc.).

**Nunca escribe nada en Notion ni crea tasks reales por su cuenta.** Todo lo anterior
se presenta como propuesta en el chat — el usuario confirma, ajusta o descarta antes
de que cualquier cosa se persista (Regla #10 de `DEVSYNC_SYSTEM_PROMPT.md`).

## Roadmap (fuera de alcance hoy, no implementar sin que se pida)

Integración como bot en Google Meet/Teams para capturar audio en vivo sin depender de
un archivo grabado manualmente. Hoy el flujo es manual: alguien graba la reunión y pasa
el archivo.

## Paso 1 — Transcribir

Motor: **faster-whisper, local** (instalado 23-Oct-2026 vía `py -m pip install --user
faster-whisper`, Python 3.14 — ver `~/.claude/skills/tec-translate/transcribe.py`).
100% offline: ningún audio sale de esta máquina, sin costo por minuto, sin límite de
uso. Contrapartida: en CPU (sin GPU) es más lento que una API en la nube — una hora de
audio puede tardar bastante con el modelo `small`.

```bash
py ~/.claude/skills/tec-translate/transcribe.py "<ruta al .mp4/.mp3>" ["<carpeta salida>"] [modelo] [idioma] [diarizar]
```

- `modelo`: `tiny` | `base` | `small` (default) | `medium` | `large-v3`. Más grande =
  más preciso y más lento. Para una primera pasada, `small` es el balance razonable en
  CPU. Si la transcripción sale con errores notorios en términos técnicos/nombres
  propios, repetir con `medium`.
- `idioma`: `es` (default, español) o `auto` para autodetección. No forzar `en` salvo
  que la reunión sea en inglés.
- `diarizar`: `si` (default) o `no`. Ver sección "Diarización" abajo — requiere
  `HF_TOKEN` seteado. Si falta el token o la librería, el script avisa por consola y
  sigue transcribiendo igual, solo que sin etiqueta de hablante.

Esto genera `<nombre>.transcript.txt` (texto plano con timestamp por segmento) y
`<nombre>.transcript.vtt` (subtítulos, útil si alguien quiere revisar sincronizado con
el video) en la carpeta de salida.

**Antes de correrlo**: confirmar con el usuario la carpeta de salida si no la dio
explícita — no asumir que el archivo original puede/debe escribirse al lado si está en
una carpeta compartida o de red.

### Diarización (quién dijo qué)

Instalado 23-Oct-2026: **`pyannote.audio`** (modelo `pyannote/speaker-diarization-3.1`),
corre local sobre CPU igual que Whisper — ningún audio sale de la máquina. Whisper por
sí solo NO distingue hablantes; esto es lo que agrega la etiqueta `[HABLANTE_N]` a cada
línea del transcript, cruzando los segmentos de Whisper con los turnos de habla que
detecta pyannote por solapamiento de tiempo.

**Requiere, una sola vez por máquina:**

1. Crear una cuenta gratis en [huggingface.co](https://huggingface.co) si no hay una.
2. Aceptar las condiciones de **dos** modelos (son gratis, pero piden aceptar términos
   explícitamente antes de dejar descargar los pesos):
   - [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
   - [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
3. Generar un token de acceso: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
   → "New token" → tipo **Read** alcanza.
4. Setear la variable de entorno `HF_TOKEN` con ese valor (persistente, no por sesión):
   ```powershell
   [Environment]::SetEnvironmentVariable("HF_TOKEN", "hf_xxxxxxxxxxxx", "User")
   ```
   Hace falta abrir una terminal nueva después de setearla para que la vea.

Sin el token (o si `pyannote.audio` no está instalado), el script **no falla** — avisa
por consola y transcribe igual, solo que sin etiqueta de hablante. La diarización nunca
debe ser un bloqueante para tener el transcript.

**Costo en tiempo**: la diarización corre ADEMÁS de Whisper (son dos pasadas sobre el
audio), así que una reunión larga tarda sensiblemente más con `diarizar=si` que sin
ella. Para una primera prueba rápida sin importar quién dijo qué, usar `diarizar=no`.

## Paso 2 — Leer el transcript completo

Usar `Read` sobre el `.transcript.txt` generado. Si es muy largo, leerlo completo de
todas formas (no resumir a partir de una lectura parcial) — es la única forma de no
perderse una regla de negocio mencionada de pasada a mitad de reunión.

## Paso 3 — Cruzar contra el estado real de DevCodex

Antes de proponer a qué proyecto pertenece, **resolver en vivo** (Regla #1, nunca
asumir):

1. `mcp__notion__API-query-data-source` sobre `Projects` (ver
   `NOTION_DATA_REGISTRY.md`) para tener el universo real de proyectos activos y sus
   `Client`/`Engagement`.
2. Si el transcript menciona nombres de pantallas, tablas o procesos ya tocados en
   sesiones anteriores, usar `mcp__engram__mem_search` para traer contexto técnico
   relacionado (ej. si la reunión fue sobre comisiones de delivery, buscar qué ya se
   sabe de ese requerimiento antes de proponer tareas que ya están hechas).
3. Nunca inventar un proyecto que no existe en DevCodex — si no hay match claro,
   decirlo explícitamente en el borrador ("no identifiqué a qué proyecto de DevCodex
   pertenece esto, ¿lo creamos como uno nuevo o pertenece a X que no tengo mapeado?").

## Paso 4 — Armar el borrador (formato de salida)

Presentar siempre en este orden, como texto en el chat — nunca como escritura directa:

```
## Resumen ejecutivo
[2-4 líneas: de qué trató la reunión, quién participó si se identifica, y el resultado
general]

## Reglas de negocio / necesidades detectadas
- [Cada regla o necesidad mencionada, en lenguaje de negocio, citando con qué minuto
  del transcript se puede verificar -- ej. "(ver 00:14)"]

## Proyecto(s) de DevCodex candidatos
- [Nombre exacto del proyecto en Projects, o "ninguno identificado" si no hay match]

## Backlog técnico propuesto
| # | Tarea técnica | Agente sugerido | Por qué |
|---|---|---|---|
| 1 | [tarea concreta y accionable, no la necesidad de negocio sin traducir] | FORGE/PILOT/SCRIBE/COMPASS | [1 línea] |

## Candidato de entrada Dev Log
[Borrador de Entry/Summary tal como se escribiría en Dev Log -- NO se crea todavía]

## Preguntas abiertas / ambigüedades
- [Cualquier punto del transcript que no se pudo traducir con certeza a una tarea o
  regla clara -- mejor marcarlo que inventar una interpretación]
```

## Paso 5 — Esperar confirmación

Terminado el borrador, preguntar explícitamente qué hacer con cada sección (crear la
entrada de Dev Log, crear las tasks reales, ajustar la clasificación de proyecto,
etc.). Ninguna escritura en Notion ni creación de tasks ocurre hasta que el usuario lo
confirme punto por punto o en bloque.
