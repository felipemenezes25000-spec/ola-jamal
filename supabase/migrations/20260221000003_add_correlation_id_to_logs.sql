-- ============================================================
-- Migration: Adiciona correlation_id nas tabelas de log
-- Permite rastrear requisição ponta-a-ponta:
--   App Mobile → Backend .NET → Supabase Edge Function
-- ============================================================

-- Adiciona correlation_id à tabela de logs de verificação de prescrições
ALTER TABLE public.prescription_verification_logs
    ADD COLUMN IF NOT EXISTS correlation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_prescription_verification_logs_correlation_id
    ON public.prescription_verification_logs(correlation_id)
    WHERE correlation_id IS NOT NULL;

COMMENT ON COLUMN public.prescription_verification_logs.correlation_id IS
    'ID de correlação propagado pelo cliente (X-Correlation-Id header) para rastreamento ponta-a-ponta.';

-- Adiciona correlation_id ao audit_logs (se ainda não tiver, para rastreamento de requisições autenticadas)
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS correlation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id
    ON public.audit_logs(correlation_id)
    WHERE correlation_id IS NOT NULL;

COMMENT ON COLUMN public.audit_logs.correlation_id IS
    'ID de correlação da requisição (X-Correlation-Id) para cruzar logs do backend com logs de auditoria.';
