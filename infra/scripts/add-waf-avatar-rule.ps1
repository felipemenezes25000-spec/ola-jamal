# ============================================================
# Adiciona regra no WAF para permitir upload de avatar.
# A infra ja existe; o Terraform state esta vazio. Esta script
# abre o Console AWS para voce adicionar a regra manualmente.
# ============================================================

$Region = "sa-east-1"
# URL padrao do WAF (sem subdominio regional - evita 404)
$ConsoleUrl = "https://console.aws.amazon.com/wafv2/homev2?region=$Region"

Write-Host ""
Write-Host "=== Regra WAF para upload de avatar ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "A infra AWS ja existe. O Terraform tentou criar recursos duplicados."
Write-Host "Para permitir upload de avatar (evitar 403), adicione a regra no WAF:"
Write-Host ""
Write-Host "1. Abra: $ConsoleUrl" -ForegroundColor Yellow
Write-Host "   (confirme que a regiao e sa-east-1 no canto superior direito)" -ForegroundColor Gray
Write-Host "2. Clique no Web ACL 'renoveja-waf'"
Write-Host "3. Em Rules, clique 'Add rules' -> 'Add my own rules and rule groups'"
Write-Host "4. Rule type: Rule builder"
Write-Host "5. Name: allow-multipart-uploads"
Write-Host "6. Type: Regular rule"
Write-Host "7. If a request: matches the statement"
Write-Host "8. Inspect: URI path"
Write-Host "9. Match type: Contains string"
Write-Host "10. String to match: /api/auth/avatar"
Write-Host "11. Adicione outra condicao OR: URI path Contains /api/certificates/upload"
Write-Host "12. Action: Allow"
Write-Host "13. Priority: 0 (avaliada primeiro)"
Write-Host "14. Add rule"
Write-Host ""
Write-Host "Abrindo o Console AWS..." -ForegroundColor Cyan
Start-Process $ConsoleUrl
Write-Host ""
