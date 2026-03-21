# Convenção de Logs — Organização

## Objetivo

- **Logs estruturados**: erros, avisos e latência (Warning+)
- **Console/File**: tudo (incluindo Info/Debug) para debug local
- **Categorias**: filtrar por domínio (auth, api, payment, etc.)
- **Atributos**: `userId`, `requestId`, `duration`, etc. para busca nos logs

---

## Backend (.NET)

### Níveis de log

| Nível   | Destino        | Uso típico                    |
|---------|----------------|-------------------------------|
| Trace   | Arquivo/Console | Debug muito detalhado         |
| Debug   | Arquivo/Console | Diagnóstico em dev            |
| Info    | Arquivo/Console | Fluxo normal                 |
| Warning | Arquivo/Console + Alerta | Erros recuperáveis, lentidão   |
| Error   | Arquivo/Console + Alerta | Falhas que precisam atenção   |
| Fatal   | Arquivo/Console + Alerta | Falhas críticas               |

### Categoria via prefixo `[TAG]`

Use prefixo na mensagem para categorização:

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

Assim, erros e latência aparecem nos logs estruturados.

---

## Frontend (Web e Mobile)

### Logger estruturado

Use `lib/logger` em vez de `console.log` direto:

```ts
import { logger } from '../lib/logger';

// Info/debug: só console em dev
logger.info('api', 'Requisição iniciada', { endpoint: '/orders', userId });
logger.debug('payment', 'Cache lookup', { key: 'order_123' });

// Erros e avisos: registrados e reportados
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

### Frontend: o que é reportado

- Só `warn`, `error`, `fatal` e `exception`
- `info` e `debug` ficam só no console (em dev)

---

## Resumo

| Camada   | Info/Debug      | Warning+          | Categorias              |
|----------|-----------------|-------------------|-------------------------|
| Backend  | Console + File  | Log + Alerta      | `[TAG]` na mensagem     |
| Frontend | Console (dev)   | Log + Alerta      | `logger.warn('api', …)` |
