# Script para iniciar ngrok e expor a API local para o webhook do Mercado Pago
# Pré-requisito: API rodando em http://localhost:5000
# Antes de usar: verifique seu email em https://dashboard.ngrok.com/user/settings

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Write-Host "Iniciando ngrok na porta 5000..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Quando o ngrok iniciar, copie a URL HTTPS (ex: https://xxxx.ngrok-free.app)" -ForegroundColor Yellow
Write-Host "e use no Mercado Pago: URL + /api/payments/webhook" -ForegroundColor Yellow
Write-Host "Ex: https://xxxx.ngrok-free.app/api/payments/webhook" -ForegroundColor Green
Write-Host ""
Write-Host "Mantenha esta janela aberta enquanto testar. Ctrl+C para encerrar." -ForegroundColor Gray
Write-Host ""

ngrok http 5000
