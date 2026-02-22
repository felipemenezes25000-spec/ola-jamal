using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

namespace RenoveJa.Infrastructure.Data.Supabase;

/// <summary>
/// Marker class for logger (static classes can't be used as type arguments).
/// </summary>
internal class MigrationRunnerLogger { }

/// <summary>
/// Executa migrations SQL no Postgres do Supabase quando DatabaseUrl está configurada.
/// </summary>
public static class SupabaseMigrationRunner
{
    private static readonly string[] PasswordResetTokensMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            token TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            used BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token)",
        "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at)"
    };

    private static readonly string[] RequestAiColumns =
    {
        """
        ALTER TABLE public.requests
          ADD COLUMN IF NOT EXISTS ai_summary_for_doctor TEXT,
          ADD COLUMN IF NOT EXISTS ai_extracted_json TEXT,
          ADD COLUMN IF NOT EXISTS ai_risk_level TEXT,
          ADD COLUMN IF NOT EXISTS ai_urgency TEXT,
          ADD COLUMN IF NOT EXISTS ai_readability_ok BOOLEAN,
          ADD COLUMN IF NOT EXISTS ai_message_to_user TEXT
        """,
        "ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS access_code TEXT"
    };

    private static readonly string[] PrescriptionProfileFieldsMigrations =
    {
        "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender VARCHAR(20)",
        "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT",
        "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city VARCHAR(100)",
        "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS state VARCHAR(2)",
        "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10)",
        "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS street VARCHAR(200)",
        "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS number VARCHAR(20)",
        "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100)",
        "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS complement VARCHAR(100)",
        "ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS professional_address TEXT",
        "ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS professional_phone VARCHAR(30)",
        "ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS prescription_kind VARCHAR(30)"
    };

    private static readonly string[] DoctorCertificatesMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.doctor_certificates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            doctor_profile_id UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
            subject_name TEXT NOT NULL,
            issuer_name TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            not_before TIMESTAMPTZ NOT NULL,
            not_after TIMESTAMPTZ NOT NULL,
            pfx_storage_path TEXT NOT NULL,
            pfx_file_name TEXT NOT NULL,
            cpf TEXT,
            crm_number TEXT,
            is_valid BOOLEAN NOT NULL DEFAULT true,
            is_revoked BOOLEAN NOT NULL DEFAULT false,
            revoked_at TIMESTAMPTZ,
            revocation_reason TEXT,
            validated_at_registration BOOLEAN NOT NULL DEFAULT false,
            last_validation_date TIMESTAMPTZ,
            last_validation_result TEXT,
            uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            uploaded_by_ip TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_doctor_certificates_doctor ON public.doctor_certificates(doctor_profile_id)",
        "CREATE INDEX IF NOT EXISTS idx_doctor_certificates_valid ON public.doctor_certificates(is_valid, is_revoked)",
        "CREATE INDEX IF NOT EXISTS idx_doctor_certificates_not_after ON public.doctor_certificates(not_after)",
        "ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS active_certificate_id UUID REFERENCES public.doctor_certificates(id)",
        "ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS crm_validated BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS crm_validated_at TIMESTAMPTZ"
    };

    private static readonly string[] AuditLogsMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            user_email TEXT,
            user_role TEXT,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            details TEXT,
            ip_address TEXT,
            user_agent TEXT,
            endpoint TEXT,
            http_method TEXT,
            status_code INTEGER,
            event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
            duration BIGINT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action)",
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON public.audit_logs(user_id, created_at DESC)"
    };

    private static readonly string[] NotificationsMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            notification_type TEXT NOT NULL DEFAULT 'info',
            read BOOLEAN NOT NULL DEFAULT FALSE,
            data JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read)"
    };

    private static readonly string[] VideoRoomsMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.video_rooms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
            room_name TEXT NOT NULL,
            room_url TEXT,
            status TEXT NOT NULL DEFAULT 'waiting',
            started_at TIMESTAMPTZ,
            ended_at TIMESTAMPTZ,
            duration_seconds INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_video_rooms_request_id ON public.video_rooms(request_id)",
        "CREATE INDEX IF NOT EXISTS idx_video_rooms_status ON public.video_rooms(status)"
    };

    private static readonly string[] ConsultationAnamnesisMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.consultation_anamnesis (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
            patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            transcript_text TEXT,
            anamnesis_json TEXT,
            ai_suggestions_json TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_anamnesis_request_id ON public.consultation_anamnesis(request_id)",
        "CREATE INDEX IF NOT EXISTS idx_consultation_anamnesis_patient_id ON public.consultation_anamnesis(patient_id)"
    };

    private static readonly string[] PushTokensMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.push_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            token TEXT NOT NULL,
            device_type TEXT NOT NULL DEFAULT 'unknown',
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens(token)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_unique ON public.push_tokens(user_id, token)"
    };

    private static readonly string[] ProductPricesMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.product_prices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            product_type TEXT NOT NULL,
            subtype TEXT NOT NULL DEFAULT 'default',
            price_brl DECIMAL(10,2) NOT NULL,
            name TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_product_prices_unique ON public.product_prices(product_type, subtype)",
        "CREATE INDEX IF NOT EXISTS idx_product_prices_active ON public.product_prices(is_active)",
        """
        INSERT INTO public.product_prices (product_type, subtype, price_brl, name, is_active)
        VALUES
            ('prescription', 'simples', 49.90, 'Receita simples', TRUE),
            ('prescription', 'controlado', 79.90, 'Receita controlada', TRUE),
            ('prescription', 'azul', 69.90, 'Receita azul (antimicrobianos)', TRUE),
            ('exam', 'default', 99.90, 'Pedido de exame', TRUE),
            ('consultation', 'default', 149.90, 'Teleconsulta', TRUE)
        ON CONFLICT (product_type, subtype) DO NOTHING
        """
    };

    private static readonly string[] PaymentAttemptsMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.payment_attempts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
            request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            correlation_id TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            mercado_pago_payment_id TEXT,
            mercado_pago_preference_id TEXT,
            request_url TEXT,
            request_payload TEXT,
            response_payload TEXT,
            response_status_code INTEGER,
            response_status_detail TEXT,
            response_headers TEXT,
            error_message TEXT,
            is_success BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_payment_attempts_correlation_id ON public.payment_attempts(correlation_id)",
        "CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment_id ON public.payment_attempts(payment_id)",
        "CREATE INDEX IF NOT EXISTS idx_payment_attempts_request_id ON public.payment_attempts(request_id)",
        "CREATE INDEX IF NOT EXISTS idx_payment_attempts_mp_payment_id ON public.payment_attempts(mercado_pago_payment_id)",
        "CREATE INDEX IF NOT EXISTS idx_payment_attempts_mp_preference_id ON public.payment_attempts(mercado_pago_preference_id)",
        "CREATE INDEX IF NOT EXISTS idx_payment_attempts_created_at ON public.payment_attempts(created_at DESC)"
    };

    private static readonly string[] WebhookEventsMigrations =
    {
        // Criar tabela com schema completo (inclui colunas legadas: event_id, event_type, source, payload, status, error_message)
        """
        CREATE TABLE IF NOT EXISTS public.webhook_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id TEXT,
            event_type TEXT DEFAULT 'payment',
            source VARCHAR DEFAULT 'mercadopago',
            payload JSONB,
            status VARCHAR DEFAULT 'processed',
            error_message TEXT,
            correlation_id TEXT,
            mercado_pago_payment_id TEXT,
            mercado_pago_request_id TEXT,
            webhook_type TEXT,
            webhook_action TEXT,
            raw_payload TEXT,
            processed_payload TEXT,
            query_string TEXT,
            request_headers TEXT,
            content_type TEXT,
            content_length INTEGER,
            source_ip TEXT,
            is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
            is_processed BOOLEAN NOT NULL DEFAULT FALSE,
            processing_error TEXT,
            payment_status TEXT,
            payment_status_detail TEXT,
            processed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        // Se a tabela já existia, garantir que colunas NOT NULL problemáticas tenham default ou sejam nullable
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='webhook_events' AND column_name='event_type' AND is_nullable='NO') THEN
                ALTER TABLE public.webhook_events ALTER COLUMN event_type SET DEFAULT 'payment';
                ALTER TABLE public.webhook_events ALTER COLUMN event_type DROP NOT NULL;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='webhook_events' AND column_name='event_id' AND is_nullable='NO') THEN
                ALTER TABLE public.webhook_events ALTER COLUMN event_id DROP NOT NULL;
            END IF;
        END $$;
        """,
        // Adicionar colunas do nosso modelo que podem não existir na tabela legada
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS event_id TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'payment'",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS source VARCHAR DEFAULT 'mercadopago'",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS payload JSONB",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'processed'",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS error_message TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS correlation_id TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS mercado_pago_payment_id TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS mercado_pago_request_id TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS webhook_type TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS webhook_action TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS raw_payload TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS processed_payload TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS query_string TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS request_headers TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS content_type TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS content_length INTEGER",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS source_ip TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS is_processed BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS processing_error TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS payment_status TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS payment_status_detail TEXT",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()",
        "ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        // Corrigir constraints legadas que podem impedir inserts
        "ALTER TABLE public.webhook_events DROP CONSTRAINT IF EXISTS webhook_events_status_check",
        "ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_status_check CHECK (status IN ('processed', 'failed', 'ignored', 'pending', 'duplicate'))",
        "ALTER TABLE public.webhook_events DROP CONSTRAINT IF EXISTS webhook_events_event_id_key",
        // Índices
        "CREATE INDEX IF NOT EXISTS idx_webhook_events_correlation_id ON public.webhook_events(correlation_id)",
        "CREATE INDEX IF NOT EXISTS idx_webhook_events_mp_payment_id ON public.webhook_events(mercado_pago_payment_id)",
        "CREATE INDEX IF NOT EXISTS idx_webhook_events_mp_request_id ON public.webhook_events(mercado_pago_request_id)",
        "CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at DESC)"
    };

    private static readonly string[] SavedCardsMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.saved_cards (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            mp_customer_id TEXT NOT NULL,
            mp_card_id TEXT NOT NULL,
            last_four TEXT NOT NULL,
            brand TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_saved_cards_user_id ON public.saved_cards(user_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_cards_mp_card ON public.saved_cards(mp_card_id)"
    };

    /// <summary>
    /// Executa todas as migrations. Só roda se Supabase:DatabaseUrl estiver definida.
    /// </summary>
    public static async Task RunAsync(IServiceProvider serviceProvider, CancellationToken cancellationToken = default)
    {
        var config = serviceProvider.GetService<IOptions<SupabaseConfig>>()?.Value;
        var logger = serviceProvider.GetService<ILogger<MigrationRunnerLogger>>();

        if (config == null || string.IsNullOrWhiteSpace(config.DatabaseUrl))
        {
            logger?.LogInformation("Supabase:DatabaseUrl not configured, skipping migrations");
            return;
        }

        var connectionString = config.DatabaseUrl.Trim();
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(cancellationToken);

        logger?.LogInformation("Running Supabase migrations...");

        var allMigrations = new (string Name, string[] Sqls)[]
        {
            ("password_reset_tokens", PasswordResetTokensMigrations),
            ("request_ai_columns", RequestAiColumns),
            ("prescription_profile_fields", PrescriptionProfileFieldsMigrations),
            ("doctor_certificates", DoctorCertificatesMigrations),
            ("audit_logs", AuditLogsMigrations),
            ("notifications", NotificationsMigrations),
            ("video_rooms", VideoRoomsMigrations),
            ("consultation_anamnesis", ConsultationAnamnesisMigrations),
            ("push_tokens", PushTokensMigrations),
            ("product_prices", ProductPricesMigrations),
            ("payment_attempts", PaymentAttemptsMigrations),
            ("webhook_events", WebhookEventsMigrations),
            ("saved_cards", SavedCardsMigrations)
        };

        foreach (var (name, sqls) in allMigrations)
        {
            foreach (var sql in sqls)
            {
                try
                {
                    await using var cmd = conn.CreateCommand();
                    cmd.CommandText = sql;
                    await cmd.ExecuteNonQueryAsync(cancellationToken);
                }
                catch (Exception ex)
                {
                    logger?.LogWarning(ex, "Migration {Name} warning (may already exist)", name);
                }
            }
            logger?.LogInformation("Migration {Name} completed", name);
        }

        logger?.LogInformation("All Supabase migrations completed successfully");
    }
}
