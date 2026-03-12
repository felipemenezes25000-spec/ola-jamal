<#
.SYNOPSIS
    Testa todos os fluxos de IA usando APENAS OpenAI (GPT-4o) — sem Gemini.

.DESCRIPTION
    Inicia o backend com Gemini__ApiKey vazia para forçar uso de OpenAI em todos os fluxos.
    Valida que o fallback GPT está funcionando quando Gemini não está configurado.

    Fluxos testados: Triage, Clinical summary, Conduct, Prescription.

.PARAMETER BaseUrl
    URL base (padrão: http://localhost:5000).

.EXAMPLE
    .\test-openai-only.ps1
#>

[CmdletBinding()]
param([string]$BaseUrl = "http://localhost:5000")

$ErrorActionPreference = "Stop"
$ApiDir = Join-Path (Split-Path -Parent $PSScriptRoot) "src\RenoveJa.Api"

function Write-Log { param([string]$Msg, [string]$Color = "White")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Msg" -ForegroundColor $Color
}

# Para backend existente
Get-Process -Name "dotnet" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Log "=== TESTE OPENAI (GPT-4o) - SEM GEMINI ===" "Cyan"
Write-Log "Iniciando backend com FORCE_OPENAI_PROVIDER=1 (força OpenAI)..." "Gray"
Write-Log ""

# Inicia backend com Gemini desabilitado (usa OpenAI em todos os fluxos)
$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:FORCE_OPENAI_PROVIDER = "1"
$proc = Start-Process -FilePath "dotnet" -ArgumentList "run","--no-build" -WorkingDirectory $ApiDir -PassThru -WindowStyle Hidden

try {
    Start-Sleep -Seconds 12

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

    Test-Flow "Health (OpenAI configurada)" {
        $r = Invoke-RestMethod -Uri "$BaseUrl/api/health/readiness" -Method Get -TimeoutSec 10
        if ($r.checks.ai.status -ne "ok") { throw "AI não configurada: $($r.checks.ai.message)" }
    }

    Test-Flow "Triage (GPT-4o)" {
        $r = Invoke-RestMethod -Uri "$BaseUrl/api/gemini-test/triage" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 30
        if (-not $r.success) { throw $r.message }
        if ($r.text) { Write-Log "  text: $($r.text.Substring(0, [Math]::Min(80, $r.text.Length)))..." "Gray" }
    }

    Test-Flow "Clinical summary (GPT-4o)" {
        $r = Invoke-RestMethod -Uri "$BaseUrl/api/gemini-test/clinical-summary" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 60
        if (-not $r.success) { throw $r.message }
    }

    Test-Flow "Conduct suggestion (GPT-4o)" {
        $r = Invoke-RestMethod -Uri "$BaseUrl/api/gemini-test/conduct" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 60
        if (-not $r.success) { throw $r.message }
    }

    Test-Flow "Prescription generator (GPT-4o)" {
        $r = Invoke-RestMethod -Uri "$BaseUrl/api/gemini-test/prescription" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 60
        if (-not $r.success) { throw $r.message }
    }

    Write-Log ""
    Write-Log "=== RESUMO ===" "Cyan"
    Write-Log "Passou: $script:Passed | Falhou: $script:Failed" $(if ($script:Failed -eq 0) { "Green" } else { "Yellow" })
    if ($script:Failed -gt 0) { exit 1 }
} finally {
    if ($proc -and !$proc.HasExited) {
        $proc.Kill()
        Write-Log "Backend parado." "Gray"
    }
}
exit 0
