# Copia google-services.json da pasta Downloads para frontend-mobile/
# Execute após baixar o arquivo do Firebase Console

$downloads = [Environment]::GetFolderPath("UserProfile") + "\Downloads"
$source = Join-Path $downloads "google-services.json"
$dest = Join-Path $PSScriptRoot "..\frontend-mobile\google-services.json"

if (-not (Test-Path $source)) {
    Write-Host "Arquivo não encontrado em: $source" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Acesse: https://console.firebase.google.com/project/renove-ja/settings/general/android:com.renoveja.app"
    Write-Host "2. Clique em 'Baixe o arquivo google-services.json'"
    Write-Host "3. Execute este script novamente"
    exit 1
}

Copy-Item $source $dest -Force
Write-Host "OK: google-services.json copiado para frontend-mobile/" -ForegroundColor Green
