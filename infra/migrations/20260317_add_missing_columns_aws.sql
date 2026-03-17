-- ============================================================
-- Migration: Adiciona colunas faltantes na AWS (vs infra/schema.sql)
-- Data: 2026-03-17
-- Rodar no RDS: psql ... -f 20260317_add_missing_columns_aws.sql
-- ============================================================

-- ai_interaction_logs: provider e model (schema esperado)
ALTER TABLE public.ai_interaction_logs ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.ai_interaction_logs ADD COLUMN IF NOT EXISTS model TEXT;

-- consultation_time_bank: balance_minutes e updated_at
ALTER TABLE public.consultation_time_bank ADD COLUMN IF NOT EXISTS balance_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.consultation_time_bank ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill balance_minutes a partir de balance_seconds se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'consultation_time_bank' AND column_name = 'balance_seconds'
  ) THEN
    UPDATE public.consultation_time_bank SET balance_minutes = COALESCE(balance_seconds / 60, 0) WHERE balance_minutes = 0;
  END IF;
END $$;

-- consultation_time_bank_transactions: bank_id e delta_minutes
ALTER TABLE public.consultation_time_bank_transactions ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES public.consultation_time_bank(id) ON DELETE CASCADE;
ALTER TABLE public.consultation_time_bank_transactions ADD COLUMN IF NOT EXISTS delta_minutes INTEGER;

-- Backfill bank_id e delta_minutes se existirem patient_id/delta_seconds (estrutura alternativa)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'consultation_time_bank_transactions' AND column_name = 'delta_seconds'
  ) THEN
    UPDATE public.consultation_time_bank_transactions SET delta_minutes = COALESCE(delta_seconds / 60, 0) WHERE delta_minutes IS NULL;
  END IF;
END $$;

-- doctor_patient_notes: content e request_id
ALTER TABLE public.doctor_patient_notes ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.doctor_patient_notes ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL;

-- Backfill content a partir de note_text se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'doctor_patient_notes' AND column_name = 'note_text'
  ) THEN
    UPDATE public.doctor_patient_notes SET content = note_text WHERE content IS NULL AND note_text IS NOT NULL;
  END IF;
END $$;

-- Índices para as novas colunas (se fizerem sentido)
CREATE INDEX IF NOT EXISTS idx_ctb_transactions_bank_id ON public.consultation_time_bank_transactions(bank_id) WHERE bank_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doctor_patient_notes_request_id ON public.doctor_patient_notes(request_id) WHERE request_id IS NOT NULL;

-- Trigger updated_at em consultation_time_bank (se não existir)
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_consultation_time_bank') THEN
    CREATE TRIGGER set_updated_at_consultation_time_bank BEFORE UPDATE ON public.consultation_time_bank FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
END $$;
