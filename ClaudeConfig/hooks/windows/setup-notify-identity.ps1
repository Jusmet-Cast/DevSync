# Registra una identidad de notificacion propia para Claude Code ("ClaudeCode.Notify")
# en vez de heredar el AppUserModelID generico de Windows PowerShell.
#
# Que hace:
#   1. Convierte images/claudecode-color.png a un .ico (los shortcuts de Windows
#      necesitan .ico, no .png, para el icono).
#   2. Crea un shortcut en el Start Menu del usuario con ese AppUserModelID, para
#      que Windows resuelva nombre ("Claude Code") e icono en Configuracion >
#      Notificaciones y en Enfoque asistido.
#
# hooks/notify-desktop.js fija esa misma identidad en el proceso de PowerShell
# que dispara el toast (SetCurrentProcessExplicitAppUserModelID) antes de llamar
# a New-BurntToastNotification. Sin el shortcut registrado, Windows muestra el
# AppId crudo en vez de "Claude Code" con su icono.
#
# Se corre UNA sola vez (o de nuevo si se borra el shortcut o cambia el logo).
# Requiere el modulo BurntToast instalado (ver README.md, seccion notificaciones).

$ErrorActionPreference = 'Stop'

$configDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE '.claude' }
$pngPath = Join-Path $configDir 'images\claudecode-color.png'
$icoPath = Join-Path $configDir 'images\claudecode.ico'
$appId = 'ClaudeCode.Notify'

if (-not (Test-Path $pngPath)) {
    throw "No se encontro el logo en $pngPath"
}

Add-Type -AssemblyName System.Drawing

$bitmap = New-Object System.Drawing.Bitmap($pngPath)
$resized = New-Object System.Drawing.Bitmap($bitmap, 256, 256)
$hIcon = $resized.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$resized.Dispose()
$bitmap.Dispose()
Write-Output "ICO_OK: $icoPath"

Import-Module BurntToast

$shortcutPath = Join-Path ([Environment]::GetFolderPath('Programs')) 'Claude Code.lnk'

New-BTShortcut -AppId $appId -ShortcutPath $shortcutPath -DisplayName 'Claude Code' -IconPath $icoPath -ForceWindowsPowerShell

Write-Output "SHORTCUT_OK: $shortcutPath"
