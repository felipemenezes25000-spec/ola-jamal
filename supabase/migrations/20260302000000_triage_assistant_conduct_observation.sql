-- ============================================================================
-- RenoveJá+ Migration: triage_assistant_conduct_observation
-- 
-- Adds: auto_observation, doctor_conduct_notes, conduct audit columns
-- Safety: all nullable, zero impact on existing rows
-- ============================================================================

-- ── 1. Conduct + Observation fields ─────────────────────────────────────────
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS auto_observation         TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS doctor_conduct_notes     TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS include_conduct_in_pdf   BOOLEAN DEFAULT TRUE;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS ai_conduct_suggestion    TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS ai_suggested_exams        TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS conduct_updated_at       TIMESTAMPTZ;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS conduct_updated_by       UUID REFERENCES public.users(id);

-- ── 2. Triage feature flag (global, per-environment) ────────────────────────
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key   TEXT PRIMARY KEY,
  value BOOLEAN NOT NULL DEFAULT TRUE,
  note  TEXT
);
INSERT INTO public.feature_flags (key, value, note) 
VALUES ('triage_assistant_enabled', true, 'Habilita/desabilita assistente IA Dra. Renova')
ON CONFLICT (key) DO NOTHING;

-- ── 3. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_requests_has_conduct 
  ON public.requests (doctor_conduct_notes) WHERE doctor_conduct_notes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_conduct_audit 
  ON public.requests (conduct_updated_by, conduct_updated_at) WHERE conduct_updated_at IS NOT NULL;

-- ── 4. Comments ─────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.requests.auto_observation       IS 'Observação orientativa gerada automaticamente na criação (readonly para UI)';
COMMENT ON COLUMN public.requests.doctor_conduct_notes   IS 'Conduta médica registrada pelo médico (recomendações clínicas)';
COMMENT ON COLUMN public.requests.include_conduct_in_pdf IS 'Se true, conduta aparece no PDF assinado';
COMMENT ON COLUMN public.requests.ai_conduct_suggestion  IS 'Sugestão de conduta da IA (médico pode aceitar/editar/ignorar)';
COMMENT ON COLUMN public.requests.ai_suggested_exams     IS 'Exames complementares sugeridos pela IA (JSON string[])';
COMMENT ON COLUMN public.requests.conduct_updated_at    IS 'Última atualização da conduta (audit trail)';
COMMENT ON COLUMN public.requests.conduct_updated_by    IS 'Médico que atualizou a conduta (audit trail)';
