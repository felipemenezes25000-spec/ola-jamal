-- Migration: Criar tabela audit_logs para conformidade LGPD
-- Descrição: Tabela de logs de auditoria para rastrear acessos e modificações
--            a dados sensíveis de saúde (dados de pacientes, receitas, certificados).
-- Data: 2026-02-13

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    endpoint TEXT,
    http_method TEXT,
    status_code INTEGER,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Índice composto para consultas filtradas por usuário + período
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);

-- Comentários na tabela
COMMENT ON TABLE audit_logs IS 'Logs de auditoria LGPD para rastreamento de acessos a dados de saúde';
COMMENT ON COLUMN audit_logs.user_id IS 'ID do usuário que realizou a ação (NULL se anônimo/sistema)';
COMMENT ON COLUMN audit_logs.user_email IS 'Email do usuário no momento da ação';
COMMENT ON COLUMN audit_logs.user_role IS 'Papel do usuário: patient, doctor, system';
COMMENT ON COLUMN audit_logs.action IS 'Ação: Create, Read, Update, Delete, Sign, Download, Export';
COMMENT ON COLUMN audit_logs.entity_type IS 'Tipo da entidade: Request, User, Payment, Certificate, DoctorProfile';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID do registro acessado';
COMMENT ON COLUMN audit_logs.details IS 'Detalhes extras da operação';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP do cliente';
COMMENT ON COLUMN audit_logs.user_agent IS 'User-Agent do cliente (truncado em 256 chars)';
COMMENT ON COLUMN audit_logs.endpoint IS 'Endpoint acessado (ex: GET /api/requests/123)';
COMMENT ON COLUMN audit_logs.http_method IS 'Método HTTP';
COMMENT ON COLUMN audit_logs.status_code IS 'Status code da resposta HTTP';
COMMENT ON COLUMN audit_logs.timestamp IS 'Data/hora do evento';
COMMENT ON COLUMN audit_logs.duration IS 'Duração em milissegundos';

-- RLS (Row Level Security) - Apenas service_role pode ler/escrever
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Nenhum acesso via anon ou authenticated (apenas service_role bypassa RLS)
-- Isso garante que os logs só são acessíveis pelo backend
CREATE POLICY "audit_logs_no_access" ON audit_logs
    FOR ALL
    USING (false);
