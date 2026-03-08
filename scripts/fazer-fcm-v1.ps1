# Fluxo completo: Firebase Key + EAS Upload
# Execute: .\scripts\fazer-fcm-v1.ps1
#
# 1. O script abre o Firebase e clica em "Gerar nova chave privada"
# 2. Voce salva o JSON (Downloads ou outro local)
# 3. Execute: .\scripts\fazer-fcm-v1.ps1 "C:\caminho\para\renove-ja-xxxxx.json"

param([string]$JsonPath)

$frontend = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")) "frontend-mobile"

Write-Host "`n=== FCM v1 - RenoveJa ===`n" -ForegroundColor Cyan

if ($JsonPath -and (Test-Path $JsonPath)) {
    Write-Host "JSON encontrado: $JsonPath" -ForegroundColor Green
    Write-Host "Copiando para frontend-mobile (EAS detecta automaticamente)..." -ForegroundColor Yellow
    $dest = Join-Path $frontend "renove-ja-fcm-key.json"
    Copy-Item $JsonPath $dest -Force
    Write-Host "Copiado para: $dest" -ForegroundColor Green
    Write-Host "`nExecutando EAS credentials..." -ForegroundColor Yellow
    Push-Location $frontend
    npx eas credentials --platform android
    Pop-Location
    Write-Host "`nRemovendo copia local (seguranca)..." -ForegroundColor Gray
    Remove-Item $dest -Force -ErrorAction SilentlyContinue
    Write-Host "Concluido." -ForegroundColor Green
} else {
    Write-Host "1. Abra: https://console.firebase.google.com/project/renove-ja/settings/serviceaccounts/adminsdk" -ForegroundColor Yellow
    Write-Host "2. Clique em 'Gerar nova chave privada' > 'Gerar chave'" -ForegroundColor Gray
    Write-Host "3. Salve o JSON baixado" -ForegroundColor Gray
    Write-Host "4. Execute: .\scripts\fazer-fcm-v1.ps1 `"C:\caminho\para\arquivo.json`"" -ForegroundColor Cyan
    Write-Host ""
    Start-Process "https://console.firebase.google.com/project/renove-ja/settings/serviceaccounts/adminsdk"
}
