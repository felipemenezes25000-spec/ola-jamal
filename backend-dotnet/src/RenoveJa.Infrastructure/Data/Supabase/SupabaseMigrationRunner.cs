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

    private static readonly string[] UserPushPreferencesMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.user_push_preferences (
            user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
            requests_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            payments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            consultations_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_user_push_preferences_user_id ON public.user_push_preferences(user_id)"
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

    private static readonly string[] DoctorApprovalStatusMigrations =
    {
        "ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'",
        "UPDATE public.doctor_profiles SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = ''"
    };

    private static readonly string[] ProntuarioMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.patients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            cpf TEXT NOT NULL,
            birth_date TIMESTAMPTZ,
            sex VARCHAR(20),
            social_name TEXT,
            phone TEXT,
            email TEXT,
            address_line1 TEXT,
            city VARCHAR(100),
            state VARCHAR(2),
            zip_code VARCHAR(10),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_patients_cpf ON public.patients(cpf)",
        """
        CREATE TABLE IF NOT EXISTS public.encounters (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            practitioner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            type TEXT NOT NULL DEFAULT 'teleconsultation',
            status TEXT NOT NULL DEFAULT 'draft',
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            finished_at TIMESTAMPTZ,
            channel TEXT,
            reason TEXT,
            anamnesis TEXT,
            physical_exam TEXT,
            plan TEXT,
            main_icd10_code VARCHAR(10),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_encounters_patient_id ON public.encounters(patient_id)",
        "CREATE INDEX IF NOT EXISTS idx_encounters_practitioner_id ON public.encounters(practitioner_id)",
        "CREATE INDEX IF NOT EXISTS idx_encounters_started_at ON public.encounters(started_at DESC)",
        """
        CREATE TABLE IF NOT EXISTS public.medical_documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            practitioner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
            document_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            previous_document_id UUID REFERENCES public.medical_documents(id) ON DELETE SET NULL,
            medications JSONB DEFAULT '[]',
            exams JSONB DEFAULT '[]',
            report_body TEXT,
            clinical_justification TEXT,
            priority TEXT,
            icd10_code VARCHAR(10),
            leave_days INTEGER,
            general_instructions TEXT,
            signature_hash TEXT,
            signature_algorithm TEXT,
            signature_certificate TEXT,
            signed_at TIMESTAMPTZ,
            signature_is_valid BOOLEAN,
            signature_validation_result TEXT,
            signature_policy_oid TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_id ON public.medical_documents(patient_id)",
        "CREATE INDEX IF NOT EXISTS idx_medical_documents_encounter_id ON public.medical_documents(encounter_id)",
        "CREATE INDEX IF NOT EXISTS idx_medical_documents_created_at ON public.medical_documents(created_at DESC)",
        """
        CREATE TABLE IF NOT EXISTS public.consent_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            consent_type TEXT NOT NULL,
            legal_basis TEXT NOT NULL,
            purpose TEXT NOT NULL,
            accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            channel TEXT NOT NULL,
            text_version TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_consent_records_patient_id ON public.consent_records(patient_id)",
        """
        CREATE TABLE IF NOT EXISTS public.audit_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id UUID,
            channel TEXT,
            ip_address TEXT,
            user_agent TEXT,
            correlation_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON public.audit_events(entity_type, entity_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON public.audit_events(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC)",
        // RLS
        "ALTER TABLE IF EXISTS public.patients ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS public.encounters ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS public.medical_documents ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS public.consent_records ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS public.audit_events ENABLE ROW LEVEL SECURITY",
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patients' AND policyname='patients_select_own') THEN
                CREATE POLICY patients_select_own ON public.patients FOR SELECT USING (user_id = auth.uid());
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patients' AND policyname='patients_insert_own') THEN
                CREATE POLICY patients_insert_own ON public.patients FOR INSERT WITH CHECK (user_id = auth.uid());
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='patients' AND policyname='patients_update_own') THEN
                CREATE POLICY patients_update_own ON public.patients FOR UPDATE USING (user_id = auth.uid());
            END IF;
        END $$
        """,
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='encounters' AND policyname='encounters_select_patient') THEN
                CREATE POLICY encounters_select_patient ON public.encounters FOR SELECT USING (
                    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()) OR practitioner_id = auth.uid()
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='encounters' AND policyname='encounters_insert_practitioner') THEN
                CREATE POLICY encounters_insert_practitioner ON public.encounters FOR INSERT WITH CHECK (practitioner_id = auth.uid());
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='encounters' AND policyname='encounters_update_practitioner') THEN
                CREATE POLICY encounters_update_practitioner ON public.encounters FOR UPDATE USING (practitioner_id = auth.uid());
            END IF;
        END $$
        """,
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medical_documents' AND policyname='medical_documents_select') THEN
                CREATE POLICY medical_documents_select ON public.medical_documents FOR SELECT USING (
                    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()) OR practitioner_id = auth.uid()
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medical_documents' AND policyname='medical_documents_insert') THEN
                CREATE POLICY medical_documents_insert ON public.medical_documents FOR INSERT WITH CHECK (practitioner_id = auth.uid());
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='medical_documents' AND policyname='medical_documents_update') THEN
                CREATE POLICY medical_documents_update ON public.medical_documents FOR UPDATE USING (practitioner_id = auth.uid());
            END IF;
        END $$
        """,
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='consent_records' AND policyname='consent_records_select_own') THEN
                CREATE POLICY consent_records_select_own ON public.consent_records FOR SELECT USING (
                    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='consent_records' AND policyname='consent_records_insert') THEN
                CREATE POLICY consent_records_insert ON public.consent_records FOR INSERT WITH CHECK (
                    patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
                );
            END IF;
        END $$
        """,
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_events' AND policyname='audit_events_select_own') THEN
                CREATE POLICY audit_events_select_own ON public.audit_events FOR SELECT USING (user_id = auth.uid());
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_events' AND policyname='audit_events_insert_system') THEN
                CREATE POLICY audit_events_insert_system ON public.audit_events FOR INSERT WITH CHECK (true);
            END IF;
        END $$
        """,
        // Patient sub-entity tables
        """
        CREATE TABLE IF NOT EXISTS public.patient_allergies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            type TEXT,
            description TEXT NOT NULL,
            severity TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient_id ON public.patient_allergies(patient_id)",
        """
        CREATE TABLE IF NOT EXISTS public.patient_conditions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            icd10_code VARCHAR(10),
            description TEXT NOT NULL,
            start_date TIMESTAMPTZ,
            end_date TIMESTAMPTZ,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient_id ON public.patient_conditions(patient_id)",
        """
        CREATE TABLE IF NOT EXISTS public.patient_medications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            drug TEXT NOT NULL,
            dose TEXT,
            form TEXT,
            posology TEXT,
            start_date TIMESTAMPTZ,
            end_date TIMESTAMPTZ,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_patient_medications_patient_id ON public.patient_medications(patient_id)",
        """
        CREATE TABLE IF NOT EXISTS public.patient_clinical_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            description TEXT NOT NULL,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_patient_clinical_events_patient_id ON public.patient_clinical_events(patient_id)",
        "ALTER TABLE IF EXISTS public.patient_allergies ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS public.patient_conditions ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS public.patient_medications ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS public.patient_clinical_events ENABLE ROW LEVEL SECURITY"
    };

    private static readonly string[] CarePlanMigrations =
    {
        // ai_suggestions
        """
        CREATE TABLE IF NOT EXISTS public.ai_suggestions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            consultation_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
            patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            doctor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
            type TEXT NOT NULL DEFAULT 'exam_suggestion',
            status TEXT NOT NULL DEFAULT 'generated',
            model TEXT NOT NULL,
            payload_json JSONB NOT NULL,
            payload_hash TEXT NOT NULL,
            correlation_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_ai_suggestions_consultation_id ON public.ai_suggestions(consultation_id)",
        "CREATE INDEX IF NOT EXISTS idx_ai_suggestions_patient_id ON public.ai_suggestions(patient_id)",
        "CREATE INDEX IF NOT EXISTS idx_ai_suggestions_doctor_id ON public.ai_suggestions(doctor_id)",
        "CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON public.ai_suggestions(status)",
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_suggestions_idempotency
        ON public.ai_suggestions (consultation_id, COALESCE(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid), payload_hash)
        """,
        "ALTER TABLE public.ai_suggestions DROP CONSTRAINT IF EXISTS ai_suggestions_status_check",
        """
        ALTER TABLE public.ai_suggestions
        ADD CONSTRAINT ai_suggestions_status_check CHECK (status IN ('generated','reviewed','approved','rejected','superseded'))
        """,

        // care_plans
        """
        CREATE TABLE IF NOT EXISTS public.care_plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            consultation_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
            patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            responsible_doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
            status TEXT NOT NULL DEFAULT 'active',
            created_from_ai_suggestion_id UUID NOT NULL REFERENCES public.ai_suggestions(id) ON DELETE RESTRICT,
            correlation_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            closed_at TIMESTAMPTZ
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_care_plans_consultation_id ON public.care_plans(consultation_id)",
        "CREATE INDEX IF NOT EXISTS idx_care_plans_patient_id ON public.care_plans(patient_id)",
        "CREATE INDEX IF NOT EXISTS idx_care_plans_responsible_doctor_id ON public.care_plans(responsible_doctor_id)",
        "CREATE INDEX IF NOT EXISTS idx_care_plans_status ON public.care_plans(status)",
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_care_plan_active_per_consultation
        ON public.care_plans(consultation_id)
        WHERE status IN ('active','waiting_patient','waiting_results','ready_for_review')
        """,
        "ALTER TABLE public.care_plans DROP CONSTRAINT IF EXISTS care_plans_status_check",
        """
        ALTER TABLE public.care_plans
        ADD CONSTRAINT care_plans_status_check CHECK (status IN ('active','waiting_patient','waiting_results','ready_for_review','closed','escalated'))
        """,

        // care_plan_tasks
        """
        CREATE TABLE IF NOT EXISTS public.care_plan_tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            care_plan_id UUID NOT NULL REFERENCES public.care_plans(id) ON DELETE CASCADE,
            assigned_doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
            type TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'pending',
            title TEXT NOT NULL,
            description TEXT,
            payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            due_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_care_plan_tasks_care_plan_id ON public.care_plan_tasks(care_plan_id)",
        "CREATE INDEX IF NOT EXISTS idx_care_plan_tasks_assigned_doctor_id ON public.care_plan_tasks(assigned_doctor_id)",
        "CREATE INDEX IF NOT EXISTS idx_care_plan_tasks_state ON public.care_plan_tasks(state)",
        "ALTER TABLE public.care_plan_tasks DROP CONSTRAINT IF EXISTS care_plan_tasks_type_check",
        """
        ALTER TABLE public.care_plan_tasks
        ADD CONSTRAINT care_plan_tasks_type_check CHECK (type IN ('exam_order','upload_result','follow_up','in_person_guidance','instruction'))
        """,
        "ALTER TABLE public.care_plan_tasks DROP CONSTRAINT IF EXISTS care_plan_tasks_state_check",
        """
        ALTER TABLE public.care_plan_tasks
        ADD CONSTRAINT care_plan_tasks_state_check CHECK (state IN ('pending','in_progress','done_by_patient','submitted','reviewed','rejected','closed'))
        """,

        // care_plan_task_files
        """
        CREATE TABLE IF NOT EXISTS public.care_plan_task_files (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id UUID NOT NULL REFERENCES public.care_plan_tasks(id) ON DELETE CASCADE,
            storage_path TEXT NOT NULL,
            file_url TEXT NOT NULL,
            content_type TEXT NOT NULL,
            uploaded_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_care_plan_task_files_task_id ON public.care_plan_task_files(task_id)",

        // outbox_events
        """
        CREATE TABLE IF NOT EXISTS public.outbox_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            aggregate_type TEXT NOT NULL,
            aggregate_id UUID NOT NULL,
            event_type TEXT NOT NULL,
            payload_json JSONB NOT NULL,
            idempotency_key TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            processed_at TIMESTAMPTZ
        )
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_outbox_events_idempotency_key ON public.outbox_events(idempotency_key)",
        "CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created_at ON public.outbox_events(status, created_at)",

        // RLS
        "ALTER TABLE IF EXISTS public.care_plans ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS public.care_plan_tasks ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE IF EXISTS public.care_plan_task_files ENABLE ROW LEVEL SECURITY",
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='care_plans' AND policyname='care_plans_patient_select') THEN
                CREATE POLICY care_plans_patient_select ON public.care_plans FOR SELECT USING (patient_id = auth.uid());
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='care_plans' AND policyname='care_plans_doctor_select') THEN
                CREATE POLICY care_plans_doctor_select ON public.care_plans FOR SELECT USING (responsible_doctor_id = auth.uid());
            END IF;
        END $$;
        """,
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='care_plan_tasks' AND policyname='care_plan_tasks_patient_select') THEN
                CREATE POLICY care_plan_tasks_patient_select ON public.care_plan_tasks FOR SELECT USING (
                    EXISTS (
                        SELECT 1 FROM public.care_plans cp
                        WHERE cp.id = care_plan_tasks.care_plan_id
                        AND cp.patient_id = auth.uid()
                    )
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='care_plan_tasks' AND policyname='care_plan_tasks_doctor_select') THEN
                CREATE POLICY care_plan_tasks_doctor_select ON public.care_plan_tasks FOR SELECT USING (
                    EXISTS (
                        SELECT 1 FROM public.care_plans cp
                        WHERE cp.id = care_plan_tasks.care_plan_id
                        AND cp.responsible_doctor_id = auth.uid()
                    )
                );
            END IF;
        END $$;
        """,
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='care_plan_task_files' AND policyname='care_plan_task_files_patient_select') THEN
                CREATE POLICY care_plan_task_files_patient_select ON public.care_plan_task_files FOR SELECT USING (
                    EXISTS (
                        SELECT 1
                        FROM public.care_plan_tasks t
                        JOIN public.care_plans cp ON cp.id = t.care_plan_id
                        WHERE t.id = care_plan_task_files.task_id
                        AND cp.patient_id = auth.uid()
                    )
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='care_plan_task_files' AND policyname='care_plan_task_files_doctor_select') THEN
                CREATE POLICY care_plan_task_files_doctor_select ON public.care_plan_task_files FOR SELECT USING (
                    EXISTS (
                        SELECT 1
                        FROM public.care_plan_tasks t
                        JOIN public.care_plans cp ON cp.id = t.care_plan_id
                        WHERE t.id = care_plan_task_files.task_id
                        AND cp.responsible_doctor_id = auth.uid()
                    )
                );
            END IF;
        END $$;
        """
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
            ("user_push_preferences", UserPushPreferencesMigrations),
            ("product_prices", ProductPricesMigrations),
            ("payment_attempts", PaymentAttemptsMigrations),
            ("webhook_events", WebhookEventsMigrations),
            ("saved_cards", SavedCardsMigrations),
            ("doctor_approval_status", DoctorApprovalStatusMigrations),
            ("prontuario", ProntuarioMigrations),
            ("care_plans", CarePlanMigrations)
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
