-- ============================================================
-- Migration: Corrige FK encounters.patient_id (23503)
-- encounters.patient_id deve referenciar patients(id), não users(id).
-- Data: 2026-03-19
-- ============================================================

-- 1. Remover FK incorreta (se existir)
ALTER TABLE public.encounters DROP CONSTRAINT IF EXISTS encounters_patient_id_fkey;

-- 2. Corrigir dados: encounters com user_id em patient_id → patients.id
UPDATE public.encounters e
SET patient_id = p.id
FROM public.patients p
WHERE e.patient_id = p.user_id
  AND e.patient_id != p.id
  AND NOT EXISTS (SELECT 1 FROM public.patients px WHERE px.id = e.patient_id);

-- 3. Recriar FK correta: encounters.patient_id → patients(id)
ALTER TABLE public.encounters
  ADD CONSTRAINT encounters_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;

-- 4. Corrigir medical_documents que herdaram patient_id errado
UPDATE public.medical_documents md
SET patient_id = p.id
FROM public.patients p
WHERE md.patient_id = p.user_id
  AND md.patient_id != p.id
  AND NOT EXISTS (SELECT 1 FROM public.patients px WHERE px.id = md.patient_id);

SELECT 'Migration 20260319_fix_encounters_patient_id_fk aplicada.' AS result;
