<#
.SYNOPSIS
    Testa TODOS os fluxos que usam Gemini no backend.

.DESCRIPTION
    Executa em sequência:
    1. Health/readiness (verifica se AI está configurada)
    2. Gemini API direta (test-gemini-flash.ps1 - 1 chamada)
    3. Anamnese (POST /api/consultation/anamnesis-test)
    4. Triage enrich (POST /api/gemini-test/triage)
    5. Clinical summary (POST /api/gemini-test/clinical-summary)
    6. Conduct suggestion (POST /api/gemini-test/conduct)
    7. Prescription generator (POST /api/gemini-test/prescription)

    Requer backend rodando em Development (porta 5000).

.PARAMETER BaseUrl
    URL base da API (padrão: http://localhost:5000).

.PARAMETER SkipAnamnesis
    Pula o teste de anamnese (mais lento, ~30s).

.EXAMPLE
    .\test-gemini-all-flows.ps1
    .\test-gemini-all-flows.ps1 -BaseUrl "http://localhost:5000"
#>

[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:5000",
    [switch]$SkipAnamnesis = $false
)

$ErrorActionPreference = "Stop"

function Write-Log { param([string]$Msg, [string]$Color = "White")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Msg" -ForegroundColor $Color
}

$script:Failed = 0
$script:Passed = 0

function Test-Flow {
    param([string]$Name, [scriptblock]$Test)
    Write-Log "--- $Name ---" "Cyan"
    try {
        & $Test
        $script:Passed++
        Write-Log "OK: $Name" "Green"
        return $true
    } catch {
        $script:Failed++
        Write-Log "FALHA: $Name - $_" "Red"
        return $false
    }
}

Write-Log "=== TESTE DE TODOS OS FLUXOS GEMINI ===" "Cyan"
Write-Log "BaseUrl: $BaseUrl" "Gray"
Write-Log ""

# 1. Health readiness
Test-Flow "Health/Readiness (AI configurada)" {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/health/readiness" -Method Get -TimeoutSec 10
    if ($r.checks.ai.status -ne "ok") { throw "AI não configurada: $($r.checks.ai.message)" }
}

# 2. Gemini API direta
Test-Flow "Gemini API direta (1 chamada)" {
    $scriptDir = $PSScriptRoot
    & "$scriptDir\test-gemini-flash.ps1" -Count 1
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) { throw "test-gemini-flash falhou (exit $LASTEXITCODE)" }
}

# 3. Anamnese
if (-not $SkipAnamnesis) {
    Test-Flow "Anamnese (consultation/anamnesis-test)" {
        $body = @{ transcript = "[Paciente] Dor de cabeça há 3 dias, piora ao esforço. [Médico] Tomou algum remédio? [Paciente] Paracetamol, mas não melhorou. [Médico] Tem febre ou náusea? [Paciente] Febre leve ontem, sem náusea." } | ConvertTo-Json -Compress
        $r = Invoke-RestMethod -Uri "$BaseUrl/api/consultation/anamnesis-test" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 90
        if (-not $r.success) { throw $r.message }
    }
} else {
    Write-Log "--- Anamnese (PULADO) ---" "Yellow"
}

# 4. Triage
Test-Flow "Triage enrich" {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/gemini-test/triage" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 30
    if (-not $r.success) { throw $r.message }
    if ($r.text) { Write-Log "  text: $($r.text.Substring(0, [Math]::Min(80, $r.text.Length)))..." "Gray" }
}

# 5. Clinical summary
Test-Flow "Clinical summary" {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/gemini-test/clinical-summary" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 60
    if (-not $r.success) { throw $r.message }
}

# 6. Conduct suggestion
Test-Flow "Conduct suggestion" {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/gemini-test/conduct" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 60
    if (-not $r.success) { throw $r.message }
}

# 7. Prescription generator
Test-Flow "Prescription generator" {
    $r = Invoke-RestMethod -Uri "$BaseUrl/api/gemini-test/prescription" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 60
    if (-not $r.success) { throw $r.message }
}

# Resumo
Write-Log ""
Write-Log "=== RESUMO ===" "Cyan"
Write-Log "Passou: $script:Passed | Falhou: $script:Failed" $(if ($script:Failed -eq 0) { "Green" } else { "Yellow" })
if ($script:Failed -gt 0) { exit 1 }
exit 0
