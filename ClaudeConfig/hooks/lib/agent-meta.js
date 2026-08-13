'use strict';

/**
 * Resolucion de metadatos de sub-agentes, compartida por los hooks y la statusline.
 *
 * POR QUE EXISTE:
 * Ni `SubagentStart` ni `SubagentStop` traen el modelo del sub-agente en su payload. La doc
 * lista agent_type, agent_id, prompt, description y last_assistant_message — y nada mas.
 * Como el modelo lo decidimos NOSOTROS en el frontmatter de agents/*.md, lo resolvemos desde
 * ahi: es la fuente de verdad y no depende de que la plataforma nos lo cuente.
 *
 * OJO: `agent_type` es el campo `name` del frontmatter, que NO tiene por que coincidir con el
 * nombre del archivo. Por eso se indexa por `name` leido, nunca por basename.
 */

const fs = require('fs');
const path = require('path');

const configDir = process.env.CLAUDE_CONFIG_DIR || path.resolve(__dirname, '..', '..');

const RUNS_DIR = path.join(configDir, 'session-state', 'agent-runs');
const OUT_DIR = path.join(configDir, 'session-state', 'agent-outputs');

/**
 * Enum cerrado de `## Current Phase` en `state.md` (contrato: sdd-artifact-protocol/SKILL.md).
 * Cualquier sub-agente que escriba otra cosa ahi (texto libre, markdown, una fase a medio
 * terminar) rompe el contrato — y sin este chequeo, session-title.js y statusline.js lo
 * mostraban literal en la UI. Mejor ignorar la entrada que mostrar un dato corrupto.
 */
const FASES_SDD = new Set([
  'explore', 'propose', 'spec', 'design', 'tasks', 'apply', 'verify', 'archive', 'closed',
]);

/** ¿`fase` es uno de los tokens que el protocolo permite en `Current Phase`? */
function faseValida(fase) {
  return FASES_SDD.has(String(fase || '').toLowerCase());
}

/** Indice { name -> { model, effort, color, file } } leyendo el frontmatter de agents/. */
function cargarAgentes() {
  const dir = path.join(configDir, 'agents');
  const idx = {};
  let archivos = [];
  try {
    archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return idx;
  }

  for (const f of archivos) {
    try {
      const txt = fs.readFileSync(path.join(dir, f), 'utf8');
      if (!txt.startsWith('---')) continue;
      const fin = txt.indexOf('\n---', 3);
      if (fin === -1) continue;
      const fm = txt.slice(4, fin);

      const campo = (k) => {
        const m = fm.match(new RegExp(`^${k}:[ \\t]*(.+?)[ \\t]*$`, 'm'));
        return m ? m[1].replace(/^["']|["']$/g, '') : '';
      };

      const name = campo('name');
      if (!name) continue;
      idx[name] = { model: campo('model') || 'inherit', effort: campo('effort'), color: campo('color'), file: f };
    } catch {
      /* un agente ilegible no puede tumbar al hook */
    }
  }
  return idx;
}

/** Modelo declarado para un agent_type. Devuelve '' si no lo conocemos (agente nativo o de plugin). */
function modeloDe(agentType) {
  const meta = cargarAgentes()[agentType];
  return meta ? meta.model : '';
}

/**
 * Familia de un id de modelo: 'claude-opus-5' -> 'opus'. Devuelve '' si no la reconoce.
 *
 * Hace falta porque comparamos peras con manzanas: el frontmatter declara un alias corto
 * ('opus') y el transcript registra el id completo ('claude-opus-5'). Comparar los strings
 * crudos daria "mismatch" siempre.
 */
function familia(modelId) {
  const m = String(modelId || '').toLowerCase().match(/\b(opus|sonnet|haiku|fable)\b/);
  return m ? m[1] : '';
}

/**
 * ¿El modelo REAL contradice al declarado?
 *
 * Conservador a proposito: solo afirma el desacuerdo cuando reconoce AMBAS familias. Si el
 * declarado es `inherit`, no hay nada que contradecir. Ante la duda decimos que no, porque
 * una alarma falsa que salta seguido se vuelve ruido y se deja de mirar.
 */
function discrepa(declarado, real) {
  if (!declarado || !real || declarado === 'inherit') return false;
  const a = familia(declarado);
  const b = familia(real);
  return !!a && !!b && a !== b;
}

/**
 * Etiqueta compacta para UI: `sdd-design[opus]`.
 * Si el modelo real contradice al declarado, lo grita: `sdd-design[opus≠sonnet]`.
 */
function etiqueta(agentType, model, modelReal) {
  const m = model || modeloDe(agentType);
  if (discrepa(m, modelReal)) return `${agentType}[${familia(m)}≠${familia(modelReal)}]`;
  const mostrar = familia(modelReal) || (m && m !== 'inherit' ? m : '');
  return mostrar ? `${agentType}[${mostrar}]` : agentType;
}

/** Duracion legible y corta: 45s, 3m12s, 1h04m. */
function duracion(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
}

/** Ruta de la ficha de una corrida. El agent_id viene del payload: se sanea siempre. */
function fichaDe(agentId) {
  return path.join(RUNS_DIR, `${String(agentId).replace(/[^\w.-]/g, '_').slice(0, 120)}.json`);
}

function leerFicha(agentId) {
  try {
    return JSON.parse(fs.readFileSync(fichaDe(agentId), 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  configDir, RUNS_DIR, OUT_DIR,
  cargarAgentes, modeloDe, etiqueta, duracion,
  familia, discrepa, fichaDe, leerFicha,
  FASES_SDD, faseValida,
};
