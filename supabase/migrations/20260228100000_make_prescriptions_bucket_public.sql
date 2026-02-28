-- Make prescriptions bucket public so patients can download signed PDFs directly.
-- Signed medical documents are meant to be publicly verifiable (via QR code + access code).
-- The file names contain UUIDs which are effectively unguessable.
-- Run in Supabase SQL Editor if not using supabase db push.

UPDATE storage.buckets
SET public = true
WHERE id = 'prescriptions';

-- Policies for storage.objects (drop if exist so migration is idempotent)
DROP POLICY IF EXISTS "Public read access for prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert prescriptions" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access prescriptions storage" ON storage.objects;

CREATE POLICY "Public read access for prescriptions"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'prescriptions');

CREATE POLICY "Authenticated insert prescriptions"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'prescriptions');

CREATE POLICY "Service role full access prescriptions storage"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'prescriptions')
  WITH CHECK (bucket_id = 'prescriptions');
