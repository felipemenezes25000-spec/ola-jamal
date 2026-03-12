<#
.SYNOPSIS
    Testa todos os fluxos usando APENAS Gemini (sem fallback GPT).

.DESCRIPTION
    Inicia o backend com FORCE_GEMINI_ONLY=1 para desabilitar fallback OpenAI.
    Valida se o Gemini funciona sozinho em todos os cenarios.

.EXAMPLE
    .\test-gemini-only.ps1
#>

[CmdletBinding()]
param([string]$BaseUrl = "http://localhost:5000")

$ErrorActionPreference = "Stop"
$ApiDir = Join-Path (Split-Path -Parent $PSScriptRoot) "src\RenoveJa.Api"

function Write-Log { param([string]$Msg, [string]$Color = "White")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Msg" -ForegroundColor $Color
}

Get-Process -Name "dotnet" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Log "=== TESTE GEMINI PURO (sem fallback GPT) ===" "Cyan"
Write-Log "Iniciando backend com FORCE_GEMINI_ONLY=1..." "Gray"
Write-Log ""

$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:FORCE_GEMINI_ONLY = "1"
$proc = Start-Process -FilePath "dotnet" -ArgumentList "run","--no-build" -WorkingDirectory $ApiDir -PassThru -WindowStyle Hidden

try {
    Start-Sleep -Seconds 18

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

    Test-Flow "Health (Gemini configurada)" {
        $r = Invoke-RestMethod -Uri "$BaseUrl/api/health/readiness" -Method Get -TimeoutSec 10
        if ($r.checks.ai.status -ne "ok") { throw "AI nao configurada: $($r.checks.ai.message)" }
    }

    Test-Flow "Triage (Gemini)" {
        $r = Invoke-RestMethod -Uri "$BaseUrl/api/gemini-test/triage" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 30
        if (-not $r.success) { throw $r.message }
        if ($r.text) { Write-Log "  text: $($r.text.Substring(0, [Math]::Min(80, $r.text.Length)))..." "Gray" }
    }

    Test-Flow "Clinical summary (Gemini)" {
        $r = Invoke-RestMethod -Uri "$BaseUrl/api/gemini-test/clinical-summary" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 60
        if (-not $r.success) { throw $r.message }
    }

    Test-Flow "Conduct suggestion (Gemini)" {
        $r = Invoke-RestMethod -Uri "$BaseUrl/api/gemini-test/conduct" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 60
        if (-not $r.success) { throw $r.message }
    }

    Test-Flow "Prescription generator (Gemini)" {
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
