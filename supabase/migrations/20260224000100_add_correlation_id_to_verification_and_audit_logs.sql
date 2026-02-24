-- ============================================================
-- Migration: Correlation ID em logs de verificação e auditoria
-- Sincroniza schema com rastreabilidade ponta-a-ponta.
-- ============================================================

ALTER TABLE public.prescription_verification_logs
    ADD COLUMN IF NOT EXISTS correlation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_prescription_verification_logs_correlation_id
    ON public.prescription_verification_logs(correlation_id)
    WHERE correlation_id IS NOT NULL;

COMMENT ON COLUMN public.prescription_verification_logs.correlation_id IS
    'ID de correlação propagado pelo cliente (X-Correlation-Id header) para rastreamento ponta-a-ponta.';

ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS correlation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id
    ON public.audit_logs(correlation_id)
    WHERE correlation_id IS NOT NULL;

COMMENT ON COLUMN public.audit_logs.correlation_id IS
    'ID de correlação da requisição (X-Correlation-Id) para cruzar logs do backend com logs de auditoria.';
