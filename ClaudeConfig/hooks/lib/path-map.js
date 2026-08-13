'use strict';

/**
 * Mapeo de rutas entre el CONTENEDOR y WINDOWS NATIVO.
 *
 * POR QUE EXISTE:
 * Claude Code indexa TODO su estado por la ruta absoluta del cwd: el nombre de la carpeta en
 * `projects/`, el campo `cwd` de cada registro del .jsonl, los `file_path` de cada tool_use, la
 * clave de `projects{}` en .claude.json y hasta el nombre de los archivos de `file-history/`.
 * Windows reporta `C:\Users\areyes\Desktop\Farmacia` y el contenedor reporta `/workspace/Farmacia`.
 * Dos claves distintas => dos universos de estado que no se cruzan.
 *
 * POR QUE NO SE PUEDE ARREGLAR DE RAIZ:
 * La solucion limpia seria que ambos entornos vieran la MISMA ruta absoluta. Es imposible: un
 * path absoluto POSIX siempre arranca con `/` y uno de Windows siempre con letra de unidad. No
 * existe directorio en Linux cuyo path absoluto sea `C:\...`. Por eso traducimos.
 *
 * DE DONDE SALE EL MAPA (y por que del compose):
 * Se probaron dos fuentes que NO sirven, queda documentado para que nadie las reintente:
 *   1. `/proc/mounts` — inutil. Los bind mounts de Docker sobre WSL aparecen como 9p con
 *      `aname=drvfs;path=C:\` para TODOS por igual: dice la raiz de drvfs, no el subpath. No hay
 *      forma de recuperar que /workspace/Farmacia venia de /mnt/c/Users/areyes/Desktop/Farmacia.
 *   2. `docker inspect` — inutil DESDE ADENTRO. No hay CLI de docker ni socket en el contenedor.
 *      (Si funciona desde WSL, que es lo que hace la funcion `cc_in` del usuario.)
 * Queda el propio docker-compose.yml, que ademas es la fuente de verdad real: si agregas un
 * volumen nuevo, el mapa se actualiza solo. Por eso se monta read-only adentro del contenedor.
 *
 * NORMALIZACION (verificado empiricamente contra file-history de AMBOS entornos):
 * Windows hashea y guarda los paths con `\` y la letra de unidad en MAYUSCULA (`C:\Users\...`).
 * La carpeta de `projects/`, en cambio, aparece indistintamente como `C--` o `c--` segun como
 * se haya tipeado el `cd` — Windows es case-insensitive y no le importa, pero el contenedor lee
 * por 9p y ahi SI son nombres distintos. Ver `resolverCarpetaExistente()`.
 */

const fs = require('fs');
const path = require('path');

/**
 * `/mnt/c/Users/areyes/Desktop/Farmacia` -> `C:\Users\areyes\Desktop\Farmacia`
 * Mayuscula en la unidad a proposito: es la forma que Windows usa para hashear file-history.
 */
function wslAWindows(rutaWsl) {
  const m = /^\/mnt\/([a-zA-Z])(\/.*)?$/.exec(rutaWsl);
  if (!m) return null;
  const unidad = m[1].toUpperCase();
  const resto = (m[2] || '').replace(/\//g, '\\');
  return `${unidad}:${resto}`;
}

/**
 * Parsea las lineas `- <origen>:<destino>[:ro]` de la seccion volumes del compose.
 *
 * Se ignoran a proposito los origenes que no arrancan con /mnt/<letra>/ : `${HOME}/.claude-config`
 * y `${HOME}/.ssh` viven en el ext4 de WSL y no tienen equivalente en Windows, asi que no son
 * traducibles y no deben entrar al mapa.
 */
function parsearCompose(texto, configDirContenedor) {
  // Los mounts de infraestructura (projects/, file-history/, agents/, la DB de Engram, el compose)
  // NO son workspaces de proyecto: si entran al mapa, se reescribirian rutas de plomeria dentro
  // de los transcripts.
  //
  // LA REGLA ES "ESTA BAJO EL HOME", no "se llama .claude". Dos razones:
  //   - `/workspace/areyes/.claude` tambien termina en .claude y ESE si es un proyecto legitimo
  //     (es el repo de configuracion, se edita a diario). Filtrar por nombre lo romperia.
  //   - La plomeria no vive solo en .claude: tambien esta ~/.engram (la DB) y ~/.ssh. Filtrar
  //     solo por el config dir dejaba pasar .engram — pasó, y lo cazo el test del mapa.
  // Los proyectos se abren bajo /workspace; el HOME es configuracion. Esa es la separacion real.
  const cfg = (configDirContenedor || '/home/dev/.claude').replace(/\/+$/, '');
  const home = path.dirname(cfg);
  const excluido = (destino) =>
    destino === home || destino.startsWith(home + '/') || destino.startsWith('/etc/');

  const pares = [];
  for (const linea of texto.split(/\r?\n/)) {
    const t = linea.trim();
    if (!t.startsWith('-')) continue;

    const cuerpo = t.replace(/^-\s*/, '').replace(/^["']|["']$/g, '');
    if (!cuerpo.startsWith('/mnt/')) continue;

    // Se corta por el PRIMER `:` porque el origen POSIX nunca contiene `:`.
    const i = cuerpo.indexOf(':');
    if (i < 0) continue;
    const origen = cuerpo.slice(0, i);
    const destino = cuerpo.slice(i + 1).replace(/:(ro|rw|z|Z|cached|delegated)$/, '');
    if (!destino.startsWith('/')) continue;
    if (excluido(destino)) continue;

    const win = wslAWindows(origen);
    if (!win) continue;
    pares.push({ contenedor: destino.replace(/\/+$/, ''), windows: win.replace(/\\+$/, '') });
  }

  // Prefijo mas largo primero: /workspace/areyes/TFS tiene que ganarle a /workspace.
  return pares.sort((a, b) => b.contenedor.length - a.contenedor.length);
}

function cargarMapa(configDir) {
  // 1) Adentro del contenedor: el compose montado read-only es la fuente de verdad.
  const compose = process.env.CLAUDE_SYNC_COMPOSE || '/etc/claude-sync/docker-compose.yml';
  if (fs.existsSync(compose)) {
    try {
      const pares = parsearCompose(fs.readFileSync(compose, 'utf8'), configDir);
      if (pares.length) return pares;
    } catch { /* cae al plan B */ }
  }

  // 2) Desde Windows no hay compose accesible de forma confiable (habria que ir por \\wsl$).
  // Por eso el contenedor PUBLICA el mapa ya resuelto y Windows lo lee.
  try {
    const j = JSON.parse(fs.readFileSync(rutaMapaPublicado(configDir), 'utf8'));
    if (Array.isArray(j.pares) && j.pares.length) return j.pares;
  } catch { /* sin mapa */ }

  return [];
}

/**
 * OJO: el mapa va dentro de `projects/`, NO en `session-state/`.
 * `session-state/` queda deliberadamente PRIVADO de cada entorno — guarda agent-runs y
 * agent-outputs, y compartirlos haria que los sub-agentes de un entorno aparezcan en el otro.
 * `projects/` es la unica carpeta que el bind mount garantiza compartida, asi que es el unico
 * lugar donde el contenedor puede dejarle algo a Windows. El punto inicial lo mantiene fuera
 * del camino: `direccionDe()` solo mira carpetas con prefijo `-` o `X--`.
 */
function rutaMapaPublicado(configDir) {
  return path.join(configDir, 'projects', '.claude-path-map.json');
}

/** El contenedor deja el mapa resuelto para que el hook del lado Windows no necesite docker. */
function publicarMapa(configDir, pares) {
  if (!pares.length) return;
  const destino = rutaMapaPublicado(configDir);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ generado: new Date().toISOString(), pares }, null, 2));
  fs.renameSync(tmp, destino); // atomico: nadie lee un JSON a medio escribir
}

function esRutaWindows(p) {
  return /^[a-zA-Z]:[\\/]/.test(p);
}

/**
 * Traduce UNA ruta al otro entorno. Devuelve null si no cae bajo ningun volumen montado
 * (ej: /home/dev/... o C:\Windows\... no tienen contraparte y NO deben inventarse).
 */
function traducirRuta(ruta, pares, hacia) {
  if (typeof ruta !== 'string' || !ruta) return null;

  if (hacia === 'windows') {
    if (esRutaWindows(ruta)) return null; // ya esta traducida
    for (const p of pares) {
      if (ruta === p.contenedor || ruta.startsWith(p.contenedor + '/')) {
        const resto = ruta.slice(p.contenedor.length).replace(/\//g, '\\');
        return p.windows + resto;
      }
    }
    return null;
  }

  if (!esRutaWindows(ruta)) return null;
  const norm = ruta.replace(/\//g, '\\');
  for (const p of pares) {
    const pref = p.windows;
    // Case-insensitive: Windows no distingue mayusculas y la unidad aparece de las dos formas.
    if (norm.toLowerCase() === pref.toLowerCase() || norm.toLowerCase().startsWith(pref.toLowerCase() + '\\')) {
      const resto = norm.slice(pref.length).replace(/\\/g, '/');
      return p.contenedor + resto;
    }
  }
  return null;
}

/**
 * Nombre de carpeta en `projects/`: se sustituye `/`, `\` y `:` por `-`.
 *   /workspace/Farmacia/ERPLegacyGit      -> -workspace-Farmacia-ERPLegacyGit
 *   C:\Users\areyes\Desktop\Farmacia      -> C--Users-areyes-Desktop-Farmacia
 */
function sanitizarProyecto(ruta) {
  return ruta.replace(/[/\\:]/g, '-');
}

/**
 * Issue #7: en `projects/` conviven `C--Users-...` y `c--Users-...` para el MISMO proyecto,
 * segun como se tipeo el `cd`. Windows los trata como uno solo (case-insensitive); el contenedor
 * los ve como dos carpetas distintas. Si ya existe una variante, se reusa esa exacta en vez de
 * crear una tercera y fragmentar mas.
 */
function resolverCarpetaExistente(dirProyectos, nombre) {
  try {
    const existentes = fs.readdirSync(dirProyectos);
    const hit = existentes.find((e) => e.toLowerCase() === nombre.toLowerCase());
    if (hit) return hit;
  } catch { /* todavia no existe */ }
  return nombre;
}

/** file-history: nombre = sha256(<ruta absoluta tal cual la reporta el SO>)[:16] + "@v2". */
function hashFileHistory(rutaAbsoluta) {
  return require('crypto').createHash('sha256').update(rutaAbsoluta).digest('hex').slice(0, 16);
}

module.exports = {
  wslAWindows,
  parsearCompose,
  cargarMapa,
  rutaMapaPublicado,
  publicarMapa,
  traducirRuta,
  esRutaWindows,
  sanitizarProyecto,
  resolverCarpetaExistente,
  hashFileHistory,
};
