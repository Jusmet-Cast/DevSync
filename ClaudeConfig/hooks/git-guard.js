#!/usr/bin/env node
/**
 * PreToolUse (Bash) — Politica de git para el agente en repos de PROYECTO.
 *
 * HISTORIA DE ESTA REGLA (importa para no volver atras por accidente):
 *
 * v1 — "el agente NO toca git". Prohibia commit/push/merge/rebase/cherry-pick en
 *      repos de proyecto. Simple y seguro, pero rompia el flujo real de trabajo:
 *      el agente dejaba el working tree listo y el humano tenia que teclear todo.
 *
 * v2 (11 Ago 2026) — politica GRADUADA por reversibilidad, no por "es git o no".
 *      El criterio ya no es la herramienta, es el DAÑO POSIBLE:
 *
 *        commit          → LOCAL y reversible (reset, amend). El agente puede.
 *        merge / rebase  → LOCAL pero puede perder trabajo. ASISTIDO: se pregunta.
 *        cherry-pick     → idem.
 *        pull            → hace merge implicito. ASISTIDO: se pregunta.
 *        push            → SALE DE LA MAQUINA. Irreversible en la practica
 *                          (otros ya lo consumieron). El agente NUNCA.
 *
 *      La linea roja se movio de "git" a "publicar". Commitear de mas se arregla
 *      con un reset; pushear de mas no se arregla, se comunica.
 *
 * EXENCION DEL REPO DE CONFIG:
 * En ~/.claude el "producto" ES la config, asi que ahi el agente opera libre —
 * salvo push, que sigue siendo del humano en todos lados.
 *
 * COMO DETECTAMOS EL REPO DE CONFIG (y por que NO por nombre de carpeta):
 * Una version anterior matcheaba el cwd contra los literales ".claude" /
 * "claude-config" por SUFIJO de path. Barato, pero le daba la exencion a
 * CUALQUIER repo de proyecto que se llamara igual: la "regla absoluta" quedaba
 * burlada por un nombre de carpeta. Ahora comparamos contra el TOPLEVEL real de
 * git, igual que `precommit-validate.js`.
 *
 * `git rev-parse --show-toplevel` es un spawn por comando y este hook corre en
 * CADA Bash, asi que filtramos primero por comando riesgoso (regex, gratis) y
 * recien si matchea pagamos el spawn.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const configDir = process.env.CLAUDE_CONFIG_DIR || path.resolve(__dirname, '..');

/**
 * Politica por subcomando. El orden de evaluacion es por severidad
 * (deny > ask), no por orden de aparicion en el comando.
 */
const DENY = ['push'];
const ASK = ['merge', 'rebase', 'cherry-pick', 'pull'];

/** Normaliza para comparar rutas entre Git Bash (/c/Users/...) y Windows (C:\Users\...). */
function norm(p) {
  try {
    return fs.realpathSync(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  } catch {
    return String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }
}

/** ¿El cwd cae dentro del repo de configuracion? Contra el toplevel real, no contra el nombre. */
function esRepoDeConfig(cwd) {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    timeout: 5000,
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) return false;
  const top = norm((r.stdout || '').trim());
  return !!top && top === norm(configDir);
}

function decidir(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

const CHUNKS = [];
process.stdin.on('data', (c) => CHUNKS.push(c));
process.stdin.on('end', () => {
  try {
    main(JSON.parse(Buffer.concat(CHUNKS).toString('utf8') || '{}'));
  } catch {
    process.exit(0);
  }
});

function main(payload) {
  const cmd = (payload.tool_input && payload.tool_input.command) || '';
  if (!cmd.trim()) process.exit(0);

  // Un solo barrido: junta TODOS los subcomandos de git presentes en la linea,
  // asi un `git commit && git push` no se cuela por matchear solo el primero.
  const encontrados = [...cmd.matchAll(/\bgit\s+([a-z-]+)/g)].map((m) => m[1]);
  if (!encontrados.length) process.exit(0);

  const push = encontrados.find((s) => DENY.includes(s));
  const asistido = encontrados.find((s) => ASK.includes(s));
  if (!push && !asistido) process.exit(0);

  // push se bloquea SIEMPRE, incluso en el repo de config: publicar es del humano.
  if (push) {
    decidir(
      'deny',
      '❌ LINEA ROJA — el agente no ejecuta "git push".\n' +
        'Commitear es reversible; publicar no. Dejá los commits listos y resumí el cambio:\n' +
        'el humano revisa el log y pushea.\n' +
        'Permitido sin restriccion: status · diff · log · branch · show · add · commit.\n' +
        'Asistido (se te pregunta): merge · rebase · cherry-pick · pull. Ver skill branch-pr.'
    );
  }

  const cwd = payload.cwd || process.cwd();
  if (esRepoDeConfig(cwd)) process.exit(0);

  decidir(
    'ask',
    `⚠️ OPERACION ASISTIDA — "git ${asistido}" puede reescribir historia o perder trabajo.\n` +
      'Confirmá si querés que el agente proceda. Antes de aceptar, conviene verificar:\n' +
      '  · working tree limpio (git status)\n' +
      '  · rama correcta (git branch --show-current)\n' +
      '  · que exista respaldo de lo no pusheado\n' +
      'Ver skill branch-pr.'
  );
}
