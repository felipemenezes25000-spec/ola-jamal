<#
.SYNOPSIS
    Deploy completo: git push + Docker build + ECR push + ECS update
.DESCRIPTION
    1. Push dos commits locais para o remote
    2. Docker build da imagem do backend
    3. Push para o ECR (064212133215.dkr.ecr.sa-east-1.amazonaws.com/renoveja-api)
    4. Force new deployment no ECS (renoveja-prod/renoveja-api)
    5. (Opcional) Roda o aws-cleanup.ps1 para migrar SSM parameter
.PARAMETER SkipPush
    Pula o git push (se ja fez manualmente)
.PARAMETER SkipAwsCleanup
    Pula a execucao do aws-cleanup.ps1
.PARAMETER Apply
    Executa o aws-cleanup.ps1 com -Apply (senao faz dry-run)
#>
param(
    [switch]$SkipPush,
    [switch]$SkipAwsCleanup,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$git = 'C:\Program Files\Git\cmd\git.exe'
$root = 'C:\Users\renat\source\repos\ola-jamal'
$awsRegion = 'sa-east-1'
$awsAccountId = '064212133215'
$ecrRepo = "$awsAccountId.dkr.ecr.$awsRegion.amazonaws.com/renoveja-api"
$ecsCluster = 'renoveja-prod'
$ecsService = 'renoveja-api'

Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  DEPLOY RENOVEJA+ BACKEND' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# ============================================================
# STEP 1: Git Push
# ============================================================
if (!$SkipPush) {
    Write-Host '--- STEP 1: Git Push ---' -ForegroundColor Yellow
    Set-Location $root
    $branch = & $git branch --show-current 2>&1
    Write-Host "Branch: $branch" -ForegroundColor Cyan

    $status = & $git status --porcelain 2>&1
    if ($status) {
        Write-Host '[AVISO] Existem mudancas nao commitadas:' -ForegroundColor Red
        Write-Host $status
        Write-Host 'Commite antes de fazer deploy.' -ForegroundColor Red
        exit 1
    }

    & $git push origin HEAD 2>&1 | ForEach-Object { Write-Host "  $_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[ERRO] Git push falhou' -ForegroundColor Red
        exit 1
    }
    Write-Host '[OK] Push concluido' -ForegroundColor Green
} else {
    Write-Host '--- STEP 1: Git Push (PULADO) ---' -ForegroundColor Gray
}
Write-Host ''

# ============================================================
# STEP 2: ECR Login
# ============================================================
Write-Host '--- STEP 2: ECR Login ---' -ForegroundColor Yellow
$loginCmd = aws ecr get-login-password --region $awsRegion 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERRO] Falha ao obter token ECR' -ForegroundColor Red
    Write-Host $loginCmd
    exit 1
}
$loginCmd | docker login --username AWS --password-stdin "$awsAccountId.dkr.ecr.$awsRegion.amazonaws.com" 2>&1 | ForEach-Object { Write-Host "  $_" }
Write-Host '[OK] ECR login OK' -ForegroundColor Green
Write-Host ''

# ============================================================
# STEP 3: Docker Build
# ============================================================
Write-Host '--- STEP 3: Docker Build ---' -ForegroundColor Yellow
Set-Location $root

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$shortHash = (& $git rev-parse --short HEAD 2>&1).Trim()
$imageTag = "$timestamp-$shortHash"

Write-Host "Image tag: $imageTag" -ForegroundColor Cyan
Write-Host "Building from: $root" -ForegroundColor Cyan
Write-Host ''

docker build -t "${ecrRepo}:latest" -t "${ecrRepo}:${imageTag}" -f backend-dotnet/Dockerfile . 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERRO] Docker build falhou' -ForegroundColor Red
    exit 1
}
Write-Host '[OK] Docker build concluido' -ForegroundColor Green
Write-Host ''

# ============================================================
# STEP 4: Docker Push to ECR
# ============================================================
Write-Host '--- STEP 4: Push to ECR ---' -ForegroundColor Yellow
docker push "${ecrRepo}:${imageTag}" 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERRO] Push da tag falhou' -ForegroundColor Red
    exit 1
}
docker push "${ecrRepo}:latest" 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERRO] Push da latest falhou' -ForegroundColor Red
    exit 1
}
Write-Host '[OK] Imagem pushed: latest + ' -NoNewline
Write-Host $imageTag -ForegroundColor Cyan
Write-Host ''

# ============================================================
# STEP 5: ECS Force New Deployment
# ============================================================
Write-Host '--- STEP 5: ECS Update Service ---' -ForegroundColor Yellow
aws ecs update-service --cluster $ecsCluster --service $ecsService --force-new-deployment --region $awsRegion --output text --query 'service.serviceName' 2>&1 | ForEach-Object { Write-Host "  $_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERRO] ECS update falhou' -ForegroundColor Red
    exit 1
}
Write-Host '[OK] ECS deployment iniciado' -ForegroundColor Green
Write-Host ''

# ============================================================
# STEP 6: AWS SSM/ECS Cleanup (opcional)
# ============================================================
if (!$SkipAwsCleanup) {
    $cleanupScript = Join-Path $root 'scripts\aws-cleanup.ps1'
    if (Test-Path $cleanupScript) {
        Write-Host '--- STEP 6: AWS SSM/ECS Parameter Cleanup ---' -ForegroundColor Yellow
        if ($Apply) {
            Write-Host 'Modo: APPLY (alteracoes reais)' -ForegroundColor Red
            & $cleanupScript -Apply
        } else {
            Write-Host 'Modo: DRY-RUN (sem alteracoes)' -ForegroundColor Yellow
            & $cleanupScript
        }
    } else {
        Write-Host '--- STEP 6: aws-cleanup.ps1 nao encontrado (PULADO) ---' -ForegroundColor Gray
    }
} else {
    Write-Host '--- STEP 6: AWS Cleanup (PULADO) ---' -ForegroundColor Gray
}
Write-Host ''

# ============================================================
# STEP 7: Aguardar deployment
# ============================================================
Write-Host '--- STEP 7: Aguardando ECS deployment ---' -ForegroundColor Yellow
Write-Host 'Verificando status a cada 15s (max 5 min)...' -ForegroundColor Gray

$maxWait = 20  # 20 x 15s = 5 min
for ($i = 1; $i -le $maxWait; $i++) {
    Start-Sleep -Seconds 15
    $deployments = aws ecs describe-services --cluster $ecsCluster --services $ecsService --region $awsRegion --query 'services[0].deployments' --output json 2>&1 | ConvertFrom-Json

    $primary = $deployments | Where-Object { $_.status -eq 'PRIMARY' }
    $active = $deployments | Where-Object { $_.status -eq 'ACTIVE' }

    $running = $primary.runningCount
    $desired = $primary.desiredCount
    $pending = $primary.pendingCount

    Write-Host "  [$i] Running: $running/$desired | Pending: $pending | Old deployments: $($active.Count)" -ForegroundColor Gray

    if ($running -eq $desired -and $active.Count -eq 0 -and $pending -eq 0) {
        Write-Host '[OK] Deployment concluido!' -ForegroundColor Green
        break
    }

    if ($i -eq $maxWait) {
        Write-Host '[AVISO] Timeout esperando deployment. Verifique no console AWS.' -ForegroundColor Yellow
    }
}
Write-Host ''

# ============================================================
# RESUMO
# ============================================================
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  DEPLOY COMPLETO!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host "  Image: ${ecrRepo}:${imageTag}" -ForegroundColor White
Write-Host "  Cluster: $ecsCluster" -ForegroundColor White
Write-Host "  Service: $ecsService" -ForegroundColor White
Write-Host ''
Write-Host '  Verifique:' -ForegroundColor Yellow
Write-Host '    curl https://api.renovejasaude.com.br/api/health' -ForegroundColor Gray
Write-Host '    curl https://api.renovejasaude.com.br/api/health/readiness' -ForegroundColor Gray
