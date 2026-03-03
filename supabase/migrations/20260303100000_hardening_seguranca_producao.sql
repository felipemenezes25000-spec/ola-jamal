-- ============================================================
-- RENOVEJÁ — Hardening de segurança para produção
-- Migração: 20260303100000_hardening_seguranca_producao.sql
-- ============================================================
-- APLICAR NO SUPABASE SQL EDITOR:
-- https://supabase.com/dashboard/project/SEU_PROJETO/sql/new
-- ============================================================

-- ============================================================
-- 1. RLS nas tabelas críticas do schema base
-- ============================================================

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.auth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.video_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctor_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.feature_flags ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. CHECK constraint no status de requests
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'requests_status_check'
  ) THEN
    ALTER TABLE public.requests ADD CONSTRAINT requests_status_check
      CHECK (status IN (
        'submitted', 'in_review', 'approved', 'approved_pending_payment',
        'payment_pending', 'paid', 'signed', 'delivered', 'rejected',
        'cancelled', 'expired', 'in_queue', 'in_consultation',
        'consultation_finished', 'awaiting_signature', 'reanalysis_requested'
      ));
  END IF;
END $$;

-- ============================================================
-- 3. UNIQUE constraints em CPF (com tratamento de duplicatas)
-- ============================================================

-- 3a. Limpar CPFs duplicados em users: manter o mais recente, anular os demais
UPDATE public.users
SET cpf = NULL
WHERE cpf IS NOT NULL AND cpf != ''
  AND id NOT IN (
    SELECT DISTINCT ON (cpf) id
    FROM public.users
    WHERE cpf IS NOT NULL AND cpf != ''
    ORDER BY cpf, created_at DESC NULLS LAST, id
  );

-- 3b. Limpar CPFs duplicados em patients: mesma lógica
UPDATE public.patients
SET cpf = NULL
WHERE cpf IS NOT NULL AND cpf != ''
  AND id NOT IN (
    SELECT DISTINCT ON (cpf) id
    FROM public.patients
    WHERE cpf IS NOT NULL AND cpf != ''
    ORDER BY cpf, created_at DESC NULLS LAST, id
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf_unique
  ON public.users(cpf) WHERE cpf IS NOT NULL AND cpf != '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_cpf_unique
  ON public.patients(cpf) WHERE cpf IS NOT NULL AND cpf != '';

-- ============================================================
-- 4. Tornar bucket prescription-images PRIVADO
-- ============================================================

UPDATE storage.buckets
  SET public = FALSE
  WHERE id = 'prescription-images';

-- ============================================================
-- 5. Trigger updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users', 'requests', 'payments', 'webhook_events',
      'payment_attempts', 'product_prices'
    ])
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'updated_at'
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I; '
        'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 6. Corrigir audit_events INSERT (restringir a service_role)
-- ============================================================

DROP POLICY IF EXISTS audit_events_insert_system ON public.audit_events;
CREATE POLICY audit_events_insert_own ON public.audit_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 7. Policies para médicos acessarem subtabelas clínicas
--    (só aplica se as tabelas existirem - prontuario_minimo)
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['patient_allergies', 'patient_conditions', 'patient_medications', 'patient_clinical_events']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        tbl || '_select_doctor', tbl
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (
          patient_id IN (
            SELECT p.id FROM public.patients p
            JOIN public.encounters e ON e.patient_id = p.id
            WHERE e.practitioner_id = auth.uid()
          )
        )',
        tbl || '_select_doctor', tbl
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 8. NOT NULL em webhook_events.created_at
-- ============================================================

ALTER TABLE IF EXISTS public.webhook_events
  ALTER COLUMN created_at SET NOT NULL;

-- ============================================================
-- 9. Storage policies para prescription-images (agora privado)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'prescription_images_select_authenticated'
  ) THEN
    CREATE POLICY prescription_images_select_authenticated ON storage.objects
      FOR SELECT USING (
        bucket_id = 'prescription-images' AND auth.role() = 'authenticated'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND policyname = 'prescription_images_insert_authenticated'
  ) THEN
    CREATE POLICY prescription_images_insert_authenticated ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'prescription-images' AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

-- ============================================================
-- 10. Remover índice redundante em prescriptions
-- ============================================================

DROP INDEX IF EXISTS public.prescriptions_id_idx;

-- ============================================================
-- FIM — Aplicar com: supabase db push ou via SQL Editor
-- ============================================================
