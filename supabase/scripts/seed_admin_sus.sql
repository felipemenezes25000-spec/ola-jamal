-- ============================================================
-- Script: Seed de usuário admin para testar o módulo SUS/APS
-- Uso: Executar no Supabase SQL Editor ou psql
-- Cria um admin que, ao fazer login, é redirecionado para o SUS.
-- ============================================================
-- Credenciais: admin.sus@teste.com / Teste@123
-- ============================================================

INSERT INTO public.users (id, name, email, password_hash, role, profile_complete, created_at, updated_at)
SELECT
    'd4444444-4444-4444-4444-444444444444'::uuid,
    'Admin SUS (Teste)',
    'admin.sus@teste.com',
    '$2a$10$XMmAZajKr01DmwkvtAPXLu4SDBU9gsGPUtR/s43VCqm42m9VA/J6G',
    'admin',
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'admin.sus@teste.com');

-- Verificar: SELECT id, name, email, role FROM public.users WHERE email = 'admin.sus@teste.com';
