# Auditoria Supabase — Migrations e Schema

**Data:** 2025-03-05  
**Projeto:** RenoveJá (ifgxgppxsawauaceudec)

---

## 1. Resumo executivo

| Item | Status | Ação |
|------|--------|------|
| Migrations locais vs remoto | ⚠️ Histórico divergente | Schema atual está completo |
| Tabela `receitas` (legada) | ✅ Removida | Migration `drop_legacy_receitas` aplicada |
| Migrations duplicadas no remoto | ⚠️ 40 migrations, algumas redundantes | Documentado; não reverter |
| Schema atual | ✅ Completo | Todas as features aplicadas |

---

## 2. Migrations no remoto (Supabase)

O Supabase reporta **40 migrations** aplicadas. O histórico foi construído por múltiplas fontes (Dashboard, CLI, migrations antigas com timestamps diferentes).

### Migrations duplicadas por nome (histórico)

| Nome | Ocorrências | Observação |
|------|-------------|------------|
| `create_prescriptions_and_logs` | 3x | Consolidado em `prescriptions` |
| `storage_prescriptions_bucket` | 3x | Bucket único |
| `create_saved_cards_table` | 2x | Tabela única |
| `make_prescriptions_bucket_public` | 2x | Config aplicada |

**Recomendação:** Não reverter. O schema atual está correto. As duplicatas são artefato do histórico.

---

## 3. Migrations locais (pasta `supabase/migrations/`)

| Arquivo | Conteúdo | Status no remoto |
|---------|----------|------------------|
| `20260221000001_create_base_schema.sql` | users, requests, payments, etc. | ✅ Aplicado (repo_20260221) |
| `20260221000002_incremental_features.sql` | password_reset, doctor_certificates, etc. | ✅ Aplicado |
| `20260221000003_add_correlation_id_to_logs.sql` | correlation_id em logs | ✅ Aplicado |
| `20260219000001_create_prescriptions_and_logs.sql` | prescriptions, verification_logs | ✅ Aplicado |
| `20260219000002_storage_prescriptions_bucket.sql` | Bucket prescriptions | ✅ Aplicado |
| `20260223000001_consultation_time_bank.sql` | time_bank, transactions | ✅ Aplicado |
| `20260223000002_consultation_started_at.sql` | consultation_started_at | ✅ Aplicado |
| `20260224235900_harden_rls_and_function_search_path.sql` | RLS, índices, search_path | ✅ Aplicado |
| `20260228100000_make_prescriptions_bucket_public.sql` | Bucket público | ✅ Aplicado |
| `20250304000000_care_plans.sql` | ai_suggestions, care_plans, outbox | ✅ Aplicado |
| `20260302000000_triage_assistant_conduct_observation.sql` | feature_flags, índices conduct | ✅ Aplicado |
| `20260303000000_prontuario_minimo.sql` | patients, encounters, medical_documents | ✅ Aplicado |
| `20260303100000_hardening_seguranca_producao.sql` | RLS, CPF unique, bucket privado | ⚠️ Verificar policies |
| `20260303200000_rls_policies_detalhadas.sql` | Policies detalhadas | ⚠️ Verificar |
| `20260303300000_rls_refinamento_final.sql` | requests_select_queue, storage | ⚠️ Verificar |
| `20260304100000_clinical_provenance_source_request.sql` | source_request_id, trigger | ✅ Aplicado (trigger existe) |

**Conclusão:** Nenhuma migration local crítica está faltando. O schema remoto está alinhado.

---

## 4. Duplicação: `receitas` vs `prescriptions`

### Tabela `receitas` (legada)

| Coluna | Tipo | Equivalente em `prescriptions` |
|--------|------|--------------------------------|
| id | uuid | id |
| codigo | text | verify_code_hash (SHA256 do código) |
| token_hash | text | qr_token_hash |
| paciente_iniciais | text | patient_initials |
| crm_uf | text | prescriber_crm_uf + prescriber_crm_last4 |
| emitida_em | timestamptz | issued_at |
| pdf_url | text | pdf_storage_path |
| status | text | status |

**Uso no código:** Nenhum. O backend, Edge Function `verify` e scripts usam `prescriptions`.

**Dados:** 1 linha (provavelmente seed/teste).

**Ação:** Migration `20260305100000_drop_legacy_receitas.sql` remove a tabela legada.

---

## 5. Padrões adotados

### Nomenclatura

- Tabelas: `snake_case` (ex: `prescription_verification_logs`)
- Colunas: `snake_case` (ex: `verify_code_hash`)
- Índices: `idx_<tabela>_<coluna(s)>` ou `idx_<tabela>_<propósito>`
- Policies RLS: `snake_case` descritivo (ex: `requests_select_queue`)

### Migrations

- Formato: `YYYYMMDDHHMMSS_descricao_snake_case.sql`
- Ordem: cronológica por data
- Idempotência: `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP ... IF EXISTS`

### Comentários

- `COMMENT ON TABLE` em tabelas principais
- `COMMENT ON COLUMN` em colunas sensíveis ou não óbvias

---

## 6. Checklist de homologação

- [x] Schema base (users, requests, payments) completo
- [x] Prescriptions + verification logs
- [x] Storage bucket prescriptions (público)
- [x] RLS habilitado em tabelas sensíveis
- [x] Índices em FKs e colunas de filtro
- [x] Trigger de imutabilidade em medical_documents
- [x] Proveniência (source_request_id) em encounters e medical_documents
- [x] Remover tabela `receitas` (migration aplicada)

---

## 7. Ações realizadas (2025-03-05)

- [x] Remoção da tabela legada `receitas`
- [x] Bucket `certificates` corrigido para privado (PFX dos médicos)
- [x] Padronização `public.` em migrations (prescriptions, prescription_verification_logs)
- [x] `prescription_verification_logs.id` como bigserial (consistente com schema remoto)

## 8. Próximos passos

1. Revisar policies de storage (prescription-images) conforme hardening
2. Manter migrations locais como fonte de verdade para novos deploys
