#!/usr/bin/env node
/**
 * PostToolUse — scoped por frontmatter a los sub-agentes. Detecta el modelo REAL.
 *
 * EL PROBLEMA QUE RESUELVE:
 * La statusline mostraba el modelo que NOSOTROS declaramos en `agents/*.md`. Eso no es
 * observabilidad: es repetirte lo que ya escribiste. Si Claude Code ignorara el `model:` del
 * frontmatter —por una restriccion de `availableModels` de la organizacion, por un alias que
 * dejo de existir, por un fallback silencioso— la barra te mentiria con total confianza y no
 * te enterarias nunca.
 *
 * DE DONDE SALE LA VERDAD:
 * El transcript (.jsonl) registra en CADA turno del assistant un `message.model` con el id
 * completo real (ej. "claude-opus-5"). Eso es lo que la plataforma uso de verdad, no lo que
 * nosotros pedimos. Ningun payload de hook trae el modelo: SubagentStart lista agent_type,
 * agent_id, prompt y description, y nada mas. Por eso hay que ir al transcript.
 *
 * POR QUE ESTE HOOK CORRE ADENTRO DEL SUB-AGENTE:
 * Los hooks de herramienta disparados dentro de un sub-agente traen `agent_id` en el payload,
 * asi que la correlacion "este modelo pertenece a ESTA corrida" es exacta. Hacerlo desde
 * SubagentStop en el hilo padre obligaria a adivinar cual turno sidechain corresponde a cual
 * sub-agente cuando corren varios en paralelo — y adivinar es justo lo que estamos evitando.
 *
 * REGLA DE ORO: ante la duda, NO afirmamos nada.
 * Si no podemos probar que el turno leido pertenece al sub-agente, dejamos `model_real` sin
 * setear y la UI cae al declarado. Un "no se" es honesto; un mismatch inventado hace que en
 * dos semanas nadie mire mas la alarma.
 */

'use strict';

const fs = require('fs');
const { fichaDe, leerFicha } = require('./lib/agent-meta');

const CHUNKS = [];
process.stdin.on('data', (c) => CHUNKS.push(c));
process.stdin.on('end', () => {
  try {
    main(JSON.parse(Buffer.concat(CHUNKS).toString('utf8') || '{}'));
  } catch {
    /* nunca frenamos por la traza */
  }
  process.exit(0);
});

/** Ultimos bytes del transcript. Crecen sin limite y solo nos interesa lo reciente. */
function leerCola(file, maxBytes = 2 * 1024 * 1024) {
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
  const agentId = p.agent_id || '';
  if (!agentId) process.exit(0); // no estamos dentro de un sub-agente

  const ficha = leerFicha(agentId);
  if (!ficha) process.exit(0);
  if (ficha.model_real) process.exit(0); // ya resuelto: este hook corre por tool call, sale barato

  const transcript = p.transcript_path || '';
  if (!transcript || !fs.existsSync(transcript)) process.exit(0);

  let lineas;
  try {
    lineas = leerCola(transcript).split('\n');
  } catch {
    process.exit(0);
  }

  // La sesion del PADRE, guardada por subagent-start.js. Es el discriminador: nos deja saber si
  // el transcript que estamos leyendo es el del sub-agente o el del hilo principal.
  const sesionPadre = ficha.session_id || '';

  let resultado = null;
  for (let i = lineas.length - 1; i >= 0 && !resultado; i--) {
    let o;
    try {
      o = JSON.parse(lineas[i]);
    } catch {
      continue; // la primera linea puede venir cortada por el recorte, y hay lineas de otros tipos
    }
    if (!o || o.type !== 'assistant' || !o.message || !o.message.model) continue;

    // Dos formas VALIDAS de saber que el turno es del sub-agente y no del hilo padre:
    if (o.isSidechain === true) {
      resultado = { model: o.message.model, via: 'sidechain' };
    } else if (sesionPadre && o.sessionId && o.sessionId !== sesionPadre) {
      // Transcript propio del sub-agente: su sessionId no es el del padre.
      resultado = { model: o.message.model, via: 'transcript-propio' };
    }
    // Cualquier otro caso (turno del hilo padre) se ignora a proposito: leerlo produciria un
    // mismatch fantasma contra el modelo de la sesion principal.
  }

  if (!resultado) process.exit(0);

  try {
    ficha.model_real = resultado.model;
    ficha.model_real_via = resultado.via;
    ficha.model_real_at = new Date().toISOString();
    fs.writeFileSync(fichaDe(agentId), JSON.stringify(ficha), 'utf8');
  } catch {
    /* ignorar */
  }
}
