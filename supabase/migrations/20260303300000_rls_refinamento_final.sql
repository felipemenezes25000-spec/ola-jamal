-- ============================================================
-- RENOVEJÁ+ — Refinamento final de RLS e integridade
-- Migração: 20260303300000_rls_refinamento_final.sql
-- ============================================================

-- 1. Restringir requests_select_queue a médicos
-- DROP a policy que permite qualquer autenticado ver a fila
DROP POLICY IF EXISTS requests_select_queue ON public.requests;

CREATE POLICY requests_select_queue ON public.requests
  FOR SELECT USING (
    doctor_id IS NULL
    AND status IN ('submitted', 'in_queue', 'in_review')
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'doctor'
    )
  );

-- 2. Refinar storage prescription-images para ownership
-- Remover policies genéricas e criar por ownership
DROP POLICY IF EXISTS "prescription_images_select" ON storage.objects;
DROP POLICY IF EXISTS "prescription_images_insert" ON storage.objects;

CREATE POLICY prescription_images_select_own ON storage.objects
  FOR SELECT USING (
    bucket_id = 'prescription-images'
    AND (
      -- Paciente que fez upload
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      -- Médico que atende o request
      EXISTS (
        SELECT 1 FROM public.requests r
        WHERE r.doctor_id = auth.uid()
        AND (storage.foldername(name))[1] = r.patient_id::text
      )
    )
  );

CREATE POLICY prescription_images_insert_own ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'prescription-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Triggers updated_at para tabelas clínicas
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- Adicionar coluna updated_at onde não existe e trigger (apenas em tabelas existentes)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'patients', 'encounters', 'medical_documents', 
    'consent_records'
  ]) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()',
        tbl
      );
      EXECUTE format(
        'DROP TRIGGER IF EXISTS set_updated_at ON public.%I',
        tbl
      );
      EXECUTE format(
        'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- 4. Policies para subtabelas clínicas UPDATE/DELETE (apenas em tabelas existentes)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'patient_allergies', 'patient_conditions', 'patient_medications',
    'patient_clinical_events', 'patient_procedures', 'patient_family_history',
    'patient_social_history', 'patient_vital_signs', 'encounter_diagnoses',
    'encounter_prescriptions', 'encounter_procedures_performed', 'encounter_notes'
  ]) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        tbl || '_update_doctor', tbl
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''doctor''
          )
        )',
        tbl || '_update_doctor', tbl
      );
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        tbl || '_delete_doctor', tbl
      );
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE USING (
          EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''doctor''
          )
        )',
        tbl || '_delete_doctor', tbl
      );
    END IF;
  END LOOP;
END $$;

-- 5. Restringir doctor_profiles_select_all a campos não-sensíveis
-- (Como não podemos controlar colunas via RLS, documentar que views devem ser usadas)
-- Criar VIEW segura para perfis de médicos visíveis publicamente
CREATE OR REPLACE VIEW public.doctor_profiles_public AS
SELECT 
  dp.id,
  dp.user_id,
  u.name AS doctor_name,
  dp.crm,
  dp.specialty,
  dp.created_at
FROM public.doctor_profiles dp
JOIN public.users u ON u.id = dp.user_id;

GRANT SELECT ON public.doctor_profiles_public TO authenticated, anon;

-- ============================================================
-- FIM
-- ============================================================
