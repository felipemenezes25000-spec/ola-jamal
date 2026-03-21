Você é um engenheiro sênior full-stack corrigindo bugs no projeto RenoveJá+ (telemedicina brasileira). O projeto está no diretório atual.

Stack: Expo/React Native (frontend-mobile), Vite/React (frontend-web), .NET 8 (backend-dotnet), PostgreSQL (infra/schema.sql).

Corrija TODOS os bugs abaixo. Para cada um, leia o arquivo com cat ANTES de editar. Crie um commit ao final.

═══════════════════════════════════════════════
🔴 CRÍTICOS — Segurança e crash
═══════════════════════════════════════════════

BUG #47 — DocumentTokenService retorna null quando secret não configurado
Arquivo: backend-dotnet/src/RenoveJa.Application/Services/DocumentTokenService.cs
Na função GenerateDocumentToken, se _secret está vazio, retorna null silenciosamente. O caller não trata isso.
FIX: Substituir o check no início por um throw:
```csharp
    public string? GenerateDocumentToken(Guid requestId, int validMinutes = 15)
    {
        if (string.IsNullOrEmpty(_secret))
            return null;
```
Por:
```csharp
    public string GenerateDocumentToken(Guid requestId, int validMinutes = 15)
    {
        if (string.IsNullOrEmpty(_secret))
            throw new InvalidOperationException("DocumentTokenSecret não configurado. Defina Api:DocumentTokenSecret no .env ou appsettings.");
```
E alterar a interface IDocumentTokenService.cs para retornar string (não string?):
```csharp
    string GenerateDocumentToken(Guid requestId, int validMinutes = 15);
```

BUG #48 — BearerAuthenticationHandler vaza mensagem de exceção
Arquivo: backend-dotnet/src/RenoveJa.Api/Authentication/BearerAuthenticationHandler.cs
Substituir a linha:
```csharp
            return AuthenticateResult.Fail($"Authentication error: {ex.Message}");
```
Por:
```csharp
            return AuthenticateResult.Fail("Authentication error");
```

BUG #49 — SignPdfFromUrlAsync permite SSRF (download de URL arbitrária)
Arquivo: backend-dotnet/src/RenoveJa.Infrastructure/Certificates/DigitalCertificateService.cs
Na função SignPdfFromUrlAsync, antes da linha `var pdfBytes = await httpClient.GetByteArrayAsync(pdfUrl, cancellationToken);`, adicionar validação de domínio:
```csharp
    public async Task<DigitalSignatureResult> SignPdfFromUrlAsync(
        Guid certificateId,
        string pdfUrl,
        string outputFileName,
        CancellationToken cancellationToken = default)
    {
        // SECURITY: Validar domínio para prevenir SSRF
        try
        {
            var uri = new Uri(pdfUrl);
            var host = uri.Host.ToLowerInvariant();
            var isAllowed = host.EndsWith(".amazonaws.com") || host.EndsWith(".renovejasaude.com.br") || host == "localhost";
            if (!isAllowed)
            {
                _logger.LogWarning("SignPdfFromUrlAsync blocked SSRF attempt: {Url}", pdfUrl);
                return new DigitalSignatureResult(false, "URL de PDF não permitida. Apenas URLs internas são aceitas.", null, null, null, null);
            }
        }
        catch
        {
            return new DigitalSignatureResult(false, "URL de PDF inválida.", null, null, null, null);
        }

        // Baixa o PDF da URL
        using var httpClient = new HttpClient();
```

BUG #50 — EncryptPfx armazena senha junto com PFX (risco amplificado)
Arquivo: backend-dotnet/src/RenoveJa.Infrastructure/Certificates/DigitalCertificateService.cs
Não podemos mudar o formato sem migrar dados existentes, mas devemos adicionar um TODO e log de warning.
Após o método EncryptPfx, adicione o comentário:
```csharp
    // TODO(security): Separar armazenamento de senha do PFX — atualmente a senha é embarcada
    // no payload criptografado junto com os bytes do certificado. Se a chave AES vazar,
    // o atacante tem acesso tanto ao PFX quanto à senha. Migrar para:
    // 1. Armazenar senha em AWS Secrets Manager (separado do PFX)
    // 2. Usar KMS envelope encryption em vez de AES direto
    // 3. Considerar VIDaaS VALID (A3 nuvem) para eliminar PFX local
```

═══════════════════════════════════════════════
🟠 ALTOS — Funcionalidade quebrada
═══════════════════════════════════════════════

BUG #51 — UpdatePrescriptionContentAsync e UpdateExamContentAsync exigem Status == Paid mas fluxo é gratuito
Arquivo: backend-dotnet/src/RenoveJa.Application/Services/Requests/RequestService.cs
A validação `if (request.Status != RequestStatus.Paid)` bloqueia edição porque o fluxo gratuito vai de Submitted → InReview → Paid via Approve(price=0). O médico SÓ pode editar APÓS aprovar.
O comentário de erro diz "após o pagamento" mas deveria dizer "após aprovar".
Substituir as DUAS ocorrências (UpdatePrescriptionContentAsync e UpdateExamContentAsync):
```csharp
        if (request.Status != RequestStatus.Paid)
            throw new InvalidOperationException("Só é possível editar medicamentos/notas após o pagamento. O paciente deve pagar antes de editar e assinar.");
```
Por:
```csharp
        if (request.Status != RequestStatus.Paid)
            throw new InvalidOperationException("Só é possível editar após a aprovação. Aprove a solicitação primeiro.");
```
E a segunda ocorrência (exame):
```csharp
        if (request.Status != RequestStatus.Paid)
            throw new InvalidOperationException("Só é possível editar exames/notas após o pagamento. O paciente deve pagar antes de editar e assinar.");
```
Por:
```csharp
        if (request.Status != RequestStatus.Paid)
            throw new InvalidOperationException("Só é possível editar após a aprovação. Aprove a solicitação primeiro.");
```

BUG #52 — CI/CD faz deploy de branch de feature em produção
Arquivo: .github/workflows/deploy-aws.yml
Substituir:
```yaml
on:
  push:
    branches: [main, fix/frontend-performance-responsive]
```
Por:
```yaml
on:
  push:
    branches: [main]
```

BUG #54 — S3StorageService.UploadStreamAsync bufferiza tudo em memória
Arquivo: backend-dotnet/src/RenoveJa.Infrastructure/Storage/S3StorageService.cs
Adicionar comentário TODO antes do método:
```csharp
    /// <summary>
    /// Upload via Stream — bufferiza para permitir retry (4 tentativas com backoff).
    /// TODO(perf): Para arquivos grandes (>10MB), usar TransferUtility com multipart upload
    /// para evitar OutOfMemoryException em PDFs pesados ou gravações de consulta.
    /// </summary>
```

═══════════════════════════════════════════════
🟡 MÉDIOS — UX e code quality
═══════════════════════════════════════════════

BUG #55 — S3StorageService.DeleteAsync engole exceções silenciosamente
Arquivo: backend-dotnet/src/RenoveJa.Infrastructure/Storage/S3StorageService.cs
Substituir o método DeleteAsync:
```csharp
    public async Task<bool> DeleteAsync(string path, CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucket(path);
            var key = CleanPath(path);
            await _s3.DeleteObjectAsync(bucket, key, cancellationToken);
            return true;
        }
        catch
        {
            return false;
        }
    }
```
Por:
```csharp
    public async Task<bool> DeleteAsync(string path, CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucket(path);
            var key = CleanPath(path);
            await _s3.DeleteObjectAsync(bucket, key, cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            // Log para diagnóstico — falha silenciosa impede debug de problemas de permissão/config S3
            System.Diagnostics.Debug.WriteLine($"[S3] DeleteAsync failed for {path}: {ex.Message}");
            return false;
        }
    }
```

BUG #56 — CreateSignedUrlAsync é fake async
Arquivo: backend-dotnet/src/RenoveJa.Infrastructure/Storage/S3StorageService.cs
Substituir:
```csharp
            return await Task.FromResult(_s3.GetPreSignedURL(request));
```
Por:
```csharp
            // GetPreSignedURL é síncrono no AWS SDK — não precisamos de Task.FromResult
            return _s3.GetPreSignedURL(request);
```
E mudar a assinatura do método de `async Task<string?>` para `Task<string?>` (remover async):
```csharp
    public Task<string?> CreateSignedUrlAsync(string path, int expiresInSeconds, CancellationToken cancellationToken = default)
    {
        try
        {
            var bucket = GetBucket(path);
            var key = CleanPath(path);

            var request = new GetPreSignedUrlRequest
            {
                BucketName = bucket,
                Key = key,
                Expires = DateTime.UtcNow.AddSeconds(expiresInSeconds)
            };

            return Task.FromResult<string?>(_s3.GetPreSignedURL(request));
        }
        catch
        {
            return Task.FromResult<string?>(null);
        }
    }
```

BUG #57 — CI também deploya em branch de feature
Arquivo: .github/workflows/ci.yml
Substituir:
```yaml
on:
  push:
    branches: [main, fix/frontend-performance-responsive]
  pull_request:
    branches: [main, fix/frontend-performance-responsive]
```
Por:
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

BUG #58 — ConsultationLifecycleService.StartConsultationAsync exige Status == Paid (inconsistente com AcceptConsultationAsync)
Arquivo: backend-dotnet/src/RenoveJa.Application/Services/Requests/ConsultationLifecycleService.cs
O AcceptConsultationAsync faz `request.Approve(0)` que seta status para Paid. Mas se o médico aceitar E iniciar a consulta quase simultaneamente, pode haver race condition onde o status ainda não foi persistido como Paid.
Substituir:
```csharp
        if (request.Status != RequestStatus.Paid)
            throw new InvalidOperationException($"Consultation can only be started when status is Paid. Current status: {request.Status}.");
```
Por:
```csharp
        // Aceitar Paid (fluxo normal) ou ConsultationReady (legado/race condition com accept)
        if (request.Status != RequestStatus.Paid && request.Status != RequestStatus.ConsultationReady)
            throw new InvalidOperationException($"Consultation can only be started when status is Paid or ConsultationReady. Current status: {request.Status}.");
```

BUG #59 — PostConsultationController.DownloadDocumentById redireciona para URL S3 em vez de fazer streaming
Arquivo: backend-dotnet/src/RenoveJa.Api/Controllers/PostConsultationController.cs
O `return Redirect(pdfUrl)` redireciona o browser para a URL do S3 que pode ser privada. Deveria fazer streaming via backend.
Substituir:
```csharp
            var pdfUrl = await medicalDocumentRepository.GetSignedDocumentUrlAsync(documentId, cancellationToken);
            if (!string.IsNullOrEmpty(pdfUrl))
                return Redirect(pdfUrl);
```
Por:
```csharp
            // Streaming via backend — não redirecionar para S3 (pode ser privado)
            var pdfUrl = await medicalDocumentRepository.GetSignedDocumentUrlAsync(documentId, cancellationToken);
            if (string.IsNullOrEmpty(pdfUrl))
                return NotFound(new { error = "PDF not yet available. Document may not be signed." });

            // TODO: Fazer download e streaming em vez de redirect
            // Por ora, gerar signed URL temporária para o browser
            return Redirect(pdfUrl);
```

BUG #60 — RequestApprovalService.ApproveAsync usa Task.Run para gerar conduta IA (thread pool starvation)
Arquivo: backend-dotnet/src/RenoveJa.Application/Services/Requests/RequestApprovalService.cs
Task.Run em ASP.NET Core pode causar thread pool starvation em carga alta. Substituir por fire-and-forget com logging:
```csharp
        _ = Task.Run(async () =>
        {
            try { await GenerateAndSetConductSuggestionAsync(requestIdForBackground, CancellationToken.None); }
            catch (Exception ex) { logger.LogWarning(ex, "AI conduct suggestion failed for {RequestId}", requestIdForBackground); }
        });
```
Por:
```csharp
        // Fire-and-forget sem Task.Run — evita thread pool starvation em ASP.NET Core
        _ = GenerateAndSetConductSuggestionAsync(requestIdForBackground, CancellationToken.None)
            .ContinueWith(t =>
            {
                if (t.IsFaulted)
                    logger.LogWarning(t.Exception?.InnerException, "AI conduct suggestion failed for {RequestId}", requestIdForBackground);
            }, TaskScheduler.Default);
```

═══════════════════════════════════════════════
INSTRUÇÕES
═══════════════════════════════════════════════

1. Leia cada arquivo com cat ANTES de editar
2. Aplique as correções uma por uma
3. Ao final, faça:
   git add -A && git commit -m "fix(backend+infra): SSRF, token leak, auth handler, status Paid, CI branch, S3 cleanup, SOAP Task.Run"
