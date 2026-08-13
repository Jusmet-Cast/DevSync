#!/usr/bin/env node
/**
 * SubagentStart — Registro de sub-agentes EN VUELO.
 *
 * Antes solo existia SubagentStop: sabiamos que un sub-agente habia corrido recien cuando
 * terminaba. Mientras estaba trabajando —que con `opus` y `effort: high` pueden ser varios
 * minutos— no habia forma de ver QUE estaba corriendo ni CON QUE MODELO.
 *
 * Este hook abre una ficha por corrida en session-state/agent-runs/<agent_id>.json que la
 * statusline lee para mostrar `⚙ sdd-design[opus]`, y que subagent-index.js cierra al terminar
 * para poder calcular la duracion real.
 *
 * EL MODELO NO VIENE EN EL PAYLOAD. La doc de SubagentStart lista agent_type, agent_id, prompt
 * y description, nada mas. Lo resolvemos del frontmatter de agents/*.md, que es donde lo
 * decidimos nosotros.
 *
 * Sin decision control: la doc dice que la salida es solo para efectos secundarios y el
 * sub-agente arranca igual. Perfecto — este hook observa, no manda.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { RUNS_DIR, modeloDe } = require('./lib/agent-meta');

const CHUNKS = [];
process.stdin.on('data', (c) => CHUNKS.push(c));
process.stdin.on('end', () => {
  try {
    const p = JSON.parse(Buffer.concat(CHUNKS).toString('utf8') || '{}');
    const agentId = p.agent_id || '';
    const agentType = p.agent_type || 'desconocido';
    if (!agentId) process.exit(0);

    fs.mkdirSync(RUNS_DIR, { recursive: true });

    const ficha = {
      agent_id: agentId,
      agent_type: agentType,
      model: modeloDe(agentType),
      session_id: p.session_id || '',
      cwd: p.cwd || '',
      started_at: new Date().toISOString(),
      started_ms: Date.now(),
      // Solo un recorte: la ficha se lee en cada render de la statusline, no la queremos gorda.
      task: String(p.description || p.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    };

    // El nombre de archivo viene del payload: lo saneamos antes de tocar el filesystem.
    const safe = agentId.replace(/[^\w.-]/g, '_').slice(0, 120);
    fs.writeFileSync(path.join(RUNS_DIR, `${safe}.json`), JSON.stringify(ficha), 'utf8');
  } catch {
    /* nunca frenamos por la traza */
  }
  process.exit(0);
});
