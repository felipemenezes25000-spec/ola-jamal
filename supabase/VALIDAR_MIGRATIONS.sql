-- =============================================================================
-- VALIDAÇÃO DAS MIGRATIONS NO SUPABASE
-- Cole este script no SQL Editor do projeto e execute.
-- Resultado: uma tabela "validação" com OK ou FALTANDO para cada item.
-- =============================================================================

WITH checks AS (
  SELECT 'public.users' AS obj, 'table' AS tipo,
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') AS ok
  UNION ALL
  SELECT 'public.doctor_profiles', 'table',
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doctor_profiles')
  UNION ALL
  SELECT 'public.requests', 'table',
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'requests')
  UNION ALL
  SELECT 'public.doctor_certificates', 'table',
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doctor_certificates')
  UNION ALL
  SELECT 'public.feature_flags', 'table',
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_flags')
  UNION ALL
  SELECT 'public.prescriptions', 'table',
         EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prescriptions')
  UNION ALL
  SELECT 'requests.access_code', 'column',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'access_code')
  UNION ALL
  SELECT 'requests.auto_observation', 'column',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'auto_observation')
  UNION ALL
  SELECT 'requests.doctor_conduct_notes', 'column',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'doctor_conduct_notes')
  UNION ALL
  SELECT 'requests.include_conduct_in_pdf', 'column',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'include_conduct_in_pdf')
  UNION ALL
  SELECT 'requests.ai_conduct_suggestion', 'column',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'ai_conduct_suggestion')
  UNION ALL
  SELECT 'requests.conduct_updated_at', 'column',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'conduct_updated_at')
  UNION ALL
  SELECT 'doctor_profiles.active_certificate_id', 'column',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'doctor_profiles' AND column_name = 'active_certificate_id')
  UNION ALL
  SELECT 'doctor_profiles.crm_validated', 'column',
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'doctor_profiles' AND column_name = 'crm_validated')
)
SELECT
  obj AS "Objeto",
  tipo AS "Tipo",
  CASE WHEN ok THEN 'OK' ELSE 'FALTANDO' END AS "Status"
FROM checks
ORDER BY tipo, obj;
