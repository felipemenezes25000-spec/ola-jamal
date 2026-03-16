# ============================================================
# Verifica se imagens e videos estao sendo salvos corretamente no S3.
# Uso: .\verify-s3-storage.ps1
# Requer: AWS CLI configurado (aws configure)
# ============================================================

$ErrorActionPreference = "Stop"
$Region = "sa-east-1"

$Buckets = @{
    "renoveja-prescriptions" = @("pedidos/", "usuarios/", "planos-de-cuidado/", "receitas/", "signed/", "prescription-images/")
    "renoveja-avatars"       = @("usuarios/", "avatars/")
    "renoveja-certificates" = @("usuarios/", "certificates/")
    "renoveja-transcripts"  = @("consultas/", "transcripts/", "recordings/")
}

Write-Host ""
Write-Host "=== RenoveJa+ - Verificacao S3 (imagens, videos, avatares) ===" -ForegroundColor Cyan
Write-Host ""

# Verifica AWS CLI
$aws = Get-Command aws -ErrorAction SilentlyContinue
if (-not $aws) {
    Write-Host "[ERRO] AWS CLI nao encontrado. Instale: winget install Amazon.AWSCLI" -ForegroundColor Red
    exit 1
}

# Verifica credenciais
$identity = aws sts get-caller-identity --region $Region 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Credenciais AWS. Rode: aws configure" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] AWS configurado" -ForegroundColor Green
Write-Host ""

foreach ($bucket in $Buckets.Keys) {
    Write-Host "--- Bucket: $bucket ---" -ForegroundColor Cyan
    
    # Verifica se bucket existe
    $head = aws s3api head-bucket --bucket $bucket --region $Region 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FALTA] Bucket nao existe ou sem permissao" -ForegroundColor Red
        continue
    }
    Write-Host "  [OK] Bucket acessivel" -ForegroundColor Green
    
    $totalObjects = 0
    $totalSize = 0
    
    foreach ($prefix in $Buckets[$bucket]) {
        $list = aws s3api list-objects-v2 --bucket $bucket --prefix $prefix --region $Region --output json 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  $prefix : erro ao listar" -ForegroundColor Yellow
            continue
        }
        
        $json = $list | ConvertFrom-Json
        $count = 0
        $size = 0
        $samples = @()
        
        if ($json.Contents) {
            $count = $json.Contents.Count
            foreach ($obj in $json.Contents) {
                $size += $obj.Size
                if ($samples.Count -lt 3) {
                    $ext = [System.IO.Path]::GetExtension($obj.Key)
                    $samples += "$($obj.Key.Split('/')[-1]) ($([math]::Round($obj.Size/1024, 1)) KB)"
                }
            }
        }
        
        $totalObjects += $count
        $totalSize += $size
        
        $status = if ($count -gt 0) { "[OK]" } else { "[vazio]" }
        $color = if ($count -gt 0) { "Green" } else { "Gray" }
        Write-Host "  $prefix : $count objetos, $([math]::Round($size/1MB, 2)) MB" -ForegroundColor $color
        if ($samples.Count -gt 0) {
            foreach ($s in $samples) { Write-Host "    - $s" -ForegroundColor Gray }
        }
    }
    
    Write-Host "  Total: $totalObjects objetos, $([math]::Round($totalSize/1MB, 2)) MB" -ForegroundColor White
    Write-Host ""
}

Write-Host "=== Resumo ===" -ForegroundColor Cyan
Write-Host "prescriptions = imagens de receita/exame, PDFs assinados" -ForegroundColor Gray
Write-Host "avatars       = fotos de perfil (usuarios)" -ForegroundColor Gray
Write-Host "certificates  = certificados digitais PFX" -ForegroundColor Gray
Write-Host "transcripts   = transcricoes e gravacoes de video (consultas)" -ForegroundColor Gray
Write-Host ""
