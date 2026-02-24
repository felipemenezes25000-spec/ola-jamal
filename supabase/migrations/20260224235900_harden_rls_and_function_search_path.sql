-- Hardening de segurança/performance guiado por advisors do Supabase.
-- Objetivos:
-- 1) Habilitar RLS em tabelas expostas sem proteção.
-- 2) Criar índices faltantes para FKs sinalizadas.
-- 3) Fixar search_path em funções públicas sinalizadas.

-- 1) Enable RLS em tabelas públicas expostas
ALTER TABLE IF EXISTS public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.consultation_time_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.consultation_time_bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.consultation_anamnesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.doctor_certificates ENABLE ROW LEVEL SECURITY;

-- 2) Índices de FK faltantes (performance)
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_active_certificate_id
  ON public.doctor_profiles(active_certificate_id);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_user_id
  ON public.payment_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_system_config_updated_by
  ON public.system_config(updated_by);

-- 3) Funções com search_path estático (security lint)
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema_name, p.proname AS function_name, oidvectortypes(p.proargtypes) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'cleanup_old_rate_limits',
        'increment_version',
        'validate_status_transition',
        'get_next_job',
        'update_updated_at_column'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp;',
      fn.schema_name,
      fn.function_name,
      fn.args
    );
  END LOOP;
END $$;
