# ==============================================================================
# Gastapp - Script de ejecución desatendida del Scraper de Banco Galicia
# ==============================================================================
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$LogFile = Join-Path $ScriptDir "cron.log"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Add-Content -Path $LogFile -Value "[$Timestamp] Iniciando scrapeo diario programado..."

try {
    # Ejecutar scraper en modo headless silencioso
    & node scraper.mjs 2>&1 | Out-File -FilePath $LogFile -Append -Encoding utf8
    $EndTimestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$EndTimestamp] Scrapeo diario finalizado correctamente."
} catch {
    $ErrTimestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "[$ErrTimestamp] ERROR en el scrapeo diario: $_"
}
