-- Migration: add_prescription_profile_fields
-- Campos para receituário conforme CFM, RDC 471/2021, ANVISA/SNCR
-- Users: sexo (paciente) para receita antimicrobiana
-- Doctor_profiles: endereço e telefone profissional
-- Requests: prescription_kind (simple, antimicrobial, controlled_special)

-- 1) users: sexo (M, F, Outro, Não informado)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS gender VARCHAR(20);

COMMENT ON COLUMN public.users.gender IS 'Sexo do paciente: M, F, Outro, Não informado. Obrigatório para receita antimicrobiana.';

-- 2) users: endereço do paciente (para receita controle especial)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS address TEXT;

COMMENT ON COLUMN public.users.address IS 'Endereço completo. Obrigatório para receita de controle especial.';

-- 3) doctor_profiles: endereço e telefone profissional
ALTER TABLE public.doctor_profiles
ADD COLUMN IF NOT EXISTS professional_address TEXT,
ADD COLUMN IF NOT EXISTS professional_phone VARCHAR(30);

COMMENT ON COLUMN public.doctor_profiles.professional_address IS 'Endereço profissional do médico. Obrigatório para emissão de receitas.';
COMMENT ON COLUMN public.doctor_profiles.professional_phone IS 'Telefone profissional do médico. Obrigatório para emissão de receitas.';

-- 4) requests: prescription_kind (simple, antimicrobial, controlled_special)
ALTER TABLE public.requests
ADD COLUMN IF NOT EXISTS prescription_kind VARCHAR(30);

COMMENT ON COLUMN public.requests.prescription_kind IS 'Tipo de receita: simple, antimicrobial, controlled_special. Define layout e validação.';
