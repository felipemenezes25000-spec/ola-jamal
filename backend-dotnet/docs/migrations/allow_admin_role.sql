-- Permite a role 'admin' na tabela users.
-- Execute no PostgreSQL se aparecer: new row violates check constraint "users_role_check"
--
-- Se a constraint já permitir 'admin', os comandos abaixo não farão mal (DROP IF EXISTS / ADD não falha se já existir o check).

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('patient', 'doctor', 'admin'));
