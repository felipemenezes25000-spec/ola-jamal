-- Private bucket for prescription PDFs (signed URLs only)
-- Run after 20260219000001_create_prescriptions_and_logs.sql
-- If this fails (e.g. storage schema), create bucket in Dashboard: Storage → New bucket → name "prescriptions", Private, limit 10MB, MIME application/pdf

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'prescriptions',
  'prescriptions',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;
