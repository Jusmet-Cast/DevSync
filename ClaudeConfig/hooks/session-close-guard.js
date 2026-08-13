#!/usr/bin/env node
/**
 * Stop — Gate del SESSION CLOSE PROTOCOL de Engram.
 *
 * ENGRAM-PROTOCOL.md dice: "Antes de terminar sesion o decir listo/done, llamar
 * mem_session_summary. Esto NO es opcional." Era prosa. Si el modelo no se acordaba, la sesion
 * siguiente arrancaba a ciegas y NADIE se enteraba.
 *
 * POR QUE `Stop` Y NO `SessionEnd`:
 * SessionEnd parece el evento obvio y es el equivocado. La doc es explicita: "No decision
 * control. The exit code and JSON output are ignored." Cuando SessionEnd corre, el modelo ya
 * no puede hacer nada. `Stop`, en cambio, acepta `decision: "block"` con un `reason` que vuelve
 * al modelo y la conversacion CONTINUA — que es justo lo que necesitamos.
 *
 * EL RIESGO ACA ES EL LOOP INFINITO. Tres frenos independientes, cualquiera corta:
 *   1. `stop_hook_active` — ya venimos de un bloqueo nuestro. Es el freno oficial.
 *   2. Marca por session_id en disco — bloqueamos UNA sola vez por sesion, pase lo que pase.
 *   3. Si el transcript ya muestra un mem_session_summary, no hay nada que pedir.
 *
 * Ademas no molesta en sesiones triviales: si no hubo ni una escritura de archivo, no hay
 * aprendizaje que valga un resumen y salimos derecho.
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
const marcasDir = path.join(configDir, 'session-state', 'close-reminders');

/** Lee la cola del transcript. Los .jsonl crecen mucho; con el final alcanza y no revienta la RAM. */
function leerCola(file, maxBytes = 4 * 1024 * 1024) {
  const { size } = fs.statSync(file);
  const desde = Math.max(0, size - maxBytes);
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size - desde);
    fs.readSync(fd, buf, 0, buf.length, desde);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function main(p) {
  // ---- Freno 1: ya bloqueamos y el modelo esta respondiendo a eso.
  if (p.stop_hook_active === true) process.exit(0);

  const sessionId = p.session_id || '';
  if (!sessionId) process.exit(0);

  // ---- Freno 2: una vez por sesion y se acabo.
  const marca = path.join(marcasDir, `${sessionId}.done`);
  try {
    fs.mkdirSync(marcasDir, { recursive: true });
    if (fs.existsSync(marca)) process.exit(0);
  } catch {
    process.exit(0);
  }

  // Sin Engram no hay protocolo que exigir. session-bootstrap ya aviso al arrancar.
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['engram'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
    timeout: 5000,
  });
  if (probe.status !== 0) process.exit(0);

  const transcript = p.transcript_path || '';
  if (!transcript || !fs.existsSync(transcript)) process.exit(0);

  let texto = '';
  try {
    texto = leerCola(transcript);
  } catch {
    process.exit(0);
  }

  // ---- Freno 3: el resumen ya se persistio.
  if (texto.includes('mem_session_summary')) {
    try {
      fs.writeFileSync(marca, '');
    } catch {
      /* da igual */
    }
    process.exit(0);
  }

  // Sesion de solo lectura (preguntas, exploracion): no hay nada que valga un resumen.
  const huboTrabajo = /"name"\s*:\s*"(Edit|Write|MultiEdit|NotebookEdit)"/.test(texto);
  if (!huboTrabajo) process.exit(0);

  try {
    fs.writeFileSync(marca, new Date().toISOString());
  } catch {
    process.exit(0); // si no podemos marcar, NO bloqueamos: sin freno 2 no arriesgamos loop
  }

  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        'SESSION CLOSE PROTOCOL (ENGRAM-PROTOCOL.md) — esta sesion modifico archivos y todavia no ' +
        'persistio el resumen.\n\n' +
        'Llama a `mem_session_summary` AHORA con las secciones Goal / Instructions / Discoveries / ' +
        'Accomplished / Next Steps / Relevant Files. Si ademas tomaste una decision de arquitectura, ' +
        'arreglaste un bug o estableciste una convencion, hace el `mem_save` correspondiente.\n\n' +
        'Despues segui normalmente. Este recordatorio corre UNA sola vez por sesion.',
    })
  );
  process.exit(0);
}
