#!/usr/bin/env node
/**
 * SessionStart — Bootstrap deterministico de la sesion.
 *
 * Hace ANTES del primer turno lo que antes estaba pedido en prosa dentro de
 * dev-orchestrator.md (y por lo tanto dependia de que el modelo se acordara):
 *
 *   1. Limpia agent-outputs/ con TTL de 24h  (skill agent-output-persistence)
 *   2. Detecta changes SDD abiertos en .atl/ y los inyecta al contexto
 *   3. Verifica que Engram este disponible y AVISA FUERTE si no lo esta
 *
 * El punto 3 es el importante: sin esto, el protocolo de memoria de CLAUDE.md
 * falla en SILENCIO y la sesion arranca a ciegas sin que nadie se entere.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// El hook vive DENTRO de la carpeta de configuracion, asi que se ubica solo:
// <config-dir>/hooks/session-bootstrap.js  ->  <config-dir>
// Nada de os.homedir(): toda la config vive en esta carpeta, y esa carpeta no tiene
// por que estar en el home (CLAUDE_CONFIG_DIR puede apuntarla a cualquier lado).
const configDir = process.env.CLAUDE_CONFIG_DIR || path.resolve(__dirname, '..');
const outDir = path.join(configDir, 'session-state', 'agent-outputs');
const lines = [];

// ------------------------------------------------ 1. Cleanup de agent-outputs
try {
  fs.mkdirSync(outDir, { recursive: true });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let deleted = 0;
  for (const f of fs.readdirSync(outDir)) {
    if (!f.endsWith('.md')) continue;
    const full = path.join(outDir, f);
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.unlinkSync(full);
      deleted++;
    }
  }
  if (deleted > 0) lines.push(`🧹 agent-outputs: ${deleted} archivo(s) expirado(s) eliminado(s).`);
} catch {
  /* nunca frenamos la sesion por el cleanup */
}

// Barrido de estado efimero. Dos directorios, dos TTL:
//   close-reminders/ -> una marca por sesion, inservible despues (7d)
//   agent-runs/      -> fichas de sub-agentes EN VUELO. Si un sub-agente muere sucio,
//                       SubagentStop nunca corre y la ficha queda huerfana mintiendole a la
//                       statusline. Al arrancar sesion no puede haber ninguno vivo del pasado.
for (const [sub, ttl] of [
  ['close-reminders', 7 * 24 * 60 * 60 * 1000],
  ['agent-runs', 2 * 60 * 60 * 1000],
]) {
  try {
    const dir = path.join(configDir, 'session-state', sub);
    const cutoff = Date.now() - ttl;
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      const full = path.join(dir, f);
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full);
    }
  } catch {
    /* ignorar */
  }
}

// ------------------------------------------------------- 2. Estado SDD (.atl)
try {
  const changesDir = path.join(process.cwd(), '.atl', 'changes');
  if (fs.existsSync(changesDir)) {
    const abiertos = [];
    for (const name of fs.readdirSync(changesDir)) {
      const stateFile = path.join(changesDir, name, 'state.md');
      if (!fs.existsSync(stateFile)) continue;
      const txt = fs.readFileSync(stateFile, 'utf8');
      const m = txt.match(/##\s*Current Phase\s*\r?\n+\s*([^\r\n]+)/i);
      const fase = (m ? m[1] : 'desconocida').trim();
      if (/^closed$/i.test(fase)) continue;
      const dias = Math.floor((Date.now() - fs.statSync(stateFile).mtimeMs) / 86400000);
      const stale = dias >= 7 ? `  ⚠️ ${dias} dias sin avanzar` : '';
      abiertos.push(`- **${name}** → fase actual: \`${fase}\`${stale}`);
    }
    if (abiertos.length) {
      lines.push('## Changes SDD abiertos en este proyecto (.atl/changes/)');
      lines.push(...abiertos);
      lines.push('Ofrecele al usuario continuar desde la fase indicada antes de arrancar algo nuevo.');
    }
  }
} catch {
  /* ignorar */
}

// --------------------------------------------------- 3. Disponibilidad Engram
let engramOk = false;
try {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['engram'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
    timeout: 5000,
  });
  engramOk = probe.status === 0;
} catch {
  engramOk = false;
}

const out = { hookSpecificOutput: { hookEventName: 'SessionStart' } };

if (!engramOk) {
  lines.push(
    '⚠️ **ENGRAM NO DISPONIBLE EN ESTE ENTORNO.** El binario `engram` no esta en el PATH, ' +
      'asi que el protocolo de memoria persistente de CLAUDE.md (mem_context / mem_save / ' +
      'mem_session_summary) NO se puede cumplir en esta sesion.\n' +
      'Avisale al usuario en tu primer mensaje. NUNCA simules haber cargado contexto de memoria.'
  );
  out.systemMessage = '⚠️ Engram no encontrado — memoria persistente deshabilitada esta sesion';
}

if (lines.length) out.hookSpecificOutput.additionalContext = lines.join('\n');

process.stdout.write(JSON.stringify(out));
