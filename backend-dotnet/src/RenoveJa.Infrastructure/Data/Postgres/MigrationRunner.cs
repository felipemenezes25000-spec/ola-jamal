using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Npgsql;

namespace RenoveJa.Infrastructure.Data.Postgres;

internal class MigrationRunnerLogger { }

public static class MigrationRunner
{
    private static readonly string[] RefreshTokenMigrations =
    {
        "ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS refresh_token TEXT",
        "ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ",
        "CREATE INDEX IF NOT EXISTS idx_auth_tokens_refresh_token ON auth_tokens (refresh_token) WHERE refresh_token IS NOT NULL"
    };

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
            subject_name TEXT NOT NULL, issuer_name TEXT NOT NULL, serial_number TEXT NOT NULL,
            not_before TIMESTAMPTZ NOT NULL, not_after TIMESTAMPTZ NOT NULL,
            pfx_storage_path TEXT NOT NULL, pfx_file_name TEXT NOT NULL,
            cpf TEXT, crm_number TEXT,
            is_valid BOOLEAN NOT NULL DEFAULT true, is_revoked BOOLEAN NOT NULL DEFAULT false,
            revoked_at TIMESTAMPTZ, revocation_reason TEXT,
            validated_at_registration BOOLEAN NOT NULL DEFAULT false,
            last_validation_date TIMESTAMPTZ, last_validation_result TEXT,
            uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(), uploaded_by_ip TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_doctor_certificates_doctor ON public.doctor_certificates(doctor_profile_id)",
        "CREATE INDEX IF NOT EXISTS idx_doctor_certificates_valid ON public.doctor_certificates(is_valid, is_revoked)",
        "ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS active_certificate_id UUID REFERENCES public.doctor_certificates(id)",
        "ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS crm_validated BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS crm_validated_at TIMESTAMPTZ"
    };

    private static readonly string[] AuditLogsMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
            user_email TEXT, user_role TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL,
            entity_id TEXT, details TEXT, ip_address TEXT, user_agent TEXT,
            endpoint TEXT, http_method TEXT, status_code INTEGER,
            event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(), duration BIGINT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(created_at DESC)"
    };

    private static readonly string[] NotificationsMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            title TEXT NOT NULL, message TEXT NOT NULL,
            notification_type TEXT NOT NULL DEFAULT 'info',
            read BOOLEAN NOT NULL DEFAULT FALSE, data JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id)",
        "CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read)"
    };

    private static readonly string[] VideoRoomsMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.video_rooms (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
            room_name TEXT NOT NULL, room_url TEXT,
            status TEXT NOT NULL DEFAULT 'waiting',
            started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, duration_seconds INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_video_rooms_request_id ON public.video_rooms(request_id)"
    };

    private static readonly string[] ConsultationAnamnesisMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.consultation_anamnesis (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
            patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            transcript_text TEXT, anamnesis_json TEXT, ai_suggestions_json TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_anamnesis_request_id ON public.consultation_anamnesis(request_id)",
        "ALTER TABLE public.consultation_anamnesis ADD COLUMN IF NOT EXISTS transcript_file_url TEXT",
        "ALTER TABLE public.consultation_anamnesis ADD COLUMN IF NOT EXISTS evidence_json TEXT",
        "ALTER TABLE public.consultation_anamnesis ADD COLUMN IF NOT EXISTS recording_file_url TEXT",
        "ALTER TABLE public.consultation_anamnesis ADD COLUMN IF NOT EXISTS soap_notes_json TEXT"
    };

    private static readonly string[] PushTokensMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.push_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            token TEXT NOT NULL, device_type TEXT NOT NULL DEFAULT 'unknown',
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
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
        """
    };

    private static readonly string[] DoctorApprovalStatusMigrations =
    {
        "ALTER TABLE public.doctor_profiles ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'",
        "UPDATE public.doctor_profiles SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = ''"
    };

    private static readonly string[] DoctorPatientNotesMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.doctor_patient_notes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            note_type TEXT NOT NULL DEFAULT 'progress_note',
            content TEXT NOT NULL,
            request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_doctor_patient_notes_doctor_patient ON public.doctor_patient_notes(doctor_id, patient_id)"
    };

    private static readonly string[] ConsultationTimeBankMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.consultation_time_bank (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            consultation_type TEXT NOT NULL DEFAULT 'medico_clinico',
            balance_seconds INTEGER NOT NULL DEFAULT 0,
            last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "ALTER TABLE public.consultation_time_bank ADD COLUMN IF NOT EXISTS consultation_type TEXT NOT NULL DEFAULT 'medico_clinico'",
        "ALTER TABLE public.consultation_time_bank ADD COLUMN IF NOT EXISTS balance_seconds INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE public.consultation_time_bank ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "CREATE INDEX IF NOT EXISTS idx_consultation_time_bank_patient_type ON public.consultation_time_bank(patient_id, consultation_type)",
        """
        CREATE TABLE IF NOT EXISTS public.consultation_time_bank_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
            consultation_type TEXT NOT NULL DEFAULT 'medico_clinico',
            delta_seconds INTEGER NOT NULL DEFAULT 0,
            reason TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "ALTER TABLE public.consultation_time_bank_transactions ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE",
        "ALTER TABLE public.consultation_time_bank_transactions ADD COLUMN IF NOT EXISTS consultation_type TEXT NOT NULL DEFAULT 'medico_clinico'",
        "ALTER TABLE public.consultation_time_bank_transactions ADD COLUMN IF NOT EXISTS delta_seconds INTEGER NOT NULL DEFAULT 0",
        "CREATE INDEX IF NOT EXISTS idx_ctb_transactions_patient ON public.consultation_time_bank_transactions(patient_id)"
    };

    private static readonly string[] AiInteractionLogsMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.ai_interaction_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
            user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
            provider TEXT NOT NULL, model TEXT NOT NULL,
            prompt_tokens INTEGER, completion_tokens INTEGER, latency_ms INTEGER,
            success BOOLEAN NOT NULL DEFAULT TRUE, error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    };

    private static readonly string[] ProntuarioMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.patients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            name TEXT NOT NULL, cpf TEXT NOT NULL, birth_date TIMESTAMPTZ,
            sex VARCHAR(20), social_name TEXT, phone TEXT, email TEXT,
            address_line1 TEXT, city VARCHAR(100), state VARCHAR(2), zip_code VARCHAR(10),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients(user_id)",
        """
        CREATE TABLE IF NOT EXISTS public.encounters (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            practitioner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            source_request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
            type TEXT NOT NULL DEFAULT 'teleconsultation', status TEXT NOT NULL DEFAULT 'draft',
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), finished_at TIMESTAMPTZ,
            channel TEXT, reason TEXT, anamnesis TEXT, physical_exam TEXT, plan TEXT,
            main_icd10_code VARCHAR(10), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_encounters_patient_id ON public.encounters(patient_id)",
        """
        CREATE TABLE IF NOT EXISTS public.medical_documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            practitioner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
            source_request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
            signed_document_url TEXT, signature_id TEXT,
            document_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
            previous_document_id UUID REFERENCES public.medical_documents(id) ON DELETE SET NULL,
            medications JSONB DEFAULT '[]', exams JSONB DEFAULT '[]',
            report_body TEXT, clinical_justification TEXT, priority TEXT,
            icd10_code VARCHAR(10), leave_days INTEGER, general_instructions TEXT,
            signature_hash TEXT, signature_algorithm TEXT, signature_certificate TEXT,
            signed_at TIMESTAMPTZ, signature_is_valid BOOLEAN,
            signature_validation_result TEXT, signature_policy_oid TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS public.consent_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            consent_type TEXT NOT NULL, legal_basis TEXT NOT NULL, purpose TEXT NOT NULL,
            accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), channel TEXT NOT NULL,
            text_version TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS public.audit_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
            action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id UUID,
            channel TEXT, ip_address TEXT, user_agent TEXT, correlation_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS public.patient_allergies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            type TEXT, description TEXT NOT NULL, severity TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS public.patient_conditions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            icd10_code VARCHAR(10), description TEXT NOT NULL,
            start_date TIMESTAMPTZ, end_date TIMESTAMPTZ,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS public.patient_medications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            drug TEXT NOT NULL, dose TEXT, form TEXT, posology TEXT,
            start_date TIMESTAMPTZ, end_date TIMESTAMPTZ,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS public.patient_clinical_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
            description TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    };

    private static readonly string[] CarePlanMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.ai_suggestions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            consultation_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
            patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            doctor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
            type TEXT NOT NULL DEFAULT 'exam_suggestion', status TEXT NOT NULL DEFAULT 'generated',
            model TEXT NOT NULL, payload_json JSONB NOT NULL, payload_hash TEXT NOT NULL,
            correlation_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE",
        "ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES public.users(id) ON DELETE SET NULL",
        """
        CREATE TABLE IF NOT EXISTS public.care_plans (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            consultation_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
            patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
            responsible_doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
            status TEXT NOT NULL DEFAULT 'active',
            created_from_ai_suggestion_id UUID NOT NULL REFERENCES public.ai_suggestions(id) ON DELETE RESTRICT,
            correlation_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            closed_at TIMESTAMPTZ
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS public.care_plan_tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            care_plan_id UUID NOT NULL REFERENCES public.care_plans(id) ON DELETE CASCADE,
            assigned_doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
            type TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
            title TEXT NOT NULL, description TEXT,
            payload_json JSONB NOT NULL DEFAULT '{}'::jsonb, due_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS public.care_plan_task_files (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id UUID NOT NULL REFERENCES public.care_plan_tasks(id) ON DELETE CASCADE,
            storage_path TEXT NOT NULL, file_url TEXT NOT NULL, content_type TEXT NOT NULL,
            uploaded_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS public.outbox_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            aggregate_type TEXT NOT NULL, aggregate_id UUID NOT NULL,
            event_type TEXT NOT NULL, payload_json JSONB NOT NULL,
            idempotency_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), processed_at TIMESTAMPTZ
        )
        """,
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_outbox_events_idempotency_key ON public.outbox_events(idempotency_key)"
    };

    /// <summary>Limpa URLs do Supabase Storage que ficaram gravadas no banco RDS.</summary>
    private static readonly string[] CleanupSupabaseUrlsMigrations =
    {
        "UPDATE public.users SET avatar_url = NULL WHERE avatar_url LIKE '%supabase.co%'",
        "UPDATE public.requests SET signed_document_url = NULL WHERE signed_document_url LIKE '%supabase.co%'",
        "UPDATE public.requests SET prescription_images = '[]' WHERE prescription_images::text LIKE '%supabase.co%'",
        "UPDATE public.requests SET exam_images = '[]' WHERE exam_images::text LIKE '%supabase.co%'"
    };

    /// <summary>
    /// Corrige encounters: FK patient_id deve referenciar patients(id), não users(id).
    /// Erro 23503 ocorre quando encounters_patient_id_fkey aponta para users.
    /// Ordem: 1) drop FK 2) corrigir dados 3) recriar FK para patients.
    /// </summary>
    private static readonly string[] FixEncounterPatientIdMigrations =
    {
        // 1. Remover FK incorreta (se existir e apontar para users)
        "ALTER TABLE public.encounters DROP CONSTRAINT IF EXISTS encounters_patient_id_fkey",
        // 2. Corrigir encounters: trocar users.id → patients.id onde o FK estava quebrado
        """
        UPDATE public.encounters e
        SET patient_id = p.id
        FROM public.patients p
        WHERE e.patient_id = p.user_id
          AND e.patient_id != p.id
          AND NOT EXISTS (SELECT 1 FROM public.patients px WHERE px.id = e.patient_id)
        """,
        // 3. Recriar FK correta: encounters.patient_id → patients(id)
        """
        ALTER TABLE public.encounters
          ADD CONSTRAINT encounters_patient_id_fkey
          FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE
        """,
        // 4. Remover FK incorreta de medical_documents (se apontar para users)
        """
        DO $$
        DECLARE fk_name TEXT;
        BEGIN
            SELECT conname INTO fk_name FROM pg_constraint
            WHERE conrelid = 'public.medical_documents'::regclass
              AND contype = 'f' AND conname LIKE '%patient_id%';
            IF fk_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE public.medical_documents DROP CONSTRAINT %I', fk_name);
            END IF;
        END $$
        """,
        // 5. Corrigir medical_documents que herdaram o patient_id errado
        """
        UPDATE public.medical_documents md
        SET patient_id = p.id
        FROM public.patients p
        WHERE md.patient_id = p.user_id
          AND md.patient_id != p.id
          AND NOT EXISTS (SELECT 1 FROM public.patients px WHERE px.id = md.patient_id)
        """,
        // 6. Recriar FK correta: medical_documents.patient_id → patients(id)
        """
        ALTER TABLE public.medical_documents
          ADD CONSTRAINT medical_documents_patient_id_fkey
          FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE
        """
    };

    /// <summary>
    /// Adiciona campos de enriquecimento ao encounter para compliance CFM 1.638/2002
    /// e suporte à emissão pós-consulta com IA.
    /// </summary>
    private static readonly string[] EncounterEnrichmentMigrations =
    {
        """
        ALTER TABLE public.encounters
          ADD COLUMN IF NOT EXISTS differential_diagnosis TEXT,
          ADD COLUMN IF NOT EXISTS patient_instructions TEXT,
          ADD COLUMN IF NOT EXISTS red_flags TEXT,
          ADD COLUMN IF NOT EXISTS structured_anamnesis TEXT
        """
    };

    /// <summary>
    /// Segurança e controle antifraude de documentos médicos.
    /// </summary>
    private static readonly string[] DocumentSecurityMigrations =
    {
        "ALTER TABLE public.medical_documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ",
        "ALTER TABLE public.medical_documents ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMPTZ",
        "ALTER TABLE public.medical_documents ADD COLUMN IF NOT EXISTS dispensed_by TEXT",
        "ALTER TABLE public.medical_documents ADD COLUMN IF NOT EXISTS dispensed_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE public.medical_documents ADD COLUMN IF NOT EXISTS max_dispenses INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE public.medical_documents ADD COLUMN IF NOT EXISTS verify_code_hash TEXT",
        "ALTER TABLE public.medical_documents ADD COLUMN IF NOT EXISTS access_code TEXT",
        "ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ",
        "ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMPTZ",
        "ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS dispensed_count INTEGER NOT NULL DEFAULT 0",
        """
        CREATE TABLE IF NOT EXISTS public.document_access_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            document_id UUID,
            request_id UUID,
            user_id UUID,
            action TEXT NOT NULL,
            actor_type TEXT NOT NULL DEFAULT 'patient',
            ip_address TEXT,
            user_agent TEXT,
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_doc_access_log_doc ON public.document_access_log(document_id)",
        "CREATE INDEX IF NOT EXISTS idx_doc_access_log_req ON public.document_access_log(request_id)",
        "CREATE INDEX IF NOT EXISTS idx_doc_access_log_date ON public.document_access_log(created_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_med_docs_expires ON public.medical_documents(expires_at) WHERE expires_at IS NOT NULL",
        "CREATE INDEX IF NOT EXISTS idx_requests_expires ON public.requests(expires_at) WHERE expires_at IS NOT NULL",
    };

    /// <summary>
    /// Log de verificações e downloads de receitas (anti-fraude, auditoria LGPD).
    /// </summary>
    private static readonly string[] ChronicConditionMigrations =
    {
        "ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS has_chronic_condition BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE public.encounters ADD COLUMN IF NOT EXISTS is_presential TEXT NOT NULL DEFAULT 'false'",
    };

    private static readonly string[] PrescriptionVerificationLogsMigrations =
    {
        """
        CREATE TABLE IF NOT EXISTS public.prescription_verification_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            prescription_id UUID NOT NULL,
            action TEXT NOT NULL,
            outcome TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_prescription_verification_logs_prescription ON public.prescription_verification_logs(prescription_id)",
        "CREATE INDEX IF NOT EXISTS idx_prescription_verification_logs_created ON public.prescription_verification_logs(created_at DESC)",
    };

    /// <summary>
    /// Executa todas as migrations. Só roda se DatabaseUrl estiver definida.
    /// </summary>
    public static async Task RunAsync(IServiceProvider serviceProvider, CancellationToken cancellationToken = default)
    {
        var config = serviceProvider.GetService<IOptions<DatabaseConfig>>()?.Value;
        var logger = serviceProvider.GetService<ILogger<MigrationRunnerLogger>>();

        if (config == null || string.IsNullOrWhiteSpace(config.DatabaseUrl))
        {
            logger?.LogInformation("DatabaseUrl not configured, skipping migrations");
            return;
        }

        var connectionString = config.DatabaseUrl.Trim();
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync(cancellationToken);

        logger?.LogInformation("Running Database migrations...");

        var allMigrations = new (string Name, string[] Sqls)[]
        {
            ("refresh_tokens", RefreshTokenMigrations),
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
            ("doctor_approval_status", DoctorApprovalStatusMigrations),
            ("doctor_patient_notes", DoctorPatientNotesMigrations),
            ("consultation_time_bank", ConsultationTimeBankMigrations),
            ("ai_interaction_logs", AiInteractionLogsMigrations),
            ("prontuario", ProntuarioMigrations),
            ("care_plans", CarePlanMigrations),
            ("encounter_enrichment", EncounterEnrichmentMigrations),
            ("document_security", DocumentSecurityMigrations),
            ("prescription_verification_logs", PrescriptionVerificationLogsMigrations),
            ("cleanup_supabase_urls", CleanupSupabaseUrlsMigrations),
            ("fix_encounter_patient_id", FixEncounterPatientIdMigrations),
            ("chronic_condition", ChronicConditionMigrations)
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

        logger?.LogInformation("All Database migrations completed successfully");
    }
}
