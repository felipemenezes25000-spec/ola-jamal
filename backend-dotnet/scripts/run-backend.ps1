# Script para iniciar o backend RenoveJa.Api
# Encerra instâncias antigas antes de rodar (evita erro "arquivo bloqueado por RenoveJa.Api.exe")
#
# Se der "Acesso negado" ao encerrar: clique direito no PowerShell -> Executar como administrador
# Depois: cd backend-dotnet\scripts; .\run-backend.ps1

$ErrorActionPreference = "Stop"
$apiDir = Join-Path $PSScriptRoot "..\src\RenoveJa.Api"

# Encerra processos RenoveJa.Api existentes
$procs = Get-Process -Name "RenoveJa.Api" -ErrorAction SilentlyContinue
if ($procs) {
    Write-Host "Encerrando $($procs.Count) instancia(s) antiga(s) do RenoveJa.Api..." -ForegroundColor Yellow
    $killed = $false
    foreach ($p in $procs) {
        try {
            Stop-Process -Id $p.Id -Force -ErrorAction Stop
            Write-Host "  PID $($p.Id) encerrado." -ForegroundColor Gray
            $killed = $true
        } catch {
            Write-Host "  AVISO: Nao foi possivel encerrar PID $($p.Id)." -ForegroundColor Red
            Write-Host "  Solucao: PowerShell como Administrador, ou feche o terminal/IDE onde o backend esta rodando." -ForegroundColor Red
        }
    }
    if ($killed) { Start-Sleep -Seconds 2 }
}

Write-Host "Iniciando backend em $apiDir..." -ForegroundColor Cyan
Set-Location $apiDir
dotnet run
