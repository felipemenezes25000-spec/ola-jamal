-- Campo de validade da receita para lembretes de renovação.
-- Receita simples = 30 dias; controlada = conforme portaria (default 30 por ora).
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS prescription_valid_days INTEGER DEFAULT 30;

COMMENT ON COLUMN public.requests.prescription_valid_days IS 'Dias de validade da receita a partir de signed_at. Usado para lembretes de renovação. Default 30.';
