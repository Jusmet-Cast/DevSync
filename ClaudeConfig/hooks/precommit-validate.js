#!/usr/bin/env node
/**
 * PreToolUse (Bash) — Gate de calidad del PROPIO repo de configuracion.
 *
 * El README decia "corré validate-config.js antes de commitear cambios en esta config".
 * Eso es prosa, y la prosa se olvida: es exactamente el tipo de regla que este repo decidio
 * convertir en codigo (ver git-guard.js). Ahora el commit no sale si la config esta rota.
 *
 * Alcance deliberadamente chico:
 *   - Solo se activa sobre `git commit`.
 *   - Solo dentro del repo de CONFIGURACION (el que contiene a este mismo hook).
 *     En un repo de proyecto no tiene nada que validar, y ahi ademas manda git-guard.
 *
 * Falla ABIERTO ante cualquier problema propio (no encuentra git, no encuentra el validador,
 * timeout): un hook roto nunca debe frenar el trabajo. Lo unico que bloquea es un validador
 * que corrio bien y dijo que NO.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CHUNKS = [];
process.stdin.on('data', (c) => CHUNKS.push(c));
process.stdin.on('end', () => {
  try {
    main(JSON.parse(Buffer.concat(CHUNKS).toString('utf8') || '{}'));
  } catch {
    process.exit(0);
  }
});

const configDir = process.env.CLAUDE_CONFIG_DIR || path.resolve(__dirname, '..');

/** Normaliza para comparar rutas entre Git Bash (/c/Users/...) y Windows (C:\Users\...). */
function norm(p) {
  try {
    return fs.realpathSync(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  } catch {
    return String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * ¿El cwd cae dentro del repo de configuracion?
 *
 * Se compara contra el toplevel real de git, NO contra el nombre de la carpeta. Matchear por
 * nombre ("claude-config") le daria la exencion a cualquier repo que se llame igual.
 */
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

function main(payload) {
  const cmd = (payload.tool_input && payload.tool_input.command) || '';
  if (!/\bgit\s+(?:-[^\s]+\s+)*commit\b/.test(cmd)) process.exit(0);

  const cwd = payload.cwd || process.cwd();
  if (!esRepoDeConfig(cwd)) process.exit(0);

  const validador = path.join(configDir, 'hooks', 'validate-config.js');
  if (!fs.existsSync(validador)) process.exit(0);

  const r = spawnSync(process.execPath, [validador], {
    cwd: configDir,
    encoding: 'utf8',
    timeout: 25000,
  });

  // Sin status 1 explicito no bloqueamos: cubre timeout (status null) y fallas del runtime.
  if (r.status !== 1) process.exit(0);

  const salida = ((r.stdout || '') + (r.stderr || '')).trim();

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          '❌ La configuracion no valida — no se commitea rota.\n\n' +
          salida +
          '\n\nArregla los errores y volve a intentar. Un frontmatter con un campo que no existe ' +
          'NO da error en runtime: simplemente no hace nada, y te enteras meses despues.',
      },
    })
  );
  process.exit(0);
}
