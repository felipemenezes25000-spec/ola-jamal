# RenoveJá+ — Notas de alinhamento (contrato, estado, Verify v2)

Documento de decisões para eliminar drift entre frontend (mobile + web) e backend/Supabase.

---

## 1. Verify v2 (oficial)

**Decisão:** O fluxo oficial de verificação pública de receitas é o **Verify v2**, documentado em `docs/VERIFY_DEPLOY.md` e implementado com:

- **Tabelas:** `prescriptions`, `prescription_verification_logs`
- **Storage:** bucket privado `prescriptions` (acesso só por signed URL)
- **Edge Function:** `POST /functions/v1/verify` (Supabase)
- **Frontend:** `frontend-web` rota `/verify/:id`, query `?v=<token>`, input code 6 dígitos

### Contrato do POST verify

- **Request (JSON):**
  - `id` (string, UUID)
  - `code` (string, exatamente 6 dígitos `[0-9]`)
  - `v` (string, opcional) — token do QR; obrigatório se a prescription tiver `qr_token_hash` preenchido

- **Resposta sucesso (200):**
```json
{
  "status": "valid",
  "downloadUrl": "<signed_url>",
  "meta": {
    "issuedAt": "...",
    "issuedDate": "YYYY-MM-DD",
    "patientInitials": "...",
    "crmMasked": "UF • ****1234",
    "prescriberCrmUf": "...",
    "prescriberCrmLast4": "..."
  }
}
```

- **Resposta erro (4xx):**
```json
{ "status": "invalid", "error": "not_found|invalid_code|invalid_token|revoked|expired|invalid_id|invalid_code_format" }
```

### Formato do QR

- URL final: `https://renovejasaude.com.br/verify/<id>?v=<token>`
- `id` = UUID da linha em `prescriptions`
- `token` = valor aleatório cujo SHA256 está em `prescriptions.qr_token_hash`; expira em `qr_token_expires_at`
- Código de 6 dígitos armazenado como SHA256 em `prescriptions.verify_code_hash`

### Backend .NET (QR no PDF)

- O backend hoje gera o QR da receita via `PrescriptionPdfService` e `VerificationConfig.BaseUrl` (ex.: `{BaseUrl}/{RequestId}`).
- Esse fluxo aponta para a API .NET (`/api/verify`), não para o Verify v2 (Supabase).
- **TODO (opcional):** Para alinhar o QR do PDF ao Verify v2:
  1. Ao assinar/gerar receita, o backend (ou um job) deve criar o registro em `prescriptions` no Supabase (id, code, qr_token hashes, `pdf_storage_path` após upload no bucket).
  2. Configurar o QR para `https://renovejasaude.com.br/verify/<prescription_id>?v=<qr_token>`.
- Enquanto isso, o **seed** (`scripts/seedPrescription.ts`) e a **Edge Function + frontend-web** estão alinhados ao v2 para testes e uso direto.

---

## 2. Frontend-mobile — helpers de estado e preço

### Estado de UI (status)

- **Arquivo único:** `frontend-mobile/lib/domain/requestUiState.ts`
- **Função:** `getRequestUiState(request)` → retorna um dos estados: `waiting_doctor`, `in_review`, `needs_payment`, `paid_pending_sign`, `signed_ready`, `rejected`, `cancelled`, `unknown`
- **Uso:** Todas as telas que precisam agrupar ou filtrar por “fase” do pedido devem usar esse helper (ex.: home do paciente para stats: pending, toPay, ready). Não filtrar status do backend “na mão” em listas.

### Preço

- **Arquivo:** `frontend-mobile/lib/config/pricing.ts`
- **Conteúdo:** `FALLBACK_PRICES` por tipo de request, `PRESCRIPTION_TYPE_PRICES`, `FALLBACK_CONSULTATION_PRICE`, `FALLBACK_EXAM_PRICE`, e a função `getDisplayPrice(price, requestType)`.
- Nenhuma tela deve hardcodar valor de preço; usar sempre `getDisplayPrice(request.price, request.requestType)` ou as constantes do config.

### Erro de API

- **Função:** `getApiErrorMessage(err: unknown): string` em `frontend-mobile/lib/api-client.ts`
- Todas as telas que exibem erro de chamada à API (Alert, setError, etc.) devem usar essa função em vez de `(error as Error)?.message` espalhado.

---

## 3. Checklist de comandos para validar

- **Backend:**  
  `cd backend-dotnet && dotnet build`  
  (e `dotnet test` se existir)

- **Frontend-web:**  
  `cd frontend-web && npm i && npm run build`

- **Frontend-mobile:**  
  `cd frontend-mobile && npm i && npm test`  
  (e `npm run typecheck` se existir)

- **Verify v2 (teste com seed):**  
  1. `cd scripts && npm i`  
  2. Definir `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`  
  3. `npm run seed`  
  4. Abrir a URL impressa no browser, informar o code de 6 dígitos, validar download do PDF e meta.

---

## 4. Arquivos alterados (referência rápida)

- **Verify v2:** `supabase/functions/verify/index.ts` (prescriptions, logs, signed URL, code 6 dígitos, token `v`).
- **Web:** `frontend-web/src/pages/Verify.tsx` (code só dígitos, `inputMode="numeric"`, mensagens de erro v2).
- **Mobile:**  
  - `lib/domain/requestUiState.ts` (novo),  
  - `lib/config/pricing.ts` (novo),  
  - `lib/api-client.ts` (getApiErrorMessage),  
  - home, RequestCard, request-detail, payment/card, new-request (prescription, consultation, exam), doctor-request [id] (uso de getRequestUiState, getDisplayPrice, getApiErrorMessage).
