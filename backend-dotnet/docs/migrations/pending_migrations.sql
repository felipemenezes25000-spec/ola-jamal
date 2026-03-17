-- ============================================================
-- MIGRATIONS PENDENTES - RenoveJá
-- Rodar no PostgreSQL (AWS RDS ou local). Migrations oficiais em infra/migrations/.
-- Data: 2026-02-14
-- ============================================================

-- 1) Tabela doctor_certificates (NÃO existe no banco)
CREATE TABLE IF NOT EXISTS public.doctor_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_profile_id UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    issuer_name TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    not_before TIMESTAMPTZ NOT NULL,
    not_after TIMESTAMPTZ NOT NULL,
    pfx_storage_path TEXT NOT NULL,
    pfx_file_name TEXT NOT NULL,
    cpf TEXT,
    crm_number TEXT,
    is_valid BOOLEAN NOT NULL DEFAULT true,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    validated_at_registration BOOLEAN NOT NULL DEFAULT false,
    last_validation_date TIMESTAMPTZ,
    last_validation_result TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    uploaded_by_ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doctor_certificates_doctor ON public.doctor_certificates(doctor_profile_id);
CREATE INDEX IF NOT EXISTS idx_doctor_certificates_valid ON public.doctor_certificates(is_valid, is_revoked);
CREATE INDEX IF NOT EXISTS idx_doctor_certificates_not_after ON public.doctor_certificates(not_after);

-- 2) Colunas novas em doctor_profiles
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS active_certificate_id UUID REFERENCES public.doctor_certificates(id);
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS crm_validated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS crm_validated_at TIMESTAMPTZ;

-- 3) Coluna access_code em requests
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS access_code TEXT;

-- 4) Triagem + Conduta (Dra. Renova) — observação automática, conduta médica, IA
-- Se já rodou a migration de triagem/conduta, pule este bloco.
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS auto_observation         TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS doctor_conduct_notes     TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS include_conduct_in_pdf   BOOLEAN DEFAULT TRUE;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS ai_conduct_suggestion   TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS ai_suggested_exams      TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS conduct_updated_at     TIMESTAMPTZ;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS conduct_updated_by      UUID REFERENCES public.users(id);
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key   TEXT PRIMARY KEY,
  value BOOLEAN NOT NULL DEFAULT TRUE,
  note  TEXT
);
INSERT INTO public.feature_flags (key, value, note)
VALUES ('triage_assistant_enabled', true, 'Assistente Dra. Renova')
ON CONFLICT (key) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_requests_has_conduct ON public.requests (doctor_conduct_notes) WHERE doctor_conduct_notes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_conduct_audit ON public.requests (conduct_updated_by, conduct_updated_at) WHERE conduct_updated_at IS NOT NULL;

-- ============================================================
-- FIM
-- ============================================================
