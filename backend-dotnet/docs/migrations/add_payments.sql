-- Migration: add_payments
-- Tabelas para o fluxo de pagamentos via Mercado Pago (PIX, cartao, webhook)

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
    payment_method TEXT NOT NULL DEFAULT 'pix'
        CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'checkout_pro')),
    external_id TEXT,
    pix_qr_code TEXT,
    pix_qr_code_base64 TEXT,
    pix_copy_paste TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_request_id ON public.payments(request_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON public.payments(external_id);

CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    correlation_id TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    mercado_pago_payment_id TEXT,
    mercado_pago_preference_id TEXT,
    request_url TEXT,
    request_payload TEXT,
    response_payload TEXT,
    response_status_code INTEGER,
    response_status_detail TEXT,
    response_headers TEXT,
    error_message TEXT,
    is_success BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment_id ON public.payment_attempts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_correlation_id ON public.payment_attempts(correlation_id);

CREATE TABLE IF NOT EXISTS public.saved_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mp_customer_id TEXT NOT NULL,
    mp_card_id TEXT NOT NULL,
    last_four TEXT NOT NULL,
    brand TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_cards_unique ON public.saved_cards(user_id, mp_card_id);

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id TEXT,
    mercado_pago_payment_id TEXT,
    mercado_pago_request_id TEXT,
    webhook_type TEXT,
    webhook_action TEXT,
    raw_payload TEXT,
    processed_payload TEXT,
    query_string TEXT,
    request_headers TEXT,
    content_type TEXT,
    content_length INTEGER,
    source_ip TEXT,
    is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
    is_processed BOOLEAN NOT NULL DEFAULT FALSE,
    processing_error TEXT,
    payment_status TEXT,
    payment_status_detail TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_mp_request_id ON public.webhook_events(mercado_pago_request_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_mp_payment_id ON public.webhook_events(mercado_pago_payment_id);
