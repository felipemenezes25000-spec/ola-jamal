# ============================================================
# Executa migracao SQL + Terraform apply.
# Uso: edite $DbPassword abaixo e rode: .\run-all.ps1
#
# IMPORTANTE: Nao commite este arquivo com a senha preenchida.
# Ou use variavel de ambiente: $env:RENOVEJA_DB_PASSWORD = "sua_senha"
# ============================================================

param(
    [string]$DbPassword = $env:RENOVEJA_DB_PASSWORD
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InfraDir = Split-Path -Parent $ScriptDir
$MigrationsDir = Join-Path $InfraDir "migrations"
$MigrationFile = Join-Path $MigrationsDir "20260316_fix_care_plans_outbox_schema.sql"

$DbHost = "renoveja-postgres.c54og6486w6w.sa-east-1.rds.amazonaws.com"
$DbPort = "5432"
$DbName = "renoveja"
$DbUser = "postgres"

Write-Host ""
Write-Host "=== RenoveJa+ - Migracao + Terraform ===" -ForegroundColor Cyan
Write-Host ""

# --- 1. Migracao SQL (via Docker) ---
if ($DbPassword) {
    Write-Host "[1/2] Executando migracao no RDS..." -ForegroundColor Cyan
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if ($docker) {
        docker run --rm `
            -v "${MigrationsDir}:/migrations" `
            -e "PGPASSWORD=$DbPassword" `
            postgres:16 `
            psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f /migrations/20260316_fix_care_plans_outbox_schema.sql
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Migracao aplicada." -ForegroundColor Green
        } else {
            Write-Host "[AVISO] Migracao falhou. Continuando com Terraform..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[AVISO] Docker nao encontrado. Pulando migracao. Use RDS Query Editor." -ForegroundColor Yellow
    }
} else {
    Write-Host "[1/2] Pulando migracao (defina env:RENOVEJA_DB_PASSWORD ou passe -DbPassword)" -ForegroundColor Yellow
}

# --- 2. Terraform ---
Write-Host ""
Write-Host "[2/2] Executando Terraform..." -ForegroundColor Cyan
$machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
$userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
if ($machinePath) { $env:Path = $machinePath }
if ($userPath) { $env:Path = $env:Path + ";" + $userPath }
$terraform = Get-Command terraform -ErrorAction SilentlyContinue
if (-not $terraform) {
    Write-Host "[ERRO] Terraform nao encontrado. Instale: winget install HashiCorp.Terraform" -ForegroundColor Red
    exit 1
}

# Terraform usa TF_VAR_db_password (evita problemas com # e ! na senha)
if ($DbPassword) { $env:TF_VAR_db_password = $DbPassword }

Push-Location $InfraDir
try {
    if (-not (Test-Path ".terraform")) {
        terraform init -input=false
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    terraform plan -out=tfplan -input=false
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    terraform apply -input=false -auto-approve tfplan
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host ""
    Write-Host "[OK] Terraform aplicado." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "=== Concluido ===" -ForegroundColor Green
Write-Host ""
