# Script: Permitir todas as portas no Firewall do Windows
# ATENÇÃO: Isso reduz significativamente a segurança. Use apenas em ambiente de teste/desenvolvimento.
# Execute como Administrador: clique direito no PowerShell -> "Executar como administrador"

# Verifica se está rodando como administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRO: Execute este script como Administrador." -ForegroundColor Red
    Write-Host "Clique direito no PowerShell e escolha 'Executar como administrador'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Configurando regras do Firewall para permitir todo o tráfego..." -ForegroundColor Cyan

# Permite todo tráfego de entrada (inbound)
netsh advfirewall firewall add rule name="Allow All Inbound" dir=in action=allow protocol=any

# Permite todo tráfego de saída (outbound)
netsh advfirewall firewall add rule name="Allow All Outbound" dir=out action=allow protocol=any

Write-Host "Concluído. Todas as portas estão permitidas." -ForegroundColor Green
Write-Host ""
Write-Host "Para remover as regras depois:" -ForegroundColor Yellow
Write-Host '  netsh advfirewall firewall delete rule name="Allow All Inbound"' -ForegroundColor Gray
Write-Host '  netsh advfirewall firewall delete rule name="Allow All Outbound"' -ForegroundColor Gray
