# Migrations — Guia rápido

## Ordem de aplicação (cronológica)

As migrations em `supabase/migrations/` devem ser aplicadas na ordem do timestamp no nome do arquivo:

```
20250304000000_care_plans.sql
20260219000001_create_prescriptions_and_logs.sql
20260219000002_storage_prescriptions_bucket.sql
20260221000001_create_base_schema.sql
20260221000002_incremental_features.sql
20260221000003_add_correlation_id_to_logs.sql
20260223000001_consultation_time_bank.sql
20260223000002_consultation_started_at.sql
20260224235900_harden_rls_and_function_search_path.sql
20260228100000_make_prescriptions_bucket_public.sql
20260302000000_triage_assistant_conduct_observation.sql
20260303000000_prontuario_minimo.sql
20260303100000_hardening_seguranca_producao.sql
20260303200000_rls_policies_detalhadas.sql
20260303300000_rls_refinamento_final.sql
20260304100000_clinical_provenance_source_request.sql
20260305100000_drop_legacy_receitas.sql
20260305100001_fix_certificates_bucket_private.sql
```

## Padrões

- **Nomenclatura:** `YYYYMMDDHHMMSS_descricao_snake_case.sql`
- **Idempotência:** Use `IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP ... IF EXISTS`
- **Comentários:** `COMMENT ON TABLE` e `COMMENT ON COLUMN` em objetos principais

## Auditoria

Ver `AUDITORIA_MIGRATIONS_SCHEMA.md` para o relatório completo de auditoria e status do schema.
