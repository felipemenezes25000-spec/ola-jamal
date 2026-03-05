# Dra. RenoveJá — Navegação Clínica

## Visão geral

A **Dra. RenoveJá** é a assistente que guia o paciente do "não sei o que escolher" até "pedido feito, pago, assinado e entregue". Ela atua em dois modos:

1. **Escolha do tipo de pedido** — tela inicial em `/new-request` com opções: receita, exame, consulta
2. **Próximo passo** — orientação por status do pedido (home, detalhe do pedido)
3. **Completude e qualidade** — checklist e sinais de urgência nas telas de novo pedido

## Endpoints da API

### POST `/api/assistant/next-action`

Retorna o próximo passo recomendado para o pedido.

**Request:**
```json
{
  "requestId": "uuid-opcional",
  "status": "string-opcional",
  "requestType": "string-opcional",
  "hasSignedDocument": false
}
```

Informe `requestId` (preferencial) ou `status` + `requestType`.

**Response:**
```json
{
  "title": "Aprovado, falta pagamento",
  "statusSummary": "Seu pedido foi aprovado...",
  "whatToDo": "Conclua o pagamento...",
  "eta": "Liberação quase imediata...",
  "ctaLabel": "Pagar agora",
  "intent": "pay"
}
```

**Intents:** `pay`, `download`, `track`, `wait`, `support`, `none`

---

### POST `/api/assistant/complete`

Avalia completude do pedido antes do envio e identifica sinais de urgência.

**Request:**
```json
{
  "flow": "prescription | exam | consultation",
  "prescriptionType": "simples | controlado",
  "imagesCount": 0,
  "examType": "laboratorial | imagem",
  "examsCount": 0,
  "symptoms": "string",
  "consultationType": "psicologo | medico_clinico",
  "durationMinutes": 15
}
```

**Response:**
```json
{
  "score": 86,
  "doneCount": 3,
  "totalCount": 4,
  "missingFields": ["symptoms"],
  "checks": [
    { "id": "main_reason", "label": "Descrever sintomas...", "required": true, "done": false }
  ],
  "hasUrgencyRisk": false,
  "urgencySignals": [],
  "urgencyMessage": null
}
```

## Integração no mobile

### Next action (próximo passo)

- **`app/(patient)/home.tsx`** — card "Dra. RenoveJa: seu proximo passo" para o pedido em acompanhamento
- **`app/request-detail/[id].tsx`** — seção "Dra. RenoveJa" com orientação e CTA

Chamada: `getAssistantNextAction({ requestId })`. Em erro, fallback para `getNextBestActionForRequest(request)` local.

### Completude (checklist)

- **`app/new-request/prescription.tsx`** — `evaluateAssistantCompleteness({ flow: 'prescription', ... })`
- **`app/new-request/exam.tsx`** — `evaluateAssistantCompleteness({ flow: 'exam', ... })`
- **`app/new-request/consultation.tsx`** — `evaluateAssistantCompleteness({ flow: 'consultation', ... })`

Em erro da API, fallback para motor local em `lib/domain/assistantIntelligence.ts`.

### Tela de escolha

- **`app/new-request/index.tsx`** — tela inicial com Dra. RenoveJá e 3 opções (receita, exame, consulta)
- **`app/(patient)/home.tsx`** — card "Novo pedido" navega para `/new-request` (index)

## Motor local (fallback)

Arquivo: `frontend-mobile/lib/domain/assistantIntelligence.ts`

- `getNextBestActionForRequest(request)` — próximo passo por status
- `evaluatePrescriptionCompleteness`, `evaluateExamCompleteness`, `evaluateConsultationCompleteness`
- `detectRedFlags(symptoms)` — sinais de urgência (dor no peito, falta de ar, etc.)

## Backend

- **Controller:** `AssistantController.cs`
- **Serviço:** `AssistantNavigatorService.cs`
- **Interface:** `IAssistantNavigatorService`

Fluxos de completude e red flags são implementados no backend; o frontend usa a API com fallback local.
