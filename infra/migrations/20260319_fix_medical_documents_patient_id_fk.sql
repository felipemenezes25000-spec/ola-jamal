-- ============================================================
-- Migration: Corrige FK medical_documents.patient_id
-- medical_documents.patient_id deve referenciar patients(id), não users(id).
-- Igual à correção feita em encounters.patient_id.
-- Data: 2026-03-19
-- ============================================================

-- 1. Remover FK incorreta (se existir) — pode ser qualquer nome
DO $$
DECLARE
    fk_name TEXT;
BEGIN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'public.medical_documents'::regclass
      AND contype = 'f'
      AND conname LIKE '%patient_id%';
    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.medical_documents DROP CONSTRAINT %I', fk_name);
        RAISE NOTICE 'Dropped FK %', fk_name;
    END IF;
END $$;

-- 2. Corrigir dados: medical_documents com user_id em patient_id → patients.id
UPDATE public.medical_documents md
SET patient_id = p.id
FROM public.patients p
WHERE md.patient_id = p.user_id
  AND md.patient_id != p.id
  AND NOT EXISTS (SELECT 1 FROM public.patients px WHERE px.id = md.patient_id);

-- 3. Recriar FK correta: medical_documents.patient_id → patients(id)
ALTER TABLE public.medical_documents
  ADD CONSTRAINT medical_documents_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

SELECT 'Migration 20260319_fix_medical_documents_patient_id_fk aplicada.' AS result;
