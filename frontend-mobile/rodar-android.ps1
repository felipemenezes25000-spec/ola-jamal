# Script para rodar o app no Android
# Requisitos: Android Studio instalado e SDK baixado (abra o Android Studio uma vez)

$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (-not (Test-Path $sdkPath)) {
    Write-Host "ERRO: Android SDK nao encontrado em $sdkPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "Passos:" -ForegroundColor Yellow
    Write-Host "1. Abra o Android Studio"
    Write-Host "2. Siga o assistente de instalacao (Next > Next)"
    Write-Host "3. Ele vai baixar o Android SDK automaticamente"
    Write-Host "4. Execute este script novamente"
    exit 1
}

$env:ANDROID_HOME = $sdkPath
$env:Path = "$sdkPath\platform-tools;$sdkPath\emulator;$sdkPath\tools;$sdkPath\tools\bin;" + $env:Path

Write-Host "ANDROID_HOME configurado: $sdkPath" -ForegroundColor Green
Write-Host ""
Write-Host "Conecte um celular Android com USB debugging ativado ou inicie um emulador." -ForegroundColor Cyan
Write-Host ""

npx expo run:android
