-- ============================================================
-- Migration: Banco de horas de consulta (minutos contratados)
-- Consultas por minuto: crédito de minutos não usados para uso futuro.
-- ============================================================

-- Campos em requests para suporte a consultas por minuto
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS consultation_type TEXT,
  ADD COLUMN IF NOT EXISTS contracted_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS price_per_minute DECIMAL(10,4);

-- Tabela de saldo por paciente e tipo de consulta
CREATE TABLE IF NOT EXISTS public.consultation_time_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  consultation_type TEXT NOT NULL,
  balance_seconds INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, consultation_type)
);

-- Log de movimentações (auditoria)
CREATE TABLE IF NOT EXISTS public.consultation_time_bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  request_id UUID REFERENCES public.requests(id),
  consultation_type TEXT NOT NULL,
  delta_seconds INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctbt_patient_type ON public.consultation_time_bank_transactions (patient_id, consultation_type);
CREATE INDEX IF NOT EXISTS idx_ctbt_request ON public.consultation_time_bank_transactions (request_id);

-- Preços por minuto (consulta psicólogo e médico clínico)
INSERT INTO public.product_prices (id, product_type, subtype, price_brl, name, is_active)
VALUES
  (gen_random_uuid(), 'consultation', 'psicologo', 3.99, 'Consulta Psicólogo (por minuto)', true),
  (gen_random_uuid(), 'consultation', 'medico_clinico', 6.99, 'Consulta Médico Clínico (por minuto)', true)
ON CONFLICT (product_type, subtype) DO NOTHING;
