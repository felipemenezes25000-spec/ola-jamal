-- ============================================================
-- Migration: Schema base do RenoveJá
-- Cria as tabelas fundamentais: users, doctor_profiles, auth_tokens,
-- requests, payments, chat_messages, saved_cards.
-- As tabelas de funcionalidades adicionais (notifications, video_rooms,
-- push_tokens, product_prices, etc.) estão nas migrations incrementais.
-- As tabelas de verificação pública (prescriptions, prescription_verification_logs)
-- estão em 20260219000001_create_prescriptions_and_logs.sql.
-- ============================================================

-- --------------------------------------------------------
-- 1. USERS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    email           TEXT        NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    phone           TEXT,
    cpf             TEXT,
    birth_date      TIMESTAMPTZ,
    gender          VARCHAR(20),
    address         TEXT,
    street          VARCHAR(200),
    number          VARCHAR(20),
    neighborhood    VARCHAR(100),
    complement      VARCHAR(100),
    city            VARCHAR(100),
    state           VARCHAR(2),
    postal_code     VARCHAR(10),
    avatar_url      TEXT,
    role            TEXT        NOT NULL DEFAULT 'patient'
                        CHECK (role IN ('patient', 'doctor', 'admin')),
    profile_complete BOOLEAN    NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email      ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role       ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_cpf        ON public.users(cpf);

COMMENT ON TABLE public.users IS 'Usuários do sistema: pacientes e médicos.';
COMMENT ON COLUMN public.users.profile_complete IS 'false para usuários cadastrados via Google que ainda não preencheram phone/CPF.';

-- --------------------------------------------------------
-- 2. AUTH_TOKENS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token       TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_token   ON public.auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON public.auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires  ON public.auth_tokens(expires_at);

COMMENT ON TABLE public.auth_tokens IS 'Tokens de sessão (Bearer) gerados no login.';

-- --------------------------------------------------------
-- 3. DOCTOR_PROFILES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_profiles (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    crm                     TEXT        NOT NULL,
    crm_state               TEXT        NOT NULL,
    specialty               TEXT        NOT NULL,
    professional_address    TEXT,
    professional_phone      VARCHAR(30),
    bio                     TEXT,
    rating                  DECIMAL(3,2) NOT NULL DEFAULT 5.0,
    total_consultations     INTEGER     NOT NULL DEFAULT 0,
    available               BOOLEAN     NOT NULL DEFAULT TRUE,
    active_certificate_id   UUID,
    crm_validated           BOOLEAN     NOT NULL DEFAULT FALSE,
    crm_validated_at        TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_user_id   ON public.doctor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_specialty  ON public.doctor_profiles(specialty);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_available  ON public.doctor_profiles(available);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_crm        ON public.doctor_profiles(crm, crm_state);

COMMENT ON TABLE public.doctor_profiles IS 'Perfil profissional dos médicos cadastrados.';

-- --------------------------------------------------------
-- 4. REQUESTS
-- Tabela central: solicitações de receita, pedido de exame e consulta.
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.requests (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id              UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    patient_name            TEXT,
    doctor_id               UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    doctor_name             TEXT,
    request_type            TEXT        NOT NULL
                                CHECK (request_type IN ('prescription', 'exam', 'consultation')),
    status                  TEXT        NOT NULL DEFAULT 'submitted',
    -- Campos de receita
    prescription_type       TEXT        CHECK (prescription_type IN ('simples', 'controlado', 'azul')),
    prescription_kind       VARCHAR(30),
    medications             JSONB       NOT NULL DEFAULT '[]',
    prescription_images     JSONB       NOT NULL DEFAULT '[]',
    -- Campos de exame
    exam_type               TEXT,
    exams                   JSONB       NOT NULL DEFAULT '[]',
    exam_images             JSONB       NOT NULL DEFAULT '[]',
    -- Campos gerais
    symptoms                TEXT,
    price                   DECIMAL(10,2),
    notes                   TEXT,
    rejection_reason        TEXT,
    -- Verificação e assinatura digital
    access_code             TEXT,
    signed_at               TIMESTAMPTZ,
    signed_document_url     TEXT,
    signature_id            TEXT,
    -- Análise por IA
    ai_summary_for_doctor   TEXT,
    ai_extracted_json       TEXT,
    ai_risk_level           TEXT,
    ai_urgency              TEXT,
    ai_readability_ok       BOOLEAN,
    ai_message_to_user      TEXT,
    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_patient_id    ON public.requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_requests_doctor_id     ON public.requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_requests_status        ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_type          ON public.requests(request_type);
CREATE INDEX IF NOT EXISTS idx_requests_type_status   ON public.requests(request_type, status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at    ON public.requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_patient_status ON public.requests(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_requests_signed_at     ON public.requests(signed_at) WHERE signed_at IS NOT NULL;

COMMENT ON TABLE public.requests IS 'Solicitações médicas: renovação de receita, pedido de exame ou teleconsulta.';
COMMENT ON COLUMN public.requests.access_code IS 'Código de 4 dígitos exibido no PDF para verificação pública legada. Novos PDFs usam código de 6 dígitos via tabela prescriptions.';
COMMENT ON COLUMN public.requests.ai_readability_ok IS 'false = imagem ilegível; IA pede ao paciente enviar outra mais nítida.';

-- --------------------------------------------------------
-- 5. PAYMENTS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          UUID        NOT NULL REFERENCES public.requests(id) ON DELETE RESTRICT,
    user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    amount              DECIMAL(10,2) NOT NULL,
    status              TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
    payment_method      TEXT        NOT NULL DEFAULT 'pix'
                            CHECK (payment_method IN ('pix', 'credit_card', 'debit_card')),
    external_id         TEXT,
    pix_qr_code         TEXT,
    pix_qr_code_base64  TEXT,
    pix_copy_paste      TEXT,
    paid_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_request_id  ON public.payments(request_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id     ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status      ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON public.payments(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_created_at  ON public.payments(created_at DESC);

COMMENT ON TABLE public.payments IS 'Pagamentos via PIX ou cartão (Mercado Pago).';

-- --------------------------------------------------------
-- 6. CHAT_MESSAGES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id  UUID        NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    sender_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender_name TEXT,
    sender_type TEXT        NOT NULL CHECK (sender_type IN ('patient', 'doctor', 'system')),
    message     TEXT        NOT NULL,
    read        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_request_id ON public.chat_messages(request_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

COMMENT ON TABLE public.chat_messages IS 'Mensagens do chat entre paciente e médico por solicitação.';

-- --------------------------------------------------------
-- 7. SAVED_CARDS (Mercado Pago)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_cards (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mp_customer_id  TEXT        NOT NULL,
    mp_card_id      TEXT        NOT NULL,
    last_four       TEXT        NOT NULL,
    brand           TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_cards_user_id ON public.saved_cards(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_cards_unique ON public.saved_cards(user_id, mp_card_id);

COMMENT ON TABLE public.saved_cards IS 'Cartões de crédito/débito salvos pelo usuário no Mercado Pago.';

-- --------------------------------------------------------
-- 8. STORAGE BUCKETS (imagens de receitas e certificados PFX)
-- --------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'prescription-images',
    'prescription-images',
    TRUE,
    10485760, -- 10 MB
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'certificates',
    'certificates',
    FALSE,
    5242880, -- 5 MB
    ARRAY['application/x-pkcs12','application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE storage.buckets IS 'prescription-images: público (imagens de receitas). certificates: privado (PFX dos médicos).';
