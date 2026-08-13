#!/usr/bin/env node
/**
 * SubagentStop — Cierre e indice de corridas de sub-agentes.
 *
 * Complementa la skill agent-output-persistence. Esa skill le PIDE al sub-agente
 * que guarde su output; si el sub-agente falla, se queda sin tokens o ignora la
 * instruccion, no queda rastro. Este hook siempre deja el registro, porque corre
 * fuera del modelo.
 *
 * Ojo con el alcance: el hook NO puede recuperar el texto final del sub-agente.
 * Lo que garantiza es la TRAZA (que corrio, con que modelo, cuanto tardo y donde
 * esta su transcript), de modo que el orquestador pueda ir a buscarlo aunque el
 * archivo .md no exista.
 *
 * Hace tres cosas:
 *   1. Cierra la ficha que abrio subagent-start.js y calcula la duracion real.
 *   2. Escribe la entrada en _index.jsonl, ahora con modelo, agent_id y duracion.
 *   3. Devuelve UNA linea al hilo padre via additionalContext.
 *
 * El punto 3 es lo que cambia el dia a dia: hasta ahora el indice era un .jsonl que
 * nadie abria nunca. SubagentStop soporta `hookSpecificOutput.additionalContext`
 * hacia la conversacion padre, asi que el orquestador ve que termino, con que modelo
 * y cuanto tardo, sin que nadie lea nada. UNA linea, no un parrafo: el contexto del
 * orquestador es justamente lo que estamos cuidando.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { OUT_DIR, modeloDe, etiqueta, duracion, discrepa, familia, fichaDe } = require('./lib/agent-meta');

const CHUNKS = [];
process.stdin.on('data', (c) => CHUNKS.push(c));
process.stdin.on('end', () => {
  let linea = '';
  try {
    linea = main(JSON.parse(Buffer.concat(CHUNKS).toString('utf8') || '{}'));
  } catch {
    /* nunca frenamos por el indice */
  }

  if (linea) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SubagentStop', additionalContext: linea },
      })
    );
  }
  process.exit(0);
});

function main(p) {
  const agentType = p.agent_type || 'desconocido';
  const agentId = p.agent_id || '';

  // ---------------------------------------- 1. Cerrar la ficha en vuelo
  let ficha = null;
  if (agentId) {
    const fichaPath = fichaDe(agentId);
    if (fs.existsSync(fichaPath)) {
      try {
        ficha = JSON.parse(fs.readFileSync(fichaPath, 'utf8'));
      } catch {
        /* ficha corrupta: seguimos, solo perdemos la duracion */
      }
      try {
        fs.unlinkSync(fichaPath);
      } catch {
        /* si no se puede borrar, el barrido por TTL de session-bootstrap la limpia */
      }
    }
  }

  const declarado = (ficha && ficha.model) || modeloDe(agentType);
  const real = (ficha && ficha.model_real) || '';
  const ms = ficha && ficha.started_ms ? Date.now() - ficha.started_ms : NaN;
  const dur = duracion(ms);

  // ---------------------------------------------- 2. Indice persistente
  const entry = {
    ts: new Date().toISOString(),
    agent_type: agentType,
    agent_id: agentId,
    model_declarado: declarado || null,
    // null = no se pudo probar a quien pertenecia el turno. NO es lo mismo que "coincide".
    model_real: real || null,
    model_real_via: (ficha && ficha.model_real_via) || null,
    duration_ms: Number.isFinite(ms) ? ms : null,
    session_id: p.session_id || '',
    transcript_path: p.transcript_path || '',
    cwd: p.cwd || '',
  };

  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.appendFileSync(path.join(OUT_DIR, '_index.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    /* ignorar */
  }

  // ------------------------------- 3. Una linea de vuelta al orquestador
  //
  // El agent_id es OBLIGATORIO en esta linea. Sin el, cuando corren varios sub-agentes del MISMO
  // tipo en paralelo (el caso de fondo de Judgment Day: siempre 2+ jd-judge a la vez), esta linea
  // decia literalmente "termino jd-judge[sonnet]" sin decir CUAL — indistinguible entre instancias,
  // y el padre no tenia forma de correlacionar la notificacion con un agent_id especifico. Eso
  // empujaba a tratar silencio + ambiguedad como "murio" y relanzar de mas.
  const idCorto = agentId ? ` (${agentId})` : '';
  const base = `✅ sub-agente ${etiqueta(agentType, declarado, real)}${idCorto} terminó${dur ? ` en ${dur}` : ''}.`;

  if (discrepa(declarado, real)) {
    return (
      `⚠️ MODELO INESPERADO — ${agentType}${idCorto} declara \`model: ${declarado}\` en su frontmatter, ` +
      `pero Claude Code lo corrió con \`${real}\` (familia ${familia(real)}). ` +
      `Terminó${dur ? ` en ${dur}` : ''}.\n` +
      'Revisá si el alias del frontmatter sigue existiendo o si hay un allowlist de modelos ' +
      'de la organización pisando la decisión. El costo y la calidad de esta fase NO son los ' +
      'que planificaste.'
    );
  }

  return base;
}
