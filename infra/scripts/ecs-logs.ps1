# ============================================================
# Busca logs do ECS para debug de deploy/health check
#
# Uso: .\ecs-logs.ps1
#      .\ecs-logs.ps1 -Minutes 60
#      .\ecs-logs.ps1 -Stream "api/f59be271ed504de5b538a921f46a9e01"
# ============================================================

param(
    [int]$Minutes = 30,
    [string]$Stream
)

$Region = "sa-east-1"
$LogGroup = "/ecs/renoveja-api"

Write-Host ""
Write-Host "=== ECS Logs - renoveja-api (ultimos $Minutes min) ===" -ForegroundColor Cyan
Write-Host ""

$startMs = [long](Get-Date).AddMinutes(-$Minutes).ToUniversalTime().Subtract([datetime]'1970-01-01').TotalMilliseconds)
$cmd = "aws logs filter-log-events --log-group-name $LogGroup --start-time $startMs --region $Region --output json"
if ($Stream) { $cmd += " --log-stream-name-prefix $Stream" }
$result = Invoke-Expression $cmd 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erro ao buscar logs: $result" -ForegroundColor Red
    exit 1
}

$events = $result | ConvertFrom-Json
$events.events | ForEach-Object {
    $ts = [datetime]'1970-01-01'.AddMilliseconds($_.timestamp).ToLocalTime().ToString("HH:mm:ss")
    $msg = $_.message
    if ($msg -match "error|fail|exception|FATAL|ERR" -and $msg -notmatch "LogLevel") {
        Write-Host "[$ts] $msg" -ForegroundColor Red
    } elseif ($msg -match "warn|WRN") {
        Write-Host "[$ts] $msg" -ForegroundColor Yellow
    } else {
        Write-Host "[$ts] $msg"
    }
}

Write-Host ""
Write-Host "Para ver logs em tempo real: aws logs tail $LogGroup --follow --region $Region" -ForegroundColor Gray
Write-Host "Para listar tasks falhadas: aws ecs list-tasks --cluster renoveja-prod --service renoveja-api --desired-status STOPPED --region $Region" -ForegroundColor Gray
Write-Host ""
