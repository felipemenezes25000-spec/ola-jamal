-- ============================================================
-- Script: Verificar cadastros incompletos (sem CPF ou dados obrigatórios)
-- Uso: Executar no Supabase SQL Editor ou psql
-- ============================================================

-- 1. Usuários sem CPF (profile_complete = true significa que deveriam ter CPF)
SELECT
    id,
    name,
    email,
    role,
    profile_complete,
    cpf,
    phone,
    street,
    number,
    neighborhood,
    city,
    state,
    created_at
FROM public.users
WHERE (cpf IS NULL OR cpf = '')
   OR (profile_complete = true AND (street IS NULL OR street = '' OR number IS NULL OR number = '' OR neighborhood IS NULL OR neighborhood = '' OR city IS NULL OR city = '' OR state IS NULL OR state = ''))
ORDER BY created_at DESC;

-- 2. Resumo: contagem de usuários sem CPF
SELECT
    role,
    COUNT(*) FILTER (WHERE cpf IS NULL OR cpf = '') AS sem_cpf,
    COUNT(*) FILTER (WHERE profile_complete = true AND (street IS NULL OR street = '' OR number IS NULL OR number = '')) AS completos_sem_endereco,
    COUNT(*) AS total
FROM public.users
GROUP BY role;

-- 3. Usuários com profile_complete = false (fluxo Google pendente - esperado até completar)
SELECT
    id,
    name,
    email,
    role,
    profile_complete,
    created_at
FROM public.users
WHERE profile_complete = false
ORDER BY created_at DESC;
