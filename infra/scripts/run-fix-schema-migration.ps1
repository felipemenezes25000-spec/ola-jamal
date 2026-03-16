# ============================================================
# Executa a migração 20260316_fix_care_plans_outbox_schema.sql
# no RDS. Usa variáveis de ambiente para credenciais.
#
# Uso:
#   $env:PGPASSWORD = "sua_senha"
#   .\run-fix-schema-migration.ps1
#
# Ou com connection string completa (parseada):
#   $env:DATABASE_URL = "Host=...;Port=5432;Database=renoveja;Username=postgres;Password=..."
#   .\run-fix-schema-migration.ps1
#
# NUNCA commitar senhas. Rotacione credenciais se expostas.
# ============================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InfraDir = Split-Path -Parent $ScriptDir
$MigrationFile = Join-Path $InfraDir "migrations\20260316_fix_care_plans_outbox_schema.sql"

if (-not (Test-Path $MigrationFile)) {
    Write-Host "[ERRO] Arquivo nao encontrado: $MigrationFile" -ForegroundColor Red
    exit 1
}

# Preferir psql se instalado
$psql = Get-Command psql -ErrorAction SilentlyContinue
if ($psql) {
    # Extrair Host, Port, Database, Username de DATABASE_URL ou ConnectionStrings
    $connStr = if ($env:DATABASE_URL) { $env:DATABASE_URL } elseif ($env:ConnectionStrings__DefaultConnection) { $env:ConnectionStrings__DefaultConnection } else { "" }
    if (-not $connStr) {
        Write-Host "[ERRO] Defina DATABASE_URL ou ConnectionStrings__DefaultConnection (ou PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD)" -ForegroundColor Red
        exit 1
    }

    # Parse simples: Host=...;Port=...;Database=...;Username=...;Password=...
    $host = ""; $port = "5432"; $db = ""; $user = ""; $pass = ""
    foreach ($pair in $connStr -split ";") {
        $kv = $pair -split "=", 2
        if ($kv.Count -eq 2) {
            $k = $kv[0].Trim(); $v = $kv[1].Trim()
            switch ($k) {
                "Host"     { $host = $v }
                "Port"     { $port = $v }
                "Database" { $db = $v }
                "Username" { $user = $v }
                "Password" { $pass = $v }
            }
        }
    }

    if (-not $host -or -not $db -or -not $user) {
        Write-Host "[ERRO] Connection string incompleta. Necessario: Host, Database, Username" -ForegroundColor Red
        exit 1
    }

    if (-not $pass -and -not $env:PGPASSWORD) {
        Write-Host "[ERRO] Defina Password na connection string ou PGPASSWORD" -ForegroundColor Red
        exit 1
    }

    if ($pass) { $env:PGPASSWORD = $pass }

    Write-Host "Executando migracao em ${host}:${port}/${db}..." -ForegroundColor Cyan
    & psql -h $host -p $port -U $user -d $db -f $MigrationFile
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Write-Host "[OK] Migracao concluida." -ForegroundColor Green
    exit 0
}

# Fallback: instruções para rodar manualmente
Write-Host "[AVISO] psql nao encontrado. Instale PostgreSQL client ou use RDS Query Editor." -ForegroundColor Yellow
Write-Host ""
Write-Host "Opcao 1 - RDS Query Editor:" -ForegroundColor Cyan
Write-Host "  1. AWS Console -> RDS -> renoveja-postgres -> Query Editor"
Write-Host "  2. Cole o conteudo de: $MigrationFile"
Write-Host ""
Write-Host "Opcao 2 - psql (apos instalar PostgreSQL):" -ForegroundColor Cyan
Write-Host "  `$env:PGPASSWORD = 'SUA_SENHA'"
    Write-Host "  psql -h renoveja-postgres.xxx.sa-east-1.rds.amazonaws.com -p 5432 -U postgres -d renoveja -f `"$MigrationFile`""
    Write-Host ""
    Write-Host "Ou use DATABASE_URL:"
    Write-Host "  `$env:DATABASE_URL = 'Host=...;Port=5432;Database=renoveja;Username=postgres;Password=...'"
    Write-Host "  .\run-fix-schema-migration.ps1"
Write-Host ""
exit 1
