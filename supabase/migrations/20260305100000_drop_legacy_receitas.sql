-- ============================================================
-- RENOVEJÁ — Remoção da tabela legada receitas
-- ============================================================
-- A tabela prescriptions substitui receitas (Verify v2).
-- Código, Edge Function e backend usam apenas prescriptions.
-- receitas tinha 1 linha (seed/teste); estrutura incompatível.
-- ============================================================

DROP TABLE IF EXISTS public.receitas CASCADE;
