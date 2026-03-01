# Migração: Verificação de Receita para med-renew

Este guia descreve como aplicar no repositório **med-renew** (https://github.com/felipemenezes25000-spec/med-renew) as mesmas alterações de verificação de receita feitas no ola-jamal: validação no servidor, dados reais (sem mock), CRM completo.

---

## Pré-requisitos no med-renew

- Backend .NET com:
  - Tabela `prescriptions` (ou equivalente) com `verify_code_hash`, e repositório que valide código (4 ou 6 dígitos).
  - Entidade `Request`/`MedicalRequest` com `CreatedAt`, `SignedAt`, `DoctorId`, `PatientName`, `DoctorName`, `Status`.
  - Repositórios: `IRequestRepository`, `IDoctorRepository`, `IPrescriptionVerifyRepository` (ou equivalente).
  - Configuração de base URL da API (ex.: `ApiConfig.BaseUrl`).
- Frontend web com página de verificação (ex.: rota `/verify/:id`) e chamada atual à verificação (Edge Function ou outra API).

Ajuste namespaces e nomes de projeto (ex.: `RenoveJa` → `MedRenew`) conforme o med-renew.

---

## 1. Backend (.NET)

### 1.1 DTOs de verificação

**Arquivo:** `src/<Application>/DTOs/Verification/VerificationDtos.cs` (ou equivalente)

Adicione ao final do arquivo (ou crie o arquivo com o conteúdo abaixo, ajustando o namespace):

```csharp
/// <summary>
/// Corpo do POST /api/prescriptions/verify — validação por código de 6 dígitos.
/// </summary>
public record PrescriptionVerifyRequest(Guid PrescriptionId, string VerificationCode);

/// <summary>
/// Motivo de falha quando is_valid é false.
/// </summary>
public static class PrescriptionVerifyReason
{
    public const string InvalidCode = "INVALID_CODE";
    public const string NotSigned = "NOT_SIGNED";
    public const string NotFound = "NOT_FOUND";
    public const string Expired = "EXPIRED";
    public const string Revoked = "REVOKED";
}

/// <summary>
/// Resposta do POST /api/prescriptions/verify.
/// </summary>
public record PrescriptionVerifyResponse(
    bool IsValid,
    string Status,
    string? Reason,
    DateTime? IssuedAt,
    DateTime? SignedAt,
    string? PatientName,
    string? DoctorName,
    string? DoctorCrm,
    string? DownloadUrl
);
```

### 1.2 Controller de prescrições

**Arquivo novo:** `src/<Api>/Controllers/PrescriptionsController.cs`

Substitua `RenoveJa.Application`, `RenoveJa.Domain`, `RenoveJa.Api` pelos namespaces do med-renew. Ajuste o nome do enum de status cancelado (ex.: `RequestStatus.Cancelled`):

```csharp
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;   // ex.: MedRenew.Application
using RenoveJa.Application.DTOs.Verification;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/prescriptions")]
[EnableRateLimiting("verify")]   // use a policy de rate limit que já existir para verify
public class PrescriptionsController(
    IPrescriptionVerifyRepository prescriptionVerifyRepository,
    IRequestRepository requestRepository,
    IDoctorRepository doctorRepository,
    IOptions<ApiConfig> apiConfig,
    ILogger<PrescriptionsController> logger) : ControllerBase
{
    [HttpPost("verify")]
    public async Task<ActionResult<PrescriptionVerifyResponse>> Verify(
        [FromBody] PrescriptionVerifyRequest body,
        CancellationToken cancellationToken)
    {
        var id = body.PrescriptionId;
        var code = (body.VerificationCode ?? "").Trim();

        if (code.Length != 4 && code.Length != 6)
        {
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false, Status: "invalid", Reason: PrescriptionVerifyReason.InvalidCode,
                IssuedAt: null, SignedAt: null, PatientName: null, DoctorName: null, DoctorCrm: null, DownloadUrl: null));
        }

        var codeValid = await prescriptionVerifyRepository.ValidateVerifyCodeAsync(id, code, cancellationToken);
        if (!codeValid)
        {
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false, Status: "invalid", Reason: PrescriptionVerifyReason.InvalidCode,
                IssuedAt: null, SignedAt: null, PatientName: null, DoctorName: null, DoctorCrm: null, DownloadUrl: null));
        }

        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
        {
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false, Status: "invalid", Reason: PrescriptionVerifyReason.NotFound,
                IssuedAt: null, SignedAt: null, PatientName: null, DoctorName: null, DoctorCrm: null, DownloadUrl: null));
        }

        if (request.SignedAt == null)
        {
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false, Status: "invalid", Reason: PrescriptionVerifyReason.NotSigned,
                IssuedAt: null, SignedAt: null, PatientName: null, DoctorName: null, DoctorCrm: null, DownloadUrl: null));
        }

        if (request.Status == RequestStatus.Cancelled)   // ajuste o enum se for outro nome
        {
            return Ok(new PrescriptionVerifyResponse(
                IsValid: false, Status: "invalid", Reason: PrescriptionVerifyReason.Revoked,
                IssuedAt: null, SignedAt: null, PatientName: null, DoctorName: null, DoctorCrm: null, DownloadUrl: null));
        }

        string? doctorCrmFull = null;
        if (request.DoctorId.HasValue)
        {
            var doctor = await doctorRepository.GetByUserIdAsync(request.DoctorId.Value, cancellationToken);
            if (doctor != null)
                doctorCrmFull = string.IsNullOrWhiteSpace(doctor.CrmState) ? doctor.Crm : $"{doctor.Crm} / {doctor.CrmState}";
        }

        var baseUrl = (apiConfig?.Value?.BaseUrl ?? "").TrimEnd('/');
        var downloadUrl = string.IsNullOrEmpty(baseUrl) ? null
            : $"{baseUrl}/api/verify/{id}/document?code={Uri.EscapeDataString(code)}";

        return Ok(new PrescriptionVerifyResponse(
            IsValid: true, Status: "valid", Reason: null,
            IssuedAt: request.CreatedAt, SignedAt: request.SignedAt,
            PatientName: request.PatientName, DoctorName: request.DoctorName, DoctorCrm: doctorCrmFull,
            DownloadUrl: downloadUrl));
    }
}
```

- Garanta que existe endpoint `GET /api/verify/{id}/document?code=xxx` para download do PDF; caso a rota seja outra, ajuste `downloadUrl`.
- Se no med-renew não houver `EnableRateLimiting("verify")`, remova o atributo ou use a policy existente.

---

## 2. Frontend (Web)

### 2.1 API de verificação

**Arquivo:** `src/api/verify.ts` (ou caminho equivalente)

Substitua o conteúdo para chamar a API backend em vez da Edge Function:

```typescript
/**
 * Verificação de receita via API backend (POST /api/prescriptions/verify).
 * Validação server-side; sem mock ou fallback.
 */

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export interface VerifyPayload {
  id: string;
  code: string;
  v?: string;
}

export interface PrescriptionVerifyResponse {
  isValid: boolean;
  status: string;
  reason?: string | null;
  issuedAt?: string | null;
  signedAt?: string | null;
  patientName?: string | null;
  doctorName?: string | null;
  doctorCrm?: string | null;
  downloadUrl?: string | null;
}

export interface VerifySuccess {
  status: 'valid';
  issuedAt: string;
  signedAt: string | null;
  patientName: string | null;
  doctorName: string | null;
  doctorCrm: string | null;
  downloadUrl: string | null;
}

export type VerifyResponse =
  | { status: 'valid'; data: VerifySuccess }
  | { status: 'invalid'; reason: string; message: string }
  | { status: 'error'; message: string };

const REASON_MESSAGES: Record<string, string> = {
  INVALID_CODE: 'Código inválido.',
  NOT_SIGNED: 'Receita ainda não assinada.',
  NOT_FOUND: 'Receita não encontrada.',
  EXPIRED: 'Receita expirada.',
  REVOKED: 'Receita revogada.',
};

function reasonToMessage(reason: string | undefined): string {
  if (!reason) return 'Falha ao verificar. Tente novamente.';
  return REASON_MESSAGES[reason] ?? reason;
}

export async function verifyReceita(payload: VerifyPayload): Promise<VerifyResponse> {
  if (!API_URL) {
    return { status: 'error', message: 'Variável de ambiente VITE_API_URL não configurada.' };
  }
  const id = payload.id.trim();
  const code = payload.code.trim();
  if (!id || !code) {
    return { status: 'error', message: 'ID e código são obrigatórios.' };
  }
  const url = `${API_URL}/api/prescriptions/verify`;
  let res: Response;
  let data: PrescriptionVerifyResponse;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prescriptionId: id, verificationCode: code }),
    });
    data = (await res.json()) as PrescriptionVerifyResponse;
  } catch (err) {
    const isNetwork = err instanceof TypeError && (err instanceof Error ? err.message : '').toLowerCase().includes('fetch');
    return {
      status: 'error',
      message: isNetwork ? 'Não foi possível conectar ao servidor. Verifique sua internet e a URL da API.' : (err instanceof Error ? err.message : 'Erro de conexão.'),
    };
  }
  if (!res.ok) {
    return { status: 'error', message: (data as unknown as { error?: string })?.error ?? `HTTP ${res.status}` };
  }
  if (!data.isValid) {
    return { status: 'invalid', reason: data.reason ?? 'INVALID_CODE', message: reasonToMessage(data.reason ?? undefined) };
  }
  return {
    status: 'valid',
    data: {
      status: 'valid',
      issuedAt: data.issuedAt ?? '',
      signedAt: data.signedAt ?? null,
      patientName: data.patientName ?? null,
      doctorName: data.doctorName ?? null,
      doctorCrm: data.doctorCrm ?? null,
      downloadUrl: data.downloadUrl ?? null,
    },
  };
}
```

### 2.2 Página de verificação

**Arquivo:** `src/pages/Verify.tsx` (ou equivalente)

- Ao clicar em **Validar**, chamar apenas `verifyReceita({ id, code })` e tratar `status === 'valid' | 'invalid' | 'error'`.
- Em **erro/inválido**: mostrar só mensagem de erro; **não** exibir dados de receita.
- Em **sucesso**: exibir **apenas** os campos retornados pela API:
  - `issuedAt` → "Emitida em" (formatar com `toLocaleDateString('pt-BR')` a partir da string ISO).
  - `signedAt` → "Assinada em" (formatar data/hora pt-BR).
  - `patientName`, `doctorName`, `doctorCrm` (CRM completo, sem mascarar).
  - `downloadUrl` → botão "Baixar PDF (2ª via)".
- **Remover** qualquer uso de `Date.now()` ou `new Date()` para preencher "Emitida em" ou "Assinada em".
- **Remover** fallbacks como `meta.issuedDate ?? new Date()...`, `crmMasked ?? '****'`, etc.

Exemplo de helpers de formatação e uso do resultado:

```typescript
function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatIsoDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
```

No bloco de sucesso, use só `result.issuedAt`, `result.signedAt`, `result.patientName`, `result.doctorName`, `result.doctorCrm`, `result.downloadUrl` (todos vindos da API).

---

## 3. Variáveis de ambiente

- **Backend:** `ApiConfig:BaseUrl` (ou equivalente) com a URL pública da API (ex.: `https://seudominio.com`).
- **Frontend:** `VITE_API_URL` com a mesma base URL (ex.: `https://seudominio.com` ou `http://localhost:5xxx` em dev).

---

## 4. Resumo de arquivos

| Repo / Camada | Ação | Caminho (exemplo) |
|---------------|------|-------------------|
| Backend | Alterar | `Application/DTOs/Verification/VerificationDtos.cs` — adicionar `PrescriptionVerifyRequest`, `PrescriptionVerifyReason`, `PrescriptionVerifyResponse` |
| Backend | Criar | `Api/Controllers/PrescriptionsController.cs` — POST `api/prescriptions/verify` |
| Frontend | Substituir | `src/api/verify.ts` — chamar POST `/api/prescriptions/verify` |
| Frontend | Alterar | `src/pages/Verify.tsx` — só dados da API, CRM completo, datas reais, sem fallbacks |

---

## 5. Testes manuais sugeridos

1. **Código inválido** → mensagem de erro, sem dados de receita.
2. **Código válido** → "Emitida em" e "Assinada em" com datas reais; CRM completo visível; download do PDF funcionando.
3. **Receita não assinada** → mensagem "Receita ainda não assinada." (NOT_SIGNED), sem dados.

Se o med-renew tiver estrutura diferente (outros nomes de projeto, sem `prescriptions` ou sem repositório de verificação), adapte os namespaces, interfaces e rotas conforme o código existente.
