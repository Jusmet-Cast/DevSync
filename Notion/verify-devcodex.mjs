#!/usr/bin/env node
/**
 * verify-devcodex.mjs — compara un workspace DevCodex real contra el esquema canonico.
 *
 * POR QUE VERIFICAR Y NO CREAR:
 * La API de Notion NO permite crear bases de datos (gotcha G-05: create-a-data-source
 * responde 400 remitiendo a la Create Database API, que no esta expuesta). Y los FILTROS
 * de vista tampoco son configurables por API. O sea: un script nunca puede levantar
 * DevCodex solo. Lo que SI puede — y es donde aporta valor real — es responder
 * "¿lo que hay coincide con lo que deberia haber?".
 *
 * Se usa en dos momentos:
 *   1) Post-instalacion → confirmar que la copia quedo completa
 *   2) Higiene periodica → detectar drift (Regla #9). Un campo renombrado a mano rompe
 *      la Regla #7 (nombres literales) y no da error hasta que un agente escribe mal.
 *
 * USO:
 *   NOTION_TOKEN=ntn_xxx node verify-devcodex.mjs
 *   NOTION_TOKEN=ntn_xxx node verify-devcodex.mjs --json           (salida parseable)
 *   NOTION_TOKEN=ntn_xxx node verify-devcodex.mjs --root <page_id> (acota a una raiz)
 *
 * ⚠️ POR QUE EXISTE --root:
 * El matching es por NOMBRE de base (los ids cambian al duplicar, ver devcodex-schema.json).
 * Si en el mismo workspace hay MAS DE UN DevCodex — el operativo y una copia-plantilla, por
 * ejemplo — ambos tienen bases llamadas `Projects`, `Sprints`, etc. Sin --root el script se
 * queda con la ultima que devuelve /search, que es arbitraria: reportaria un resultado que
 * parece valido y corresponde al workspace equivocado.
 * Con --root solo considera las bases cuyo `database_parent` sea esa pagina.
 * El page_id sale de la URL de la pagina raiz en Notion.
 *
 * NO escribe nada. Solo lee. Exit code 1 si hay diferencias.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ESQUEMA = JSON.parse(readFileSync(join(AQUI, 'devcodex-schema.json'), 'utf8'));

const TOKEN = process.env.NOTION_TOKEN;
const JSON_OUT = process.argv.includes('--json');

/** Normaliza un page_id: Notion lo muestra sin guiones en las URLs. */
function normId(id) {
  const limpio = String(id).replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(limpio) ? limpio : null;
}
const rootArg = process.argv[process.argv.indexOf('--root') + 1];
const ROOT = process.argv.includes('--root') ? normId(rootArg) : null;

if (process.argv.includes('--root') && !ROOT) {
  console.error(`❌ --root recibio "${rootArg}", que no es un page_id valido.`);
  console.error('   Son 32 caracteres hex, con o sin guiones. Sale de la URL de la pagina.');
  process.exit(2);
}
const API = 'https://api.notion.com/v1';
/**
 * ⚠️ La version importa. Con 2022-06-28 el objeto atomico es la DATABASE y /search
 * devuelve database_id. Desde 2025-09-03 existe el DATA SOURCE, que es lo que los
 * agentes usan para leer y escribir (NOTION_DATA_REGISTRY.md §5.4). Pedir la version
 * vieja hacia que este script reportara ids que parecian correctos y no lo eran.
 */
const VERSION = '2025-09-03';

if (!TOKEN) {
  console.error('❌ Falta NOTION_TOKEN.\n');
  console.error('   NOTION_TOKEN=ntn_xxx node verify-devcodex.mjs\n');
  console.error('   El token sale de la integracion interna en');
  console.error('   https://www.notion.so/profile/integrations');
  console.error('   Ver DEVCODEX_TEMPLATE.md §2.');
  process.exit(2);
}

async function notion(ruta, opciones = {}) {
  const r = await fetch(API + ruta, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Notion-Version': VERSION,
      'Content-Type': 'application/json',
      ...(opciones.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

const problemas = [];
const err = (m) => problemas.push({ nivel: 'error', mensaje: m });
const warn = (m) => problemas.push({ nivel: 'aviso', mensaje: m });

/**
 * Recorre el arbol de bloques de una pagina y junta los `database_id` que cuelgan de ella.
 *
 * ⚠️ NO alcanza con mirar `database_parent` del data source. Solo las bases que estan al
 * NIVEL RAIZ de la pagina tienen `database_parent.type === 'page_id'`; las que viven dentro
 * de una columna o un callout — la mayoria en este layout — reportan `type: 'block_id'`,
 * apuntando al contenedor. Filtrar por page_id devolvia 1 de 10 bases.
 * Por eso hay que bajar por el arbol: BFS sobre /blocks/{id}/children.
 */
async function databasesBajoLaRaiz(rootId) {
  const encontradas = new Set();
  const pendientes = [rootId];

  while (pendientes.length) {
    const bloque = pendientes.shift();
    let cursor;
    do {
      const qs = new URLSearchParams({ page_size: '100', ...(cursor ? { start_cursor: cursor } : {}) });
      let r;
      try {
        r = await notion(`/blocks/${bloque}/children?${qs}`);
      } catch {
        break; // bloque sin hijos accesibles — no es fatal
      }
      for (const b of r.results) {
        if (b.type === 'child_database') encontradas.add(normId(b.id));
        else if (b.has_children) pendientes.push(b.id);
      }
      cursor = r.has_more ? r.next_cursor : null;
    } while (cursor);
  }
  return encontradas;
}

/** Busca las bases visibles para la integracion, indexadas por titulo. */
async function descubrirBases() {
  const permitidas = ROOT ? await databasesBajoLaRaiz(ROOT) : null;
  if (permitidas && !permitidas.size) {
    err(`La raiz ${ROOT} no tiene bases accesibles. ¿El page_id es correcto y esta compartida?`);
  }

  const encontradas = new Map();
  const ambiguas = new Map(); // titulo -> cuantas veces aparecio
  let cursor;
  do {
    const r = await notion('/search', {
      method: 'POST',
      body: JSON.stringify({
        filter: { property: 'object', value: 'data_source' },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    for (const ds of r.results) {
      const titulo = (ds.title || []).map((t) => t.plain_text).join('').trim();
      if (!titulo) continue;

      // Con --root: el data source debe pertenecer a una database que cuelgue de esa raiz.
      if (permitidas) {
        const dbId = normId(ds.parent?.database_id || '');
        if (!dbId || !permitidas.has(dbId)) continue;
      }

      ambiguas.set(titulo, (ambiguas.get(titulo) || 0) + 1);
      encontradas.set(titulo, ds);
    }
    cursor = r.has_more ? r.next_cursor : null;
  } while (cursor);

  // Homonimos: el resultado seria arbitrario. Con --root no deberia pasar.
  for (const [titulo, veces] of ambiguas) {
    if (veces > 1) {
      err(
        `AMBIGUO: hay ${veces} bases llamadas "${titulo}" visibles para la integracion. ` +
          'Usá --root <page_id> para acotar a una sola raiz — sin eso el resultado es arbitrario.'
      );
    }
  }
  return encontradas;
}

function verificarBase(nombre, spec, real) {
  const props = real.properties || {};

  // Título: el nombre importa porque los agentes lo usan literal (Regla #7).
  const tituloReal = Object.values(props).find((p) => p.type === 'title')?.name;
  if (tituloReal !== spec.title_property) {
    err(`${nombre}: la propiedad titulo es "${tituloReal}" y deberia ser "${spec.title_property}"`);
  }

  for (const [propNombre, propSpec] of Object.entries(spec.properties)) {
    const real1 = props[propNombre];

    if (!real1) {
      err(`${nombre}.${propNombre}: FALTA (esperado ${propSpec.type})`);
      continue;
    }
    if (real1.type !== propSpec.type) {
      err(`${nombre}.${propNombre}: es ${real1.type} y deberia ser ${propSpec.type}`);
      continue;
    }

    // Opciones de select / multi_select / status
    if (Array.isArray(propSpec.options) && propSpec.options.length) {
      const reales = (real1[real1.type]?.options || []).map((o) => o.name);
      const faltan = propSpec.options.filter((o) => !reales.includes(o));
      const sobran = reales.filter((o) => !propSpec.options.includes(o));
      if (faltan.length) err(`${nombre}.${propNombre}: faltan opciones → ${faltan.join(' · ')}`);
      if (sobran.length) warn(`${nombre}.${propNombre}: opciones extra (puede ser intencional) → ${sobran.join(' · ')}`);
    }

    // Relaciones: que apunten a la base correcta y que la vuelta se llame como toca
    if (propSpec.type === 'relation') {
      const rel = real1.relation || {};
      if (propSpec.dual) {
        if (rel.type !== 'dual_property') {
          err(`${nombre}.${propNombre}: deberia ser dual_property y es ${rel.type}`);
        } else {
          const vuelta = rel.dual_property?.synced_property_name;
          if (vuelta !== propSpec.dual) {
            err(`${nombre}.${propNombre}: la relacion inversa se llama "${vuelta}" y deberia ser "${propSpec.dual}"`);
          }
        }
      }
    }
  }

  // Propiedades que existen pero no estan en el esquema
  const esperadas = new Set(Object.keys(spec.properties));
  esperadas.add(spec.title_property);
  for (const p of Object.keys(props)) {
    if (!esperadas.has(p)) warn(`${nombre}.${p}: existe pero no esta en el esquema canonico`);
  }
}

const bases = await descubrirBases();
const presentes = [];

for (const [nombre, spec] of Object.entries(ESQUEMA.databases)) {
  const real = bases.get(nombre);
  if (!real) {
    err(`Base "${nombre}" no encontrada. ¿Existe y esta compartida con la integracion?`);
    continue;
  }
  presentes.push({ nombre, data_source_id: real.id });
  verificarBase(nombre, spec, real);
}

const errores = problemas.filter((p) => p.nivel === 'error');
const avisos = problemas.filter((p) => p.nivel === 'aviso');

if (JSON_OUT) {
  console.log(JSON.stringify({ presentes, errores, avisos }, null, 2));
} else {
  console.log(`\nDevCodex — verificacion contra esquema canonico v${ESQUEMA.version}`);
  console.log(ROOT ? `  Raiz: ${ROOT}\n` : '  Raiz: todas las visibles (usá --root para acotar)\n');
  console.log(`  Bases encontradas: ${presentes.length}/${Object.keys(ESQUEMA.databases).length}\n`);
  for (const { nombre, data_source_id } of presentes) {
    console.log(`  ✅ ${nombre.padEnd(14)} ${data_source_id}`);
  }
  if (errores.length) {
    console.log('\n  ── ERRORES ──');
    for (const e of errores) console.log(`  ❌ ${e.mensaje}`);
  }
  if (avisos.length) {
    console.log('\n  ── AVISOS ──');
    for (const a of avisos) console.log(`  ⚠️  ${a.mensaje}`);
  }
  console.log(
    errores.length
      ? `\n  ${errores.length} error(es), ${avisos.length} aviso(s).\n`
      : `\n  ✅ Esquema consistente. ${avisos.length} aviso(s).\n`
  );
  if (presentes.length) {
    console.log('  Copiá estos data_source_id a System/NOTION_DATA_REGISTRY.md §2.\n');
  }
}

process.exit(errores.length ? 1 : 0);
