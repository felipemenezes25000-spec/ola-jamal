-- ============================================================================
-- RenoveJá+ Migration: 20260302_triage_assistant_conduct_observation
-- 
-- Adds: auto_observation, doctor_conduct_notes, conduct audit columns
-- Safety: all nullable, zero impact on existing rows
-- ============================================================================

BEGIN;

-- ── 1. Conduct + Observation fields ─────────────────────────────────────────
ALTER TABLE requests ADD COLUMN IF NOT EXISTS auto_observation         TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS doctor_conduct_notes     TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS include_conduct_in_pdf   BOOLEAN DEFAULT TRUE;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS ai_conduct_suggestion    TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS ai_suggested_exams       TEXT;   -- JSON array string
ALTER TABLE requests ADD COLUMN IF NOT EXISTS conduct_updated_at       TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS conduct_updated_by       UUID REFERENCES auth.users(id);

-- ── 2. Triage feature flag (global, per-environment) ────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  key   TEXT PRIMARY KEY,
  value BOOLEAN NOT NULL DEFAULT TRUE,
  note  TEXT
);
INSERT INTO feature_flags (key, value, note) 
VALUES ('triage_assistant_enabled', true, 'Habilita/desabilita assistente IA Dra. Renova')
ON CONFLICT (key) DO NOTHING;

-- ── 3. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_requests_has_conduct 
  ON requests (doctor_conduct_notes) WHERE doctor_conduct_notes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_conduct_audit 
  ON requests (conduct_updated_by, conduct_updated_at) WHERE conduct_updated_at IS NOT NULL;

-- ── 4. Comments ─────────────────────────────────────────────────────────────
COMMENT ON COLUMN requests.auto_observation       IS 'Observação orientativa gerada automaticamente na criação (readonly para UI)';
COMMENT ON COLUMN requests.doctor_conduct_notes   IS 'Conduta médica registrada pelo médico (recomendações clínicas)';
COMMENT ON COLUMN requests.include_conduct_in_pdf IS 'Se true, conduta aparece no PDF assinado';
COMMENT ON COLUMN requests.ai_conduct_suggestion  IS 'Sugestão de conduta da IA (médico pode aceitar/editar/ignorar)';
COMMENT ON COLUMN requests.ai_suggested_exams     IS 'Exames complementares sugeridos pela IA (JSON string[])';
COMMENT ON COLUMN requests.conduct_updated_at     IS 'Última atualização da conduta (audit trail)';
COMMENT ON COLUMN requests.conduct_updated_by     IS 'Médico que atualizou a conduta (audit trail)';

COMMIT;
