# Script de diagnóstico para verificação ITI (validar.iti.gov.br)
# Testa se o endpoint de verificação responde corretamente ao fluxo do QR Code.
#
# Uso:
#   .\test-iti-verify.ps1 -RequestId "b691c2f1-1e35-40a6-8553-e1809d9fc3b7" -Code "123456" -ApiBase "https://ola-jamal.onrender.com"

param(
    [Parameter(Mandatory = $true)]
    [string]$RequestId,

    [Parameter(Mandatory = $true)]
    [string]$Code,

    [Parameter(Mandatory = $true)]
    [string]$ApiBase
)

$ApiBase = $ApiBase.TrimEnd('/')
$verifyUrl = "$ApiBase/api/verify/$RequestId"
$itiUrl = "$verifyUrl`?type=prescricao&_format=application/validador-iti+json&_secretCode=$Code"

Write-Host ""
Write-Host "=== Diagnóstico ITI - Verificação de Receita ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Request ID: $RequestId"
Write-Host "Código (6 dígitos): $Code"
Write-Host "API Base: $ApiBase"
Write-Host ""
Write-Host "URL que o ITI chama:" -ForegroundColor Yellow
Write-Host $itiUrl
Write-Host ""

# 1. Teste do endpoint ITI (JSON)
Write-Host "1. Testando endpoint ITI (GET com _format e _secretCode)..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri $itiUrl -Method Get -UseBasicParsing -TimeoutSec 30
    $status = $response.StatusCode
    $body = $response.Content

    if ($status -eq 200) {
        Write-Host "   Status: $status OK" -ForegroundColor Green
        try {
            $json = $body | ConvertFrom-Json
            $pdfUrl = $json.prescription.signatureFiles[0].url
            Write-Host "   PDF URL retornada: $pdfUrl" -ForegroundColor Green

            # 2. Teste de download do PDF
            Write-Host ""
            Write-Host "2. Testando download do PDF..." -ForegroundColor Cyan
            try {
                $pdfResponse = Invoke-WebRequest -Uri $pdfUrl -Method Get -UseBasicParsing -TimeoutSec 15
                if ($pdfResponse.StatusCode -eq 200 -and $pdfResponse.Headers.'Content-Type' -like '*pdf*') {
                    Write-Host "   Download OK - PDF recebido ($($pdfResponse.RawContentLength) bytes)" -ForegroundColor Green
                } else {
                    Write-Host "   AVISO: Resposta inesperada - Status $($pdfResponse.StatusCode), Content-Type: $($pdfResponse.Headers.'Content-Type')" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "   ERRO ao baixar PDF: $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "   Verifique Api__BaseUrl no Render." -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   Resposta JSON: $body" -ForegroundColor Gray
            Write-Host "   ERRO ao parsear JSON: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   Status: $status (esperado: 200)" -ForegroundColor Red
        Write-Host "   Corpo: $body" -ForegroundColor Gray
    }
} catch {
    $statusCode = $null
    if ($_.Exception.Response) { $statusCode = $_.Exception.Response.StatusCode.value__ }
    $errorBody = ""
    if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        $reader.Close()
    }

    Write-Host "   ERRO: $($_.Exception.Message)" -ForegroundColor Red
    if ($statusCode) { Write-Host "   Status HTTP: $statusCode" -ForegroundColor Red }
    if ($errorBody) { Write-Host "   Corpo: $errorBody" -ForegroundColor Gray }

    switch ($statusCode) {
        401 { Write-Host "   -> Código inválido ou não corresponde ao cadastrado. Verifique o código de 6 dígitos no PDF." -ForegroundColor Yellow }
        404 { Write-Host "   -> Receita não encontrada. Verifique o RequestId ou se a receita foi assinada." -ForegroundColor Yellow }
        429 { Write-Host "   -> Rate limit. Aguarde 1 minuto e tente novamente." -ForegroundColor Yellow }
        default {
            if ($_.Exception.Message -like "*Could not resolve*" -or $_.Exception.Message -like "*Connection refused*") {
                Write-Host "   -> API inacessível. Verifique Verification__BaseUrl e se o serviço está online (Render pode estar em cold start)." -ForegroundColor Yellow
            }
        }
    }
}

Write-Host ""
Write-Host "=== Checklist de variáveis no Render ===" -ForegroundColor Cyan
Write-Host "  Verification__BaseUrl = $ApiBase/api/verify"
Write-Host "  Api__BaseUrl = $ApiBase"
Write-Host ""
Write-Host "Se o teste falhou, confira: docs/RENDER_CONFIG_ITI.md" -ForegroundColor Gray
Write-Host ""
