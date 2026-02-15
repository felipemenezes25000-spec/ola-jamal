-- Colunas para resultado da leitura por IA (receita e pedido de exame).
-- Resumo para o médico, dados extraídos (JSON), risco/urgência, e mensagem quando imagem ilegível.
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS ai_summary_for_doctor TEXT,
  ADD COLUMN IF NOT EXISTS ai_extracted_json TEXT,
  ADD COLUMN IF NOT EXISTS ai_risk_level TEXT,
  ADD COLUMN IF NOT EXISTS ai_urgency TEXT,
  ADD COLUMN IF NOT EXISTS ai_readability_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS ai_message_to_user TEXT;

COMMENT ON COLUMN public.requests.ai_summary_for_doctor IS 'Resumo gerado pela IA para o médico (copiável para doc/PDF).';
COMMENT ON COLUMN public.requests.ai_readability_ok IS 'false = imagem ilegível; IA pede ao paciente enviar outra mais nítida.';
