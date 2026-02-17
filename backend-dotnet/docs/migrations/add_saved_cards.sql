-- ============================================================
-- Migration: Tabela saved_cards para cartões salvos (MP Customers)
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saved_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    mp_customer_id TEXT NOT NULL,
    mp_card_id TEXT NOT NULL,
    last_four TEXT NOT NULL,
    brand TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_cards_user_id ON public.saved_cards(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_cards_mp_card ON public.saved_cards(mp_card_id);

COMMENT ON TABLE public.saved_cards IS 'Cartões salvos dos pacientes (Mercado Pago Customers)';
