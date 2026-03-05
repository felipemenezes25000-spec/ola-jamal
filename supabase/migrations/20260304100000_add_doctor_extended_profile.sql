-- ============================================================
-- Migration: Perfil estendido do médico
-- Adiciona approval_status (se não existir), university, courses,
-- hospitals_services em doctor_profiles para cadastro completo.
-- ============================================================

-- Status de aprovação do médico (pending, approved, rejected)
ALTER TABLE public.doctor_profiles
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending';

COMMENT ON COLUMN public.doctor_profiles.approval_status IS 'Status de aprovação: pending, approved, rejected.';

-- Faculdade / instituição de formação
ALTER TABLE public.doctor_profiles
    ADD COLUMN IF NOT EXISTS university TEXT;

COMMENT ON COLUMN public.doctor_profiles.university IS 'Faculdade ou instituição de formação do médico.';

-- Cursos (texto livre)
ALTER TABLE public.doctor_profiles
    ADD COLUMN IF NOT EXISTS courses TEXT;

COMMENT ON COLUMN public.doctor_profiles.courses IS 'Cursos e formações adicionais (texto livre).';

-- Hospitais/serviços por onde trabalhou (texto livre)
ALTER TABLE public.doctor_profiles
    ADD COLUMN IF NOT EXISTS hospitals_services TEXT;

COMMENT ON COLUMN public.doctor_profiles.hospitals_services IS 'Hospitais e serviços por onde o médico trabalhou (texto livre).';
