-- ============================================================================
-- RENOVEJÁ — SQL para rodar no Supabase
-- Copie e cole no SQL Editor: https://supabase.com/dashboard → seu projeto → SQL Editor → New query
-- Pode rodar mais de uma vez: usa IF NOT EXISTS / ON CONFLICT, sem quebrar o que já existe.
-- ============================================================================

-- ── 1. Triagem + Conduta (Dra. Renova) ─────────────────────────────────────
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS auto_observation         TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS doctor_conduct_notes     TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS include_conduct_in_pdf   BOOLEAN DEFAULT TRUE;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS ai_conduct_suggestion    TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS ai_suggested_exams        TEXT;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS conduct_updated_at       TIMESTAMPTZ;
-- Se no seu projeto usuários ficam em auth.users, troque para: REFERENCES auth.users(id)
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS conduct_updated_by       UUID REFERENCES public.users(id);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key   TEXT PRIMARY KEY,
  value BOOLEAN NOT NULL DEFAULT TRUE,
  note  TEXT
);
INSERT INTO public.feature_flags (key, value, note)
VALUES ('triage_assistant_enabled', true, 'Assistente Dra. Renova')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_requests_has_conduct
  ON public.requests (doctor_conduct_notes) WHERE doctor_conduct_notes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_conduct_audit
  ON public.requests (conduct_updated_by, conduct_updated_at) WHERE conduct_updated_at IS NOT NULL;

COMMENT ON COLUMN public.requests.auto_observation       IS 'Observação orientativa gerada na criação';
COMMENT ON COLUMN public.requests.doctor_conduct_notes     IS 'Conduta médica registrada pelo médico';
COMMENT ON COLUMN public.requests.include_conduct_in_pdf  IS 'Se true, conduta vai no PDF';
COMMENT ON COLUMN public.requests.ai_conduct_suggestion    IS 'Sugestão de conduta da IA';
COMMENT ON COLUMN public.requests.ai_suggested_exams       IS 'Exames sugeridos pela IA (JSON array)';
COMMENT ON COLUMN public.requests.conduct_updated_at       IS 'Última atualização da conduta';
COMMENT ON COLUMN public.requests.conduct_updated_by      IS 'Médico que atualizou a conduta';
