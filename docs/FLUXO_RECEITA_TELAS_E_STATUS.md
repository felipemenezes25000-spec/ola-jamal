# Fluxo de receita: telas e atualização de status

Este documento descreve o fluxo de telas no app durante o processo de renovação de receita e em que momento cada status é atualizado no backend.

---

## Visão geral do fluxo

```
Paciente: Home → Nova Receita → [envia] → volta ao Home
                → Meus Pedidos → Detalhe do pedido (status: Enviado)
                                    ↓
Médico:  Dashboard → Fila → Detalhe (receita) → Aprovar ou Rejeitar
                                    ↓
Paciente: Detalhe do pedido (status: Em análise → Aprovado, aguardando pagamento)
                → Pagar → Tela de pagamento (PIX/cartão)
                                    ↓
Backend:  Webhook Mercado Pago → status vira Paid
                                    ↓
Paciente: Detalhe (status: Pago) — aguarda assinatura
Médico:   Fila/Detalhe → Assinar digitalmente
                                    ↓
Backend:  SignAsync → status vira Signed
                                    ↓
Paciente: Detalhe → Baixar receita / Visualizar → mark-delivered → status vira Delivered
```

---

## 1. Telas por ator

### Paciente

| Tela | Rota | Quando aparece |
|------|------|----------------|
| Home | `/(patient)/home` | Após login; mostra atalhos (Nova Receita, Meus Pedidos, etc.). |
| Nova Receita | `/new-request/prescription` | Ao tocar em "Renovar Receita". |
| Meus Pedidos | `/(patient)/requests` | Lista de todos os pedidos (filtros: Todos, Receitas, Exames, Consultas). |
| Detalhe do pedido | `/request-detail/[id]` | Ao tocar em um pedido na lista. Mostra status, detalhes, e botões conforme o status. |
| Pagamento | `/payment/[paymentId]` | Ao tocar em "Pagar" no detalhe (PIX ou cartão). |
| Pagamento cartão | `/payment/card` | Se escolher pagamento com cartão. |

### Médico

| Tela | Rota | Quando aparece |
|------|------|----------------|
| Dashboard | `/(doctor)/dashboard` | Após login; contadores (Fila, Em análise, Assinados, Consultas) e preview da fila. |
| Fila de Atendimento | `/(doctor)/requests` | Lista de pedidos (fila + atribuídos ao médico). |
| Detalhe do pedido (médico) | `/doctor-request/[id]` | Ao tocar em um pedido na fila. Mostra dados do paciente, análise IA, imagens, e ações (Aprovar, Rejeitar, Assinar). |

---

## 2. Momento em que cada status é atualizado

| Status | Quando é setado | Onde no backend | Tela/ação do usuário |
|--------|-----------------|-----------------|----------------------|
| **Submitted** | Paciente envia a receita | `CreatePrescriptionAsync` → `MedicalRequest.CreatePrescription(...)` com `RequestStatus.Submitted` | Tela "Nova Receita" → preenche tipo, foto, medicamentos → Enviar. Após sucesso, volta ao Home (pode ir em Meus Pedidos para ver o pedido). |
| **InReview** | Médico é atribuído ao pedido | `AssignDoctor()` (em `AssignToQueueAsync` ou no primeiro `ApproveAsync` quando `DoctorId == null`) | Médico abre o pedido na Fila e clica em **Aprovar** (ou o sistema atribui via assign-queue). O status passa a "Em análise" para o paciente. |
| **Rejected** | Médico rejeita | `RejectAsync` → `request.Reject(motivo)` | Na tela do médico, botão **Rejeitar** + motivo. Paciente vê o motivo no detalhe. |
| **ApprovedPendingPayment** | Médico aprova | `ApproveAsync` → `request.Approve(preço, ...)` | Na tela do médico, botão **Aprovar**. Paciente vê "A Pagar" e o botão **Pagar** no detalhe. |
| **Paid** | Pagamento confirmado | `PaymentService` (webhook PIX ou confirmação cartão) → `request.MarkAsPaid()` | Paciente paga na tela de pagamento; o backend recebe a confirmação e atualiza o status. Paciente pode estar na tela de pagamento (polling) ou voltar ao detalhe e ver "Pago". |
| **Signed** | Médico assina o documento | `SignAsync` → geração do PDF, assinatura digital, `request.Sign(url, signatureId)` | Na tela do médico, pedido com status "Pago" → **Assinar Digitalmente** (senha do certificado). Paciente passa a ver **Baixar Receita** / **Visualizar** no detalhe. |
| **Delivered** | Paciente baixa/abre o PDF | `MarkDeliveredAsync` → `request.Deliver()` | Na tela de detalhe do paciente, ao tocar em **Baixar Receita** ou **Visualizar**, o app chama `POST /api/requests/{id}/mark-delivered` e depois abre o documento. |
| **Cancelled** | Paciente cancela | `CancelAsync` → `request.Cancel()` | Na tela de detalhe do paciente, botão **Cancelar pedido** (visível apenas quando status é submitted, in_review, approved_pending_payment, pending_payment, searching_doctor ou consultation_ready). |

---

## 3. Botões e regras por tela

### Detalhe do pedido (paciente) – `request-detail/[id].tsx`

- **Pagar**: se `status` ∈ { pending_payment, approved_pending_payment, approved, consultation_ready }.
- **Baixar Receita** / **Visualizar**: se existe `signedDocumentUrl` (e ao usar, chama `mark-delivered` se status ainda for `signed`).
- **Entrar na Consulta**: apenas para tipo consulta e status paid ou in_consultation.
- **Cancelar pedido**: se status for cancelável (submitted, in_review, approved_pending_payment, pending_payment, searching_doctor, consultation_ready).

### Detalhe do pedido (médico) – `doctor-request/[id].tsx`

- **Aprovar**: status `submitted` ou `in_review` e tipo não é consulta.
- **Rejeitar**: status `submitted` ou `in_review`.
- **Assinar Digitalmente**: status `paid` e tipo não é consulta.
- **Aceitar Consulta** / **Iniciar Consulta**: apenas para consultas (searching_doctor / paid, in_consultation).

---

## 4. Status Tracker (receita)

O componente `StatusTracker` para receita/exame usa os passos:

1. Enviado (`submitted`)
2. Análise (`analyzing` – opcional, se a IA rodar em etapa separada)
3. Em Análise (`in_review`)
4. Pagamento (`approved_pending_payment`, `pending_payment`)
5. Assinado (`paid`, `signed`) — inclui “aguardando assinatura” (paid) e “já assinado” (signed)
6. Entregue (`delivered`)

Cada transição de status acima é refletida no tracker conforme o backend atualiza o pedido.

---

## 5. Ajuste realizado

- Foi adicionado o botão **Cancelar pedido** na tela de detalhe do pedido (paciente) quando o status é cancelável, chamando `POST /api/requests/{id}/cancel` e atualizando o estado local para exibir o pedido como cancelado.

Com isso, o fluxo de telas e a atualização de status da receita estão alinhados com a documentação e com o backend.
