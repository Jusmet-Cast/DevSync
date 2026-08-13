#!/usr/bin/env node
/**
 * statusLine — Barra de estado.
 *
 * Con 9 sub-agentes corriendo en background y modelos mixtos, tener a la vista
 * proyecto / rama / modelo / fase SDD evita la mitad de las preguntas de "¿en que
 * estabamos?".
 *
 * Dos filas (cada linea impresa es una fila):
 *   ~/erp-facturacion  feat/12345-alta-vales*  [sonnet]  SDD:alta-vales→design
 *   ctx ████████░░ 78% libre  ·  5h 24% ↻3h10m
 *
 * La segunda fila responde "¿cuanto me queda?" sin tener que preguntar: contexto libre de la
 * sesion y consumo de los limites de uso. Los dos datos vienen en el payload del statusLine
 * (`context_window` y `rate_limits`), no hay que calcularlos ni pedirlos a ningun lado.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { RUNS_DIR, etiqueta, discrepa, faseValida } = require('./lib/agent-meta');


/** Rama + dirty con cache en disco por cwd (TTL 5s). Ante cualquier problema, devuelve null. */
function gitCacheado(cwd) {
  const clave = Buffer.from(cwd).toString('base64url').slice(-40);
  const cacheFile = path.join(RUNS_DIR, '..', `git-${clave}.json`);

  try {
    const st = fs.statSync(cacheFile);
    if (Date.now() - st.mtimeMs < 5000) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch {
    /* sin cache valida: se calcula */
  }

  const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8', timeout: 3000 });
  if (r.status !== 0) return null;

  const dato = {
    branch: (r.stdout || '').trim(),
    dirty:
      (spawnSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8', timeout: 3000 }).stdout || '').trim()
        .length > 0
        ? '*'
        : '',
  };

  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify(dato), 'utf8');
  } catch {
    /* el cache es un lujo, no un requisito */
  }
  return dato;
}

// ---------------------------------------------------------------- Fila 2: presupuesto
//
// Dos recursos distintos que la gente confunde todo el tiempo:
//   contexto -> cuanto entra en ESTA conversacion antes de compactar. Se recupera al compactar.
//   uso      -> tu cuota de la suscripcion (ventanas de 5h y 7d). NO se recupera hasta el reset.
//
// Todo lo de esta fila puede faltar y hay que tolerarlo:
//   - `rate_limits` solo existe para suscriptores Claude.ai (Pro/Max), y recien despues de la
//     primera respuesta de la API. Cada ventana puede faltar por separado.
//   - `used_percentage` / `remaining_percentage` pueden venir en null al arrancar la sesion.
// Si no hay ningun dato, la fila entera no se dibuja: mejor una barra corta que una que miente.

const VERDE = '\x1b[32m';
const AMARILLO = '\x1b[33m';
const ROJO = '\x1b[31m';
const GRIS = '\x1b[90m';
const OFF = '\x1b[0m';

/** Verde/amarillo/rojo segun cuanto queda LIBRE (no cuanto se uso). */
function colorPorLibre(libre) {
  if (libre <= 10) return ROJO;
  if (libre <= 30) return AMARILLO;
  return VERDE;
}

/** Barra de 10 bloques. */
function barra(libre) {
  const llenos = Math.max(0, Math.min(10, Math.round(libre / 10)));
  return '█'.repeat(llenos) + '░'.repeat(10 - llenos);
}

/** "2d21h" / "3h10m" / "45m" / "" — cuanto falta para un reset dado en epoch segundos. */
function faltaPara(epochSeg) {
  if (!Number.isFinite(epochSeg)) return '';
  const min = Math.round((epochSeg * 1000 - Date.now()) / 60000);
  if (min <= 0) return '';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  // La ventana de 7 dias da numeros como "69h27m", que no le dicen nada a nadie.
  if (h >= 24) return `${Math.floor(h / 24)}d${h % 24}h`;
  return `${h}h${String(min % 60).padStart(2, '0')}m`;
}

function filaPresupuesto(p) {
  const trozos = [];

  // --- Contexto libre de la sesion
  const cw = p.context_window || {};
  let libre = cw.remaining_percentage;
  if (typeof libre !== 'number' && typeof cw.used_percentage === 'number') {
    libre = 100 - cw.used_percentage;
  }
  if (typeof libre === 'number') {
    const l = Math.max(0, Math.min(100, Math.round(libre)));
    const c = colorPorLibre(l);
    // El tamaño de ventana se muestra solo si NO es el default de 200k, que es el caso
    // interesante: un modelo de contexto extendido cambia por completo el significado del %.
    const size = cw.context_window_size;
    const extendida =
      typeof size !== 'number' || size === 200000
        ? ''
        : size >= 1000000
          ? ` ${+(size / 1000000).toFixed(1)}M`
          : ` ${Math.round(size / 1000)}k`;
    trozos.push(`${c}ctx ${barra(l)} ${l}%${OFF}${GRIS} libre${extendida}${OFF}`);
  }

  // --- Cuota de uso: SOLO la ventana de 5 horas.
  //
  // La de 7 dias (`rate_limits.seven_day`) existe en el payload y se omite a proposito: es la
  // que se agota lento y sobre la que no se toma ninguna decision en el momento. La de 5h es la
  // que te frena HOY, y una barra con dos numeros que compiten hace que no mires ninguno.
  const cinco = (p.rate_limits || {}).five_hour;
  if (cinco && typeof cinco.used_percentage === 'number') {
    const usado = Math.max(0, Math.min(100, Math.round(cinco.used_percentage)));
    const c = colorPorLibre(100 - usado);
    const reset = faltaPara(cinco.resets_at);
    trozos.push(`${c}5h ${usado}%${OFF}${reset ? `${GRIS} ↻${reset}${OFF}` : ''}`);
  }

  return trozos.length ? trozos.join(`${GRIS}  ·  ${OFF}`) : '';
}

/**
 * Sub-agentes EN VUELO de esta sesion, leyendo las fichas que abre subagent-start.js.
 *
 * Se descartan las fichas de mas de 2h: si un sub-agente muere de forma sucia, SubagentStop
 * nunca corre y la ficha queda huerfana para siempre. Mejor mostrar de menos que mentir.
 */
function enVuelo(sessionId) {
  let archivos = [];
  try {
    archivos = fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const corte = Date.now() - 2 * 60 * 60 * 1000;
  const vivos = [];
  for (const f of archivos) {
    try {
      const full = path.join(RUNS_DIR, f);
      if (fs.statSync(full).mtimeMs < corte) continue;
      const ficha = JSON.parse(fs.readFileSync(full, 'utf8'));
      // Otra sesion en paralelo puede tener sus propios sub-agentes: no son asunto de esta barra.
      if (sessionId && ficha.session_id && ficha.session_id !== sessionId) continue;
      vivos.push(ficha);
    } catch {
      /* ficha ilegible: se ignora */
    }
  }
  return vivos.sort((a, b) => (a.started_ms || 0) - (b.started_ms || 0));
}

const CHUNKS = [];
process.stdin.on('data', (c) => CHUNKS.push(c));
process.stdin.on('end', () => {
  let p = {};
  try {
    p = JSON.parse(Buffer.concat(CHUNKS).toString('utf8') || '{}');
  } catch {
    /* seguimos con defaults */
  }

  const cwd = (p.workspace && p.workspace.current_dir) || p.cwd || process.cwd();
  const parts = [`[36m${path.basename(cwd)}[0m`];

  // Nombre de la sesion. OJO: el campo puede NO venir — solo aparece si la nombraste con
  // --name / /rename, o una vez que existe un titulo autogenerado. El nombre por defecto
  // (tipo "my-app-3f") NO lo popula. Por eso siempre hay que tolerar la ausencia.
  const sesion = (p.session_name || '').trim();
  if (sesion) {
    const corta = sesion.length > 26 ? sesion.slice(0, 25) + '…' : sesion;
    parts.push(`[90m‹${corta}›[0m`);
  }

  // Rama + dirty flag, con cache de 5s.
  //
  // `git status --porcelain` en un repo grande es lento, y con `refreshInterval` esto corre cada
  // pocos segundos aunque no toques nada. La doc avisa explicitamente que la statusline no debe
  // colgarse en comandos lentos. 5s es imperceptible para el ojo y saca la mayoria de los spawns.
  const git = gitCacheado(cwd);
  if (git && git.branch) parts.push(`[33m${git.branch}${git.dirty}[0m`);

  // Modelo activo
  const model = (p.model && (p.model.display_name || p.model.id)) || '';
  if (model) parts.push(`[35m[${model}][0m`);

  // Agente principal de la sesion. El campo `agent` SOLO llega cuando se corre con --agent
  // o con el setting `agent` configurado; en una sesion normal no existe.
  const agente = (p.agent && p.agent.name) || '';

  // La fase SDD se muestra UNICAMENTE bajo dev-orchestrator: es el unico contexto donde el
  // flujo por fases esta corriendo. En una sesion suelta ese dato es ruido.
  if (agente === 'dev-orchestrator') {
    try {
      const changesDir = path.join(cwd, '.atl', 'changes');
      let best = null;
      for (const name of fs.readdirSync(changesDir)) {
        const st = path.join(changesDir, name, 'state.md');
        if (!fs.existsSync(st)) continue;
        const m = fs.readFileSync(st, 'utf8').match(/##\s*Current Phase\s*\r?\n+\s*([^\r\n]+)/i);
        // state.md a veces trae prosa despues del token ("verify (completado — ...)").
        // Nos quedamos con el token: cortamos en el primer parentesis, guion o punto y coma.
        const fase = (m ? m[1] : '')
          .trim()
          .split(/[(\-–—;,]/)[0]
          .trim()
          .slice(0, 24);
        // Si no es uno de los 9 tokens del protocolo (sdd-artifact-protocol), el state.md esta
        // corrupto o a medio escribir: mejor no mostrarlo que mostrar texto libre/markdown crudo.
        if (!faseValida(fase) || /^closed$/i.test(fase)) continue;
        const mtime = fs.statSync(st).mtimeMs;
        if (!best || mtime > best.mtime) best = { name, fase, mtime };
      }
      if (best) {
        const change = best.name.length > 28 ? best.name.slice(0, 27) + '…' : best.name;
        parts.push(`[32mSDD:${change}→${best.fase}[0m`);
      }
    } catch {
      /* proyecto sin SDD */
    }
  } else if (agente) {
    // Otro agente principal: mostrar cual, para saber bajo que persona estas trabajando.
    parts.push(`[34m@${agente}[0m`);
  }

  // Sub-agentes corriendo AHORA, con su modelo. Con 9 sub-agentes y modelos mixtos (opus en
  // design, haiku en spec), saber que hay en vuelo y con que modelo es la diferencia entre
  // esperar tranquilo y preguntarse si se colgo.
  const corriendo = enVuelo(p.session_id || '');
  if (corriendo.length) {
    // Los que corren con un modelo distinto al declarado van PRIMERO. Si no, la truncacion a 2
    // puede esconder justo la alarma detras del "+N" — una alarma tapada no es una alarma.
    corriendo.sort((a, b) => Number(discrepa(b.model, b.model_real)) - Number(discrepa(a.model, a.model_real)));
    const visibles = corriendo.slice(0, 2).map((f) => etiqueta(f.agent_type, f.model, f.model_real));
    const resto = corriendo.length - visibles.length;
    parts.push(`[36m⚙ ${visibles.join(' ')}${resto > 0 ? ` +${resto}` : ''}[0m`);
  }

  // Fila 2. Se omite entera si no hay ni un dato: una barra a medias confunde mas que ayuda.
  const fila2 = filaPresupuesto(p);
  process.stdout.write(parts.join('  ') + (fila2 ? '\n' + fila2 : ''));
});
