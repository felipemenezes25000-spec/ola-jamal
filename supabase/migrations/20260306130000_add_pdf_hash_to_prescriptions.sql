-- pdf_hash: SHA256 do PDF assinado para prova de integridade (conformidade jurídica)
-- Permite verificar que o documento não foi alterado após assinatura

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS pdf_hash text;

CREATE INDEX IF NOT EXISTS idx_prescriptions_pdf_hash
  ON public.prescriptions(pdf_hash) WHERE pdf_hash IS NOT NULL;

COMMENT ON COLUMN public.prescriptions.pdf_hash IS 'SHA256 (hex) do conteúdo do PDF assinado. Prova de integridade para auditoria.';
