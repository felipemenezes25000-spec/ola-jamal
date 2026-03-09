# O que precisa subir no Supabase (RenoveJá+)

Checklist do que deve estar deployado/rodado no seu projeto Supabase para o app funcionar por completo.

---

## 1. Migrations (banco de dados)

Execute **na ordem** (SQL Editor do Dashboard ou CLI).

| Ordem | Arquivo | O que faz |
|-------|---------|-----------|
| 1 | `supabase/migrations/20260219000001_create_prescriptions_and_logs.sql` | Tabelas `prescriptions` e `prescription_verification_logs` (Verify v2) |
| 2 | `supabase/migrations/20260219000002_storage_prescriptions_bucket.sql` | Bucket privado `prescriptions` para PDFs |
| 3 | `supabase/migrations/20260221000001_create_base_schema.sql` | Tabelas base: users, doctor_profiles, requests, payments, etc. |
| 4 | `supabase/migrations/20260221000002_incremental_features.sql` | Recursos incrementais (notifications, video_rooms, product_prices, etc.) |
| 5 | `supabase/migrations/20260221000003_add_correlation_id_to_logs.sql` | correlation_id em logs |
| 6 | `supabase/migrations/20260223000001_consultation_time_bank.sql` | Banco de horas: `consultation_time_bank`, `consultation_time_bank_transactions`, colunas em `requests` |
| 7 | `supabase/migrations/20260223000002_consultation_started_at.sql` | Colunas `consultation_started_at`, `doctor_call_connected_at`, `patient_call_connected_at` em `requests` |
| 8 | `supabase/migrations/20260224000100_add_correlation_id_to_verification_and_audit_logs.sql` | correlation_id em verification/audit |
| 9 | `supabase/migrations/20260224235900_harden_rls_and_function_search_path.sql` | RLS e search_path |

**Via CLI (recomendado):**

```bash
cd ola-jamal
supabase link --project-ref ifgxgppxsawauaceudec
supabase db push
```

**Via Dashboard:** em [Supabase](https://supabase.com/dashboard/project/ifgxgppxsawauaceudec/sql/new) → SQL Editor, abra e rode cada arquivo na ordem acima (se ainda não rodou).

---

## 2. Storage

- Bucket **`prescriptions`** deve existir e ser **privado**.
- Criado pela migration `20260219000002_storage_prescriptions_bucket.sql`.
- Se a migration de storage falhar, crie manualmente: **Storage** → **New bucket** → nome `prescriptions`, **Private**, limite 10 MB, MIME `application/pdf`.

---

## 3. Edge Function `verify`

Usada pela página de verificação (QR Code + código 6 dígitos) para gerar signed URL do PDF.

**Deploy:**

```bash
cd ola-jamal/supabase
supabase functions deploy verify --no-verify-jwt
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados pelo Supabase; não precisa configurar. Se a API de download usar outro domínio, configure o secret **API_BASE_URL** no Dashboard (Functions → verify → Secrets).

---

## 4. Como verificar se já está tudo aplicado

- **Migrations:** no Dashboard → **Database** → **Migrations** (ou rode `supabase db pull` e veja se há diferenças).
- **Bucket:** **Storage** → deve existir o bucket `prescriptions` (privado).
- **Edge Function:** **Edge Functions** → deve existir `verify` e estar deployada.

---

## 5. Resumo rápido

| O quê | Onde / Comando |
|-------|-----------------|
| Migrations | `supabase db push` ou rodar os 9 SQL na ordem no SQL Editor |
| Bucket `prescriptions` | Migration 20260219000002 ou criar manualmente (privado) |
| Edge Function verify | `supabase functions deploy verify --no-verify-jwt` |

Se algo já foi aplicado antes (ex.: schema base pelo backend), pode pular as migrations correspondentes; o importante é que **prescriptions**, **prescription_verification_logs**, **consultation_time_bank**, **consultation_started_at** em `requests` e a Edge Function **verify** estejam no projeto.
