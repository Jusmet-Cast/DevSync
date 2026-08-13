'use strict';

/**
 * Notificacion de escritorio multiplataforma para poder desligarse del CLI.
 * Cubre: Notification (permission_prompt), SubagentStart y Stop.
 *
 * El evento Stop dispara al final de CADA respuesta del agente, sin filtrar por
 * foco de ventana: es una decision explicita del usuario (ver README). Va
 * configurado con "async": true en settings.json para no sumarle latencia al
 * turno. Reemplaza al matcher idle_prompt, que avisaba de lo mismo pero recien
 * despues del delay de inactividad — tenerlos juntos daba doble toast.
 *
 * Caminos soportados:
 * - Windows nativo: toast via BurntToast (PowerShell).
 * - WSL2 corriendo Claude Code DIRECTO (sin contenedor): mismo camino de
 *   arriba, invocando el powershell.exe del host via interop.
 * - macOS: `display notification` via osascript (nativo, sin dependencias).
 * - Linux de escritorio: `notify-send` (libnotify).
 *
 * - Claude Code DENTRO de un contenedor Docker (nested en WSL2 u otro host):
 *   no hay interop ni notify-send con efecto visible ahi adentro, asi que se
 *   usa un bridge de carpeta compartida. El contenedor escribe un archivo
 *   JSON ({title, body}) en CLAUDE_NOTIFY_BRIDGE_DIR (default /claude-notify,
 *   pensado para montarse con `-v /mnt/c/Users/<user>/ClaudeNotify:/claude-notify`
 *   al levantar el contenedor desde WSL2). Del lado de Windows, un watcher de
 *   PowerShell (hooks/windows/notify-bridge-watcher.ps1) mira esa carpeta y
 *   dispara el toast. Si el volumen no esta montado, se avisa una vez en vez
 *   de fallar en silencio — ver README.md.
 *
 * Un hook de notificacion falla siempre abierto: nunca debe bloquear ni
 * retrasar a Claude Code. El unico "aviso" que emite (dependencia faltante o
 * contenedor sin bridge) sale por un exit code que NO es 0 ni 2, asi el
 * mensaje llega al usuario sin activar el comportamiento de bloqueo de
 * ningun evento (SubagentStart si se puede bloquear con exit 2; este hook
 * nunca usa ese codigo).
 */

const { spawn, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
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

function forPowerShellSingleQuoted(text) {
  return String(text ?? '')
    .replace(/'/g, "''")
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 200);
}

function forAppleScriptDoubleQuoted(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 200);
}

function buildMessage(input) {
  const event = input.hook_event_name;

  if (event === 'Notification') {
    if (input.notification_type === 'permission_prompt') {
      return {
        title: 'Claude Code — permiso pendiente',
        body: input.message || 'Necesita que apruebes una accion',
      };
    }
    return { title: 'Claude Code', body: input.message || 'Notificacion' };
  }

  if (event === 'Stop') {
    const project = input.cwd ? path.basename(input.cwd) : null;
    return {
      title: project ? `Claude Code — ${project}` : 'Claude Code',
      body: 'Termino de responder y espera tu proximo mensaje',
    };
  }

  if (event === 'SubagentStart') {
    const agentType = input.agent_type || 'sub-agente';
    return { title: 'Claude Code — sub-agente', body: `Arranco: ${agentType}` };
  }

  return null;
}

function hasCommand(cmd) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasBurntToast(powershellExe) {
  try {
    const out = execFileSync(
      powershellExe,
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "if (Get-Module -ListAvailable -Name BurntToast) { 'yes' } else { 'no' }",
      ],
      { encoding: 'utf8', timeout: 5000 },
    );
    return out.trim() === 'yes';
  } catch {
    return false;
  }
}

// Se emite UNA sola vez por sesion (marca en session-state/) para no
// bombardear al usuario cada vez que dispara Notification/SubagentStart.
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

const APP_LOGO_PATH = path.join(configDir, 'images', 'claudecode-color.png');

// AppUserModelID propio, registrado con un shortcut en el Start Menu (ver
// hooks/windows/setup-notify-identity.ps1) para que Windows muestre "Claude
// Code" con su icono en vez del generico "Windows PowerShell", y se pueda
// priorizar por separado en Enfoque asistido.
const APP_USER_MODEL_ID = 'ClaudeCode.Notify';

function fireToastPowerShell(powershellExe, message) {
  const title = forPowerShellSingleQuoted(message.title);
  const body = forPowerShellSingleQuoted(message.body);
  const hasLogo = fs.existsSync(APP_LOGO_PATH);
  const appLogoArg = hasLogo ? ` -AppLogo '${forPowerShellSingleQuoted(APP_LOGO_PATH)}'` : '';
  const psScript = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "Add-Type -MemberDefinition '[DllImport(\"shell32.dll\", CharSet = CharSet.Unicode)] public static extern int SetCurrentProcessExplicitAppUserModelID(string AppID);' -Namespace ClaudeNotify -Name Aumid",
    `[ClaudeNotify.Aumid]::SetCurrentProcessExplicitAppUserModelID('${APP_USER_MODEL_ID}')`,
    'Import-Module BurntToast',
    `New-BurntToastNotification -Text '${title}', '${body}'${appLogoArg}`,
  ].join('; ');

  const child = spawn(powershellExe, ['-NoProfile', '-NonInteractive', '-Command', psScript], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

function fireNotificationMac(message) {
  const title = forAppleScriptDoubleQuoted(message.title);
  const body = forAppleScriptDoubleQuoted(message.body);
  const script = `display notification "${body}" with title "${title}"`;

  const child = spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' });
  child.unref();
}

function bridgeDir() {
  return process.env.CLAUDE_NOTIFY_BRIDGE_DIR || '/claude-notify';
}

// Escritura atomica: renombra en vez de escribir directo, asi el watcher de
// Windows nunca lee un archivo a medio volcar.
function writeBridgeFile(dir, message) {
  const name = `${Date.now()}-${crypto.randomUUID()}.json`;
  const tmpPath = path.join(dir, `.${name}.tmp`);
  const finalPath = path.join(dir, name);
  fs.writeFileSync(tmpPath, JSON.stringify(message));
  fs.renameSync(tmpPath, finalPath);
}

function fireNotificationLinux(message) {
  const child = spawn('notify-send', [message.title, message.body], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function main() {
  let input = {};
  try {
    input = JSON.parse((await readStdin()) || '{}');
  } catch {
    process.exit(0);
    return;
  }

  const message = buildMessage(input);
  if (!message) {
    process.exit(0);
    return;
  }

  const platform = process.platform;
  const sessionId = input.session_id;

  if (platform === 'darwin') {
    fireNotificationMac(message);
    process.exit(0);
    return;
  }

  // Windows nativo, o WSL2 corriendo Claude Code directo (sin contenedor) con
  // interop hacia powershell.exe habilitado.
  const powershellExe =
    platform === 'win32' ? 'powershell.exe' : hasCommand('powershell.exe') ? 'powershell.exe' : null;

  if (powershellExe) {
    if (!hasBurntToast(powershellExe)) {
      warnOnce(
        sessionId,
        'burnttoast',
        '[notify-desktop] Falta el modulo BurntToast para las notificaciones de Windows. ' +
          'Corre vos "Install-Module -Name BurntToast -Scope CurrentUser -Force" en PowerShell, ' +
          'o pedile a tu Claude Code LOCAL (el que corre directo en tu maquina, no esta sesion) ' +
          'que lo instale.',
      );
      process.exit(1);
      return;
    }
    fireToastPowerShell(powershellExe, message);
    process.exit(0);
    return;
  }

  if (platform === 'linux') {
    if (fs.existsSync('/.dockerenv')) {
      const dir = bridgeDir();
      if (fs.existsSync(dir)) {
        try {
          writeBridgeFile(dir, message);
          process.exit(0);
          return;
        } catch {
          // si no se pudo escribir (permisos, disco lleno), cae al aviso de abajo
        }
      }
      warnOnce(
        sessionId,
        'docker-no-bridge',
        `[notify-desktop] Corriendo dentro de un contenedor Docker pero no encuentro ${dir} ` +
          'montado (o no se pudo escribir ahi). Montalo con "-v /mnt/c/Users/<TU_USUARIO>/ClaudeNotify:' +
          '/claude-notify" al levantar el contenedor y corre el watcher de Windows — ver README.md ' +
          '(seccion de notificaciones).',
      );
      process.exit(1);
      return;
    }

    if (!hasCommand('notify-send')) {
      warnOnce(
        sessionId,
        'notify-send',
        '[notify-desktop] Falta notify-send para las notificaciones de escritorio. Instalalo con ' +
          'tu gestor de paquetes (ej. "sudo apt install libnotify-bin"), o pedile a Claude que lo instale.',
      );
      process.exit(1);
      return;
    }

    fireNotificationLinux(message);
    process.exit(0);
    return;
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
