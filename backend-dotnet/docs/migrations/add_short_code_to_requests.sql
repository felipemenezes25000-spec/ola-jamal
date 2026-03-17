-- ============================================================
-- Migration: short_code em requests (URLs mais curtas para pedidos)
-- Execute no PostgreSQL (AWS RDS ou local)
-- Data: 2025-03
-- ============================================================
-- Permite URLs como /pedidos/11040ef97c6e em vez do UUID completo.
-- short_code = primeiros 12 caracteres hex do UUID (sem hífens).
-- ============================================================

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS short_code TEXT;

-- Backfill: preencher short_code para registros existentes
UPDATE public.requests
SET short_code = lower(substring(replace(id::text, '-', ''), 1, 12))
WHERE short_code IS NULL;

-- Índice para lookup rápido (colisão de 12 hex chars é extremamente rara; índice não-unique para segurança)
CREATE INDEX IF NOT EXISTS idx_requests_short_code ON public.requests(short_code) WHERE short_code IS NOT NULL;

COMMENT ON COLUMN public.requests.short_code IS 'Código curto (12 hex) para URLs: primeiros 12 chars do UUID sem hífens';
