# ============================================================
# Valida token do médico e conexão com o banco
# Uso: .\validate-token-and-db.ps1 -Token "SEU_TOKEN" [-ApiBase "https://api.renovejasaude.com.br"]
# ============================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$ApiBase = "https://api.renovejasaude.com.br"
)

$url = "$ApiBase/api/health/diagnose"
$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type"  = "application/json"
}

Write-Host ""
Write-Host "=== Validação Token + Banco ===" -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction Stop
    Write-Host "[OK] Resposta recebida" -ForegroundColor Green
    Write-Host ""
    Write-Host "Token:" -ForegroundColor Yellow
    $response.token | ConvertTo-Json | Write-Host
    Write-Host "Database:" -ForegroundColor Yellow
    $response.database | ConvertTo-Json | Write-Host
    Write-Host ""
    if ($response.token.valid -and $response.database.status -eq "ok") {
        Write-Host "[OK] Token válido e banco conectado. Pode testar /api/requests." -ForegroundColor Green
    } elseif (-not $response.token.valid) {
        Write-Host "[ERRO] Token inválido. Faça login novamente no app." -ForegroundColor Red
    } else {
        Write-Host "[ERRO] Banco com problema: $($response.database.message)" -ForegroundColor Red
    }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 401) {
        Write-Host "[ERRO] Token inválido ou expirado (401). Faça login novamente no app." -ForegroundColor Red
    } elseif ($statusCode -eq 404) {
        Write-Host "[ERRO] Endpoint não encontrado (404). Backend pode estar desatualizado." -ForegroundColor Red
    } else {
        Write-Host "[ERRO] Falha na requisição: $_" -ForegroundColor Red
    }
    exit 1
}
