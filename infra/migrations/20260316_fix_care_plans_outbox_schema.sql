-- ============================================================
-- Migration: Corrige schema care_plans e outbox_events para
-- alinhar com MigrationRunner (evita erros 42703 nos logs).
-- Idempotente: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
-- Data: 2026-03-16
-- ============================================================

-- ----- care_plans: garante patient_id e índices -----
ALTER TABLE public.care_plans ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- Backfill patient_id: consultation_id -> requests.patient_id
UPDATE public.care_plans cp
SET patient_id = r.patient_id
FROM public.requests r
WHERE cp.consultation_id = r.id
  AND cp.patient_id IS NULL;

-- Backfill patient_id: encounter_id -> encounters.patient_id (se coluna existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'care_plans' AND column_name = 'encounter_id'
  ) THEN
    UPDATE public.care_plans cp
    SET patient_id = e.patient_id
    FROM public.encounters e
    WHERE cp.encounter_id = e.id AND cp.patient_id IS NULL;
  END IF;
END $$;

-- Índices (IF NOT EXISTS evita erro se já existirem)
CREATE INDEX IF NOT EXISTS idx_care_plans_patient_id ON public.care_plans(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_care_plans_consultation_id ON public.care_plans(consultation_id) WHERE consultation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_care_plans_responsible_doctor_id ON public.care_plans(responsible_doctor_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status ON public.care_plans(status);

-- ----- outbox_events: garante colunas esperadas pelo OutboxEventRepository -----
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS aggregate_type TEXT DEFAULT 'legacy';
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS aggregate_id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS payload_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.outbox_events ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Backfill: payload_json a partir de payload (se coluna payload existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'outbox_events' AND column_name = 'payload'
  ) THEN
    UPDATE public.outbox_events SET payload_json = payload WHERE payload_json IS NULL OR payload_json = '{}'::jsonb;
  END IF;
END $$;

-- Backfill idempotency_key para linhas existentes
UPDATE public.outbox_events SET idempotency_key = gen_random_uuid()::text WHERE idempotency_key IS NULL OR idempotency_key = '';

-- Garantir NOT NULL para novas inserções (após backfill)
ALTER TABLE public.outbox_events ALTER COLUMN idempotency_key SET DEFAULT gen_random_uuid()::text;

-- Índices (após backfill, idempotency_key deve ser único)
CREATE UNIQUE INDEX IF NOT EXISTS ux_outbox_events_idempotency_key ON public.outbox_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created_at ON public.outbox_events(status, created_at);

SELECT 'Migration 20260316_fix_care_plans_outbox_schema aplicada.' AS result;
