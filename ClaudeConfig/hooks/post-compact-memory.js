#!/usr/bin/env node
/**
 * SessionStart (matcher: compact) — Recordatorio de persistencia despues de compactar.
 *
 * ENGRAM-PROTOCOL.md § AFTER COMPACTION pide que, al ver una compactacion, lo PRIMERO sea
 * llamar mem_session_summary con el contenido del resumen compactado. Eso estaba escrito en
 * prosa, y se le pedia al modelo que se acordara justo en el peor momento posible: cuando le
 * acaban de recortar el contexto.
 *
 * POR QUE ACA Y NO EN `PreCompact`:
 * PreCompact es el evento intuitivo y no sirve para esto — la doc dice que NO puede devolver
 * `additionalContext`; solo acepta `decision: "block"` para frenar la compactacion, que no es
 * lo que queremos. `SessionStart` SI soporta `additionalContext`, y tiene el matcher `compact`
 * que dispara exactamente despues de compactar (auto o manual). El texto entra como system
 * reminder antes del primer turno posterior.
 *
 * Defensivo con el `source`: si el matcher se afloja o el payload no lo trae, chequeamos igual.
 */

'use strict';

const { spawnSync } = require('child_process');

const CHUNKS = [];
process.stdin.on('data', (c) => CHUNKS.push(c));
process.stdin.on('end', () => {
  let p = {};
  try {
    p = JSON.parse(Buffer.concat(CHUNKS).toString('utf8') || '{}');
  } catch {
    process.exit(0);
  }

  if (p.source && p.source !== 'compact') process.exit(0);

  // Sin Engram no hay nada que recordar; el aviso de ausencia ya lo da session-bootstrap.
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['engram'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
    timeout: 5000,
  });
  if (probe.status !== 0) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext:
          '## ⚠️ FIRST ACTION REQUIRED — se acaba de compactar el contexto\n\n' +
          'Protocolo de ENGRAM-PROTOCOL.md § AFTER COMPACTION. En este orden, ANTES de seguir ' +
          'trabajando:\n\n' +
          '1. `mem_session_summary` con el contenido del resumen compactado que tenes a la vista. ' +
          'Sin este paso se pierde TODO lo hecho antes de la compactacion.\n' +
          '2. `mem_context` para recuperar contexto de sesiones previas.\n' +
          '3. Recien ahi retoma la tarea donde estaba.\n\n' +
          'No saltees el paso 1.',
      },
    })
  );
  process.exit(0);
});
