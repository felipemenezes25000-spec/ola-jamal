-- Criar bucket dedicado para fotos de perfil (avatares)
-- Público: permite acesso direto via URL (necessário para exibir no app)
-- 5 MB: suficiente para fotos de perfil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    TRUE,
    5242880, -- 5 MB
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: permitir upload via service_role (já funciona por padrão com service key)
-- Policy: leitura pública (bucket público = acesso direto)
