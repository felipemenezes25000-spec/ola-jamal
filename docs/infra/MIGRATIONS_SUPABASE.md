# Validação das migrations no Supabase

Este documento lista todas as migrations do projeto na **ordem em que devem ser aplicadas** e como conferir se o Supabase está de acordo.

---

## Ordem das migrations (`supabase/migrations/`)

| Ordem | Arquivo | Conteúdo resumido |
|-------|---------|-------------------|
| 1 | `20260219000001_create_prescriptions_and_logs.sql` | Tabelas `prescriptions`, `prescription_verification_logs` (verificação pública) |
| 2 | `20260219000002_storage_prescriptions_bucket.sql` | Bucket de storage para prescrições |
| 3 | `20260221000001_create_base_schema.sql` | `users`, `auth_tokens`, `doctor_profiles`, `requests`, `payments`, `chat_messages`, `saved_cards`, buckets |
| 4 | `20260221000002_incremental_features.sql` | `password_reset_tokens`, `doctor_certificates`, `audit_logs`, `notifications`, `video_rooms`, `consultation_anamnesis`, `push_tokens`, `product_prices`, `payment_attempts`, `webhook_events`; colunas em `doctor_profiles` |
| 5 | `20260221000003_add_correlation_id_to_logs.sql` | `correlation_id` em prescription_verification_logs e audit_logs |
| 6 | `20260223000001_consultation_time_bank.sql` | Colunas em `requests` (consultation_type, contracted_minutes, price_per_minute); tabelas `consultation_time_bank`, `consultation_time_bank_transactions` |
| 7 | `20260223000002_consultation_started_at.sql` | Colunas em `requests`: consultation_started_at, doctor_call_connected_at, patient_call_connected_at |
| 8 | `20260224000100_add_correlation_id_to_verification_and_audit_logs.sql` | correlation_id (repetido/garantido) em verification e audit logs |
| 9 | `20260224235900_harden_rls_and_function_search_path.sql` | RLS em várias tabelas; índices de FK |
| 10 | `20260228100000_make_prescriptions_bucket_public.sql` | Ajuste de visibilidade do bucket prescriptions |
| 11 | `20260302000000_triage_assistant_conduct_observation.sql` | Colunas em `requests`: auto_observation, doctor_conduct_notes, include_conduct_in_pdf, ai_conduct_suggestion, ai_suggested_exams, conduct_updated_at, conduct_updated_by; tabela `feature_flags` |

---

## Como validar no Supabase

1. Abra o **SQL Editor** do seu projeto:  
   https://supabase.com/dashboard/project/ifgxgppxsawauaceudec/sql/new

2. Cole e execute o script:  
   **`supabase/VALIDAR_MIGRATIONS.sql`**

3. Veja o resultado:
   - **OK** = tabela ou coluna existe.
   - **FALTANDO** = aplique a migration correspondente (ou o `pending_migrations.sql`).

---

## Se algo estiver FALTANDO

- **Opção A (recomendada):** Rodar as migrations na ordem acima via `supabase db push` (CLI) ou aplicando cada arquivo em `supabase/migrations/` manualmente no SQL Editor.

- **Opção B:** Usar o bloco único de fallback:  
  **`backend-dotnet/docs/migrations/pending_migrations.sql`**  
  Ele inclui: doctor_certificates, colunas em doctor_profiles, access_code em requests, e o bloco 4 (triagem + conduta). Não substitui as migrations 1–10; use só para itens que ainda não existirem.

- **Triagem + conduta (Dra. Renova):** Se só as colunas de conduta/observação e `feature_flags` faltarem, execute:  
  **`supabase/SUBIR_NO_SUPABASE.sql`**

---

## Resumo

| O quê | Onde está |
|-------|------------|
| Lista ordenada de migrations | Este arquivo (tabela acima) |
| Script de validação (rodar no Supabase) | `supabase/VALIDAR_MIGRATIONS.sql` |
| Fallback manual (certificados + triagem/conduta) | `backend-dotnet/docs/migrations/pending_migrations.sql` |
| Só triagem + conduta | `supabase/SUBIR_NO_SUPABASE.sql` |
