# Guia de Monitoramento — RenoveJá+

> **Data:** 2026-03-16 | **Status:** implementado e operacional (falta configurar DSNs do Sentry)

---

## 1. Pré-requisito: configurar os DSNs do Sentry

Sem os DSNs abaixo, **todos os erros ficam silenciosos** (só aparecem em arquivo de log local).

### 1.1 Como obter os DSNs

1. Acesse [sentry.io](https://sentry.io) → crie ou abra a org `renoveja`
2. Crie **3 projetos**: `renoveja-backend`, `renoveja-mobile`, `renoveja-web`
3. Em cada projeto: **Settings → Client Keys (DSN)** → copie o valor

### 1.2 Onde configurar

| Arquivo | Variável | Plataforma |
|---|---|---|
| `backend-dotnet/src/RenoveJa.Api/.env` | `SENTRY_DSN=https://...` | .NET 8 |
| `frontend-mobile/.env` | `EXPO_PUBLIC_SENTRY_DSN=https://...` | Expo / React Native |
| `frontend-web/.env` | `VITE_SENTRY_DSN=https://...` | Vite / React |

Em **produção (Railway/AWS)**: setar como variável de ambiente na plataforma, não no arquivo `.env`.

---

## 2. O que já está monitorado

### Backend (.NET 8)

| Camada | O que captura | Destino |
|---|---|---|
| `ExceptionHandlingMiddleware` | Toda exceção não tratada no pipeline HTTP | Sentry Issues + log arquivo |
| `ApiRequestLoggingMiddleware` | 4xx/5xx + requisições > 3 s | Serilog warn → Sentry Logs |
| `CorrelationIdMiddleware` | Propaga `X-Correlation-Id` por request | Tag em todos os eventos Sentry |
| `AuditMiddleware` | Todas as requisições LGPD-sensíveis | Tabela `audit_logs` no Postgres |
| `SentrySdk.CaptureException` | Background jobs (5 services) | Sentry Issues com tag `job=...` |
| `Serilog` | Console + arquivo `logs/log-*.txt` (30 dias) | Local / CloudWatch |

**Background services com Sentry** (após esta sessão):
- `RenewalReminderService` ✅
- `StaleRequestReminderService` ✅
- `NewRequestBatchService` ✅
- `AuditBackgroundService` ✅
- `ExpoPushReceiptChecker` ✅
