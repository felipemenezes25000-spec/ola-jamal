<#
.SYNOPSIS
    Testa chamadas ao Gemini 2.5 Flash para validar integração e custo (~$1).

.DESCRIPTION
    Faz N chamadas ao modelo gemini-2.5-flash via API OpenAI-compatible.
    Custo estimado: ~$0.0001 por chamada mínima; ~100 chamadas ≈ $0.01; ~10000 ≈ $1.

.PARAMETER Count
    Número de chamadas (padrão: 10 para teste rápido).

.PARAMETER Tokens
    Meta de tokens a consumir (ex: 100000). Faz chamadas com prompt/output maiores.

.PARAMETER SpendDollar
    Se especificado, faz ~10000 chamadas para custar ~$1 e validar.

.PARAMETER ApiKey
    Chave Gemini. Se omitida, lê de .env (Gemini__ApiKey).

.EXAMPLE
    .\test-gemini-flash.ps1 -Tokens 100000  # ~100k tokens
    .\test-gemini-flash.ps1 -Count 100
#>

[CmdletBinding()]
param(
    [int]$Count = 0,
    [int]$Tokens = 0,
    [switch]$SpendDollar = $false,
    [string]$ApiKey = ""
)

if ($SpendDollar) { $Count = 10000 }
if ($Tokens -gt 0) {
    # ~2000 tokens por chamada (prompt ~400 + output ~1600)
    $Count = [Math]::Max(1, [Math]::Ceiling($Tokens / 2000))
}
if ($Count -le 0) { $Count = 10 }

$ErrorActionPreference = "Stop"
$script:ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$ApiDir = Join-Path (Split-Path -Parent $script:ScriptDir) "src\RenoveJa.Api"
$EnvPath = Join-Path $ApiDir ".env"

function Write-Log { param([string]$Msg, [string]$Color = "White")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Msg" -ForegroundColor $Color
}

# Carrega .env
if ([string]::IsNullOrWhiteSpace($ApiKey) -and (Test-Path $EnvPath)) {
    Get-Content $EnvPath | ForEach-Object {
        if ($_ -match '^\s*Gemini__ApiKey\s*=\s*(.+)$') {
            $script:ApiKey = $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    Write-Log "Gemini__ApiKey não encontrada. Defina no .env ou use -ApiKey" "Red"
    exit 1
}

$BaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai"
$Model = "gemini-2.5-flash"

# Prompt e max_tokens conforme meta de tokens
$useLargePrompt = $Tokens -gt 0
$promptText = if ($useLargePrompt) {
    # ~400 tokens: peça lista longa
    "Liste em português, um por linha, 50 sintomas ou condições médicas comuns. Numere de 1 a 50. Seja conciso."
} else {
    "Responda em uma frase: qual a capital do Brasil?"
}
$maxTokens = if ($useLargePrompt) { 1600 } else { 50 }

$Body = @{
    model = $Model
    messages = @(
        @{ role = "user"; content = $promptText }
    )
    max_tokens = $maxTokens
    temperature = 0.2
} | ConvertTo-Json -Depth 5 -Compress

$estTokens = if ($useLargePrompt) { $Count * 2000 } else { $Count * 60 }
Write-Log "Iniciando $Count chamadas ao $Model (~$estTokens tokens)..." "Cyan"
Write-Log "BaseUrl: $BaseUrl" "Gray"

$ok = 0
$fail = 0
$sw = [System.Diagnostics.Stopwatch]::StartNew()

for ($i = 1; $i -le $Count; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/chat/completions" `
            -Method Post `
            -Headers @{
                "Authorization" = "Bearer $ApiKey"
                "Content-Type"  = "application/json"
            } `
            -Body $Body `
            -TimeoutSec 30

        $text = $response.choices[0].message.content
        if ($i -le 3) { Write-Log "  [$i] OK: $($text.Substring(0, [Math]::Min(40, $text.Length)))..." "Green" }
        $ok++
    }
    catch {
        $fail++
        if ($fail -le 3) { Write-Log "  [$i] ERRO: $($_.Exception.Message)" "Red" }
    }

    if ($i % 100 -eq 0) { Write-Log "  Progresso: $i/$Count (ok=$ok, fail=$fail)" "Yellow" }
}

$sw.Stop()
$elapsed = $sw.Elapsed.TotalSeconds

Write-Log "---" "Gray"
Write-Log "Concluído em $([math]::Round($elapsed, 1))s" "Cyan"
Write-Log "Sucesso: $ok | Falha: $fail" $(if ($fail -eq 0) { "Green" } else { "Yellow" })
$cost = if ($useLargePrompt) { $ok * 0.004 } else { $ok * 0.0001 }
Write-Log "Tokens estimados: ~$($ok * $(if ($useLargePrompt) { 2000 } else { 60 })) | Custo: ~`$$([math]::Round($cost, 4))" "Gray"
