-- Adiciona coluna para CRF (Conselho Regional de Farmácia) do farmacêutico na dispensação.
-- Corrige uso incorreto de CRM (que é exclusivo de médicos) para CRF.
ALTER TABLE public.prescriptions
    ADD COLUMN IF NOT EXISTS dispensed_pharmacist_crf TEXT;
