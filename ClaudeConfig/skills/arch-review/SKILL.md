---
name: arch-review
description: Auditoría de Clean Architecture sobre el diff actual — violaciones de capas, SOLID, complejidad, naming y seguridad.
argument-hint: "[opcional: ruta o area a revisar]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, Skill
---

# Arch Review — Auditoría del diff actual

Auditá los cambios actuales contra los estándares del equipo. Alcance: **$ARGUMENTS**
(si viene vacío, el diff completo del working tree).

## Procedimiento

1. **Cargá las reglas base ANTES de mirar el diff.** Con el tool `Skill`, una por una:
   `cc-architecture`, `cc-solid`, `cc-complexity`, `cc-naming`, `cc-domain-services`.

   > Esto NO es opcional y NO es automático. El frontmatter de una skill **no puede** precargar
   > otras skills (no existe un campo `skills:` en `SKILL.md` — es campo de sub-agente). Si no las
   > cargás explícitamente acá, estás auditando de memoria y los hallazgos no tienen regla atrás.

2. `git diff --stat` y `git diff` para ver qué cambió realmente. Si no hay cambios sin commitear,
   usá `git diff HEAD~1` y avisá que estás revisando el último commit.
3. Leé los archivos tocados completos cuando el diff no alcance para juzgar el contexto.
4. Ampliá según el stack tocado: si el diff toca `.ts`/`.html`, cargá también `angular-core` y
   `typescript-advanced`; si toca endpoints o SQL, `dotnet-api-security` y `efcore-data-access`.

## Formato del reporte

Agrupado por severidad, cada hallazgo con `archivo:línea`:

```
🔴 CRITICAL — violación de dependencia de capas, lógica de negocio en controller o repository,
              secreto hardcodeado, SQL sin parametrizar, IDOR
🟡 WARNING  — SOLID, complejidad > 10, naming, DTO impuro, scope creep
🔵 SUGGESTION — legibilidad, duplicación menor
```

Por cada hallazgo, tres cosas y nada más:

```
[🟡 WARNING] ValeAppService.cs:88 — Constructor con 9 dependencias
  Regla: cc-complexity §5 (SonarQube S107, máximo 7)
  Fix: crear ValeAppServiceOptions con propiedades `required init` y registrar con factory lambda
```

## Reglas duras

- **Nombrá siempre la regla violada.** Sin regla nombrada, el hallazgo es opinión → va como
  SUGGESTION, nunca como CRITICAL.
- **No inventes hallazgos para llenar el reporte.** "Sin violaciones detectadas en los N archivos
  revisados" es un resultado válido y valioso. Decilo en una línea y terminá.
- **No apliques los fixes.** Esto es review: reportás, el humano decide.
- Cerrá con un veredicto: ✅ limpio · ⚠️ hay warnings a mirar · ❌ hay críticos, no mergear.
