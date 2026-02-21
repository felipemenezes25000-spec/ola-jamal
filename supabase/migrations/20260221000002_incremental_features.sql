-- ============================================================
-- Migration: Tabelas de funcionalidades incrementais
-- Espelha as migrations executadas pelo SupabaseMigrationRunner.cs.
-- Inclui: password_reset_tokens, doctor_certificates, audit_logs,
--         notifications, video_rooms, consultation_anamnesis,
--         push_tokens, product_prices, payment_attempts, webhook_events.
-- ============================================================

-- --------------------------------------------------------
-- 1. PASSWORD_RESET_TOKENS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token       TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token      ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id    ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

COMMENT ON TABLE public.password_reset_tokens IS 'Tokens de recuperação de senha (email + link temporário).';

-- --------------------------------------------------------
-- 2. DOCTOR_CERTIFICATES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.doctor_certificates (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_profile_id       UUID        NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
    subject_name            TEXT        NOT NULL,
    issuer_name             TEXT        NOT NULL,
    serial_number           TEXT        NOT NULL,
    not_before              TIMESTAMPTZ NOT NULL,
    not_after               TIMESTAMPTZ NOT NULL,
    pfx_storage_path        TEXT        NOT NULL,
    pfx_file_name           TEXT        NOT NULL,
    cpf                     TEXT,
    crm_number              TEXT,
    is_valid                BOOLEAN     NOT NULL DEFAULT TRUE,
    is_revoked              BOOLEAN     NOT NULL DEFAULT FALSE,
    revoked_at              TIMESTAMPTZ,
    revocation_reason       TEXT,
    validated_at_registration BOOLEAN   NOT NULL DEFAULT FALSE,
    last_validation_date    TIMESTAMPTZ,
    last_validation_result  TEXT,
    uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_by_ip          TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_certificates_doctor   ON public.doctor_certificates(doctor_profile_id);
CREATE INDEX IF NOT EXISTS idx_doctor_certificates_valid    ON public.doctor_certificates(is_valid, is_revoked);
CREATE INDEX IF NOT EXISTS idx_doctor_certificates_not_after ON public.doctor_certificates(not_after);

-- Referência cruzada: doctor_profiles → doctor_certificates (adicionada após criar ambas)
ALTER TABLE public.doctor_profiles
    ADD COLUMN IF NOT EXISTS active_certificate_id UUID REFERENCES public.doctor_certificates(id),
    ADD COLUMN IF NOT EXISTS crm_validated          BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS crm_validated_at       TIMESTAMPTZ;

COMMENT ON TABLE public.doctor_certificates IS 'Certificados digitais ICP-Brasil dos médicos (PFX armazenado criptografado).';

-- --------------------------------------------------------
-- 3. AUDIT_LOGS (LGPD)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
    user_email      TEXT,
    user_role       TEXT,
    action          TEXT        NOT NULL,
    entity_type     TEXT        NOT NULL,
    entity_id       TEXT,
    details         TEXT,
    ip_address      TEXT,
    user_agent      TEXT,
    endpoint        TEXT,
    http_method     TEXT,
    status_code     INTEGER,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration        BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id       ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity        ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp     ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action        ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON public.audit_logs(user_id, created_at DESC);

COMMENT ON TABLE public.audit_logs IS 'Trilha de auditoria LGPD: ações dos usuários e do sistema.';

-- --------------------------------------------------------
-- 4. NOTIFICATIONS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title               TEXT        NOT NULL,
    message             TEXT        NOT NULL,
    notification_type   TEXT        NOT NULL DEFAULT 'info',
    read                BOOLEAN     NOT NULL DEFAULT FALSE,
    data                JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read       ON public.notifications(user_id, read);

COMMENT ON TABLE public.notifications IS 'Notificações para usuários (pacientes e médicos).';

-- --------------------------------------------------------
-- 5. VIDEO_ROOMS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.video_rooms (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID        NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    room_name       TEXT        NOT NULL,
    room_url        TEXT,
    status          TEXT        NOT NULL DEFAULT 'waiting',
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_rooms_request_id ON public.video_rooms(request_id);
CREATE INDEX IF NOT EXISTS idx_video_rooms_status     ON public.video_rooms(status);

COMMENT ON TABLE public.video_rooms IS 'Salas de vídeo para teleconsultas (WebRTC via SignalR).';

-- --------------------------------------------------------
-- 6. CONSULTATION_ANAMNESIS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultation_anamnesis (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          UUID        NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    patient_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    transcript_text     TEXT,
    anamnesis_json      TEXT,
    ai_suggestions_json TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_anamnesis_request_id ON public.consultation_anamnesis(request_id);
CREATE INDEX IF NOT EXISTS idx_consultation_anamnesis_patient_id        ON public.consultation_anamnesis(patient_id);

COMMENT ON TABLE public.consultation_anamnesis IS 'Transcrição e anamnese da teleconsulta (gerada por IA via Whisper + GPT).';

-- --------------------------------------------------------
-- 7. PUSH_TOKENS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token       TEXT        NOT NULL,
    device_type TEXT        NOT NULL DEFAULT 'unknown',
    active      BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token   ON public.push_tokens(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_unique ON public.push_tokens(user_id, token);

COMMENT ON TABLE public.push_tokens IS 'Tokens de push notification (Expo) dos dispositivos móveis.';

-- --------------------------------------------------------
-- 8. PRODUCT_PRICES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_prices (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type    TEXT        NOT NULL,
    subtype         TEXT        NOT NULL DEFAULT 'default',
    price_brl       DECIMAL(10,2) NOT NULL,
    name            TEXT,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_prices_unique ON public.product_prices(product_type, subtype);
CREATE INDEX IF NOT EXISTS idx_product_prices_active ON public.product_prices(is_active);

INSERT INTO public.product_prices (product_type, subtype, price_brl, name, is_active)
VALUES
    ('prescription', 'simples',    49.90, 'Receita simples',              TRUE),
    ('prescription', 'controlado', 79.90, 'Receita controlada',           TRUE),
    ('prescription', 'azul',       69.90, 'Receita azul (antimicrobianos)', TRUE),
    ('exam',         'default',    99.90, 'Pedido de exame',              TRUE),
    ('consultation', 'default',   149.90, 'Teleconsulta',                 TRUE)
ON CONFLICT (product_type, subtype) DO NOTHING;

COMMENT ON TABLE public.product_prices IS 'Preços dos serviços por tipo (prescription, exam, consultation).';

-- --------------------------------------------------------
-- 9. PAYMENT_ATTEMPTS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id                  UUID        NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    request_id                  UUID        NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    user_id                     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    correlation_id              TEXT        NOT NULL,
    payment_method              TEXT        NOT NULL,
    amount                      DECIMAL(10,2) NOT NULL,
    mercado_pago_payment_id     TEXT,
    mercado_pago_preference_id  TEXT,
    request_url                 TEXT,
    request_payload             TEXT,
    response_payload            TEXT,
    response_status_code        INTEGER,
    response_status_detail      TEXT,
    response_headers            TEXT,
    error_message               TEXT,
    is_success                  BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_correlation_id      ON public.payment_attempts(correlation_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment_id          ON public.payment_attempts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_request_id          ON public.payment_attempts(request_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_mp_payment_id       ON public.payment_attempts(mercado_pago_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_mp_preference_id    ON public.payment_attempts(mercado_pago_preference_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_created_at          ON public.payment_attempts(created_at DESC);

COMMENT ON TABLE public.payment_attempts IS 'Log detalhado de cada tentativa de pagamento para auditoria e debug.';

-- --------------------------------------------------------
-- 10. WEBHOOK_EVENTS (Mercado Pago)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Campos de compatibilidade com schema legado
    event_id                TEXT,
    event_type              TEXT        DEFAULT 'payment',
    source                  VARCHAR     DEFAULT 'mercadopago',
    payload                 JSONB,
    status                  VARCHAR     DEFAULT 'processed'
                                CHECK (status IN ('processed', 'failed', 'ignored', 'pending', 'duplicate')),
    error_message           TEXT,
    -- Campos do modelo atual
    correlation_id          TEXT,
    mercado_pago_payment_id TEXT,
    mercado_pago_request_id TEXT,
    webhook_type            TEXT,
    webhook_action          TEXT,
    raw_payload             TEXT,
    processed_payload       TEXT,
    query_string            TEXT,
    request_headers         TEXT,
    content_type            TEXT,
    content_length          INTEGER,
    source_ip               TEXT,
    is_duplicate            BOOLEAN     NOT NULL DEFAULT FALSE,
    is_processed            BOOLEAN     NOT NULL DEFAULT FALSE,
    processing_error        TEXT,
    payment_status          TEXT,
    payment_status_detail   TEXT,
    processed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_correlation_id  ON public.webhook_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_mp_payment_id   ON public.webhook_events(mercado_pago_payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_mp_request_id   ON public.webhook_events(mercado_pago_request_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at      ON public.webhook_events(created_at DESC);

COMMENT ON TABLE public.webhook_events IS 'Registro de webhooks recebidos do Mercado Pago (idempotência e auditoria).';
