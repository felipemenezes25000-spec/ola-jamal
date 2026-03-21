# Guia de Monitoramento — RenoveJá+

> **Data:** 2026-03-16 | **Status:** implementado e operacional

---

## 1. O que já está monitorado

### Backend (.NET 8)

| Camada | O que captura | Destino |
|---|---|---|
| `ExceptionHandlingMiddleware` | Toda exceção não tratada no pipeline HTTP | Log arquivo |
| `ApiRequestLoggingMiddleware` | 4xx/5xx + requisições > 3 s | Serilog warn |
| `CorrelationIdMiddleware` | Propaga `X-Correlation-Id` por request | Tag em eventos de log |
| `AuditMiddleware` | Todas as requisições LGPD-sensíveis | Tabela `audit_logs` no Postgres |
| `Serilog` | Console + arquivo `logs/log-*.txt` (30 dias) | Local / CloudWatch |

**Background services monitorados:**
- `RenewalReminderService`
- `StaleRequestReminderService`
- `NewRequestBatchService`
- `AuditBackgroundService`
- `ExpoPushReceiptChecker`
