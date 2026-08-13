#!/usr/bin/env node
/**
 * Validador de la configuracion. Corrélo a mano antes de commitear:
 *
 *     node hooks/validate-config.js
 *
 * POR QUE EXISTE: con 26 skills, 10 agentes y 6 hooks, la informacion vive en varios
 * lugares que tienen que estar de acuerdo entre si. Cada vez que se borra o renombra
 * algo, quedan referencias colgadas — y se descubren leyendo a mano, tarde y por casualidad.
 * Este script las encuentra en dos segundos.
 *
 * Comprueba:
 *   1. Frontmatter YAML presente y parseable en agents/ y skills/
 *   2. Toda clave de frontmatter existe en el schema de su tipo de archivo
 *   3. Todo `skills:` de un agente apunta a una skill que existe
 *   4. Toda skill nombrada en SKILL-REGISTRY.md tiene su carpeta
 *   5. Toda skill de stack esta en el registry (y al reves)
 *   6. Todo comando de hook en settings.json apunta a un archivo existente
 *   7. settings.json es JSON valido y no quedaron `model` invalidos en agentes
 *
 * El punto 2 nacio de un bug real: skills/arch-review y skills/tdd declaraban `skills:` en su
 * frontmatter creyendo que precargaban cc-solid & co. Ese campo NO existe en SKILL.md (es campo
 * de SUB-AGENTE), asi que Claude Code lo ignoraba en silencio y las dos skills corrian sin una
 * sola regla cargada. Un campo mal escrito no da error: simplemente no hace nada. Por eso se
 * valida contra un schema cerrado y no contra una lista de campos prohibidos.
 *
 * Sale con codigo 1 si encuentra errores, 0 si esta todo bien.
 * Sin dependencias: parser de YAML minimo, suficiente para frontmatter plano.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errores = [];
const avisos = [];

const err = (m) => errores.push(m);
const warn = (m) => avisos.push(m);

/**
 * Extrae el frontmatter crudo de un archivo markdown.
 *
 * ⚠️ NORMALIZA CRLF → LF ANTES DE PARSEAR. No es cosmetico:
 * en JavaScript `\r` es TERMINADOR DE LINEA, asi que `.` NO lo matchea y `$`
 * (sin flag `m`) no matchea delante de el. Con archivos CRLF — lo normal en
 * Windows — el regex `^(clave):\s*(.*)$` de parseFm fallaba en TODA linea con
 * valor, y solo acertaba en las de valor vacio (`skills:`), donde `\s*` se comia
 * el `\r`. Resultado: el validador reportaba "falta 'name'" en los 13 agentes,
 * que SI tenian name. Un validador que da falsos positivos entrena a ignorarlo,
 * que es peor que no tenerlo.
 *
 * Detectado el 11 Ago 2026 al validar tras editar git-guard.js.
 */
function frontmatter(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
  if (!txt.startsWith('---')) return null;
  const end = txt.indexOf('\n---', 3);
  if (end === -1) return null;
  return txt.slice(4, end);
}

/** Parser minimo: claves de primer nivel + listas `- item`. Alcanza para frontmatter. */
function parseFm(raw) {
  const out = {};
  let claveLista = null;
  for (const linea of raw.split('\n')) {
    const item = linea.match(/^\s+-\s+(.+?)\s*$/);
    if (item && claveLista) {
      out[claveLista].push(item[1].replace(/^["']|["']$/g, ''));
      continue;
    }
    const kv = linea.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v.trim() === '') {
      claveLista = k;
      out[k] = [];
    } else {
      claveLista = null;
      out[k] = v.trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

const dirs = (p) =>
  fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];

// ------------------------------------------------------- Schemas de frontmatter
//
// OJO CON EL CASING: no es un descuido de la doc, son dos schemas distintos.
//   SKILL.md  -> kebab-case  (`disallowed-tools`, `argument-hint`)
//   agents/*  -> camelCase   (`disallowedTools`, `permissionMode`, `maxTurns`)
// Escribir uno con el casing del otro cae en el mismo pozo que el bug de `skills:`:
// se ignora en silencio.
//
// Fuente: code.claude.com/docs/en/skills y /docs/en/sub-agents.

const CLAVES_SKILL = new Set([
  'name', 'description', 'when_to_use', 'argument-hint', 'arguments',
  'disable-model-invocation', 'user-invocable', 'allowed-tools', 'disallowed-tools',
  'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell',
  // Del estandar abierto Agent Skills (agentskills.io). Claude Code los ignora, no molestan.
  'license', 'metadata',
]);

const CLAVES_AGENTE = new Set([
  'name', 'description', 'tools', 'disallowedTools', 'model', 'permissionMode',
  'maxTurns', 'skills', 'mcpServers', 'hooks', 'memory', 'background', 'effort',
  'isolation', 'color', 'initialPrompt',
  'license', 'metadata',
]);

// Errores de casing/parentesco frecuentes -> mensaje que dice QUE hacer, no solo que esta mal.
const SUGERENCIAS = {
  skills: 'no existe en SKILL.md (es campo de SUB-AGENTE). Una skill no puede precargar otras: ' +
    'pedilas explicitamente en el body con el tool Skill, o usa `context: fork` + `agent:`',
  'disallowed-tools': 'en un AGENTE el campo es camelCase: `disallowedTools`',
  disallowedTools: 'en una SKILL el campo es kebab-case: `disallowed-tools`',
  'allowed-tools': 'los agentes no filtran con `allowed-tools`: usa `tools:` (allowlist) o `disallowedTools:`',
  tools: 'en una SKILL el campo es `allowed-tools` (pre-aprobacion), no `tools`',
  color: 'no existe en SKILL.md — es campo de sub-agente',
  paths: 'no existe en agents/ — es campo de SKILL.md',
};

// Valores validos de enums. Se declaran ACA arriba, antes del primer uso: son `const` a nivel
// de modulo, y leerlos antes de su declaracion tira ReferenceError por TDZ.
const MODELOS = ['haiku', 'sonnet', 'opus', 'fable', 'inherit'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const COLORES = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];

/** Valida las claves de primer nivel contra el schema del tipo de archivo. */
function validarClaves(etiqueta, fm, permitidas) {
  for (const k of Object.keys(fm)) {
    if (permitidas.has(k)) continue;
    const extra = SUGERENCIAS[k] ? ` — ${SUGERENCIAS[k]}` : ' — no existe en el schema, se ignora en SILENCIO';
    err(`${etiqueta}: frontmatter "${k}"${extra}`);
  }
}

// Tools que un agente puede pedir. Un `tools:` con un nombre que no resuelve no es cosmetico:
// segun la doc, si NINGUN entry resuelve, el sub-agente directamente NO ARRANCA. Y un typo
// suelto ("Aget") le saca silenciosamente una capacidad que su prompt da por sentada.
const TOOLS_CONOCIDOS = new Set([
  'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'BashOutput', 'KillShell',
  'Glob', 'Grep', 'Agent', 'Task', 'Skill', 'WebFetch', 'WebSearch', 'TodoWrite',
  'AskUserQuestion', 'ExitPlanMode', 'SlashCommand', 'ListMcpResources', 'ReadMcpResource',
]);

// Nombres de agente declarados, para validar referencias cruzadas (skill -> agent).
// Se arma ANTES que las skills porque el chequeo de `agent:` las necesita.
const agentsDir = path.join(ROOT, 'agents');
const nombresDeAgente = new Set();
for (const f of fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter((x) => x.endsWith('.md')) : []) {
  const raw = frontmatter(path.join(agentsDir, f));
  if (raw === null) continue;
  const n = parseFm(raw).name;
  if (n) nombresDeAgente.add(n);
}

// ---------------------------------------------------------------- 1. Skills
const skillsDir = path.join(ROOT, 'skills');
const skills = new Set();

for (const nombre of dirs(skillsDir)) {
  const file = path.join(skillsDir, nombre, 'SKILL.md');
  if (!fs.existsSync(file)) {
    err(`skills/${nombre}/ no tiene SKILL.md`);
    continue;
  }
  skills.add(nombre);
  const raw = frontmatter(file);
  if (raw === null) {
    err(`skills/${nombre}/SKILL.md no tiene frontmatter cerrado`);
    continue;
  }
  const fm = parseFm(raw);
  validarClaves(`skills/${nombre}`, fm, CLAVES_SKILL);
  if (!fm.description) warn(`skills/${nombre}: sin 'description' — Claude no sabe cuando activarla`);
  if (fm.name && fm.name !== nombre) {
    warn(`skills/${nombre}: el campo name es "${fm.name}" y no coincide con la carpeta`);
  }
  if (fm.context && fm.context !== 'fork') {
    err(`skills/${nombre}: context "${fm.context}" no es valido (el unico valor soportado es "fork")`);
  }
  if (fm.agent && fm.context !== 'fork') {
    warn(`skills/${nombre}: declara 'agent' pero sin 'context: fork' — el campo no hace nada`);
  }
  // Una skill lanzadora que apunta a un agente inexistente falla en el momento de invocarla,
  // que es siempre el peor momento.
  if (fm.agent && !nombresDeAgente.has(fm.agent)) {
    err(`skills/${nombre}: 'agent: ${fm.agent}' no existe en agents/ (nombres validos: ${[...nombresDeAgente].join(', ')})`);
  }
  if (fm.effort && !EFFORTS.includes(fm.effort)) {
    err(`skills/${nombre}: effort "${fm.effort}" no es valido (${EFFORTS.join(', ')})`);
  }
}

// ---------------------------------------------------------------- 2. Agentes
for (const f of fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter((x) => x.endsWith('.md')) : []) {
  const file = path.join(agentsDir, f);
  const raw = frontmatter(file);
  if (raw === null) {
    err(`agents/${f}: sin frontmatter cerrado`);
    continue;
  }
  const fm = parseFm(raw);
  validarClaves(`agents/${f}`, fm, CLAVES_AGENTE);

  if (!fm.name) err(`agents/${f}: falta 'name' (obligatorio)`);
  if (!fm.description) err(`agents/${f}: falta 'description' (obligatorio)`);
  if (fm.model && !MODELOS.includes(fm.model) && !fm.model.startsWith('claude-')) {
    err(`agents/${f}: model "${fm.model}" no es valido (${MODELOS.join(', ')} o un id completo)`);
  }
  if (fm.effort && !EFFORTS.includes(fm.effort)) {
    err(`agents/${f}: effort "${fm.effort}" no es valido (${EFFORTS.join(', ')})`);
  }
  if (fm.color && !COLORES.includes(fm.color)) {
    err(`agents/${f}: color "${fm.color}" no es valido (${COLORES.join(', ')})`);
  }
  // La razon #1 por la que un agente arranca roto: precargar una skill que ya no existe.
  for (const s of fm.skills || []) {
    if (!skills.has(s)) err(`agents/${f}: precarga la skill "${s}", que NO existe en skills/`);
  }

  // `tools` llega como string separado por comas: "Read, Edit, mcp__engram__*".
  for (const t of String(fm.tools || '').split(',').map((x) => x.trim()).filter(Boolean)) {
    if (t.startsWith('mcp__')) continue; // servers MCP: no los podemos resolver desde acá
    if (!TOOLS_CONOCIDOS.has(t)) {
      warn(`agents/${f}: tool "${t}" no esta en la lista de tools conocidos — revisá que no sea un typo`);
    }
  }
}

// -------------------------------------------------------------- 3. Registry
const registryFile = path.join(skillsDir, 'SKILL-REGISTRY.md');
if (!fs.existsSync(registryFile)) {
  err('falta skills/SKILL-REGISTRY.md');
} else {
  const reg = fs.readFileSync(registryFile, 'utf8');

  // Skills nombradas en el registry que ya no existen (referencias colgadas)
  const nombradas = new Set();
  for (const m of reg.matchAll(/skills\/([a-z0-9-]+)\/SKILL\.md/g)) nombradas.add(m[1]);
  for (const m of reg.matchAll(/^### ([a-z0-9-]+)$/gm)) nombradas.add(m[1]);
  for (const n of nombradas) {
    if (!skills.has(n)) err(`SKILL-REGISTRY menciona "${n}", que ya no existe en skills/`);
  }

  // Skills de stack que existen pero nadie registro (el orquestador no las va a inyectar)
  const esStack = (n) => /^(cc-|csharp-|angular-|sql-|typescript-|dotnet-|efcore-|frontend-)/.test(n);
  for (const n of skills) {
    if (esStack(n) && !reg.includes(`### ${n}`)) {
      err(`skills/${n} es de stack pero NO tiene compact rules en SKILL-REGISTRY`);
    }
  }
}

// -------------------------------------------------------------- 4. Settings
const settingsFile = path.join(ROOT, 'settings.json');
try {
  const s = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  const eventos = s.hooks || {};
  for (const [evento, grupos] of Object.entries(eventos)) {
    for (const g of grupos) {
      for (const h of g.hooks || []) {
        const m = (h.command || '').match(/hooks\/([\w.-]+\.js)/);
        if (!m) continue;
        if (!fs.existsSync(path.join(ROOT, 'hooks', m[1]))) {
          err(`settings.json → hook ${evento} apunta a hooks/${m[1]}, que no existe`);
        }
      }
    }
  }
  const sl = (s.statusLine && s.statusLine.command) || '';
  const mSl = sl.match(/hooks\/([\w.-]+\.js)/);
  if (mSl && !fs.existsSync(path.join(ROOT, 'hooks', mSl[1]))) {
    err(`settings.json → statusLine apunta a hooks/${mSl[1]}, que no existe`);
  }
} catch (e) {
  err(`settings.json no es JSON valido: ${e.message}`);
}

// ------------------------------------------------------------- 5. Sintaxis JS
// Recursivo a proposito: hooks/lib/ tiene codigo COMPARTIDO por varios hooks, asi que un error
// de sintaxis ahi los rompe todos a la vez. Es el archivo que menos se puede dar el lujo de
// quedar sin chequear.
function jsRecursivo(dir, rel = 'hooks') {
  const salida = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory()) salida.push(...jsRecursivo(path.join(dir, d.name), `${rel}/${d.name}`));
    else if (d.name.endsWith('.js')) salida.push([path.join(dir, d.name), `${rel}/${d.name}`]);
  }
  return salida;
}

for (const [full, etiqueta] of jsRecursivo(path.join(ROOT, 'hooks'))) {
  try {
    new (require('vm').Script)(fs.readFileSync(full, 'utf8'), { filename: etiqueta });
  } catch (e) {
    err(`${etiqueta}: error de sintaxis — ${e.message}`);
  }
}

// ------------------------------------------------------------------ Reporte
const totalAgentes = fs.readdirSync(agentsDir).filter((x) => x.endsWith('.md')).length;
console.log(`\nValidacion de configuracion — ${skills.size} skills, ${totalAgentes} agentes\n`);

for (const a of avisos) console.log(`  ⚠️  ${a}`);
for (const e of errores) console.log(`  ❌ ${e}`);

if (!errores.length && !avisos.length) console.log('  ✅ Todo consistente.\n');
else console.log(`\n  ${errores.length} error(es), ${avisos.length} aviso(s).\n`);

process.exit(errores.length ? 1 : 0);
