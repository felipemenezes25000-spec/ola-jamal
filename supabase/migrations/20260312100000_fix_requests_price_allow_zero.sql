-- Fix: requests_price_positive rejeitava price=0 (consultas gratuitas via banco de horas).
-- Relaxa a constraint para permitir NULL e 0, mantendo rejeição de valores negativos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'requests'
      AND constraint_name = 'requests_price_positive'
  ) THEN
    ALTER TABLE public.requests DROP CONSTRAINT requests_price_positive;
  END IF;
END $$;

ALTER TABLE public.requests
  ADD CONSTRAINT requests_price_positive
  CHECK (price IS NULL OR price >= 0);

COMMENT ON CONSTRAINT requests_price_positive ON public.requests
  IS 'Preço deve ser NULL (não definido) ou >= 0. Permite 0 para consultas gratuitas (banco de horas).';
