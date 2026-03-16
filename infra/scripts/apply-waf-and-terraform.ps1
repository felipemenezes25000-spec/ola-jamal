# ============================================================
# Aplica Terraform (WAF + demais recursos).
# Uso: .\apply-waf-and-terraform.ps1
#
# Requer: AWS CLI configurado (aws configure)
# A senha do RDS NÃO é usada pelo Terraform — só pelas migrações.
# ============================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InfraDir = Split-Path -Parent $ScriptDir

# Atualiza PATH para incluir Terraform (se instalado via winget)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Host ""
Write-Host "=== RenoveJa+ — Terraform Apply ===" -ForegroundColor Cyan
Write-Host ""

# Verifica Terraform
$terraform = Get-Command terraform -ErrorAction SilentlyContinue
if (-not $terraform) {
    Write-Host "[ERRO] Terraform nao encontrado. Instale: winget install HashiCorp.Terraform" -ForegroundColor Red
    exit 1
}

# Verifica credenciais AWS
$identity = aws sts get-caller-identity --region sa-east-1 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Credenciais AWS nao configuradas. Rode: aws configure" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] AWS configurado" -ForegroundColor Green

# Terraform init (se necessario)
Push-Location $InfraDir
try {
    if (-not (Test-Path ".terraform")) {
        Write-Host "`nExecutando terraform init..." -ForegroundColor Cyan
        terraform init -input=false
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    Write-Host "`nExecutando terraform plan..." -ForegroundColor Cyan
    terraform plan -out=tfplan -input=false
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "`nExecutando terraform apply..." -ForegroundColor Cyan
    terraform apply -input=false -auto-approve tfplan
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "`n[OK] Terraform aplicado com sucesso." -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host ""
