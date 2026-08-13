#!/usr/bin/env node
/**
 * SessionStart | Stop | SessionEnd — Espejado de sesiones contenedor <-> Windows nativo.
 *
 * QUE PROBLEMA RESUELVE:
 * Claude Code indexa todo su estado por la ruta absoluta del cwd. El mismo proyecto abierto desde
 * Windows (`C:\Users\areyes\Desktop\Farmacia\X`) y desde el contenedor (`/workspace/Farmacia/X`)
 * produce dos claves distintas, asi que `/resume` de un lado nunca ve las sesiones del otro.
 * Este hook genera el GEMELO TRADUCIDO de cada sesion para que aparezca nativamente en los dos.
 *
 * POR QUE UN SOLO SCRIPT PARA LOS DOS ENTORNOS:
 * El bind mount hace que `projects/` sea LA MISMA carpeta fisica en ambos lados. Las sesiones no
 * colisionan porque las subcarpetas se llaman distinto (`-workspace-...` vs `c--Users-...`), asi
 * que basta con recorrer esa unica carpeta y traducir en la direccion que corresponda segun el
 * prefijo. Corra donde corra, hace el trabajo completo.
 *
 * ESTO ES LO QUE CUBRE EL CASO "SE ME AGOTO LA CUOTA":
 * Cuando la cuota del contenedor se agota y te vas a Windows, el `SessionStart` del contenedor no
 * corre nunca mas. No importa: el .jsonl crudo YA esta en disco de Windows (lo escribio Claude
 * Code por bind mount, no un hook), y el `SessionStart` del lado de Windows genera el gemelo que
 * quedo pendiente. Ningun dato depende de que este hook llegue a ejecutarse en un momento exacto.
 *
 * NUNCA BLOQUEA NI FALLA RUIDOSAMENTE: sale 0 siempre. Un espejado que no se hizo se rehace en el
 * proximo arranque; una sesion que no arranca por culpa de un hook de sync es inaceptable.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const pm = require('./lib/path-map.js');
const core = require('./lib/session-sync-core.js');

const configDir = process.env.CLAUDE_CONFIG_DIR || path.resolve(__dirname, '..');
const DIR_PROYECTOS = path.join(configDir, 'projects');
const DIR_FH = path.join(configDir, 'file-history');
const ESTADO = path.join(configDir, 'session-state', 'sync-state.json');

/** Techo de trabajo por corrida: `SessionStart` esta en el camino critico del arranque. */
const MAX_POR_CORRIDA = 40;

const CHUNKS = [];
process.stdin.on('data', (c) => CHUNKS.push(c));
process.stdin.on('end', () => {
  try {
    main(JSON.parse(Buffer.concat(CHUNKS).toString('utf8') || '{}'));
  } catch {
    /* silencio deliberado: ver cabecera */
  }
  process.exit(0);
});

function leerEstado() {
  try { return JSON.parse(fs.readFileSync(ESTADO, 'utf8')); } catch { return { archivos: {} }; }
}

function guardarEstado(e) {
  try { core.escribirAtomico(ESTADO, JSON.stringify(e, null, 2)); } catch { /* no critico */ }
}

/**
 * Direccion de traduccion segun el prefijo de la carpeta.
 * `-workspace-...` la escribio el contenedor  -> hay que generar el gemelo Windows.
 * `c--...`/`C--...` la escribio Windows        -> hay que generar el gemelo contenedor.
 * Cualquier otra cosa (otro entorno, otra maquina) se ignora: no sabemos traducirla.
 */
function direccionDe(carpeta) {
  if (carpeta.startsWith('-')) return 'windows';
  if (/^[a-zA-Z]--/.test(carpeta)) return 'contenedor';
  return null;
}

function main(payload) {
  const evento = payload.hook_event_name || '';
  const pares = pm.cargarMapa(configDir);
  if (!pares.length) return; // sin mapa no se inventa nada

  // El contenedor es el unico que puede leer el compose montado: publica el mapa resuelto para
  // que el lado Windows no necesite docker ni tenga que ir a buscar nada por \\wsl$.
  if (fs.existsSync(process.env.CLAUDE_SYNC_COMPOSE || '/etc/claude-sync/docker-compose.yml')) {
    try { pm.publicarMapa(configDir, pares); } catch { /* no critico */ }
  }

  const estado = leerEstado();

  // `Stop` corre despues de CADA turno (no al cerrar sesion): solo la sesion actual, incremental.
  if (evento === 'Stop' && payload.transcript_path) {
    procesar(payload.transcript_path, pares, estado);
    guardarEstado(estado);
    return;
  }

  // `SessionStart` y `SessionEnd`: reconciliacion completa en ambas direcciones. Es la red de
  // seguridad para todo lo que quedo colgado de un cierre abrupto (cuota, SIGKILL, corte de luz).
  reconciliar(pares, estado);
  guardarEstado(estado);

  if (evento === 'SessionStart') mergearConfig(pares);
}

/**
 * Issues #4 y #5: `history.jsonl` (flecha arriba) y `projects{}` de `.claude.json` (trust dialog,
 * allowedTools, MCP por proyecto) tambien estan indexados por ruta absoluta.
 *
 * POR QUE SOLO EN `SessionStart` Y POR QUE ES IDEMPOTENTE:
 * `.claude.json` lo escribe Claude Code cuando quiere, con su estado en memoria — que no incluye
 * lo que nosotros agreguemos mientras corre. O sea que nuestro merge PUEDE ser pisado. No se
 * puede evitar desde un hook, asi que se disenia para tolerarlo: el merge no pisa nada existente
 * y se vuelve a aplicar en cada arranque. Si se pierde, vuelve solo al siguiente. Autoreparable.
 */
function mergearConfig(pares) {
  const cm = require('./lib/config-merge.js');
  const otro = rutaConfigOtroEntorno(pares);
  if (!otro) return;

  const hacia = configDir.startsWith('/home/') ? 'windows' : 'contenedor';

  try {
    const local = path.join(configDir, '.claude.json');
    const remoto = path.join(otro, '.claude.json');
    const L = JSON.parse(fs.readFileSync(local, 'utf8'));
    const R = JSON.parse(fs.readFileSync(remoto, 'utf8'));
    // Cada archivo recibe SOLO el subarbol projects{} traducido. oauthAccount/userID/machineID
    // ni se leen: son identidad de cuenta y de maquina, no se cruzan jamas.
    if (cm.mergeProyectos(L, R, pares, hacia).length) core.escribirAtomico(remoto, JSON.stringify(R, null, 2));
    if (cm.mergeProyectos(R, L, pares, hacia === 'windows' ? 'contenedor' : 'windows').length) {
      core.escribirAtomico(local, JSON.stringify(L, null, 2));
    }
  } catch { /* no critico */ }

  try {
    const leer = (f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const local = path.join(configDir, 'history.jsonl');
    const remoto = path.join(otro, 'history.jsonl');
    const L = leer(local); const R = leer(remoto);
    const nR = cm.mergeHistory(L, R, pares, hacia);
    const nL = cm.mergeHistory(R, L, pares, hacia === 'windows' ? 'contenedor' : 'windows');
    if (nR.length !== R.length) core.escribirAtomico(remoto, nR.map((e) => JSON.stringify(e)).join('\n') + '\n');
    if (nL.length !== L.length) core.escribirAtomico(local, nL.map((e) => JSON.stringify(e)).join('\n') + '\n');
  } catch { /* no critico */ }
}

/**
 * Ubica el config dir del OTRO entorno. Sale del propio mapa: la carpeta de configuracion de
 * Windows esta montada como proyecto (`/workspace/areyes/.claude`), asi que el par que apunta a
 * un destino terminado en `.claude` es el que buscamos. Nada hardcodeado.
 */
function rutaConfigOtroEntorno(pares) {
  for (const p of pares) {
    if (!/[\\/]\.claude$/.test(p.contenedor)) continue;
    const candidato = configDir.startsWith('/home/') ? p.contenedor : p.windows;
    if (candidato !== configDir && fs.existsSync(path.join(candidato, '.claude.json'))) return candidato;
  }
  return null;
}

function reconciliar(pares, estado) {
  let carpetas;
  try { carpetas = fs.readdirSync(DIR_PROYECTOS); } catch { return; }

  const pendientes = [];
  for (const carpeta of carpetas) {
    if (!direccionDe(carpeta)) continue;
    let archivos;
    try { archivos = fs.readdirSync(path.join(DIR_PROYECTOS, carpeta)); } catch { continue; }
    for (const a of archivos) {
      if (!a.endsWith('.jsonl')) continue;
      const full = path.join(DIR_PROYECTOS, carpeta, a);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      const prev = estado.archivos[full];
      if (prev && prev.mtime === st.mtimeMs) continue; // sin cambios desde el ultimo sync
      pendientes.push({ full, mtime: st.mtimeMs });
    }
  }

  // Lo mas reciente primero: si hay que recortar por el techo, que sobreviva lo que mas importa.
  pendientes.sort((a, b) => b.mtime - a.mtime);
  for (const p of pendientes.slice(0, MAX_POR_CORRIDA)) procesar(p.full, pares, estado);
}

function procesar(archivo, pares, estado) {
  const carpeta = path.basename(path.dirname(archivo));
  const hacia = direccionDe(carpeta);
  if (!hacia) return;

  let r;
  try {
    r = core.espejarSesion({ archivo, dirProyectos: DIR_PROYECTOS, dirFH: DIR_FH, pares, hacia });
  } catch {
    return; // una sesion ilegible no puede frenar al resto
  }

  // Una divergencia NO se marca como sincronizada: se reintenta, y mientras tanto no se pisa nada.
  if (r.estado === 'divergido') return;

  try {
    estado.archivos[archivo] = { mtime: fs.statSync(archivo).mtimeMs, estado: r.estado };
  } catch { /* no critico */ }
}
