-- ============================================================
-- Migration: tabela prescriptions para Verify v2 (QR Code).
-- Usada por PrescriptionVerifyRepository.
-- Aplicar em banco já existente. Idempotente.
-- Data: 2026-03-17
-- ============================================================

CREATE TABLE IF NOT EXISTS public.prescriptions (
    id UUID PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'active',
    issued_at TIMESTAMPTZ NOT NULL,
    issued_date_str TEXT NOT NULL DEFAULT '',
    patient_initials TEXT NOT NULL DEFAULT '',
    prescriber_crm_uf TEXT NOT NULL DEFAULT '',
    prescriber_crm_last4 TEXT NOT NULL DEFAULT '',
    verify_code_hash TEXT NOT NULL DEFAULT '',
    pdf_storage_path TEXT NOT NULL DEFAULT '',
    pdf_hash TEXT,
    dispensed_at TIMESTAMPTZ,
    dispensed_pharmacy TEXT,
    dispensed_pharmacist TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_verify_code_hash ON public.prescriptions(verify_code_hash) WHERE verify_code_hash != '';

SELECT 'Migration 20260317_prescriptions_verify_v2 aplicada.' AS result;
