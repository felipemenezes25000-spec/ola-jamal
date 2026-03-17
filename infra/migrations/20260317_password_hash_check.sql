-- Garante hash mínimo de 20 chars (BCrypt = 60 chars)
ALTER TABLE public.users ADD CONSTRAINT chk_password_hash_min_length CHECK (length(password_hash) >= 20);
