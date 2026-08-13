# DevSync

Un ecosistema de agentes para Claude Code que orquesta tu día a día de desarrollo — proyectos, sprints, código, documentación y aprendizaje — con memoria persistente que sobrevive entre sesiones.

No es un plugin ni un prompt suelto. Es **tres capas que se necesitan entre sí**:

```
┌──────────────────────────────────────────────────────┐
│  CAPA 1 — GOBERNANZA          DevSync Core (main loop)│
│  Roles: PILOT · COMPASS · ECHO · SCRIBE · MENTOR ·    │
│         SENTRY · FORGE · RELAY · CIPHER               │
│  Vive en: System/*.md  →  base de conocimiento        │
├──────────────────────────────────────────────────────┤
│  CAPA 2 — EJECUCIÓN            Agentes de Claude Code │
│  dev-orchestrator · sdd-* (8) · judgment-day · jd-*   │
│  Vive en: ClaudeConfig/agents/  →  ~/.claude/agents/  │
├──────────────────────────────────────────────────────┤
│  CAPA 3 — ESTADO                   DevCodex (Notion)  │
│  Projects · Sprints · Dev Log · Repos · Training …    │
│  Vive en: la nube. Es la única fuente de verdad viva. │
└──────────────────────────────────────────────────────┘
```

Los roles de la Capa 1 no son procesos — son sombreros que se pone el main loop. Lo que se ejecuta de verdad son los agentes de la Capa 2, que leen y escriben contra el estado vivo de la Capa 3. Instalar una sola capa no sirve de nada; las tres son el sistema.

## Qué resuelve

- **Memoria que no se pierde**: el estado de tus proyectos, sprints y decisiones vive en Notion, no en el historial de una conversación que se puede compactar o cerrar.
- **Un rol para cada tipo de trabajo**: gestión de proyectos, planificación de ciclos, revisión de código con veto, desarrollo, documentación, formación y seguridad de secretos — cada uno con su propio dominio de datos.
- **Flujo SDD completo para features grandes**: `explore → propose → spec ∥ design → tasks → apply → verify → archive`, con review adversarial (`judgment-day`) antes de dar algo por cerrado.
- **Acceso dual**: terminal (Claude Code, siempre activo) y celular (Project de claude.ai), según cómo lo necesites.

## Instalación

Todo el paso a paso — requisitos, las tres capas, verificación y gotchas conocidos de la API de Notion — está en **[`INSTALL.md`](INSTALL.md)**.

Resumen de qué hay en cada carpeta:

```
DevSync/
├── INSTALL.md              ← guía completa de instalación
├── System/                 ← CAPA 1 · los 9 roles + registro de datos + plantilla de KPI
├── ClaudeConfig/           ← CAPA 2 · espejo portátil de ~/.claude (agentes, hooks, skills)
└── Notion/                 ← CAPA 3 · plantilla de DevCodex duplicable + verificador de schema
```

## Filosofía

> *"Los grandes proyectos se construyen con pequeños commits."*

CONCEPTOS > CÓDIGO. La IA ejecuta, el humano dirige. El sistema existe para que las decisiones queden **registradas, medibles y recuperables** — no para decidir por vos.
