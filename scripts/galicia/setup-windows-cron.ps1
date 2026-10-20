# ==============================================================================
# Gastapp - Programar Scraper Galicia a las 07:00 AM todos los días en Windows
# ==============================================================================
$TaskName = "Gastapp-Galicia-Scraper-7AM"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptPath = Join-Path $ScriptDir "run-daily-scrape.ps1"

Write-Host "Configurando tarea programada en Windows: $TaskName..." -ForegroundColor Cyan

# Acción: ejecutar PowerShell con la ruta del script
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

# Disparador: diario a las 07:00 AM
$Trigger = New-ScheduledTaskTrigger -Daily -At "07:00AM"

# Configuración de ejecución
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Registrar o actualizar tarea
try {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Force
    Write-Host "✅ Tarea programada creada con exito!" -ForegroundColor Green
    Write-Host "El scraper de Galicia se ejecutara todos los dias automaticamente a las 07:00 AM." -ForegroundColor White
} catch {
    Write-Host "❌ Error al registrar la tarea: $_" -ForegroundColor Red
}
