---
name: branch-pr
description: >
  Flujo de trabajo con git: naming de branches, conventional commits, checklist previo a
  entregar el cambio y qué hace (y qué NO hace) el agente con git.
  Trigger: cuando se prepara un branch, se redacta un commit, se va a entregar un cambio para
  revisión, o se pregunta por la convención de versionado del equipo.
license: Apache-2.0
metadata:
  author: madian-velasquez
  version: "3.0"
  last_change: "Reescrita a git puro: se elimino todo el vocabulario de plataforma GitHub (labels type:*, status:approved, issues, Discussions) que no aplica al flujo real de trabajo"
---

# Flujo de Trabajo con git

> **Alcance:** git, nada más. Esta skill NO asume GitHub, GitLab ni ninguna plataforma: no habla
> de labels, issues ni Discussions, porque esas son features de plataforma, no de git.

## 1. Regla #1 — el agente NO ejecuta git de escritura

El agente **NUNCA** corre `git commit`, `git push`, `git merge`, `git rebase` ni `git cherry-pick`
en repos de proyecto. Prepara el working tree y resume el cambio; **el humano revisa y ejecuta**.

- Reforzado por el hook `git-guard.js`: no es confianza, es bloqueo.
- Lo que el agente SÍ puede correr sin restricción: `git status`, `git diff`, `git log`,
  `git branch`, `git show`.
- Excepción única: el repo de configuración (`~/.claude`), donde el producto ES la config.

## 2. Naming de branches

```
{tipo}/{descripcion-en-kebab-case}
```

Tipos válidos: `feat` · `fix` · `chore` · `docs` · `style` · `refactor` · `perf` · `test` ·
`build` · `ci` · `revert`

Regex de validación:

```
^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)/[a-z0-9._-]+$
```

- Si el equipo usa identificadores de ticket, van al principio de la descripción:
  `feat/12345-alta-de-vales`.
- Descripción corta y en minúsculas. El branch no es el lugar para la explicación completa.

## 3. Conventional commits

```
tipo(scope): asunto en imperativo
```

```
feat(vales): validar limite diario por sucursal
fix(auth): persistir el token nuevo despues del refresh
refactor(ventas): extraer ValeDomainService del AppService
```

**Reglas:**
- Asunto en **imperativo** ("agregar", no "agregado" ni "agrega"), sin punto final, ≤ 72 caracteres.
- **NUNCA** `Co-Authored-By` ni ninguna atribución de AI. Sin excepciones.
  (Reforzado por `includeCoAuthoredBy: false` en `settings.json`.)
- Un commit = un cambio coherente. Si el asunto necesita "y", son dos commits.
- El cuerpo (opcional) explica el **POR QUÉ**, no el qué — el qué ya está en el diff.

## 4. Checklist antes de entregar el cambio

- [ ] `git diff` revisado línea por línea — sin código comentado, sin `Console.WriteLine`,
      sin `debugger`, sin TODOs sueltos
- [ ] Sin secretos en el diff (connection strings, keys, `appsettings.*.json` con credenciales)
- [ ] Sin archivos que no correspondan al cambio (`.vs/`, `bin/`, `obj/`, `node_modules/`)
- [ ] Si el proyecto tiene tests: corrieron y están en verde
- [ ] Formato aplicado (el hook `auto-format` ya lo hace por archivo tocado)
- [ ] El scope del cambio coincide con lo que se pidió — nada de refactors "de paso"
- [ ] Si hay change SDD: `state.md` actualizado y sus `## Open Questions` resueltas o escaladas

## 5. Qué entregar junto al cambio

Cuando terminás, entregá **siempre**:

1. Resumen en 2-4 oraciones de qué cambió y por qué
2. Lista de archivos tocados agrupados por responsabilidad
3. Mensaje de commit **propuesto** (para que el humano lo copie y ejecute)
4. Lo que quedó fuera de scope, si algo quedó

## 6. Revert

- Revertir es normal, no una derrota. `git revert` sobre historia ya compartida; `reset --hard`
  **nunca** (está en la lista `deny` de permisos).
- Un revert es un commit más: `revert: <asunto original>` y en el cuerpo, por qué se revirtió.
