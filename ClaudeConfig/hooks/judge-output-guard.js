#!/usr/bin/env node
/**
 * PreToolUse (Edit|MultiEdit|Write) — scoped a jd-judge via frontmatter.
 *
 * PROBLEMA QUE RESUELVE:
 * jd-judge no tiene Write para tocar codigo — ese es el punto entero del rol (ver
 * agents/jd-judge.md: "SIN Edit ni Write... un juez que puede arreglar lo que encontro deja de
 * ser juez"). Pero SI necesita persistir su propio veredicto en disco, como red de seguridad
 * contra un bug de plataforma ya documentado en Engram (5+ incidentes): el sub-agente hace el
 * trabajo real (30-45 tool calls, minutos de trabajo) pero el texto de respuesta del tool `Agent`
 * vuelve vacio o truncado. Sin un backup en disco, ese veredicto se pierde sin forma de
 * recuperarlo — judgment-day terminaba grepeando transcripts JSONL de cientos de KB a mano.
 *
 * A DIFERENCIA de atl-only-guard.js: ese restringe a `.atl/` DENTRO del proyecto (resuelve contra
 * el cwd). `session-state/agent-outputs/` vive bajo la carpeta de CONFIGURACION
 * (`~/.claude/session-state/agent-outputs/`), no bajo el proyecto — por eso se resuelve contra
 * `OUT_DIR` de `lib/agent-meta.js`, no contra `payload.cwd`.
 *
 * Permitido: cualquier escritura bajo `session-state/agent-outputs/`. Rechaza todo lo demas.
 * Falla ABIERTO ante lo inesperado, salvo cuando puede afirmar que el destino esta fuera.
 */

'use strict';

const path = require('path');
const { OUT_DIR } = require('./lib/agent-meta');

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
  const destino = (payload.tool_input && payload.tool_input.file_path) || '';
  if (!destino) process.exit(0);

  const cwd = payload.cwd || process.cwd();

  // Resolvemos contra el cwd para que un path relativo no se escape, y normalizamos separadores
  // porque en Windows llegan con backslash. Si `destino` ya es absoluto (el caso esperado, ver
  // jd-judge.md), path.resolve lo devuelve tal cual.
  const abs = path.resolve(cwd, destino).replace(/\\/g, '/');
  const permitido = OUT_DIR.replace(/\\/g, '/');

  if (abs === permitido || abs.startsWith(`${permitido}/`)) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          '❌ jd-judge no escribe código — solo puede persistir su propio veredicto en ' +
          `\`session-state/agent-outputs/\`.\nDestino rechazado: ${destino}\n\n` +
          'Sos un juez, no un fixer. Si encontraste algo para arreglar, va en tu lista de ' +
          'hallazgos — lo aplica jd-fixer después, nunca vos.',
      },
    })
  );
  process.exit(0);
}
