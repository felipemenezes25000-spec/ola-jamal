-- Execute este SQL no projeto Supabase que a API usa
-- (Dashboard: https://supabase.com/dashboard → seu projeto → SQL Editor).
-- O appsettings.json tem Supabase:Url; use o projeto correspondente a essa URL.
--
-- 1) Bucket para fotos de receita (upload em POST /api/requests/prescription).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prescription-images',
  'prescription-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2) Bucket para certificados digitais (.pfx.enc - upload em POST /api/certificates/upload).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificates',
  'certificates',
  false,
  10485760,
  array['application/octet-stream']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
