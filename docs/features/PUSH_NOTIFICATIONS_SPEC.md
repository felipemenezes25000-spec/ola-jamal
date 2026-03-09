# Push Notifications — Especificação de Regras

Documento técnico com mapeamento de eventos, payload padrão, deduplicação e prioridades.

## 0) Padrões obrigatórios

### 0.1 Payload padrão (data)

Todo push inclui:

```json
{
  "type": "request_status_changed",
  "requestId": "uuid",
  "requestType": "prescription|exam|consultation",
  "status": "ApprovedPendingPayment",
  "deepLink": "renoveja://request-detail/uuid",
  "category": "requests|payments|consultations|system",
  "collapseKey": "req_uuid_ApprovedPendingPayment",
  "ts": 1710000000
}
```

### 0.2 Canais Android

- **default**: importância MAX (heads-up) — ação imediata
- **quiet**: importância DEFAULT (sem heads-up) — informativo

### 0.3 Deduplicação

- `collapseKey = <entidade>_<id>_<evento>`
- Mesmo evento em 5 min → não reenviar
- Janela: 5 minutos (configurável)

### 0.4 Preferências

- `push_tokens.active` = false → não enviar push (apenas in-app)

## 1) Eventos implementados

### Paciente — Pedidos

| Evento | Canal | Título | Deep link |
|--------|-------|-------|-----------|
| Submitted | quiet | Pedido enviado ✅ | request-detail/{id} |
| InReview | quiet | Seu pedido está em análise | request-detail/{id} |
| NeedMoreInfo | default | Precisamos de um detalhe | request-detail/{id}?focus=missingInfo |
| ApprovedPendingPayment | default | Aprovado ✅ falta só o pagamento | payment/{id} |
| PaymentFailed | default | Pagamento não concluído | payment/{id}?retry=1 |
| Paid | default | Pagamento confirmado ✅ | request-detail/{id} |
| Signed | default | Documento pronto 🧾 | request-detail/{id}?action=download |
| Rejected | default | Seu pedido precisa de revisão | request-detail/{id}?tab=reason |
| Cancelled | quiet/default* | Pedido cancelado | request-detail/{id} |

\* default se houve pagamento (reembolso)

### Médico — Pedidos

| Evento | Canal | Título | Deep link |
|--------|-------|-------|-----------|
| NewRequestAvailable | default | Nova solicitação | doctor-requests?filter=pending |
| RequestAssigned | quiet | Pedido atribuído a você | doctor-request/{id} |
| Paid (para médico) | default | Pagamento confirmado | doctor-request/{id}?action=sign |
| SigningFailed | default | Falha ao assinar | doctor-request/{id}?action=sign&retry=1 |

### Consulta

| Evento | Canal | Título |
|--------|-------|-------|
| ConsultationScheduled | quiet | Consulta confirmada ✅ |
| ConsultationStartingSoon (T-10) | default | Sua consulta começa em 10 min |
| DoctorReady | default | Seu médico já está pronto |
| NoShow | quiet | Não conseguimos iniciar a consulta |

## 2) Implementação

- **PushNotificationRules**: mapeia eventos → `PushNotificationRequest`
- **PushNotificationDispatcher**: deduplicação + persistência in-app + envio
- **ExpoPushService**: envia com `collapseKey`, `channelId`, `priority`

## 3) Pendente (futuro)

- [ ] Quiet hours (22:00–08:00)
- [ ] Preferências por categoria (Pedidos, Pagamentos, Consultas, Lembretes)
- [ ] Lembretes (receita vencendo, pedido parado)
- [ ] Chat (mensagem do médico)
- [ ] Batching (5 pedidos em 2 min → "5 novas solicitações")
