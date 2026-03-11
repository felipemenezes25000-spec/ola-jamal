-- Truncate SOMENTE requests (e tabelas dependentes por FK).
-- NÃO apaga users.
-- CASCADE: necessário porque payments tem ON DELETE RESTRICT em request_id.
TRUNCATE public.requests CASCADE;
