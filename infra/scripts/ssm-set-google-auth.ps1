# =============================================================================
# SSM Parameter Store — Google OAuth (login)
# Cria/atualiza Google__ClientId e Google__AndroidClientId para a API ECS.
# Execute após configurar as credenciais no Google Cloud Console.
# =============================================================================

param(
    [string]$Prefix = "/renoveja/prod",
    [string]$Region = "sa-east-1",
    [string]$GoogleClientId = "598286841038-j095u3iopiqltpgbvu0f5od924etobk7.apps.googleusercontent.com",
    [string]$GoogleAndroidClientId = "598286841038-780e9kksjoscthg0g611virnchlb7kcr.apps.googleusercontent.com"
)

Write-Host "Criando/atualizando parâmetros Google OAuth em SSM (prefixo: $Prefix)..." -ForegroundColor Cyan

$params = @(
    @{ Name = "Google__ClientId"; Value = $GoogleClientId },
    @{ Name = "Google__AndroidClientId"; Value = $GoogleAndroidClientId }
)

foreach ($p in $params) {
    $fullName = "$Prefix/$($p.Name)".Replace("//", "/")
    aws ssm put-parameter `
        --name $fullName `
        --value $p.Value `
        --type "String" `
        --overwrite `
        --region $Region
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK $fullName" -ForegroundColor Green
    } else {
        Write-Host "  ERRO ao criar $fullName" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "  1. O task-definition.json já referencia esses parâmetros em secrets." -ForegroundColor Gray
Write-Host "  2. Faça deploy: aws ecs register-task-definition --cli-input-json file://infra/task-definition.json --region $Region" -ForegroundColor Gray
Write-Host "  3. Force new deployment: aws ecs update-service --cluster renoveja-cluster --service renoveja-api --task-definition renoveja-api --force-new-deployment --region $Region" -ForegroundColor Gray
