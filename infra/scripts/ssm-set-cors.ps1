# =============================================================================
# SSM Parameter Store — CORS AllowedOrigins
# Cria/atualiza parâmetros Cors__AllowedOrigins__0..4 para a API ECS.
# Use se preferir gerenciar CORS via AWS Console/CLI em vez do task-definition.
# =============================================================================

param(
    [string]$Prefix = "/renoveja/prod",
    [string]$Region = "sa-east-1"
)

$origins = @(
    "https://renovejasaude.com.br",
    "https://www.renovejasaude.com.br",
    "https://admin.renovejasaude.com.br",
    "https://medico.renovejasaude.com.br",
    "https://app.renovejasaude.com.br"
)

Write-Host "Criando/atualizando parâmetros CORS em SSM (prefixo: $Prefix)..." -ForegroundColor Cyan
for ($i = 0; $i -lt $origins.Count; $i++) {
    $name = "$Prefix/Cors__AllowedOrigins__$i".Replace("//", "/")
    $value = $origins[$i]
    aws ssm put-parameter `
        --name $name `
        --value $value `
        --type "String" `
        --overwrite `
        --region $Region
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK $name = $value" -ForegroundColor Green
    } else {
        Write-Host "  ERRO ao criar $name" -ForegroundColor Red
    }
}
Write-Host ""
Write-Host "Para usar no ECS via SSM, adicione em task-definition.json (secrets):" -ForegroundColor Yellow
Write-Host '  {"name": "Cors__AllowedOrigins__0", "valueFrom": "arn:aws:ssm:sa-east-1:064212133215:parameter/renoveja/prod/Cors__AllowedOrigins__0"},'
Write-Host "  ... (e assim por diante para __1, __2, __3, __4)"
Write-Host ""
Write-Host "Ou mantenha as env vars no task-definition (ja incluem medico.renovejasaude.com.br)." -ForegroundColor Gray
