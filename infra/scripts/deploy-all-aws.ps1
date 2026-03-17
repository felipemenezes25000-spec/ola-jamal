# ============================================================
# Deploy completo RenoveJá+ na AWS
# Backend (ECS) + Frontend (S3/CloudFront) + Migrations (opcional)
#
# Uso:
#   .\deploy-all-aws.ps1                    # Backend + Frontend
#   .\deploy-all-aws.ps1 -BackendOnly       # Só backend
#   .\deploy-all-aws.ps1 -FrontendOnly      # Só frontend
#   .\deploy-all-aws.ps1 -WithMigrations   # Inclui migrations no RDS
#
# Requer: AWS CLI configurado (aws configure)
# ============================================================

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$WithMigrations
)

$ErrorActionPreference = "Stop"
$Region = "sa-east-1"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Variáveis do deploy
$ECR_REPOSITORY = "renoveja-api"
$ECS_CLUSTER = "renoveja-prod"
$ECS_SERVICE = "renoveja-api"
$S3_FRONTEND_BUCKET = "renoveja-frontend-web"
$CF_DISTRIBUTION_ID = "EXWM1ERYI9GZL"

Write-Host ""
Write-Host "=== RenoveJa+ - Deploy AWS (regiao $Region) ===" -ForegroundColor Cyan
Write-Host ""

# Verificar AWS CLI
$identity = aws sts get-caller-identity --region $Region 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] AWS CLI nao configurado. Rode: aws configure" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Credenciais AWS" -ForegroundColor Green

# --- 1. Migrations (opcional) ---
if ($WithMigrations) {
    Write-Host ""
    Write-Host "[1] Executando migrations no RDS..." -ForegroundColor Cyan
    $migrationScript = Join-Path $RepoRoot "backend-dotnet\scripts\RunMigration\RunMigration.csproj"
    $migrationDir = Join-Path $RepoRoot "backend-dotnet\scripts\RunMigration"
    $migrationsPath = Join-Path $RepoRoot "infra\migrations"
    if (Test-Path $migrationDir) {
        Get-ChildItem $migrationsPath -Filter "*.sql" | Sort-Object Name | ForEach-Object {
            Write-Host "  Aplicando: $($_.Name)"
            Push-Location $migrationDir
            dotnet run -- $_.FullName
            $migExit = $LASTEXITCODE
            Pop-Location
            if ($migExit -ne 0) { Write-Host "  [AVISO] Falha em $($_.Name)" -ForegroundColor Yellow }
        }
        Write-Host "[OK] Migrations concluidas" -ForegroundColor Green
    } else {
        Write-Host "[AVISO] RunMigration nao encontrado. Pulando." -ForegroundColor Yellow
    }
}

# --- 2. Backend (ECS) ---
if (-not $FrontendOnly) {
    Write-Host ""
    Write-Host "[2] Deploy Backend (ECS)..." -ForegroundColor Cyan

    $ecrLogin = aws ecr get-login-password --region $Region 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERRO] Falha ao obter ECR login" -ForegroundColor Red
        exit 1
    }

    $accountId = (aws sts get-caller-identity --query Account --output text)
    $ecrRegistry = "$accountId.dkr.ecr.$Region.amazonaws.com"
    $imageTag = "latest"

    Write-Host "  Build Docker..."
    Push-Location $RepoRoot
    docker build -t "$ecrRegistry/${ECR_REPOSITORY}:$imageTag" -f backend-dotnet/Dockerfile .
    if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

    Write-Host "  Push para ECR..."
    aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $ecrRegistry
    docker push "$ecrRegistry/${ECR_REPOSITORY}:$imageTag"
    if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
    Pop-Location

    Write-Host "  Registrando task definition..."
    aws ecs register-task-definition --cli-input-json file://$RepoRoot/infra/task-definition.json --region $Region
    if ($LASTEXITCODE -ne 0) { exit 1 }

    Write-Host "  Atualizando ECS service..."
    aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --task-definition renoveja-api --force-new-deployment --region $Region
    if ($LASTEXITCODE -ne 0) { exit 1 }

    Write-Host "[OK] Backend deploy iniciado. Aguarde estabilizar no console ECS." -ForegroundColor Green
}

# --- 3. Frontend (S3/CloudFront) ---
if (-not $BackendOnly) {
    Write-Host ""
    Write-Host "[3] Deploy Frontend (S3/CloudFront)..." -ForegroundColor Cyan

    $frontendDir = Join-Path $RepoRoot "frontend-web"
    if (-not (Test-Path $frontendDir)) {
        Write-Host "[AVISO] frontend-web nao encontrado" -ForegroundColor Yellow
    } else {
        Push-Location $frontendDir
        npm ci 2>$null; if ($LASTEXITCODE -ne 0) { npm install }
        $env:VITE_API_URL = "https://api.renovejasaude.com.br"
        npm run build
        if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

        Write-Host "  Sync para S3..."
        aws s3 sync dist/ "s3://$S3_FRONTEND_BUCKET" --delete --region $Region
        aws s3 sync dist/ "s3://$S3_FRONTEND_BUCKET" --exclude "*" --include "*.js" --content-type "application/javascript" --region $Region
        aws s3 sync dist/ "s3://$S3_FRONTEND_BUCKET" --exclude "*" --include "*.css" --content-type "text/css" --region $Region
        aws s3 cp "s3://$S3_FRONTEND_BUCKET/index.html" "s3://$S3_FRONTEND_BUCKET/index.html" --metadata-directive REPLACE --cache-control "no-cache" --content-type "text/html" --region $Region

        Write-Host "  Invalidando CloudFront..."
        aws cloudfront create-invalidation --distribution-id $CF_DISTRIBUTION_ID --paths "/*" --region $Region

        Pop-Location
        Write-Host "[OK] Frontend deploy concluido" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Deploy concluido ===" -ForegroundColor Green
Write-Host ""
