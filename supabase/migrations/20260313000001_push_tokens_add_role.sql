-- Adiciona coluna "role" na tabela push_tokens para distinguir tokens de médico vs paciente.
-- Isso permite filtrar tokens no backend antes de enviar, evitando notificações cruzadas
-- quando o mesmo dispositivo físico já teve tokens de ambos os roles.
ALTER TABLE public.push_tokens
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'patient'
        CHECK (role IN ('patient', 'doctor'));

COMMENT ON COLUMN public.push_tokens.role IS
    'Role do usuário no momento do registro do token. Usado para filtrar notificações por targetRole no backend.';

-- Índice para consultas filtradas por role (dispatcher usa user_id + role)
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_role
    ON public.push_tokens(user_id, role)
    WHERE active = TRUE;
