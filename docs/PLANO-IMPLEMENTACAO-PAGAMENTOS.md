# Plano de Implementacao — Pagamentos via Mercado Pago (RenoveJa+)

> Objetivo: reintroduzir o fluxo de pagamentos (PIX + cartao) no projeto atual (`ola-jamal`), baseando-se na implementacao que existia no projeto antigo (`renoveja-pagamentos`), adaptando para a stack atual (AWS RDS + Npgsql/Dapper, sem Supabase).

---

## Contexto

### O que mudou entre as versoes

| Aspecto | Versao antiga (`renoveja-pagamentos`) | Versao atual (`ola-jamal`) |
|---------|---------------------------------------|----------------------------|
| Banco | Supabase REST API (`PostgresClient` via HTTP) | AWS RDS PostgreSQL (Npgsql/Dapper via `PostgresClient`) |
| Storage | Supabase Storage | AWS S3 (`S3StorageService`) |
| Repositorios | HTTP REST calls para Supabase | SQL direto com Dapper |
| Pagamentos | Mercado Pago completo (PIX, cartao, webhook, saved cards) | **Removido** — `Approve()` vai direto para `Paid` (preco=0) |
| Status `Approve()` | `ApprovedPendingPayment` (aguarda pagamento) | `Paid` (pula pagamento) |
| `MedicalRequest.Price` | Obrigatorio (>0 para receita/exame) | Sempre 0 (`Money.Zero`) |
| Redis | Nao tinha | ElastiCache (usado pelo `ConsultationSessionStore`) |
| Infra | Nao definida | Terraform (ECS, RDS, S3, CloudFront, WAF) |

### O que sera reaproveitado da versao antiga

- **Entidades**: `Payment`, `PaymentAttempt`, `WebhookEvent`, `SavedCard` (dominio puro, sem dependencia de infra)
- **Servicos**: `PaymentService`, `PaymentWebhookHandler` (logica de negocio)
- **Integracao**: `MercadoPagoService` (HTTP direto para API do MP)
- **DTOs**: `CreatePaymentRequestDto`, `PaymentResponseDto`, etc.
- **Configuracao**: `MercadoPagoConfig`
- **Validadores**: `CreatePaymentRequestValidator`

### O que precisa ser reescrito

- **Repositorios**: de Supabase REST para Npgsql/Dapper (SQL direto)
- **`MedicalRequest.Approve()`**: restaurar logica de preco e transicao para `ApprovedPendingPayment`
- **`RequestApprovalService`**: passar preco na aprovacao
- **Migrations**: SQL para criar tabelas no RDS
- **Frontend**: telas de pagamento PIX e cartao (mobile + web)

---

## Fases de Implementacao

### Fase 1 — Domain Layer (Entidades e Enums)

**Objetivo**: adicionar as entidades de pagamento e restaurar a logica de preco no dominio.

#### 1.1 Criar entidade `Payment`

**Arquivo**: `backend-dotnet/src/RenoveJa.Domain/Entities/Payment.cs`

```csharp
// Propriedades: Id, RequestId, UserId, Amount (Money), Status (PaymentStatus),
// PaymentMethod, ExternalId, PixQrCode, PixQrCodeBase64, PixCopyPaste,
// PaidAt, CreatedAt, UpdatedAt
// Factory methods: CreatePixPayment, CreateCardPayment, CreateCheckoutProPayment, Reconstitute
// Behavior: SetPixData, SetExternalId, Approve, Reject, Refund, IsPending, IsApproved
```

Copiar de `renoveja-pagamentos` — entidade pura, sem dependencias externas.

#### 1.2 Criar entidade `PaymentAttempt`

**Arquivo**: `backend-dotnet/src/RenoveJa.Domain/Entities/PaymentAttempt.cs`

Copiar integralmente — auditoria de cada tentativa com correlation ID, payloads, status codes.

#### 1.3 Criar entidade `WebhookEvent`

**Arquivo**: `backend-dotnet/src/RenoveJa.Domain/Entities/WebhookEvent.cs`

Copiar integralmente — rastreabilidade completa de webhooks do MP.

#### 1.4 Criar entidade `SavedCard`

**Arquivo**: `backend-dotnet/src/RenoveJa.Domain/Entities/SavedCard.cs`

Copiar integralmente — cartoes tokenizados do paciente.

#### 1.5 Criar enum `PaymentStatus`

**Arquivo**: `backend-dotnet/src/RenoveJa.Domain/Enums/PaymentStatus.cs`

```csharp
public enum PaymentStatus { Pending, Approved, Rejected, Refunded }
```

#### 1.6 Restaurar `MedicalRequest.Approve()` com preco

**Arquivo**: `backend-dotnet/src/RenoveJa.Domain/Entities/MedicalRequest.cs`

**Mudanca**: restaurar a logica da versao antiga:
- `price` deixa de ter default `= 0` e passa a ser obrigatorio
- Receita/exame com `price <= 0` lanca `DomainException`
- Consulta com `price == 0` vai direto para `Paid` (banco de horas)
- Demais casos: `Status = ApprovedPendingPayment`

```csharp
// ANTES (atual):
public void Approve(decimal price = 0, ...) {
    Status = RequestStatus.Paid;  // sempre Paid
}

// DEPOIS:
public void Approve(decimal price, ...) {
    Price = price == 0 ? Money.Zero : Money.Create(price);
    Status = (RequestType == RequestType.Consultation && price == 0)
        ? RequestStatus.Paid
        : RequestStatus.ApprovedPendingPayment;
}
```

#### 1.7 Adicionar metodo `ConfirmPayment()` ao `MedicalRequest`

```csharp
public void ConfirmPayment()
{
    if (Status != RequestStatus.ApprovedPendingPayment)
        throw new DomainException("Request must be pending payment");
    Status = RequestStatus.Paid;
    UpdatedAt = DateTime.UtcNow;
}
```

---

### Fase 2 — Domain Interfaces (Contratos dos Repositorios)

#### 2.1 `IPaymentRepository`

**Arquivo**: `backend-dotnet/src/RenoveJa.Domain/Interfaces/IPaymentRepository.cs`

```csharp
Task<Payment?> GetByIdAsync(Guid id);
Task<Payment?> GetByRequestIdAsync(Guid requestId);
Task<Payment?> GetByExternalIdAsync(string externalId);
Task<List<Payment>> GetByUserIdAsync(Guid userId);
Task<Payment> CreateAsync(Payment payment);
Task<Payment> UpdateAsync(Payment payment);
Task DeleteAsync(Guid id);
```

#### 2.2 `IPaymentAttemptRepository`

**Arquivo**: `backend-dotnet/src/RenoveJa.Domain/Interfaces/IPaymentAttemptRepository.cs`

```csharp
Task<PaymentAttempt?> GetByCorrelationIdAsync(string correlationId);
Task<List<PaymentAttempt>> GetByPaymentIdAsync(Guid paymentId);
Task<List<PaymentAttempt>> GetByRequestIdAsync(Guid requestId);
Task<PaymentAttempt> CreateAsync(PaymentAttempt attempt);
Task<PaymentAttempt> UpdateAsync(PaymentAttempt attempt);
```

#### 2.3 `IWebhookEventRepository`

**Arquivo**: `backend-dotnet/src/RenoveJa.Domain/Interfaces/IWebhookEventRepository.cs`

```csharp
Task<WebhookEvent?> GetByMercadoPagoRequestIdAsync(string mpRequestId);
Task<List<WebhookEvent>> GetByPaymentIdAsync(string mpPaymentId);
Task<WebhookEvent> CreateAsync(WebhookEvent evt);
Task<WebhookEvent> UpdateAsync(WebhookEvent evt);
```

#### 2.4 `ISavedCardRepository`

**Arquivo**: `backend-dotnet/src/RenoveJa.Domain/Interfaces/ISavedCardRepository.cs`

```csharp
Task<SavedCard?> GetByIdAsync(Guid id);
Task<List<SavedCard>> GetByUserIdAsync(Guid userId);
Task<SavedCard> CreateAsync(SavedCard card);
Task DeleteAsync(Guid id);
```

---

### Fase 3 — Infrastructure Layer (Repositorios + Mercado Pago)

**Diferenca critica**: a versao antiga usava Supabase REST. Aqui usaremos **Npgsql + Dapper**, seguindo o padrao do `PostgresClient` atual.

#### 3.1 `PaymentRepository` (Dapper)

**Arquivo**: `backend-dotnet/src/RenoveJa.Infrastructure/Repositories/PaymentRepository.cs`

```csharp
// INSERT INTO payments (id, request_id, user_id, amount, status, payment_method, ...) VALUES (...)
// SELECT * FROM payments WHERE id = @Id
// SELECT * FROM payments WHERE request_id = @RequestId
// SELECT * FROM payments WHERE external_id = @ExternalId
// UPDATE payments SET status = @Status, external_id = @ExternalId, ... WHERE id = @Id
```

Seguir o padrao existente nos repositorios do projeto (ex: `RequestRepository`, `UserRepository`).

#### 3.2 `PaymentAttemptRepository` (Dapper)

**Arquivo**: `backend-dotnet/src/RenoveJa.Infrastructure/Repositories/PaymentAttemptRepository.cs`

#### 3.3 `WebhookEventRepository` (Dapper)

**Arquivo**: `backend-dotnet/src/RenoveJa.Infrastructure/Repositories/WebhookEventRepository.cs`

#### 3.4 `SavedCardRepository` (Dapper)

**Arquivo**: `backend-dotnet/src/RenoveJa.Infrastructure/Repositories/SavedCardRepository.cs`

#### 3.5 `MercadoPagoService` (HTTP)

**Arquivo**: `backend-dotnet/src/RenoveJa.Infrastructure/Payments/MercadoPagoService.cs`

Copiar da versao antiga — usa `HttpClient` direto para `https://api.mercadopago.com`. **Nao depende de Supabase**.

Metodos:
- `CreatePixPaymentAsync()` — POST `/v1/payments` com `payment_method_id: "pix"`
- `CreateCardPaymentAsync()` — POST `/v1/payments` com token do Brick SDK
- `CreateCardPaymentWithCustomerAsync()` — pagamento com cartao salvo
- `CreateCustomerAsync()` / `SearchCustomerByEmailAsync()` — gerenciar clientes MP
- `AddCardToCustomerAsync()` — POST `/v1/customers/{id}/cards`
- `GetPaymentStatusAsync()` / `GetPaymentDetailsAsync()` — consultar status real
- `CreateCheckoutProPreferenceAsync()` — POST `/checkout/preferences`
- `CpfHelper` — validacao de CPF para pagamento

#### 3.6 `MercadoPagoConfig`

**Arquivo**: `backend-dotnet/src/RenoveJa.Application/Configuration/MercadoPagoConfig.cs`

```csharp
public class MercadoPagoConfig
{
    public const string SectionName = "MercadoPago";
    public string AccessToken { get; set; } = "";
    public string? NotificationUrl { get; set; }
    public string? PublicKey { get; set; }
    public string? WebhookSecret { get; set; }
    public string? RedirectBaseUrl { get; set; }
}
```

---

### Fase 4 — Application Layer (Servicos e DTOs)

#### 4.1 DTOs de Pagamento

**Arquivo**: `backend-dotnet/src/RenoveJa.Application/DTOs/Payments/PaymentDtos.cs`

Copiar da versao antiga:
- `CreatePaymentRequestDto` (RequestId, PaymentMethod, Token, Installments, ...)
- `PaymentResponseDto` (Id, RequestId, Amount, Status, PixQrCode, PixCopyPaste, ...)
- `CheckoutProResponseDto` (InitPoint, PaymentId)
- `AddCardRequestDto` (Token)
- `PayWithSavedCardRequestDto` (RequestId, SavedCardId, Token)
- `SavedCardDto` (Id, MpCardId, LastFour, Brand)
- `MercadoPagoWebhookDto` (Action, Id, Data)

#### 4.2 Interfaces de Servico

**`IPaymentService`**: `backend-dotnet/src/RenoveJa.Application/Interfaces/IPaymentService.cs`
**`IMercadoPagoService`**: `backend-dotnet/src/RenoveJa.Application/Interfaces/IMercadoPagoService.cs`
**`IPaymentWebhookHandler`**: `backend-dotnet/src/RenoveJa.Application/Interfaces/IPaymentWebhookHandler.cs`

Copiar interfaces da versao antiga — contratos puros.

#### 4.3 `PaymentService`

**Arquivo**: `backend-dotnet/src/RenoveJa.Application/Services/Payments/PaymentService.cs`

Copiar e adaptar:
- Logica de criacao PIX com semaforo (anti-duplicidade)
- Logica de cartao com token do Brick SDK
- Logica de cartao salvo com Customer ID
- `ProcessWebhookAsync` — atualiza Payment + MedicalRequest via `ConfirmPayment()`
- Notificacoes push para paciente e medico
- Publicacao de evento SignalR

**Adaptacoes necessarias**:
- Trocar `_requestRepository.UpdateAsync()` pelo padrao Dapper do projeto atual
- Usar `IRequestEventsPublisher` (ja existe) para notificar frontend
- Usar `IPushNotificationDispatcher` (ja existe) para push notifications

#### 4.4 `PaymentWebhookHandler`

**Arquivo**: `backend-dotnet/src/RenoveJa.Application/Services/Payments/PaymentWebhookHandler.cs`

Copiar integralmente — logica pura de parsing/validacao HMAC/deduplicacao.

#### 4.5 Validador

**Arquivo**: `backend-dotnet/src/RenoveJa.Application/Validators/CreatePaymentRequestValidator.cs`

FluentValidation: RequestId obrigatorio, PaymentMethod valido, Token obrigatorio se cartao.

#### 4.6 Atualizar `RequestApprovalService`

**Arquivo**: `backend-dotnet/src/RenoveJa.Application/Services/Requests/RequestApprovalService.cs`

**Mudanca**: o `ApproveAsync` precisa receber e passar o preco:
- Buscar preco da tabela `product_prices` (ou receber do DTO de aprovacao)
- Chamar `request.Approve(price, notes, medications, exams)`
- Request fica em `ApprovedPendingPayment` (nao mais `Paid`)
- Notificacao ao paciente: "Solicitacao aprovada — realize o pagamento"

**Opcao**: adicionar campo `Price` ao `ApproveRequestDto`:
```csharp
public record ApproveRequestDto(
    decimal? Price = null,  // NOVO — obrigatorio para receita/exame
    List<string>? Medications = null,
    List<string>? Exams = null,
    string? Notes = null
);
```

---

### Fase 5 — API Layer (Controller + Webhook)

#### 5.1 `PaymentsController`

**Arquivo**: `backend-dotnet/src/RenoveJa.Api/Controllers/PaymentsController.cs`

Endpoints (copiar da versao antiga, adaptar auth middleware):

```
POST   /api/payments                          — Criar pagamento (PIX ou cartao)
GET    /api/payments/by-request/{requestId}    — Buscar pagamento por request
GET    /api/payments/{id}                      — Detalhes do pagamento
GET    /api/payments/{id}/pix-code             — Codigo PIX copia-e-cola (texto)
POST   /api/payments/{id}/confirm              — Confirmacao manual (dev/test)
POST   /api/payments/confirm-by-request/{rid}  — Confirmacao manual por request
GET    /api/payments/saved-cards               — Listar cartoes salvos
POST   /api/payments/add-card                  — Salvar cartao tokenizado
POST   /api/payments/saved-card                — Pagar com cartao salvo
POST   /api/payments/sync-status/{requestId}   — Sincronizar status com MP
POST   /api/payments/checkout-pro/{requestId}  — URL Checkout Pro
GET    /api/payments/webhook                   — Health check (AllowAnonymous)
POST   /api/payments/webhook                   — Webhook MP (AllowAnonymous)
```

**Webhook handler**: ler raw body, headers, query string e delegar para `IPaymentWebhookHandler`.

#### 5.2 Registrar no DI

**Arquivo**: `backend-dotnet/src/RenoveJa.Api/Extensions/ServiceCollectionExtensions.cs`

Adicionar em `AddRepositories()`:
```csharp
services.AddScoped<IPaymentRepository, PaymentRepository>();
services.AddScoped<IPaymentAttemptRepository, PaymentAttemptRepository>();
services.AddScoped<IWebhookEventRepository, WebhookEventRepository>();
services.AddScoped<ISavedCardRepository, SavedCardRepository>();
```

Adicionar em `AddApplicationServices()`:
```csharp
services.AddScoped<IPaymentService, PaymentService>();
services.AddScoped<IPaymentWebhookHandler, PaymentWebhookHandler>();
```

Adicionar em `AddInfrastructureServices()`:
```csharp
services.AddScoped<IMercadoPagoService, MercadoPagoService>();
```

Adicionar em `AddRenoveJaConfiguration()`:
```csharp
services.Configure<MercadoPagoConfig>(options =>
{
    options.AccessToken = EnvOrConfig(envVars, config, "MercadoPago__AccessToken", "MercadoPago:AccessToken");
    options.NotificationUrl = EnvOrConfig(envVars, config, "MercadoPago__NotificationUrl", "MercadoPago:NotificationUrl");
    options.PublicKey = EnvOrConfig(envVars, config, "MercadoPago__PublicKey", "MercadoPago:PublicKey");
    options.WebhookSecret = EnvOrConfig(envVars, config, "MercadoPago__WebhookSecret", "MercadoPago:WebhookSecret");
    options.RedirectBaseUrl = EnvOrConfig(envVars, config, "MercadoPago__RedirectBaseUrl", "MercadoPago:RedirectBaseUrl");
});
```

---

### Fase 6 — Database Migration

**Arquivo**: `backend-dotnet/docs/migrations/add_payments.sql`

```sql
-- Tabela principal de pagamentos
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
    payment_method TEXT NOT NULL DEFAULT 'pix'
        CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'checkout_pro')),
    external_id TEXT,
    pix_qr_code TEXT,
    pix_qr_code_base64 TEXT,
    pix_copy_paste TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_request_id ON public.payments(request_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_external_id ON public.payments(external_id);

-- Auditoria de tentativas de pagamento
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    correlation_id TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    mercado_pago_payment_id TEXT,
    mercado_pago_preference_id TEXT,
    request_url TEXT,
    request_payload TEXT,
    response_payload TEXT,
    response_status_code INTEGER,
    response_status_detail TEXT,
    response_headers TEXT,
    error_message TEXT,
    is_success BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_attempts_payment_id ON public.payment_attempts(payment_id);
CREATE INDEX idx_payment_attempts_correlation_id ON public.payment_attempts(correlation_id);

-- Eventos de webhook do Mercado Pago
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT,
    mercado_pago_payment_id TEXT,
    mercado_pago_request_id TEXT,
    webhook_type TEXT,
    webhook_action TEXT,
    raw_payload TEXT,
    processed_payload TEXT,
    query_string TEXT,
    request_headers TEXT,
    content_type TEXT,
    content_length INTEGER,
    source_ip TEXT,
    is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
    is_processed BOOLEAN NOT NULL DEFAULT FALSE,
    processing_error TEXT,
    payment_status TEXT,
    payment_status_detail TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_mp_request_id ON public.webhook_events(mercado_pago_request_id);
CREATE INDEX idx_webhook_events_mp_payment_id ON public.webhook_events(mercado_pago_payment_id);

-- Cartoes salvos (tokenizados no Mercado Pago)
CREATE TABLE IF NOT EXISTS public.saved_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mp_customer_id TEXT NOT NULL,
    mp_card_id TEXT NOT NULL,
    last_four TEXT NOT NULL,
    brand TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_saved_cards_unique ON public.saved_cards(user_id, mp_card_id);
```

Registrar no `MigrationRunner` para execucao automatica no startup.

---

### Fase 7 — Frontend Mobile

#### 7.1 API Client

**Arquivo**: `frontend-mobile/lib/api-payments.ts`

Copiar da versao antiga — funcoes para todos os endpoints de pagamento.

#### 7.2 React Query Hooks

**Arquivo**: `frontend-mobile/lib/hooks/usePaymentQuery.ts`

Copiar da versao antiga:
- `usePaymentQuery(paymentId, polling)` — polling de 5s para PIX
- `usePixCodeQuery(paymentId)` — buscar codigo copia-e-cola
- `usePaymentByRequestQuery(requestId)` — buscar por request
- `useSyncPaymentStatus()` — sincronizar com MP

#### 7.3 Tela de Pagamento

**Arquivos**:
- `frontend-mobile/components/payment/PaymentHeader.tsx` — header com botao voltar
- `frontend-mobile/components/payment/PaymentMethodSelection.tsx` — escolha PIX ou cartao
- Tela de PIX: exibir QR code + copia-e-cola + polling
- Tela de Cartao: Mercado Pago Brick SDK para tokenizacao
- Tela de Cartao Salvo: lista + selecao + CVV via Brick

#### 7.4 Ajustar fluxo pos-aprovacao

Quando request status mudar para `approved_pending_payment`:
- Exibir botao "Pagar" no card da solicitacao
- Navegar para tela de escolha de metodo de pagamento
- Apos pagamento: status muda para `paid` via polling/SignalR

---

### Fase 8 — Frontend Web (Portal Medico)

#### 8.1 Atualizar StatusTracker

O `StatusTracker` ja mapeia `approved_pending_payment` — verificar se exibe corretamente o passo de pagamento.

#### 8.2 Tela de aprovacao do medico

Adicionar campo de preco no modal de aprovacao:
- Buscar preco sugerido da tabela `product_prices`
- Permitir medico ajustar valor
- Enviar `price` no `ApproveRequestDto`

#### 8.3 Verificacao publica

Se a receita nao estiver paga, a verificacao deve informar que esta pendente de pagamento (nao exibir download).

---

### Fase 9 — Configuracao e Infraestrutura

#### 9.1 Variaveis de ambiente

Adicionar ao `.env` / ECS task definition / Terraform:

```env
MercadoPago__AccessToken=APP_USR_...
MercadoPago__PublicKey=APP_USR_...
MercadoPago__NotificationUrl=https://api.renoveja.com.br/api/payments/webhook
MercadoPago__WebhookSecret=whsec_...
MercadoPago__RedirectBaseUrl=https://renoveja.com.br
```

#### 9.2 Terraform

**Arquivo**: `infra/ecs.tf` — adicionar env vars ao task definition
**Arquivo**: `infra/waf.tf` — garantir que `/api/payments/webhook` nao seja bloqueado pelo WAF (rate limit adequado para webhooks)

#### 9.3 Mercado Pago Dashboard

- Criar aplicacao no painel MP (se nao existir)
- Configurar webhook URL: `https://api.renoveja.com.br/api/payments/webhook`
- Copiar `AccessToken`, `PublicKey`, `WebhookSecret`
- Configurar eventos: `payment.created`, `payment.updated`

#### 9.4 `appsettings.json`

Adicionar secao MercadoPago com placeholders:

```json
{
  "MercadoPago": {
    "AccessToken": "",
    "PublicKey": "",
    "WebhookSecret": "",
    "NotificationUrl": "",
    "RedirectBaseUrl": ""
  }
}
```

---

## Ordem de Execucao Recomendada

```
Fase 1 — Domain (entidades + enum + ajuste Approve)         ~2h
Fase 2 — Domain Interfaces (contratos repositorios)          ~30min
Fase 3 — Infrastructure (repositorios Dapper + MercadoPago)  ~4h
Fase 4 — Application (servicos + DTOs + validadores)         ~3h
Fase 5 — API (controller + webhook + DI)                     ~2h
Fase 6 — Database (migration SQL)                            ~30min
Fase 7 — Frontend Mobile (API + hooks + telas)               ~4h
Fase 8 — Frontend Web (ajustes portal medico)                ~2h
Fase 9 — Config e Infra (env vars + Terraform + MP)          ~1h
```

**Total estimado: ~19h de trabalho**

---

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Webhook nao chega (firewall/WAF) | Endpoint de sync manual (`/sync-status`); health check GET no webhook |
| Pagamento duplicado (race condition) | Semaforo por request no PIX; idempotency key no cartao |
| Webhook duplicado do MP | Deduplicacao por `X-Request-Id`; verificacao `IsPaymentProcessedByExternalIdAsync` |
| HMAC invalido (MP muda formato) | 8 variacoes de manifest; fallback idempotente se ja processado |
| Preco inconsistente (frontend vs backend) | Preco SEMPRE vem do backend (`product_prices`), nunca do cliente |
| Cartao recusado | Frontend exibe mensagem clara; PaymentAttempt registra motivo |
| Supabase residual | Buscar e remover qualquer referencia; usar apenas Npgsql/Dapper |

---

## Checklist de Validacao

- [ ] `dotnet build` sem erros
- [ ] `dotnet test` passa
- [ ] Migration roda no RDS sem erros
- [ ] Criar pagamento PIX (sandbox) retorna QR code
- [ ] Webhook do MP (sandbox) atualiza status para Paid
- [ ] Criar pagamento com cartao de teste funciona
- [ ] Salvar cartao e pagar com cartao salvo funciona
- [ ] Frontend mobile exibe QR code e polling funciona
- [ ] Frontend web permite medico definir preco na aprovacao
- [ ] Verificacao publica bloqueia download se nao pago
- [ ] Nenhuma referencia a Supabase no codigo
- [ ] Env vars configuradas no ECS/Terraform

---

## Arquivos a Criar (Resumo)

### Backend — Domain
1. `Domain/Entities/Payment.cs`
2. `Domain/Entities/PaymentAttempt.cs`
3. `Domain/Entities/WebhookEvent.cs`
4. `Domain/Entities/SavedCard.cs`
5. `Domain/Enums/PaymentStatus.cs`
6. `Domain/Interfaces/IPaymentRepository.cs`
7. `Domain/Interfaces/IPaymentAttemptRepository.cs`
8. `Domain/Interfaces/IWebhookEventRepository.cs`
9. `Domain/Interfaces/ISavedCardRepository.cs`

### Backend — Application
10. `Application/DTOs/Payments/PaymentDtos.cs`
11. `Application/Interfaces/IPaymentService.cs`
12. `Application/Interfaces/IMercadoPagoService.cs`
13. `Application/Interfaces/IPaymentWebhookHandler.cs`
14. `Application/Services/Payments/PaymentService.cs`
15. `Application/Services/Payments/PaymentWebhookHandler.cs`
16. `Application/Services/Payments/PaymentWebhookHandleResult.cs`
17. `Application/Validators/CreatePaymentRequestValidator.cs`
18. `Application/Configuration/MercadoPagoConfig.cs`

### Backend — Infrastructure
19. `Infrastructure/Repositories/PaymentRepository.cs`
20. `Infrastructure/Repositories/PaymentAttemptRepository.cs`
21. `Infrastructure/Repositories/WebhookEventRepository.cs`
22. `Infrastructure/Repositories/SavedCardRepository.cs`
23. `Infrastructure/Payments/MercadoPagoService.cs`

### Backend — API
24. `Api/Controllers/PaymentsController.cs`

### Database
25. `docs/migrations/add_payments.sql`

### Arquivos a Modificar
26. `Domain/Entities/MedicalRequest.cs` — restaurar logica de preco no `Approve()`
27. `Application/Services/Requests/RequestApprovalService.cs` — passar preco
28. `Application/DTOs/Requests/ApproveRequestDto.cs` — adicionar campo `Price`
29. `Api/Extensions/ServiceCollectionExtensions.cs` — registrar novos servicos no DI
30. `Api/appsettings.json` — secao MercadoPago

### Frontend Mobile
31. `frontend-mobile/lib/api-payments.ts`
32. `frontend-mobile/lib/hooks/usePaymentQuery.ts`
33. `frontend-mobile/components/payment/PaymentHeader.tsx`
34. `frontend-mobile/components/payment/PaymentMethodSelection.tsx`
35. Telas de pagamento PIX e cartao (a definir rota/navegacao)

### Frontend Web
36. Ajustes no modal de aprovacao (campo preco)
37. Ajustes no StatusTracker (se necessario)
