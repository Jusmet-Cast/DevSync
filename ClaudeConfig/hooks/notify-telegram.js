'use strict';

/**
 * Notificacion via Telegram Bot API, disparada en el evento Stop (cada vez que
 * el agente termina de responder). Pensada como canal independiente del bridge
 * de escritorio (notify-desktop.js) — no lo reemplaza, corre en paralelo.
 *
 * Credenciales: NUNCA hardcodeadas aca ni en settings.json. Llegan por env vars
 * (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID) inyectadas por docker-compose desde un
 * .env que vive junto al compose REAL en WSL (fuera del repo). Ver docker/docker-compose.yml.
 *
 * Fail-open: si faltan credenciales, si no hay red, o si Telegram devuelve error,
 * el hook nunca bloquea ni retrasa a Claude Code. Avisa una sola vez por sesion
 * cuando faltan credenciales (mismo patron que notify-desktop.js).
 */

const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const configDir = process.env.CLAUDE_CONFIG_DIR || path.resolve(__dirname, '..');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

function warnOnce(sessionId, key, text) {
  const dir = path.join(configDir, 'session-state', 'notify-warnings');
  const marker = path.join(dir, `${sessionId || 'no-session'}__${key}`);
  if (fs.existsSync(marker)) {
    return;
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(marker, '');
  } catch {
    // si no se puede escribir la marca, mejor avisar de nuevo que quedar mudo
  }
  console.error(text);
}

function buildMessage(input) {
  const project = input.cwd ? path.basename(input.cwd) : null;
  const title = project ? `Claude Code — ${project}` : 'Claude Code';
  return `${title}\nTermino de responder y espera tu proximo mensaje.`;
}

function sendTelegram(token, chatId, text) {
  return new Promise((resolve) => {
    const body = new URLSearchParams({ chat_id: chatId, text }).toString();
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 8000,
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve(res.statusCode));
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  let input = {};
  try {
    input = JSON.parse((await readStdin()) || '{}');
  } catch {
    process.exit(0);
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const sessionId = input.session_id;

  if (!token || !chatId) {
    warnOnce(
      sessionId,
      'telegram-missing-creds',
      '[notify-telegram] Faltan TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID en el entorno del contenedor. ' +
        'Revisa el .env junto al docker-compose.yml REAL en WSL — ver README.md (seccion Telegram).',
    );
    process.exit(1);
    return;
  }

  const text = buildMessage(input);
  const status = await sendTelegram(token, chatId, text);

  if (status !== 200) {
    warnOnce(
      sessionId,
      'telegram-send-failed',
      `[notify-telegram] Fallo el envio a Telegram (status=${status ?? 'sin respuesta'}). ` +
        'Verifica que el token sea valido y que le hayas mandado al menos un mensaje al bot antes.',
    );
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
