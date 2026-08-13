'use strict';

/**
 * Motor de espejado de sesiones entre el CONTENEDOR y WINDOWS NATIVO.
 *
 * REPARTO DE RESPONSABILIDADES (esto es lo importante del diseno):
 *
 *   DISPONIBILIDAD del dato crudo  -> BIND MOUNT, no este codigo.
 *   TRADUCCION al otro entorno     -> este codigo.
 *
 * La primera version de este diseno hacia que el hook COPIARA las sesiones. Estaba mal, y el
 * caso que lo tumba es real: si se agota la cuota en el contenedor y te vas a Windows a seguir,
 * el `SessionStart` del contenedor NUNCA corre — no estas arrancando una sesion de contenedor —
 * asi que el push pendiente no ocurre jamas. El motor vivia justo donde no ibas a estar.
 *
 * Por eso `projects/` y `file-history/` se montan directo sobre los de Windows: el .jsonl lo
 * escribe Claude Code por su camino normal de escritura, no un hook. Eso sobrevive a cuota
 * agotada, SIGKILL, docker stop y corte de luz, porque no depende de que corra nada nuestro.
 * Las carpetas NO colisionan: el contenedor escribe en `-workspace-...` y Windows en `c--Users-...`.
 *
 * Este modulo solo genera el GEMELO TRADUCIDO, que es idempotente y tolera correr tarde: si no
 * se genero ahora, se genera en el proximo arranque de cualquiera de los dos lados, sin perdida.
 *
 * TRADUCCION DIRIGIDA (decision explicita, no atajo):
 * Se reescriben SOLO campos estructurales (`cwd`, `file_path`) y comandos Bash — que es lo que
 * rompe al resumir. La prosa de la conversacion y los contenidos de archivo capturados en
 * `toolUseResult` quedan INTACTOS. Una sesion donde se discutio el docker-compose contiene
 * "/workspace/Farmacia" como CONTENIDO, no como referencia: reescribirlo falsearia el registro.
 */

const fs = require('fs');
const path = require('path');
const pm = require('./path-map.js');

/** Campos que SI se traducen. Todo lo demas se deja como esta, a proposito. */
const CAMPOS_RUTA = ['file_path', 'filePath', 'notebook_path', 'path'];

function traducirValorProfundo(nodo, pares, hacia) {
  if (Array.isArray(nodo)) return nodo.map((n) => traducirValorProfundo(n, pares, hacia));
  if (!nodo || typeof nodo !== 'object') return nodo;

  const out = {};
  for (const [k, v] of Object.entries(nodo)) {
    if (CAMPOS_RUTA.includes(k) && typeof v === 'string') {
      out[k] = pm.traducirRuta(v, pares, hacia) || v;
    } else if (k === 'command' && typeof v === 'string') {
      out[k] = traducirDentroDeComando(v, pares, hacia);
    } else {
      out[k] = traducirValorProfundo(v, pares, hacia);
    }
  }
  return out;
}

/**
 * Dentro de un comando Bash las rutas vienen embebidas en texto libre. Se sustituye por prefijo
 * de volumen montado, que es lo unico que se puede hacer con seguridad: son prefijos largos y
 * muy especificos (`/workspace/Farmacia`), no hay riesgo realista de falso positivo.
 */
function traducirDentroDeComando(cmd, pares, hacia) {
  let out = cmd;
  for (const p of pares) {
    const desde = hacia === 'windows' ? p.contenedor : p.windows;
    const a = hacia === 'windows' ? p.windows : p.contenedor;
    if (!out.includes(desde)) continue;
    out = out.split(desde).join(a);
  }
  return out;
}

function traducirRegistro(reg, pares, hacia) {
  const out = traducirValorProfundo(reg, pares, hacia);
  if (typeof reg.cwd === 'string') out.cwd = pm.traducirRuta(reg.cwd, pares, hacia) || reg.cwd;
  return out;
}

/** Lee un .jsonl tolerando lineas corruptas (una sesion viva se esta escribiendo mientras leemos). */
function leerJsonl(archivo) {
  const lineas = fs.readFileSync(archivo, 'utf8').split('\n');
  const regs = [];
  for (const l of lineas) {
    const t = l.trim();
    if (!t) continue;
    try { regs.push(JSON.parse(t)); } catch { /* linea a medio escribir: se ignora */ }
  }
  return regs;
}

function escribirAtomico(destino, contenido) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contenido);
  fs.renameSync(tmp, destino);
}

/**
 * FAST-FORWARD ONLY (el ajuste sobre last-writer-wins).
 *
 * El escenario que pierde datos NO requiere trabajar en paralelo, alcanza con un sync que no
 * corrio: el contenedor llega a 120 mensajes, el push falla, despues resumis en Windows la copia
 * vieja de 100, sumas 5, y el sync pisa los 120 con 105. Se perdieron 20 mensajes sin que nunca
 * hubiera simultaneidad.
 *
 * Regla: solo se sobrescribe si el destino es ANCESTRO del origen (mismo prefijo, menos o igual
 * cantidad de registros). Si divergieron, no se toca nada y se reporta. Es `git push` sin --force:
 * en el 99% de los casos se comporta igual que last-writer-wins, y solo frena cuando iba a
 * destruir algo.
 */
function esFastForward(origen, destino) {
  if (!destino.length) return true;
  if (destino.length > origen.length) return false;
  for (let i = 0; i < destino.length; i++) {
    const a = destino[i];
    const b = origen[i];
    if ((a && a.uuid) !== (b && b.uuid)) return false;
  }
  return true;
}

/** Indice hash->ruta reconstruido desde la sesion: file-history guarda el hash, no la ruta. */
function rutasDeSesion(regs) {
  const rutas = new Set();
  const visitar = (n) => {
    if (Array.isArray(n)) return n.forEach(visitar);
    if (!n || typeof n !== 'object') return;
    for (const [k, v] of Object.entries(n)) {
      if (CAMPOS_RUTA.includes(k) && typeof v === 'string') rutas.add(v);
      else visitar(v);
    }
  };
  regs.forEach(visitar);
  return rutas;
}

/**
 * file-history es direccionable por sha256(ruta)[:16]. Compartir la carpeta por bind mount hace
 * que el archivo ESTE, pero con el nombre del hash del OTRO entorno: presente y no encontrable.
 * Por eso se reescribe el nombre. Los sufijos son @v1/@v2/@v3... (versiones), se copian todas.
 */
function espejarFileHistory(dirFH, sessionId, regs, pares, hacia) {
  const dir = path.join(dirFH, sessionId);
  if (!fs.existsSync(dir)) return 0;

  const porHash = new Map();
  for (const r of rutasDeSesion(regs)) {
    const t = pm.traducirRuta(r, pares, hacia);
    if (t) porHash.set(pm.hashFileHistory(r), t);
  }

  let n = 0;
  for (const entrada of fs.readdirSync(dir)) {
    const m = /^([0-9a-f]{16})(@v\d+)$/.exec(entrada);
    if (!m) continue;
    const destinoRuta = porHash.get(m[1]);
    if (!destinoRuta) continue; // ruta fuera de los volumenes montados: no hay equivalente

    const nuevo = path.join(dir, pm.hashFileHistory(destinoRuta) + m[2]);
    if (fs.existsSync(nuevo)) continue;
    try { fs.copyFileSync(path.join(dir, entrada), nuevo); n++; } catch { /* best effort */ }
  }
  return n;
}

/**
 * Espeja UNA sesion al otro entorno. Devuelve un motivo cuando no hace nada, para que el hook
 * pueda reportarlo sin adivinar.
 */
function espejarSesion({ archivo, dirProyectos, dirFH, pares, hacia }) {
  const regs = leerJsonl(archivo);
  if (!regs.length) return { estado: 'vacia' };

  const cwd = (regs.find((r) => typeof r.cwd === 'string') || {}).cwd;
  if (!cwd) return { estado: 'sin-cwd' };

  const cwdTraducido = pm.traducirRuta(cwd, pares, hacia);
  if (!cwdTraducido) return { estado: 'fuera-de-volumenes', cwd };

  const carpeta = pm.resolverCarpetaExistente(dirProyectos, pm.sanitizarProyecto(cwdTraducido));
  const destino = path.join(dirProyectos, carpeta, path.basename(archivo));

  let previos = [];
  if (fs.existsSync(destino)) {
    try { previos = leerJsonl(destino); } catch { /* ilegible: se trata como vacio */ }
  }
  if (previos.length === regs.length) return { estado: 'sin-cambios' };
  if (!esFastForward(regs, previos)) return { estado: 'divergido', destino, local: regs.length, remoto: previos.length };

  const salida = regs.map((r) => JSON.stringify(traducirRegistro(r, pares, hacia))).join('\n') + '\n';
  escribirAtomico(destino, salida);

  const sid = path.basename(archivo, '.jsonl');
  const nFH = espejarFileHistory(dirFH, sid, regs, pares, hacia);

  return { estado: 'espejada', destino, registros: regs.length, fileHistory: nFH };
}

module.exports = {
  traducirRegistro,
  traducirDentroDeComando,
  leerJsonl,
  escribirAtomico,
  esFastForward,
  rutasDeSesion,
  espejarFileHistory,
  espejarSesion,
};
