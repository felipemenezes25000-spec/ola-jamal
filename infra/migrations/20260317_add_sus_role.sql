-- Adiciona role 'sus' ao CHECK constraint da tabela users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('patient', 'doctor', 'admin', 'sus'));
