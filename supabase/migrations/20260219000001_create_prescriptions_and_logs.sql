-- RenoveJá+ Verification: prescriptions and verification logs
-- Run in Supabase SQL Editor or via supabase db push

-- =============================================
-- TABLE: prescriptions
-- =============================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_date_str text,
  patient_initials text,
  prescriber_crm_uf text,
  prescriber_crm_last4 text,
  verify_code_hash text NOT NULL,
  qr_token_hash text,
  qr_token_expires_at timestamptz,
  pdf_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_id_idx ON prescriptions (id);

COMMENT ON TABLE prescriptions IS 'Prescrições médicas para verificação pública por código e/ou QR';
COMMENT ON COLUMN prescriptions.verify_code_hash IS 'SHA256 do código de 6 dígitos';
COMMENT ON COLUMN prescriptions.qr_token_hash IS 'SHA256 do token v do QR (?v=...)';
COMMENT ON COLUMN prescriptions.pdf_storage_path IS 'Caminho no bucket prescriptions (Storage)';

-- =============================================
-- TABLE: prescription_verification_logs
-- =============================================
CREATE TABLE IF NOT EXISTS prescription_verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  ip text,
  user_agent text,
  outcome text NOT NULL CHECK (outcome IN ('valid', 'invalid_code', 'invalid_token', 'revoked', 'expired', 'not_found', 'error')),
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prescription_verification_logs_prescription_id_idx
  ON prescription_verification_logs (prescription_id);
CREATE INDEX IF NOT EXISTS prescription_verification_logs_created_at_idx
  ON prescription_verification_logs (created_at);

COMMENT ON TABLE prescription_verification_logs IS 'Log de tentativas de verificação (auditoria e segurança)';

-- =============================================
-- RLS (Row Level Security)
-- =============================================
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_verification_logs ENABLE ROW LEVEL SECURITY;

-- prescriptions: leitura pública por id não; apenas service_role/Edge Function acessa
CREATE POLICY "Service role full access prescriptions"
  ON prescriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Logs: apenas service_role (Edge Function insere)
CREATE POLICY "Service role full access verification logs"
  ON prescription_verification_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon não acessa tabelas; verificação é feita via Edge Function com service_role
