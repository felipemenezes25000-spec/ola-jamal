<#
.SYNOPSIS
    Testa Deepgram diretamente (sem backend) - RenoveJa

.DESCRIPTION
    Chama a API do Deepgram com um arquivo de áudio.
    Útil para validar a chave e o modelo antes de rodar o backend.

.PARAMETER ApiKey
    Chave da API Deepgram. Se não informada, lê de DEEPGRAM_API_KEY no .env ou ambiente.

.PARAMETER AudioFile
    Caminho para arquivo de áudio (.wav, .mp3, .m4a, .webm).
    Se não informado, gera áudio em português com SpeechSynthesizer.

.PARAMETER Model
    Modelo Deepgram: nova-2 (padrão), nova-3, base.

.EXAMPLE
    .\test-deepgram-direct.ps1
    .\test-deepgram-direct.ps1 -ApiKey "sua-chave"
    .\test-deepgram-direct.ps1 -AudioFile "C:\meu-audio.wav"
#>

[CmdletBinding()]
param(
    [string]$ApiKey = "",
    [string]$AudioFile = "",
    [string]$Model = "nova-2"
)

$ErrorActionPreference = "Stop"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$ApiDir = Join-Path (Split-Path -Parent $ScriptDir) "src\RenoveJa.Api"

function Write-Log { param([string]$Msg, [string]$Color = "White")
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "[$ts] $Msg" -ForegroundColor $Color
}
function Write-Ok { param([string]$Msg) Write-Log $Msg "Green" }
function Write-Err { param([string]$Msg) Write-Log $Msg "Red" }
function Write-Warn { param([string]$Msg) Write-Log $Msg "Yellow" }
function Write-Info { param([string]$Msg) Write-Log $Msg "Cyan" }

Write-Log "========================================" "Magenta"
Write-Log "  TESTE DIRETO DEEPGRAM" "Magenta"
Write-Log "========================================" "Magenta"
Write-Log ""

# 1. Obter API Key
if (-not $ApiKey) {
    # Tenta .env na pasta da API
    $envPath = Join-Path $ApiDir ".env"
    if (Test-Path $envPath) {
        Get-Content $envPath | ForEach-Object {
            if ($_ -match '^\s*DEEPGRAM_API_KEY\s*=\s*(.+)$') {
                $ApiKey = $matches[1].Trim().Trim('"').Trim("'")
            }
        }
    }
    if (-not $ApiKey) {
        $ApiKey = $env:DEEPGRAM_API_KEY
    }
}

if (-not $ApiKey) {
    Write-Err "DEEPGRAM_API_KEY não encontrada."
    Write-Log ""
    Write-Log "Opções:" "Yellow"
    Write-Log "  1. Defina no .env da pasta RenoveJa.Api: DEEPGRAM_API_KEY=sua-chave"
    Write-Log "  2. Passe no script: .\test-deepgram-direct.ps1 -ApiKey 'sua-chave'"
    Write-Log "  3. Variável de ambiente: `$env:DEEPGRAM_API_KEY='sua-chave'"
    Write-Log ""
    Write-Log "Obtenha a chave em: https://deepgram.com → Dashboard → API Keys" "Cyan"
    exit 1
}

Write-Ok "API Key configurada (${ApiKey.Length} caracteres)"

# 2. Obter ou gerar áudio
$DefaultAudio = Join-Path $ScriptDir "test-deepgram-audio.wav"
if ($AudioFile -and (Test-Path $AudioFile)) {
    $AudioPath = $AudioFile
    Write-Ok "Usando áudio: $AudioPath"
} elseif (Test-Path $DefaultAudio) {
    $AudioPath = $DefaultAudio
    Write-Ok "Usando áudio existente: $AudioPath"
} else {
    Write-Info "Gerando áudio de teste em português..."
    try {
        Add-Type -AssemblyName System.Speech -ErrorAction Stop
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $voices = $synth.GetInstalledVoices()
        $pt = $voices | Where-Object { $_.VoiceInfo.Culture.Name -like "pt*" } | Select-Object -First 1
        if ($pt) { $synth.SelectVoice($pt.VoiceInfo.Name) }
        $synth.SetOutputToWaveFile($DefaultAudio)
        $synth.Speak("Olá, este é um teste de transcrição em português. O paciente está com dor de cabeça há três dias e febre.")
        $synth.Dispose()
        $AudioPath = $DefaultAudio
        Write-Ok "Áudio gerado: $AudioPath"
    } catch {
        Write-Err "Não foi possível gerar áudio. SpeechSynthesizer: $($_.Exception.Message)"
        Write-Log ""
        Write-Log "Forneça um arquivo: .\test-deepgram-direct.ps1 -AudioFile 'caminho\para\audio.wav'" "Yellow"
        exit 1
    }
}

$ext = [System.IO.Path]::GetExtension($AudioPath).ToLower()
$mime = switch ($ext) {
    ".mp3" { "audio/mpeg" }
    ".m4a" { "audio/mp4" }
    ".webm" { "audio/webm" }
    ".wav" { "audio/wav" }
    default { "audio/wav" }
}

$size = (Get-Item $AudioPath).Length
Write-Info "Arquivo: $AudioPath ($([math]::Round($size/1024, 2)) KB, $mime)"
Write-Info "Modelo: $Model"
Write-Log ""

# 3. Chamar Deepgram API
$url = "https://api.deepgram.com/v1/listen?model=$Model&language=pt-BR&smart_format=true&punctuate=true"
Write-Info "Enviando para Deepgram..."

$headers = @{
    "Authorization" = "Token $ApiKey"
    "Content-Type" = $mime
}

$audioBytes = [System.IO.File]::ReadAllBytes($AudioPath)
try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $audioBytes -TimeoutSec 30
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $body = ""
    if ($_.ErrorDetails.Message) { $body = $_.ErrorDetails.Message }
    Write-Err "Erro HTTP $statusCode"
    Write-Err $body
    if ($statusCode -eq 401) {
        Write-Log ""
        Write-Warn "401 = Chave inválida ou expirada. Gere nova em deepgram.com"
    }
    exit 1
}

# 4. Extrair transcrição
$transcript = ""
try {
    $channels = $response.results.channels
    if ($channels -and $channels.Count -gt 0) {
        $alts = $channels[0].alternatives
        if ($alts -and $alts.Count -gt 0) {
            $transcript = $alts[0].transcript
        }
    }
} catch {
    Write-Err "Resposta inesperada: $($response | ConvertTo-Json -Depth 3)"
    exit 1
}

# 5. Resultado
Write-Log "=== RESULTADO ===" "Magenta"
Write-Log ""

if ($transcript -and $transcript.Trim().Length -gt 0) {
    Write-Ok "Transcrição OK!"
    Write-Log ""
    Write-Log "TEXTO:" "Cyan"
    Write-Host "  $transcript" -ForegroundColor White
    Write-Log ""
    Write-Ok "Deepgram está funcionando corretamente."
} else {
    Write-Warn "Nenhuma fala detectada no áudio."
    Write-Log ""
    Write-Log "Dicas:" "Yellow"
    Write-Log "  - Use um áudio com voz clara em português"
    Write-Log "  - Tente outro modelo: -Model nova-3 ou -Model base"
    Write-Log "  - Verifique se o arquivo não está corrompido"
}

Write-Log ""
Write-Log "========================================" "Magenta"
