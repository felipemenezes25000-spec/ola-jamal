-- ============================================================
-- Schema completo RenoveJá+ para RDS PostgreSQL
-- Unificado a partir de infra/migrations/. Última atualização: 2026-03-17
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CORE: users, auth_tokens, doctor_profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    cpf TEXT,
    birth_date TIMESTAMPTZ,
    gender VARCHAR(20),
    address TEXT,
    street VARCHAR(200),
    number VARCHAR(20),
    neighborhood VARCHAR(100),
    complement VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(2),
    postal_code VARCHAR(10),
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
    profile_complete BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_cpf ON public.users(cpf);

CREATE TABLE IF NOT EXISTS public.auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON public.auth_tokens(token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON public.auth_tokens(user_id);

CREATE TABLE IF NOT EXISTS public.doctor_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    crm TEXT NOT NULL,
    crm_state TEXT NOT NULL,
    specialty TEXT NOT NULL,
    professional_address TEXT,
    professional_postal_code TEXT,
    professional_street TEXT,
    professional_number TEXT,
    professional_neighborhood TEXT,
    professional_complement TEXT,
    professional_city TEXT,
    professional_state TEXT,
    professional_phone VARCHAR(30),
    university TEXT,
    courses TEXT,
    hospitals_services TEXT,
    bio TEXT,
    rating DECIMAL(3,2) NOT NULL DEFAULT 5.0,
    total_consultations INTEGER NOT NULL DEFAULT 0,
    available BOOLEAN NOT NULL DEFAULT TRUE,
    active_certificate_id UUID,
    crm_validated BOOLEAN NOT NULL DEFAULT FALSE,
    crm_validated_at TIMESTAMPTZ,
    approval_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_user_id ON public.doctor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_specialty ON public.doctor_profiles(specialty);

-- ============================================================
-- REQUESTS (solicitações médicas — core do app)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_code TEXT,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    patient_name TEXT,
    doctor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    doctor_name TEXT,
    request_type TEXT NOT NULL CHECK (request_type IN ('prescription', 'exam', 'consultation')),
    status TEXT NOT NULL DEFAULT 'submitted',
    prescription_type TEXT CHECK (prescription_type IN ('simples', 'controlado', 'azul')),
    prescription_kind VARCHAR(30),
    medications JSONB NOT NULL DEFAULT '[]',
    prescription_images JSONB NOT NULL DEFAULT '[]',
    exam_type TEXT,
    exams JSONB NOT NULL DEFAULT '[]',
    exam_images JSONB NOT NULL DEFAULT '[]',
    symptoms TEXT,
    price DECIMAL(10,2),
    notes TEXT,
    rejection_reason TEXT,
    access_code TEXT,
    signed_at TIMESTAMPTZ,
    prescription_valid_days INTEGER,
    signed_document_url TEXT,
    signature_id TEXT,
    -- IA
    ai_summary_for_doctor TEXT,
    ai_extracted_json TEXT,
    ai_risk_level TEXT,
    ai_urgency TEXT,
    ai_readability_ok BOOLEAN,
    ai_message_to_user TEXT,
    auto_observation TEXT,
    doctor_conduct_notes TEXT,
    include_conduct_in_pdf BOOLEAN DEFAULT TRUE,
    ai_conduct_suggestion TEXT,
    ai_suggested_exams TEXT,
    conduct_updated_at TIMESTAMPTZ,
    conduct_updated_by UUID REFERENCES public.users(id),
    -- Consulta
    consultation_type TEXT,
    contracted_minutes INTEGER,
    price_per_minute DECIMAL(10,2),
    consultation_started_at TIMESTAMPTZ,
    doctor_call_connected_at TIMESTAMPTZ,
    patient_call_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_requests_patient_id ON public.requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_requests_doctor_id ON public.requests(doctor_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_type ON public.requests(request_type);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON public.requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_short_code ON public.requests(short_code) WHERE short_code IS NOT NULL;

-- ============================================================
-- AUTH & SECURITY
-- ============================================================

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);

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
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    validated_at_registration BOOLEAN NOT NULL DEFAULT FALSE,
    last_validation_date TIMESTAMPTZ,
    last_validation_result TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_by_ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doctor_certificates_doctor ON public.doctor_certificates(doctor_profile_id);
CREATE INDEX IF NOT EXISTS idx_doctor_certificates_valid ON public.doctor_certificates(is_valid, is_revoked);

-- ============================================================
-- NOTIFICATIONS & PUSH
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL DEFAULT 'info',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);

CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'unknown',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_unique ON public.push_tokens(user_id, token);

CREATE TABLE IF NOT EXISTS public.user_push_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    requests_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    payments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    consultations_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VIDEO & CONSULTATION
-- ============================================================

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
);
CREATE INDEX IF NOT EXISTS idx_video_rooms_request_id ON public.video_rooms(request_id);

CREATE TABLE IF NOT EXISTS public.consultation_anamnesis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    transcript_text TEXT,
    anamnesis_json TEXT,
    ai_suggestions_json TEXT,
    evidence_json TEXT,
    soap_notes_json TEXT,
    transcript_file_url TEXT,
    recording_file_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_anamnesis_request_id ON public.consultation_anamnesis(request_id);

CREATE TABLE IF NOT EXISTS public.consultation_time_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    balance_minutes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_time_bank_patient ON public.consultation_time_bank(patient_id);

CREATE TABLE IF NOT EXISTS public.consultation_time_bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_id UUID NOT NULL REFERENCES public.consultation_time_bank(id) ON DELETE CASCADE,
    request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
    delta_minutes INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ctb_transactions_bank_id ON public.consultation_time_bank_transactions(bank_id);

-- ============================================================
-- AUDIT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
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
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(created_at DESC);

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
);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON public.audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC);

-- ============================================================
-- PRONTUÁRIO CLÍNICO (FHIR-Lite)
-- ============================================================

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
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients(user_id);

CREATE TABLE IF NOT EXISTS public.encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    practitioner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source_request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
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
);
CREATE INDEX IF NOT EXISTS idx_encounters_patient_id ON public.encounters(patient_id);

CREATE TABLE IF NOT EXISTS public.medical_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    practitioner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    source_request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
    signed_document_url TEXT,
    signature_id TEXT,
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
);
CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_id ON public.medical_documents(patient_id);

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
);

CREATE TABLE IF NOT EXISTS public.patient_allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    type TEXT,
    description TEXT NOT NULL,
    severity TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.patient_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    icd10_code VARCHAR(10),
    description TEXT NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.patient_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    drug TEXT NOT NULL,
    dose TEXT,
    form TEXT,
    posology TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.patient_clinical_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCTOR NOTES & AI LOGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.doctor_patient_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    note_type TEXT NOT NULL DEFAULT 'progress_note',
    content TEXT NOT NULL,
    request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_notes_doctor_patient ON public.doctor_patient_notes(doctor_id, patient_id);

CREATE TABLE IF NOT EXISTS public.ai_interaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    latency_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CARE PLANS (pós-consulta)
-- ============================================================

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
);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_consultation_id ON public.ai_suggestions(consultation_id);

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
);
CREATE INDEX IF NOT EXISTS idx_care_plans_consultation_id ON public.care_plans(consultation_id);

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
);
CREATE INDEX IF NOT EXISTS idx_care_plan_tasks_care_plan_id ON public.care_plan_tasks(care_plan_id);

CREATE TABLE IF NOT EXISTS public.care_plan_task_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.care_plan_tasks(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    content_type TEXT NOT NULL,
    uploaded_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_outbox_events_idempotency_key ON public.outbox_events(idempotency_key);

-- Fim do schema RenoveJá+
