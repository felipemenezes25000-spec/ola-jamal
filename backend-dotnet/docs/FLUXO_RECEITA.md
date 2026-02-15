# Fluxo de receita médica (renovação)

Ordem dos passos e endpoints.

---

## 1. Paciente solicita receita (envia foto)

**Um único endpoint:** `POST /api/requests/prescription`

### Envio com imagens (recomendado) – multipart

- **Content-Type:** `multipart/form-data`
- **Campos:** `prescriptionType` (obrigatório: **simples**, **controlado** ou **azul** — define o preço na aprovação), `images` (obrigatório: um ou mais arquivos JPEG, PNG, WebP ou HEIC; máx. 10 MB por arquivo). Medicamentos não são enviados no multipart.
- **Quem:** paciente (Bearer token).
- **Efeito:** As imagens são enviadas para o **Supabase Storage** (bucket `prescription-images`). As URLs públicas são salvas na solicitação no banco (`prescription_images`). Status **submitted**.
- **Resposta:** `{ "request": { "id": "...", "status": "submitted", "prescriptionImages": ["https://...supabase.co/storage/..."], ... } }`

### Envio só com dados (JSON)

- **Content-Type:** `application/json`
- **Body:** `{ "prescriptionType": "simples", "medications": [], "prescriptionImages": [] }` (prescriptionType obrigatório; medications e prescriptionImages opcionais).
- **Quem:** paciente (Bearer token).
- **Efeito:** Cria a solicitação com status **submitted** usando as URLs informadas em prescriptionImages, se houver (sem upload).
- **Resposta:** `{ "request": { "id": "...", "status": "submitted", ... } }`

---

## 2. Médico aprova ou rejeita a renovação

### Aprovar
- **Endpoint:** `POST /api/requests/{id}/approve`
- **Body:** vazio `{}` — só aprova. O valor é consultado na tabela `product_prices`.
- **Quem:** somente médico (Bearer token, role doctor).
- **Efeito:** Atribui o médico (se ainda não houver), consulta o preço na tabela, status **approved_pending_payment**. **Não cria pagamento** — o paciente inicia o pagamento depois.
- **Resposta:** `{ "id": "...", "status": "approved_pending_payment", "price": 50.00, ... }`

### Rejeitar
- **Endpoint:** `POST /api/requests/{id}/reject`
- **Body:** `{ "rejectionReason": "Motivo da reprovação" }` (obrigatório).
- **Efeito:** Status → **rejected**; o motivo fica em `rejectionReason` para o paciente ver.

---

## 3. Paciente paga pela renovação

- **Paciente inicia o pagamento:** `POST /api/payments` com `{ "requestId": "guid-da-solicitação" }` (Bearer token do paciente). A API cria o PIX no Mercado Pago e retorna `pixQrCodeBase64`, `pixCopyPaste`.
- Se o paciente já criou pagamento antes: `GET /api/payments/by-request/{requestId}` retorna o PIX pendente.
- Pagamento via PIX (QR Code ou copia e cola) no app do banco.
- **Confirmação:** webhook do Mercado Pago (`POST /api/payments/webhook`) ou confirmação manual `POST /api/payments/{id}/confirm` (dev/teste).
- **Efeito:** Status do pagamento → aprovado; status da solicitação → **paid**.

---

## 4. Médico assina e envia a receita nova

- **Endpoint:** `POST /api/requests/{id}/sign`
- **Body:** `{ "signedDocumentUrl": "https://storage.../receita-123.pdf", "signatureData": "opcional-id-assinatura" }`
- **Quem:** médico (Bearer token, role doctor).
- **Efeito:** Associa a URL do documento assinado à solicitação, status → **signed**. O paciente pode acessar a receita pelo `signedDocumentUrl` retornado em `GET /api/requests/{id}`.
- **Resposta:** `{ "request": { ..., "signedDocumentUrl": "...", "signedAt": "..." } }`

---

## Resumo da ordem

| # | Ação              | Endpoint                          | Status antes → depois              |
|---|-------------------|-----------------------------------|------------------------------------|
| 1 | Paciente solicita (imagens + dados na mesma API) | POST /api/requests/prescription (multipart ou JSON) | — → **submitted**                  |
| 2 | Médico aprova     | POST /api/requests/{id}/approve  | submitted → **approved_pending_payment** |
| 3 | Paciente cria pagamento | POST /api/payments com requestId | Cria PIX, retorna QR/copia-e-cola |
| 4 | Paciente paga     | Webhook ou POST payments/confirm | approved_pending_payment → **paid** |
| 5 | Médico assina     | POST /api/requests/{id}/sign     | paid → **signed** (receita nova vinculada) |

---

## Outros endpoints úteis

- `GET /api/requests` – lista solicitações do usuário (filtros `status`, `type`).
- `GET /api/requests/{id}` – detalhe da solicitação (inclui `signedDocumentUrl` quando assinada).
- `POST /api/requests/{id}/reject` – médico rejeita (body: `rejectionReason`).
- `POST /api/requests/{id}/assign-queue` – atribui a um médico disponível (fila).

Fluxo de **exame** é análogo (POST /api/requests/exam → approve → pagamento → sign). **Consulta** tem fluxo próprio (sala de vídeo, etc.).

---

## Supabase Storage (fotos de receita)

- **Bucket:** `prescription-images` (público para leitura).
- **Criação do bucket:** a API usa o projeto Supabase definido em **appsettings** (`Supabase:Url`). O bucket deve existir **nesse projeto**. Execute no **SQL Editor** do Dashboard desse projeto o script **`docs/STORAGE_BUCKET.sql`** (ou crie manualmente em Storage um bucket `prescription-images`, público, limite 10 MB, tipos image/jpeg, image/png, image/webp, image/heic).
- **Limite:** 10 MB por arquivo; tipos: JPEG, PNG, WebP, HEIC.
- As imagens ficam em `{userId}/{uuid}.{ext}`; a URL pública é salva em `requests.prescription_images` (array de texto).
- No plano gratuito do Supabase há cota de Storage; no plano pago inicial a cota é maior. Consulte [Supabase Pricing](https://supabase.com/pricing) para limites atuais.
