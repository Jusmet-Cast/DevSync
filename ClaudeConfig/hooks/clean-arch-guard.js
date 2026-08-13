#!/usr/bin/env node
/**
 * PreToolUse (Edit|Write) — Guard de Clean Architecture para C#/.NET.
 *
 * Bloquea violaciones de dependencia de capas ANTES de que el archivo se escriba.
 * Esto NO es una sugerencia que el modelo pueda olvidar: es enforcement duro.
 *
 * Reglas implementadas (ver skills cc-architecture / cc-solid / cc-naming):
 *   - Domain no referencia EF Core, AspNetCore ni Infrastructure.
 *   - Application no conoce tipos HTTP ni DbContext.
 *   - Repository no retorna mensajes de negocio.
 *   - DTOs son class, nunca record, y usan sufijo *Dto.
 *
 * Entorno: Windows + Git Bash + Node. Sin dependencias externas (nada de jq).
 */

'use strict';

const CHUNKS = [];
process.stdin.on('data', (c) => CHUNKS.push(c));
process.stdin.on('end', () => {
  try {
    main(JSON.parse(Buffer.concat(CHUNKS).toString('utf8') || '{}'));
  } catch {
    // Un hook roto NUNCA debe frenar el trabajo: fallamos abierto.
    process.exit(0);
  }
});

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

function main(payload) {
  const input = payload.tool_input || {};
  const rawPath = input.file_path || '';
  if (!rawPath.toLowerCase().endsWith('.cs')) process.exit(0);

  // Normalizamos separadores: en Windows llegan con backslash.
  const file = rawPath.replace(/\\/g, '/');
  const fileName = file.split('/').pop() || '';

  // Los proyectos de test rompen legitimamente varias de estas reglas.
  if (/(^|\/)(tests?|.*\.tests?)\//i.test(file) || /tests?\.cs$/i.test(fileName)) {
    process.exit(0);
  }

  // El texto entrante viaja en tres formas distintas segun el tool:
  //   Write     -> content
  //   Edit      -> new_string
  //   MultiEdit -> edits[].new_string   <-- se nos escapaba
  //
  // Leer solo `new_string` dejaba pasar SIN REVISAR cualquier cambio en lote, justo el caso
  // donde entra mas codigo de una. El guard fallaba abierto en su peor momento. Concatenamos
  // todas las formas y revisamos el conjunto.
  const trozos = [input.content, input.new_string];
  if (Array.isArray(input.edits)) {
    for (const e of input.edits) trozos.push(e && e.new_string);
  }
  const content = trozos.filter((t) => typeof t === 'string').join('\n');
  if (!content.trim()) process.exit(0);

  const inLayer = (layer) => new RegExp(`/${layer}/`, 'i').test(file);
  const has = (re) => re.test(content);

  // ---------------------------------------------------------------- Domain
  if (inLayer('Domain')) {
    if (has(/^\s*using\s+Microsoft\.EntityFrameworkCore/m)) {
      deny(
        '❌ CLEAN ARCH — Domain no puede referenciar EntityFrameworkCore.\n' +
          'El dominio no sabe como se persiste. El acceso a datos va detras de una interfaz ' +
          'de repositorio declarada en Domain e implementada en Infrastructure (cc-solid: DIP).'
      );
    }
    if (has(/^\s*using\s+Microsoft\.AspNetCore/m)) {
      deny(
        '❌ CLEAN ARCH — Domain no puede referenciar AspNetCore.\n' +
          'El dominio no sabe que existe HTTP. Si necesitas ese tipo, el modelo esta mal ubicado.'
      );
    }
    if (has(/^\s*using\s+[\w.]*\.Infrastructure/m)) {
      deny(
        '❌ CLEAN ARCH — Domain no puede referenciar Infrastructure.\n' +
          'Las dependencias apuntan HACIA ADENTRO, siempre. Invertila con una interfaz en Domain.'
      );
    }
  }

  // ----------------------------------------------------------- Application
  if (inLayer('Application')) {
    const httpLeak = content.match(
      /\b(HttpContext|HttpRequest|HttpResponse|IActionResult|ActionResult|ControllerBase)\b|\[(FromQuery|FromBody|FromRoute|FromForm)\]/
    );
    if (httpLeak) {
      deny(
        `❌ CLEAN ARCH — Application no puede depender de tipos HTTP (encontrado: ${httpLeak[0]}).\n` +
          'La capa Application orquesta casos de uso, no conoce el transporte. Eso vive en ' +
          'Presentation/Controllers. Ver cc-architecture §1.1.'
      );
    }
    if (has(/\bDbContext\b/)) {
      deny(
        '❌ CLEAN ARCH — Application no puede usar DbContext directo.\n' +
          'Siempre detras de IRepository. Ver cc-solid (DIP) y cc-architecture.'
      );
    }
  }

  // ----------------------------------------------------------- Repository
  if (/Repository\.cs$/i.test(fileName) && has(/Respuesta[^;\n]*\.Fault\s*\(/)) {
    deny(
      '❌ CLEAN ARCH — el repository no retorna mensajes de negocio (Respuesta.Fault).\n' +
        'Responsabilidad unica: acceso a datos. Retorna null / coleccion vacia / bool y que el ' +
        'AppService decida que significa. Ver cc-architecture §5.'
    );
  }

  // ----------------------------------------------------------------- DTOs
  if (/Dto\.cs$/i.test(fileName) && has(/^\s*(public|internal)\s+(sealed\s+)?record\b/m)) {
    deny(
      '❌ NAMING — los DTOs son "public class" con { get; set; }, NUNCA record.\n' +
        'record es para value objects con comparacion estructural. Ver cc-architecture §1.2 y cc-naming.'
    );
  }

  if (/\/Dtos\//i.test(file)) {
    const base = fileName.replace(/\.cs$/i, '');
    const badSuffix = base.match(/(Request|Response|Params|Input|Model)$/);
    if (badSuffix) {
      deny(
        `❌ NAMING — "${base}" usa el sufijo prohibido "${badSuffix[0]}".\n` +
          'En este proyecto el sufijo de transferencia es *Dto, SIEMPRE. Ver cc-naming §2.'
      );
    }
  }

  process.exit(0);
}
