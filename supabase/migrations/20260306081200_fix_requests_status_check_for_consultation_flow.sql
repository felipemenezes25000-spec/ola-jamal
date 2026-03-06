-- ============================================================
-- FIX: requests_status_check alinhado ao fluxo canônico atual
-- Data: 2026-03-06
-- Motivo:
--   A constraint anterior não aceitava `searching_doctor` (status inicial de consulta)
--   e podia quebrar criação/transição de consultas.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'requests'
      AND constraint_name = 'requests_status_check'
      AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.requests DROP CONSTRAINT requests_status_check;
  END IF;
END $$;

ALTER TABLE public.requests
  ADD CONSTRAINT requests_status_check
  CHECK (status IN (
    -- canônicos atuais
    'submitted',
    'in_review',
    'approved_pending_payment',
    'paid',
    'signed',
    'delivered',
    'rejected',
    'cancelled',
    'searching_doctor',
    'in_consultation',
    'consultation_finished',

    -- legados/compatibilidade histórica
    'pending',
    'analyzing',
    'approved',
    'pending_payment',
    'payment_pending',
    'in_queue',
    'consultation_ready',
    'awaiting_signature',
    'reanalysis_requested',
    'completed',
    'expired'
  ));
