-- ============================================================
-- RENOVEJÁ — Garantir bucket certificates privado
-- ============================================================
-- O bucket certificates armazena PFX criptografados dos médicos.
-- Deve ser privado; acesso apenas via service_role (backend).
-- ============================================================

UPDATE storage.buckets
SET public = FALSE
WHERE id = 'certificates';
