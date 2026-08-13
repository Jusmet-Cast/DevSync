#!/usr/bin/env node
/**
 * PostToolUse (Edit|Write) — Formatea el archivo recien tocado.
 *
 * IMPORTANTE: NO compila. La regla de CLAUDE.md es "nunca buildear para verificar";
 * `dotnet format` con --no-restore y alcance de un solo archivo respeta eso.
 *
 * Si la herramienta no esta instalada, el hook sale silencioso: formatear es un
 * lujo, nunca un bloqueo.
 */

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHUNKS = [];
process.stdin.on('data', (c) => CHUNKS.push(c));
process.stdin.on('end', () => {
  try {
    main(JSON.parse(Buffer.concat(CHUNKS).toString('utf8') || '{}'));
  } catch {
    process.exit(0);
  }
});

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'ignore',
    shell: process.platform === 'win32', // en Windows dotnet/npx son .cmd
    timeout: 50000,
  });
  return r.status === 0;
}

/** Sube desde el archivo buscando el contenedor de proyecto mas cercano. */
function findUp(startDir, predicate) {
  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    try {
      if (fs.readdirSync(dir).some(predicate)) return dir;
    } catch {
      return null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function main(payload) {
  const file = (payload.tool_input && payload.tool_input.file_path) || '';
  if (!file || !fs.existsSync(file)) process.exit(0);

  const dir = path.dirname(file);
  const ext = path.extname(file).toLowerCase();

  if (ext === '.cs') {
    const projDir = findUp(dir, (f) => f.endsWith('.csproj'));
    if (projDir) run('dotnet', ['format', '--include', file, '--no-restore', '--verbosity', 'quiet'], projDir);
    process.exit(0);
  }

  if (['.ts', '.html', '.scss', '.css', '.json'].includes(ext)) {
    const pkgDir = findUp(dir, (f) => f === 'package.json');
    if (pkgDir) run('npx', ['--no-install', 'prettier', '--write', file], pkgDir);
    process.exit(0);
  }

  process.exit(0);
}
