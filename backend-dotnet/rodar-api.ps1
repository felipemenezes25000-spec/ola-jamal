# Script para rodar a API RenoveJa
# Execute: .\rodar-api.ps1
#
# Atualiza o PATH (necessário se o Cursor foi aberto antes da instalação do .NET)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

Set-Location $PSScriptRoot\src\RenoveJa.Api
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run
