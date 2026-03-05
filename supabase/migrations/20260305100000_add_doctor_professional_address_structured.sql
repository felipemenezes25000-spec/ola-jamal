-- ============================================================
-- Migration: Endereço profissional estruturado em doctor_profiles
-- Campos separados (CEP, rua, número, bairro, cidade, estado) para
-- consistência com o endereço pessoal em users.
-- ============================================================

ALTER TABLE public.doctor_profiles
    ADD COLUMN IF NOT EXISTS professional_postal_code VARCHAR(10),
    ADD COLUMN IF NOT EXISTS professional_street VARCHAR(200),
    ADD COLUMN IF NOT EXISTS professional_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS professional_neighborhood VARCHAR(100),
    ADD COLUMN IF NOT EXISTS professional_complement VARCHAR(100),
    ADD COLUMN IF NOT EXISTS professional_city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS professional_state VARCHAR(2);

COMMENT ON COLUMN public.doctor_profiles.professional_postal_code IS 'CEP do endereço profissional.';
COMMENT ON COLUMN public.doctor_profiles.professional_street IS 'Logradouro do endereço profissional.';
COMMENT ON COLUMN public.doctor_profiles.professional_number IS 'Número do endereço profissional.';
COMMENT ON COLUMN public.doctor_profiles.professional_neighborhood IS 'Bairro do endereço profissional.';
COMMENT ON COLUMN public.doctor_profiles.professional_complement IS 'Complemento do endereço profissional.';
COMMENT ON COLUMN public.doctor_profiles.professional_city IS 'Cidade do endereço profissional.';
COMMENT ON COLUMN public.doctor_profiles.professional_state IS 'UF do endereço profissional.';
