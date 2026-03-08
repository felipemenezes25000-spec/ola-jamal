-- Transcrição da consulta em arquivo no Supabase Storage
-- Bucket consultation-transcripts + coluna transcript_file_url

-- 1) Bucket para transcrições de consulta (.txt)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consultation-transcripts',
  'consultation-transcripts',
  false,
  524288,
  array['text/plain', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Coluna para URL do arquivo de transcrição
ALTER TABLE public.consultation_anamnesis
ADD COLUMN IF NOT EXISTS transcript_file_url TEXT;

COMMENT ON COLUMN public.consultation_anamnesis.transcript_file_url IS 'URL do arquivo .txt da transcrição no Supabase Storage (bucket consultation-transcripts).';
