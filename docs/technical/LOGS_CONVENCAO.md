# Convenção de Logs — Organização e Sentry

## Objetivo

- **Sentry**: só erros, avisos e latência (Warning+)
- **Console/File**: tudo (incluindo Info/Debug) para debug local
- **Categorias**: filtrar por domínio (auth, api, payment, etc.)
- **Atributos**: `userId`, `requestId`, `duration`, etc. para busca no Sentry

---

## Backend (.NET)

### O que vai ao Sentry

| Nível   | Vai ao Sentry? | Uso típico                    |
|---------|----------------|-------------------------------|
| Trace   | Não            | Debug muito detalhado         |
| Debug   | Não            | Diagnóstico em dev            |
| Info    | Não            | Fluxo normal                 |
| Warning | Sim            | Erros recuperáveis, lentidão   |
| Error   | Sim            | Falhas que precisam atenção   |
| Fatal   | Sim            | Falhas críticas               |

### Categoria via prefixo `[TAG]`

Use prefixo na mensagem para o Sentry extrair `log.category`:

| Tag                    | Uso                           |
|------------------------|-------------------------------|
| `[API]`                | Requisições HTTP (4xx, 5xx)   |
| `[WEBHOOK-EVENT]`      | Webhooks MercadoPago          |
| `[PAYMENT-ATTEMPT]`    | Pagamentos PIX/cartão         |
| `[MP-REQUEST]`         | Chamadas ao MercadoPago       |
| `[FinishConsultation]` | Finalização de consulta       |
| `[GetUserRequests]`    | Busca de solicitações         |

Exemplo:

```csharp
logger.LogWarning(
  "[PAYMENT-ATTEMPT] Falha ao criar PIX. CorrelationId={CorrelationId}",
  correlationId);
```

### Requisições lentas

O `ApiRequestLoggingMiddleware` registra como **Warning** quando:

- Status >= 400 (4xx/5xx)
- Duração >= 3s (lento)

Assim, erros e latência aparecem no Sentry.

---

## Frontend (Web e Mobile)

### Logger estruturado

Use `lib/logger` em vez de `console.log` ou `Sentry.logger` direto:

```ts
import { logger } from '../lib/logger';

// Info/debug: só console em dev
logger.info('api', 'Requisição iniciada', { endpoint: '/orders', userId });
logger.debug('payment', 'Cache lookup', { key: 'order_123' });

// Erros e avisos: vão ao Sentry
logger.warn('api', 'Rate limit próximo', { current: 95, max: 100 });
logger.error('payment', 'Pagamento falhou', { orderId, reason: 'card_declined' });
logger.exception('auth', err, 'Login falhou', { provider: 'google' });
```

### Categorias sugeridas

| Categoria | Uso                   |
|-----------|-----------------------|
| `auth`    | Login, logout, token  |
| `api`     | Chamadas HTTP/API     |
| `payment` | Checkout, PIX, cartão |
| `video`   | Videoconsulta, Daily  |
| `request` | Solicitações médicas  |
| `verify`  | Verificação receita   |
| `ui`      | Erros de interface    |
| `general` | Outros                |

### Frontend: o que vai ao Sentry

- Só `warn`, `error`, `fatal` e `exception`
- `info` e `debug` ficam só no console (em dev)

---

## No Sentry

- **Filtrar por categoria**: `log.category:API` ou `log.category:API`
- **Filtrar por nível**: `level:error` ou `level:warn`
- **Buscar por atributo**: `userId:abc123`, `requestId:xyz789`
- **Erros**: Issues → stack traces
- **Logs**: Explore → Logs → filtros e colunas

---

## Resumo

| Camada   | Info/Debug      | Warning+ | Categorias              |
|----------|-----------------|----------|-------------------------|
| Backend  | Console + File  | Sentry   | `[TAG]` na mensagem     |
| Frontend | Console (dev)   | Sentry   | `logger.warn('api', …)` |
