# Baixa o PDF da receita para testar o QR Code no celular (validar.iti.gov.br)
# Receita: b691c2f1-1e35-40a6-8553-e1809d9fc3b7 | Código: 712634

param(
    [string]$OutputPath = "$env:USERPROFILE\Downloads\receita-teste-iti.pdf"
)

$url = "https://ola-jamal.onrender.com/api/verify/b691c2f1-1e35-40a6-8553-e1809d9fc3b7/document?code=712634"

Write-Host ""
Write-Host "Baixando PDF para teste no ITI..." -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Gray
Write-Host ""

try {
    Invoke-WebRequest -Uri $url -Method Get -OutFile $OutputPath -UseBasicParsing
    Write-Host "PDF salvo em: $OutputPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Como testar no celular:" -ForegroundColor Yellow
    Write-Host "  1. Envie o PDF para seu celular (WhatsApp, email, etc.)"
    Write-Host "  2. Abra o PDF no celular"
    Write-Host "  3. Acesse validar.iti.gov.br no navegador"
    Write-Host "  4. Toque em 'Ler QR Code' e escaneie o QR do PDF"
    Write-Host "  5. Digite o codigo: 712634"
    Write-Host ""
    Write-Host "Ou abra o PDF agora:" -ForegroundColor Yellow
    Start-Process $OutputPath
} catch {
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Verifique se a API esta online (Render pode estar em cold start)." -ForegroundColor Yellow
}
