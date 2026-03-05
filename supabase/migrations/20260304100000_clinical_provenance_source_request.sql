-- RENOVEJÁ — Proveniência clínica e idempotência
-- Adiciona source_request_id em encounters e medical_documents para rastreabilidade
-- Adiciona metadados de assinatura no documento clínico (signed_document_url, signature_id)
-- Reforça imutabilidade pós-assinatura via trigger

-- --------------------------------------------------------
-- 1. ENCOUNTERS: source_request_id
-- --------------------------------------------------------
ALTER TABLE public.encounters
ADD COLUMN IF NOT EXISTS source_request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_encounters_source_request_id
ON public.encounters(source_request_id) WHERE source_request_id IS NOT NULL;

COMMENT ON COLUMN public.encounters.source_request_id IS 'Request comercial que originou este encounter (rastreabilidade).';

-- --------------------------------------------------------
-- 2. MEDICAL_DOCUMENTS: source_request_id + metadados assinatura
-- --------------------------------------------------------
ALTER TABLE public.medical_documents
ADD COLUMN IF NOT EXISTS source_request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL;

ALTER TABLE public.medical_documents
ADD COLUMN IF NOT EXISTS signed_document_url TEXT;

ALTER TABLE public.medical_documents
ADD COLUMN IF NOT EXISTS signature_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_medical_documents_source_request_unique
ON public.medical_documents(source_request_id, document_type)
WHERE source_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_medical_documents_source_request_id
ON public.medical_documents(source_request_id) WHERE source_request_id IS NOT NULL;

COMMENT ON COLUMN public.medical_documents.source_request_id IS 'Request comercial que originou este documento (rastreabilidade, idempotência).';
COMMENT ON COLUMN public.medical_documents.signed_document_url IS 'URL do PDF assinado (storage ou tokenizado).';
COMMENT ON COLUMN public.medical_documents.signature_id IS 'ID da assinatura digital (ICP-Brasil).';

-- --------------------------------------------------------
-- 3. TRIGGER: imutabilidade pós-assinatura em medical_documents
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_signed_medical_document_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'signed' THEN
        -- Permitir apenas atualizações de metadados não-clínicos (ex: signed_document_url se ainda null)
        IF (NEW.medications IS DISTINCT FROM OLD.medications)
           OR (NEW.exams IS DISTINCT FROM OLD.exams)
           OR (NEW.report_body IS DISTINCT FROM OLD.report_body)
           OR (NEW.clinical_justification IS DISTINCT FROM OLD.clinical_justification)
           OR (NEW.priority IS DISTINCT FROM OLD.priority)
           OR (NEW.icd10_code IS DISTINCT FROM OLD.icd10_code)
           OR (NEW.leave_days IS DISTINCT FROM OLD.leave_days)
           OR (NEW.general_instructions IS DISTINCT FROM OLD.general_instructions)
           OR (NEW.signature_hash IS DISTINCT FROM OLD.signature_hash)
           OR (NEW.signature_algorithm IS DISTINCT FROM OLD.signature_algorithm)
           OR (NEW.signature_certificate IS DISTINCT FROM OLD.signature_certificate)
           OR (NEW.signed_at IS DISTINCT FROM OLD.signed_at)
           OR (NEW.signature_is_valid IS DISTINCT FROM OLD.signature_is_valid)
           OR (NEW.signature_validation_result IS DISTINCT FROM OLD.signature_validation_result)
           OR (NEW.signature_policy_oid IS DISTINCT FROM OLD.signature_policy_oid)
           OR (OLD.signed_document_url IS NOT NULL AND (NEW.signed_document_url IS DISTINCT FROM OLD.signed_document_url))
           OR (OLD.signature_id IS NOT NULL AND (NEW.signature_id IS DISTINCT FROM OLD.signature_id))
           OR (OLD.source_request_id IS NOT NULL AND (NEW.source_request_id IS DISTINCT FROM OLD.source_request_id)) THEN
            RAISE EXCEPTION 'Documento clínico assinado não pode ser alterado. Status: signed.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_signed_medical_document_mutation ON public.medical_documents;
CREATE TRIGGER trg_prevent_signed_medical_document_mutation
    BEFORE UPDATE ON public.medical_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_signed_medical_document_mutation();
