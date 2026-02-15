-- ============================================================
-- Migration: Tabelas faltantes (notifications, video_rooms, push_tokens, product_prices)
-- Execute no SQL Editor do Supabase Dashboard
-- Data: 2026-02-14
-- ============================================================

-- 1) Tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL DEFAULT 'info',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);

COMMENT ON TABLE public.notifications IS 'Notificações para usuários (pacientes e médicos)';

-- 2) Tabela de salas de vídeo
CREATE TABLE IF NOT EXISTS public.video_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    room_url TEXT,
    status TEXT NOT NULL DEFAULT 'waiting',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_rooms_request_id ON public.video_rooms(request_id);
CREATE INDEX IF NOT EXISTS idx_video_rooms_status ON public.video_rooms(status);

COMMENT ON TABLE public.video_rooms IS 'Salas de vídeo para teleconsultas';

-- 3) Tabela de tokens push (mobile)
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'unknown',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens(token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_unique ON public.push_tokens(user_id, token);

COMMENT ON TABLE public.push_tokens IS 'Tokens de push notification para dispositivos móveis';

-- 4) Tabela de preços de produtos
CREATE TABLE IF NOT EXISTS public.product_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_type TEXT NOT NULL,  -- prescription | exam | consultation
    subtype TEXT NOT NULL DEFAULT 'default',  -- simples | controlado | azul (para prescription)
    price_brl DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_prices_unique ON public.product_prices(product_type, subtype);
CREATE INDEX IF NOT EXISTS idx_product_prices_active ON public.product_prices(is_active);

COMMENT ON TABLE public.product_prices IS 'Preços dos produtos/serviços';

-- Inserir preços padrão
INSERT INTO public.product_prices (product_type, subtype, price_brl, description, is_active)
VALUES
    ('prescription', 'simples', 49.90, 'Receita simples', TRUE),
    ('prescription', 'controlado', 79.90, 'Receita controlada', TRUE),
    ('prescription', 'azul', 69.90, 'Receita azul (antimicrobianos)', TRUE),
    ('exam', 'default', 99.90, 'Pedido de exame', TRUE),
    ('consultation', 'default', 149.90, 'Teleconsulta', TRUE)
ON CONFLICT (product_type, subtype) DO NOTHING;

-- ============================================================
-- Fim da migration
-- ============================================================
