# Análise Completa - RenoveJá Backend

**Data:** 13/02/2026 | **Arquivos:** 154 .cs | **Endpoints:** 54+

---

## 1. ARQUITETURA ✅ Boa

Clean Architecture + DDD bem aplicado:
- **Domain** → Entities, Value Objects, Enums, Interfaces de repositório
- **Application** → DTOs, Services, Interfaces, Validators (FluentValidation)
- **Infrastructure** → Repositórios (Supabase), Services externos, Persistence Models
- **Api** → Controllers, Middleware, Auth handler

**Pontos positivos:**
- Separação de camadas respeitada
- Domain não referencia Infrastructure
- Value Objects (Email, Phone, Money) bem implementados
- Validators separados por caso de uso

---

## 2. SEGURANÇA

### 🔴 CRÍTICO

**1. Chave de criptografia hardcoded**
- **Onde:** `DigitalCertificateService.cs:30`
- **O quê:** `private static readonly byte[] EncryptionKey = Encoding.UTF8.GetBytes("RenoveJa_PFX_Key_32bytes_12345!!");`
- **Risco:** Qualquer pessoa com acesso ao código vê a chave que protege os certificados PFX dos médicos
- **Fix:** Ler de `CertificateEncryption:Key` do appsettings (já existe o campo, mas o código não usa!)
- **Esforço:** 30 min

**2. CORS AllowAnyOrigin em produção**
- **Onde:** `Program.cs:151`
- **O quê:** `policy.AllowAnyOrigin()` é a policy DEFAULT
- **Risco:** Qualquer site pode fazer requests à API
- **Fix:** Usar a policy "Production" como default e mover AllowAnyOrigin pra Development only
- **Esforço:** 15 min

**3. Credenciais reais no appsettings.Development.json commitado**
- **Onde:** `appsettings.Development.json`
- **O quê:** Supabase Service Key, OpenAI API Key, MP Access Token, SMTP password — tudo em texto plano
- **Risco:** Se o repo for público (ou vazar), todas as credenciais são comprometidas
- **Fix:** Usar User Secrets (`dotnet user-secrets`) ou variáveis de ambiente. Adicionar appsettings.Development.json ao .gitignore
- **Esforço:** 1 hora

### 🟡 IMPORTANTE

**4. Webhook MP sem validação de assinatura**
- **Onde:** `PaymentsController.cs` — webhook aceita qualquer POST
- **O quê:** Não valida o `WebhookSecret` do Mercado Pago
- **Fix:** Validar header `x-signature` com HMAC
- **Esforço:** 2 horas

**5. Rate limiting só no middleware, não por endpoint**
- **Onde:** `Program.cs`
- **O quê:** Auth tem rate limit mas endpoints como `/api/verify` (público) e `/api/auth/forgot-password` não têm limite específico
- **Fix:** Adicionar rate limit mais restritivo em endpoints públicos
- **Esforço:** 1 hora

---

## 3. QUALIDADE DO CÓDIGO

### 🟡 IMPORTANTE

**6. Apenas 3 testes unitários**
- **Onde:** `tests/RenoveJa.UnitTests/` — só AuthServiceTests, DomainTests, RequestDtosTests
- **O quê:** 154 arquivos de código e 3 testes. Cobertura < 5%
- **Fix:** Adicionar testes para: PaymentService, RequestService, DigitalCertificateService, validators
- **Esforço:** 2-3 dias

**7. Catch genérico em vários lugares**
- **Onde:** 4 ocorrências de `catch (Exception)` que engolem erros
- **Fix:** Logar o erro ou re-throw com informação contextual
- **Esforço:** 1 hora

### 🟢 NICE TO HAVE

**8. Warnings de async sem await**
- **Onde:** `DigitalCertificateService.cs`, `PrescriptionPdfService.cs`
- **Fix:** Usar `Task.FromResult` ou remover async
- **Esforço:** 15 min

---

## 4. PERFORMANCE

### 🟡 IMPORTANTE

**9. N+1 no DoctorService.GetDoctorsAsync**
- **Onde:** `DoctorService.cs`
- **O quê:** Pra cada doctor profile, faz um `GetByIdAsync` no UserRepository separado
- **Fix:** Criar um método que faz JOIN ou batch query
- **Esforço:** 2 horas

**10. Sem caching**
- **O quê:** Nenhum cache em memória. Endpoints como `/api/specialties` (lista estática) e `/api/integrations/status` (valida MP token a cada request) não precisam bater no banco/API toda vez
- **Fix:** `IMemoryCache` pra dados estáticos/semi-estáticos
- **Esforço:** 2 horas

---

## 5. FUNCIONALIDADES INCOMPLETAS

### 🔴 CRÍTICO

**11. Migrations SQL faltando para features novas**
- **O quê:** Não existe migration pra: `doctor_certificates`, campos novos no `doctor_profiles` (active_certificate_id, crm_validated, crm_validated_at)
- **Fix:** Criar scripts SQL em docs/migrations/
- **Esforço:** 1 hora

**12. SupabaseStorageService — métodos da interface IStorageService**
- **O quê:** IStorageService define `UploadAsync(path, byte[], contentType)`, `DownloadAsync`, `DeleteAsync`, `ExistsAsync`, `GetPublicUrl`. Verificar se todos estão implementados
- **Esforço:** 1 hora

### 🟡 IMPORTANTE

**13. Fluxo de assinatura não integrado no RequestService.SignAsync**
- **Onde:** `RequestService.cs` → `SignAsync` recebe URLs externas
- **O quê:** Não chama `IPrescriptionPdfService.GenerateAndUploadAsync` → `IDigitalCertificateService.SignPdfAsync` automaticamente
- **Fix:** Integrar: gerar PDF → assinar com certificado do médico → salvar URL → atualizar request
- **Esforço:** 3 horas

**14. Daily.co — AcceptConsultation não usa DailyVideoService**
- **Onde:** `RequestService.AcceptConsultationAsync` cria sala com URL mock
- **Fix:** Chamar `IDailyVideoService.CreateRoomAsync` pra criar sala real
- **Esforço:** 1 hora

**15. AccessCode não é gerado na criação de receitas**
- **O quê:** O portal de verificação usa código de acesso, mas MedicalRequest não tem campo AccessCode
- **Fix:** Adicionar campo e gerar na criação
- **Esforço:** 1 hora

---

## 6. BANCO DE DADOS

### 🔴 CRÍTICO — Migrations pendentes:

```sql
-- 1. Tabela doctor_certificates
CREATE TABLE IF NOT EXISTS public.doctor_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_profile_id UUID NOT NULL REFERENCES doctor_profiles(id),
    subject_name TEXT NOT NULL,
    issuer_name TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    not_before TIMESTAMPTZ NOT NULL,
    not_after TIMESTAMPTZ NOT NULL,
    pfx_storage_path TEXT NOT NULL,
    pfx_file_name TEXT NOT NULL,
    cpf TEXT,
    crm_number TEXT,
    is_valid BOOLEAN DEFAULT true,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    validated_at_registration BOOLEAN DEFAULT false,
    last_validation_date TIMESTAMPTZ,
    last_validation_result TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    uploaded_by_ip TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_doctor_certificates_doctor ON doctor_certificates(doctor_profile_id);
CREATE INDEX idx_doctor_certificates_valid ON doctor_certificates(is_valid, is_revoked);

-- 2. Colunas novas em doctor_profiles
ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS active_certificate_id UUID;
ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS crm_validated BOOLEAN DEFAULT false;
ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS crm_validated_at TIMESTAMPTZ;

-- 3. Storage bucket para certificados
-- No Supabase Dashboard: criar bucket "certificates" (privado)
```

---

## 7. TESTES

### 🟡 IMPORTANTE

| Área | Testes existentes | Testes necessários |
|---|---|---|
| Auth | 1 (básico) | Login, registro, token, roles |
| Requests | 0 | Criar receita, aprovar, rejeitar, assinar |
| Payments | 0 | Criar pagamento, webhook, confirmar |
| Certificates | 0 | Validar PFX, upload, assinar PDF |
| Domain entities | 1 | Todos os value objects e invariantes |
| Validators | 0 | Todos os FluentValidation validators |

---

## 8. DEVOPS / DEPLOY

### 🔴 CRÍTICO

**16. Sem Dockerfile**
- App não tem container. Precisa pra deploy
- **Esforço:** 30 min

**17. Sem CI/CD**
- Sem GitHub Actions, sem pipeline
- **Esforço:** 2 horas

**18. Sem .gitignore adequado**
- appsettings.Development.json com credenciais deve estar no .gitignore
- **Esforço:** 10 min

---

## 9. PRIORIDADES

### 🔴 CRÍTICO (antes de produção)

| # | Item | Esforço |
|---|---|---|
| 1 | Chave criptografia do appsettings (não hardcoded) | 30 min |
| 2 | CORS restritivo em produção | 15 min |
| 3 | Credenciais fora do código (.gitignore + user-secrets) | 1h |
| 4 | Migrations SQL (doctor_certificates + colunas) | 1h |
| 5 | Dockerfile | 30 min |
| 6 | Integrar fluxo PDF → assinatura no RequestService | 3h |

### 🟡 IMPORTANTE (próximas sprints)

| # | Item | Esforço |
|---|---|---|
| 7 | Validar webhook MP (HMAC) | 2h |
| 8 | Integrar Daily.co real no AcceptConsultation | 1h |
| 9 | AccessCode nas receitas | 1h |
| 10 | Cache (IMemoryCache) | 2h |
| 11 | Fix N+1 DoctorService | 2h |
| 12 | Testes unitários (mínimo cobertura 40%) | 2-3 dias |
| 13 | CI/CD (GitHub Actions) | 2h |
| 14 | Rate limit em endpoints públicos | 1h |

### 🟢 NICE TO HAVE

| # | Item | Esforço |
|---|---|---|
| 15 | Fix warnings async | 15 min |
| 16 | Pagination em listagens (requests, doctors) | 2h |
| 17 | Health check mais detalhado (DB, storage, MP) | 1h |
| 18 | Swagger com exemplos de request/response | 2h |
| 19 | Logs estruturados (Serilog) | 2h |
| 20 | Notificações push reais (Firebase) | 4h |

---

**Total estimado pra "production-ready":** ~2 dias (itens críticos) + 2 semanas (importantes)
