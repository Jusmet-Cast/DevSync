<#
    .SYNOPSIS
    Watcher del bridge de notificaciones de Claude Code (Docker dentro de WSL2 -> Windows).

    .DESCRIPTION
    Cuando Claude Code corre DENTRO de un contenedor Docker (por ejemplo: WSL2 -> `docker run` ->
    Claude adentro), el hook notify-desktop.js no puede disparar un toast directo porque el
    contenedor no ve el escritorio de Windows. En su lugar escribe un archivo JSON chico
    ({"title": "...", "body": "..."}) en una carpeta compartida.

    Este script corre del lado de Windows, hace polling sobre esa carpeta, y dispara un toast
    real (BurntToast) por cada archivo nuevo. Borra cada archivo despues de procesarlo.

    Usa polling y NO FileSystemWatcher: las escrituras que vienen del contenedor atraviesan la
    capa 9p/virtiofs de WSL2 y no generan eventos ReadDirectoryChangesW, asi que el eventing
    queda mudo aunque el archivo exista. Ver el comentario largo mas abajo.

    .PARAMETER WatchDir
    Carpeta de Windows que coincide con el volumen montado en el contenedor. Por default
    "$env:USERPROFILE\ClaudeNotify", pensada para levantar el contenedor con:
        docker run -v /mnt/c/Users/<TU_USUARIO_WINDOWS>/ClaudeNotify:/claude-notify ...

    .PARAMETER MaxAgeMinutes
    Si el watcher estuvo apagado y se acumularon archivos viejos, los descarta en silencio en vez
    de disparar un toast por cada uno al arrancar. Default: 10 minutos.

    .PARAMETER PollIntervalMs
    Cada cuanto revisa la carpeta. Default: 1000 ms (latencia despreciable para un toast, y el
    costo de un Get-ChildItem sobre una carpeta casi siempre vacia es nulo).

    .EXAMPLE
    Probar en primer plano (Ctrl+C para cortar):
        powershell -ExecutionPolicy Bypass -File notify-bridge-watcher.ps1

    .EXAMPLE
    Dejarlo corriendo siempre (una sola vez, en una PowerShell con tu usuario):
        $scriptPath = "$env:USERPROFILE\.claude\hooks\windows\notify-bridge-watcher.ps1"
        $action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
            -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
        $trigger = New-ScheduledTaskTrigger -AtLogOn
        Register-ScheduledTask -TaskName 'ClaudeNotifyBridgeWatcher' -Action $action -Trigger $trigger `
            -Description 'Watcher de notificaciones de Claude Code (Docker/WSL2 bridge)'
#>

param(
    [string]$WatchDir = "$env:USERPROFILE\ClaudeNotify",
    [int]$MaxAgeMinutes = 10,
    [int]$PollIntervalMs = 1000
)

if (-not (Get-Module -ListAvailable -Name BurntToast)) {
    Write-Error 'Falta BurntToast. Corre: Install-Module -Name BurntToast -Scope CurrentUser -Force'
    exit 1
}
Import-Module BurntToast

New-Item -ItemType Directory -Path $WatchDir -Force | Out-Null

# Un -AppId NO registrado hace que Windows DESCARTE el toast en silencio: sin
# excepcion, sin error, sin nada en pantalla. El watcher lo toma por exito,
# borra el JSON y sigue -- el modo de falla mas dificil de diagnosticar que
# tiene este bridge.
#
# El AUMID se registra con un shortcut en el Start Menu (setup-notify-identity.ps1).
# Si ese shortcut no esta, es preferible un toast con identidad generica de
# PowerShell que ningun toast: se avisa y se sigue sin -AppId.
$script:ShortcutPath = Join-Path ([Environment]::GetFolderPath('Programs')) 'Claude Code.lnk'
$script:UseAppId = Test-Path -LiteralPath $script:ShortcutPath

if (-not $script:UseAppId) {
    Write-Warning @"
La identidad 'ClaudeCode.Notify' NO esta registrada (falta $script:ShortcutPath).
Los toasts van a salir como 'Windows PowerShell', sin el icono de Claude Code.
Para arreglarlo corre:
    powershell -ExecutionPolicy Bypass -File "`$env:USERPROFILE\.claude\hooks\windows\setup-notify-identity.ps1"
OJO: ese script hace throw si no encuentra images\claudecode-color.png en tu
CLAUDE_CONFIG_DIR de Windows -- si corre dentro de un contenedor, el PNG puede
no existir de este lado.
"@
}

function Show-ClaudeNotifyFile {
    param([string]$FilePath, [int]$MaxAgeMinutes)

    try {
        if (-not (Test-Path -LiteralPath $FilePath)) {
            return
        }
        $age = (Get-Date) - (Get-Item -LiteralPath $FilePath).LastWriteTime
        if ($age.TotalMinutes -le $MaxAgeMinutes) {
            $data = Get-Content -Raw -LiteralPath $FilePath | ConvertFrom-Json

            # Identidad "Claude Code" (nombre + icono) en vez del generico de
            # PowerShell. Reune las mismas dos piezas que el camino directo de
            # notify-desktop.js (fireToastPowerShell): AppId registrado por
            # setup-notify-identity.ps1, y AppLogo apuntando al PNG del lado de
            # Windows (el del contenedor no es visible desde aca).
            #
            # AMBOS van por splatting condicional: sin el PNG el toast sale sin
            # icono, y sin el shortcut sale sin identidad -- pero SALE. Nunca
            # dejar que un adorno faltante se coma la notificacion entera.
            $toastArgs = @{
                Text = @($data.title, $data.body)
            }
            if ($script:UseAppId) {
                $toastArgs['AppId'] = 'ClaudeCode.Notify'
            }
            $appLogo = Join-Path $env:USERPROFILE '.claude\images\claudecode-color.png'
            if (Test-Path -LiteralPath $appLogo) {
                $toastArgs['AppLogo'] = $appLogo
            }
            New-BurntToastNotification @toastArgs
        }
    } catch {
        # Un JSON corrupto no justifica matar el watcher, pero tampoco hay que
        # tragarse el error: este catch cubre tambien las fallas de
        # New-BurntToastNotification, que son las que interesan.
        Write-Warning "No se pudo notificar desde $FilePath : $($_.Exception.Message)"
    } finally {
        Remove-Item -LiteralPath $FilePath -Force -ErrorAction SilentlyContinue
    }
}

# POLLING, no FileSystemWatcher -- a proposito.
#
# FileSystemWatcher usa ReadDirectoryChangesW, que solo recibe eventos de
# escrituras hechas por el kernel de Windows. Cuando el contenedor Docker
# escribe el JSON, la escritura entra por la capa 9p/virtiofs de WSL2: el
# archivo APARECE en el filesystem de Windows (Get-ChildItem lo ve sin drama),
# pero el evento Created nunca se emite. Es el mismo motivo por el que
# FileSystemWatcher tampoco anda sobre network shares.
#
# Sintoma si se usa eventing aca: el barrido inicial procesa lo pendiente y
# despues el watcher queda mudo para siempre, aparentando estar vivo.
#
# El barrido tambien descarta (sin toast) lo que sea mas viejo que
# MaxAgeMinutes, asi arrancar el watcher despues de un rato no dispara una
# avalancha de toasts atrasados.
Write-Host "Escuchando notificaciones de Claude Code en $WatchDir cada ${PollIntervalMs}ms (Ctrl+C para salir)"

while ($true) {
    Get-ChildItem -Path $WatchDir -Filter '*.json' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime |
        ForEach-Object {
            Show-ClaudeNotifyFile -FilePath $_.FullName -MaxAgeMinutes $MaxAgeMinutes
        }
    Start-Sleep -Milliseconds $PollIntervalMs
}
