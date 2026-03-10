-- Adicionar suporte a HEIC/HEIF no bucket prescription-images (fotos de iPhone)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','application/pdf','image/heic','image/heif']
WHERE id = 'prescription-images';
