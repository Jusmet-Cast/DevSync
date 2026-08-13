'use strict';

/**
 * Merge de estado por-proyecto entre CONTENEDOR y WINDOWS: `.claude.json` (issue #5) e
 * `history.jsonl` (issue #4).
 *
 * QUE RESUELVE:
 *   #5 — `.claude.json` guarda `projects{}` indexado por ruta absoluta: ahi viven
 *        `hasTrustDialogAccepted`, `allowedTools` y la config MCP por proyecto. Al cruzar de
 *        entorno la clave no existe y te vuelve a pedir el trust dialog y perdes los allowedTools.
 *   #4 — `history.jsonl` (el historial de flecha arriba) tiene un campo `project` con la misma
 *        ruta absoluta, asi que el historial de prompts tampoco cruza.
 *
 * TRES FORMATOS DE RUTA WINDOWS CONVIVIENDO (verificado en los archivos reales, no asumido):
 *   1. carpeta de projects/ : `c--Users-areyes-Desktop-Farmacia`   (sanitizado con `-`)
 *   2. file_path / hash     : `C:\Users\areyes\Desktop\Farmacia`   (BARRA INVERTIDA, unidad MAY)
 *   3. clave de .claude.json: `c:/Users/areyes/Desktop/Farmacia`   (BARRA NORMAL, unidad variable)
 * Son tres. Confundirlos es el error facil aca, por eso `aClaveWindows()` existe aparte.
 *
 * QUE **NO** SE COPIA NUNCA DE `.claude.json`:
 * El archivo tiene `oauthAccount`, `userID` y `machineID` — identidad de la cuenta y de la
 * maquina. Se toca EXCLUSIVAMENTE el subarbol `projects{}`, y de cada proyecto solo los campos
 * de configuracion listados en CAMPOS_MERGE. La telemetria de sesion (lastSessionId, lastCost,
 * lastModelUsage...) se deja afuera a proposito: cruzada de entorno no significa nada.
 */

const fs = require('fs');
const pm = require('./path-map.js');

/** Solo configuracion que al usuario le duele perder. Nada de telemetria de sesion. */
const CAMPOS_MERGE = [
  'allowedTools',
  'mcpServers',
  'enabledMcpjsonServers',
  'disabledMcpjsonServers',
  'hasTrustDialogAccepted',
  'hasClaudeMdExternalIncludesApproved',
  'projectOnboardingSeenCount',
  'mcpContextUris',
];

/** `C:\Users\areyes\Desktop\X` -> `C:/Users/areyes/Desktop/X` (formato de clave de .claude.json). */
function aClaveWindows(rutaBackslash) {
  return rutaBackslash.replace(/\\/g, '/');
}

/**
 * Issue #7 otra vez, ahora en .claude.json: conviven `c:/...` y `C:/...` para el MISMO proyecto.
 * Si ya existe una variante se reusa esa clave exacta, en vez de agregar una tercera.
 */
function claveExistente(proyectos, clave) {
  if (Object.prototype.hasOwnProperty.call(proyectos, clave)) return clave;
  const lower = clave.toLowerCase();
  return Object.keys(proyectos).find((k) => k.toLowerCase() === lower) || null;
}

/** Traduce una clave de proyecto al otro entorno, en el formato que ese entorno usa. */
function traducirClave(clave, pares, hacia) {
  const t = pm.traducirRuta(clave, pares, hacia);
  if (!t) return null;
  return hacia === 'windows' ? aClaveWindows(t) : t;
}

/**
 * Fusiona `projects{}` de origen -> destino traduciendo las claves.
 * Nunca pisa un proyecto que ya existe en destino: el estado local del entorno manda.
 * Devuelve la lista de claves agregadas.
 */
function mergeProyectos(origen, destino, pares, hacia) {
  const src = (origen && origen.projects) || {};
  if (!destino.projects) destino.projects = {};
  const dst = destino.projects;

  const agregadas = [];
  for (const [clave, valor] of Object.entries(src)) {
    const nueva = traducirClave(clave, pares, hacia);
    if (!nueva) continue;                       // fuera de los volumenes montados
    if (claveExistente(dst, nueva)) continue;   // ya existe: no se pisa

    const entrada = {};
    for (const campo of CAMPOS_MERGE) {
      if (valor && Object.prototype.hasOwnProperty.call(valor, campo)) entrada[campo] = valor[campo];
    }
    if (!Object.keys(entrada).length) continue;

    dst[nueva] = entrada;
    agregadas.push(nueva);
  }
  return agregadas;
}

/** Identidad de una entrada de history para deduplicar entre corridas. */
function claveHistory(e) {
  return `${e.timestamp}\u0000${e.sessionId || ''}\u0000${e.project || ''}\u0000${e.display || ''}`;
}

/**
 * Fusiona history.jsonl traduciendo el campo `project`.
 * Append-only y deduplicado: correr esto N veces deja el mismo resultado que correrlo una.
 */
function mergeHistory(lineasOrigen, lineasDestino, pares, hacia) {
  const existentes = new Set(lineasDestino.map(claveHistory));
  const nuevas = [];

  for (const e of lineasOrigen) {
    if (!e || typeof e.project !== 'string') continue;
    const p = pm.traducirRuta(e.project, pares, hacia);
    if (!p) continue;

    const twin = { ...e, project: p };
    const k = claveHistory(twin);
    if (existentes.has(k)) continue;
    existentes.add(k);
    nuevas.push(twin);
  }

  // Orden cronologico: el historial se lee de mas viejo a mas nuevo.
  return [...lineasDestino, ...nuevas].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

module.exports = {
  CAMPOS_MERGE,
  aClaveWindows,
  claveExistente,
  traducirClave,
  mergeProyectos,
  mergeHistory,
  claveHistory,
};
