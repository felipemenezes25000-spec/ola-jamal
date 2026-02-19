# RenoveJá+ — Fluxo de verificação: deploy e uso

## Visão geral

- **Frontend (Vercel):** SPA React em `/verify/:id` que envia código (e opcionalmente `v` do QR) para a Edge Function.
- **Edge Function (Supabase):** `verify` valida código/token, gera signed URL do PDF e registra log.
- **Banco:** tabelas `prescriptions` e `prescription_verification_logs`.
- **Storage:** bucket privado `prescriptions` (apenas signed URLs).

---

## 1. Database (Supabase)

### 1.1 Executar migrations

No **Supabase Dashboard** → **SQL Editor**, execute na ordem:

1. **`supabase/migrations/20260219000001_create_prescriptions_and_logs.sql`**
   - Cria tabelas `prescriptions` e `prescription_verification_logs` e RLS.

2. **`supabase/migrations/20260219000002_storage_prescriptions_bucket.sql`**
   - Cria bucket privado `prescriptions` (PDF).

Ou, com CLI:

```bash
supabase link --project-ref SEU_REF
supabase db push
```

O bucket também pode ser criado manualmente em **Storage** → **New bucket** → nome `prescriptions`, **Private**, MIME `application/pdf`.

---

## 2. Storage

- Bucket **prescriptions** deve existir e ser **privado**.
- Tamanho máximo sugerido: 10 MB; tipos permitidos: `application/pdf`.
- Nenhuma policy para `anon`/`authenticated`; acesso só via signed URL gerada pela Edge Function (service_role).

---

## 3. Edge Function `verify`

### 3.1 Deploy

```bash
cd supabase
supabase functions deploy verify
```

Variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetadas pelo Supabase no runtime; não é necessário configurá-las manualmente.

### 3.2 Teste rápido

```bash
curl -X POST "https://SEU_REF.supabase.co/functions/v1/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -d '{"id":"<uuid>","code":"123456"}'
```

---

## 4. Seed (dados de teste)

```bash
cd scripts
npm install
export SUPABASE_URL="https://SEU_REF.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="sua_service_role_key"
npm run seed
```

Saída esperada:

- **Verify URL:** `https://renovejasaude.com.br/verify/<id>?v=<token>`
- **Code:** código de 6 dígitos

Use essa URL e o código na página de verificação.

---

## 5. Frontend (Vite + React Router)

### 5.1 Variáveis de ambiente

Crie `frontend-web/.env` (nunca commitar):

```env
VITE_SUPABASE_URL=https://SEU_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Use a **anon key** (Project Settings → API), nunca a service_role.

### 5.2 Build e deploy (Vercel)

```bash
cd frontend-web
npm install
npm run build
```

- Conectar repositório ao Vercel e definir **Root Directory** = `frontend-web`.
- Configurar **Environment Variables** no Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Build command: `npm run build`; Output: `dist`.

---

## 6. Segurança (checklist)

- [ ] Bucket `prescriptions` é **privado**.
- [ ] Acesso a PDFs apenas por **signed URLs** (5 min) geradas pela Edge Function.
- [ ] **Service role** só no backend/Edge Function; nunca no frontend ou em repositório.
- [ ] Frontend usa apenas **anon key** para chamar `/functions/v1/verify`.
- [ ] RLS nas tabelas: apenas `service_role` com acesso; anon não acessa tabelas diretamente.

---

## 7. Resumo de artefatos

| Item | Local |
|------|--------|
| Schema SQL | `supabase/migrations/20260219000001_*.sql`, `20260219000002_*.sql` |
| Edge Function | `supabase/functions/verify/index.ts` |
| Seed | `scripts/seedPrescription.ts` |
| Frontend Verify | `frontend-web/src/pages/Verify.tsx` |
| API verify (client) | `frontend-web/src/api/verify.ts` |
| Hash (browser) | `frontend-web/src/utils/hash.ts` |

---

## 8. Fluxo completo (usuário)

1. Usuário abre `https://renovejasaude.com.br/verify/<id>?v=<token>` (ou só `/verify/<id>`).
2. Informa o código de 6 dígitos e clica em **Verificar**.
3. Frontend envia `POST /functions/v1/verify` com `{ id, code, v? }` e **Authorization: Bearer ANON_KEY**.
4. Edge Function valida, gera signed URL e retorna `{ status: "valid", downloadUrl, meta }`.
5. Frontend exibe iniciais do paciente, CRM mascarado, data e botão **Baixar PDF** (usando `downloadUrl`).
6. Alerta de guardrail permanece visível: *"Decisão e responsabilidade é do profissional..."*.
