-- ============================================================
-- Schema completo RenoveJá+ para RDS PostgreSQL
-- Gerado automaticamente a partir do banco AWS. Data: 2026-03-17
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ai_interaction_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_interaction_logs (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    request_id UUID,
    interaction_type TEXT,
    model_used TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    latency_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    service_name TEXT,
    model_name TEXT,
    model_version TEXT,
    prompt_hash TEXT,
    response_summary TEXT,
    tokens_used TEXT,
    duration_ms TEXT,
    user_id TEXT,
    provider TEXT,
    model TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_interaction_logs_request_id ON public.ai_interaction_logs USING btree (request_id);
CREATE INDEX IF NOT EXISTS idx_ai_interaction_logs_created_at ON public.ai_interaction_logs USING btree (created_at DESC);

-- ============================================================
-- ai_suggestions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_suggestions (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    encounter_id UUID,
    request_id UUID,
    practitioner_id UUID NOT NULL,
    suggestion_type TEXT NOT NULL,
    input_data JSONB DEFAULT '{}'::jsonb,
    output_data JSONB DEFAULT '{}'::jsonb,
    model_used TEXT,
    accepted BOOLEAN,
    accepted_at TIMESTAMPTZ,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    consultation_id UUID,
    doctor_id UUID,
    type TEXT NOT NULL DEFAULT 'exam_suggestion'::text,
    status TEXT NOT NULL DEFAULT 'generated'::text,
    payload_json JSONB DEFAULT '{}'::jsonb,
    payload_hash TEXT NOT NULL DEFAULT ''::text,
    model TEXT NOT NULL DEFAULT ''::text,
    correlation_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    patient_id UUID
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON public.ai_suggestions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_consultation_id ON public.ai_suggestions USING btree (consultation_id) WHERE (consultation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_doctor_id ON public.ai_suggestions USING btree (doctor_id) WHERE (doctor_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_suggestions_idempotency ON public.ai_suggestions USING btree (consultation_id, COALESCE(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid), payload_hash);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_patient_id ON public.ai_suggestions USING btree (patient_id);

-- ============================================================
-- audit_events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    actor_id UUID,
    actor_role TEXT,
    action TEXT,
    resource_type TEXT,
    resource_id UUID,
    patient_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID,
    entity_type TEXT,
    entity_id TEXT,
    channel TEXT,
    user_agent TEXT,
    correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_events_patient ON public.audit_events USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON public.audit_events USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON public.audit_events USING btree (entity_type, entity_id);

-- ============================================================
-- audit_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID,
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
    old_values TEXT,
    new_values TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id TEXT,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs USING btree (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON public.audit_logs USING btree (user_id, created_at DESC);

-- ============================================================
-- auth_tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auth_tokens (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_tokens_token_key ON public.auth_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON public.auth_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_id ON public.auth_tokens USING btree (user_id);

-- ============================================================
-- care_plan_task_files
-- ============================================================

CREATE TABLE IF NOT EXISTS public.care_plan_task_files (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    storage_path TEXT NOT NULL DEFAULT ''::text,
    content_type TEXT NOT NULL DEFAULT 'application/octet-stream'::text,
    uploaded_by_user_id UUID
);

CREATE INDEX IF NOT EXISTS idx_care_plan_task_files_task_id ON public.care_plan_task_files USING btree (task_id);

-- ============================================================
-- care_plan_tasks
-- ============================================================

CREATE TABLE IF NOT EXISTS public.care_plan_tasks (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    care_plan_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT NOT NULL DEFAULT 'general'::text,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    frequency TEXT,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_doctor_id UUID,
    type TEXT NOT NULL DEFAULT 'instruction'::text,
    state TEXT NOT NULL DEFAULT 'pending'::text,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    due_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_care_plan_tasks_care_plan_id ON public.care_plan_tasks USING btree (care_plan_id);
CREATE INDEX IF NOT EXISTS idx_care_plan_tasks_assigned_doctor_id ON public.care_plan_tasks USING btree (assigned_doctor_id);
CREATE INDEX IF NOT EXISTS idx_care_plan_tasks_state ON public.care_plan_tasks USING btree (state);

-- ============================================================
-- care_plans
-- ============================================================

CREATE TABLE IF NOT EXISTS public.care_plans (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    responsible_doctor_id UUID NOT NULL,
    encounter_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active'::text,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    consultation_id UUID,
    created_from_ai_suggestion_id UUID,
    correlation_id TEXT,
    closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_care_plans_patient ON public.care_plans USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_patient_id ON public.care_plans USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_responsible_doctor_id ON public.care_plans USING btree (responsible_doctor_id);
CREATE INDEX IF NOT EXISTS idx_care_plans_status ON public.care_plans USING btree (status);
CREATE INDEX IF NOT EXISTS idx_care_plans_consultation_id ON public.care_plans USING btree (consultation_id) WHERE (consultation_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS ux_care_plan_active_per_consultation ON public.care_plans USING btree (consultation_id) WHERE (status = ANY (ARRAY['active'::text, 'waiting_patient'::text, 'waiting_results'::text, 'ready_for_review'::text]));

-- ============================================================
-- consent_records
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consent_records (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    consent_type TEXT NOT NULL,
    legal_basis TEXT NOT NULL,
    purpose TEXT NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    channel TEXT NOT NULL,
    text_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_records_patient_id ON public.consent_records USING btree (patient_id);

-- ============================================================
-- consultation_anamnesis
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consultation_anamnesis (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    transcript_text TEXT,
    anamnesis_json TEXT,
    ai_suggestions_json TEXT,
    evidence_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    transcript_file_url TEXT,
    recording_file_url TEXT,
    soap_notes_json TEXT,
    soap_notes_generated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_consultation_anamnesis_request_id ON public.consultation_anamnesis USING btree (request_id);
CREATE INDEX IF NOT EXISTS idx_consultation_anamnesis_patient_id ON public.consultation_anamnesis USING btree (patient_id);

-- ============================================================
-- consultation_time_bank
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consultation_time_bank (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    consultation_type TEXT NOT NULL,
    balance_seconds INTEGER NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    balance_minutes INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS consultation_time_bank_patient_id_consultation_type_key ON public.consultation_time_bank USING btree (patient_id, consultation_type);
CREATE INDEX IF NOT EXISTS idx_consultation_time_bank_patient_type ON public.consultation_time_bank USING btree (patient_id, consultation_type);

-- ============================================================
-- consultation_time_bank_transactions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.consultation_time_bank_transactions (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    request_id UUID,
    consultation_type TEXT NOT NULL,
    delta_seconds INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    bank_id UUID,
    delta_minutes INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ctb_transactions_bank_id ON public.consultation_time_bank_transactions USING btree (bank_id) WHERE (bank_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ctb_transactions_patient ON public.consultation_time_bank_transactions USING btree (patient_id);

-- ============================================================
-- doctor_certificates
-- ============================================================

CREATE TABLE IF NOT EXISTS public.doctor_certificates (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    doctor_profile_id UUID NOT NULL,
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
);

CREATE INDEX IF NOT EXISTS idx_doctor_certificates_doctor ON public.doctor_certificates USING btree (doctor_profile_id);
CREATE INDEX IF NOT EXISTS idx_doctor_certificates_valid ON public.doctor_certificates USING btree (is_valid, is_revoked);
CREATE INDEX IF NOT EXISTS idx_doctor_certificates_not_after ON public.doctor_certificates USING btree (not_after);

-- ============================================================
-- doctor_patient_notes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.doctor_patient_notes (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    note_text TEXT NOT NULL,
    note_type TEXT NOT NULL DEFAULT 'general'::text,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    content TEXT,
    request_id UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS doctor_patient_notes_doctor_id_patient_id_note_type_key ON public.doctor_patient_notes USING btree (doctor_id, patient_id, note_type);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_notes_request_id ON public.doctor_patient_notes USING btree (request_id) WHERE (request_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_notes_doctor_patient ON public.doctor_patient_notes USING btree (doctor_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_patient_notes_created_at ON public.doctor_patient_notes USING btree (created_at DESC);

-- ============================================================
-- doctor_profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS public.doctor_profiles (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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
    rating DECIMAL(3) NOT NULL DEFAULT 5.0,
    total_consultations INTEGER NOT NULL DEFAULT 0,
    available BOOLEAN NOT NULL DEFAULT true,
    active_certificate_id UUID,
    crm_validated BOOLEAN NOT NULL DEFAULT false,
    crm_validated_at TIMESTAMPTZ,
    approval_status TEXT NOT NULL DEFAULT 'pending'::text,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS doctor_profiles_user_id_key ON public.doctor_profiles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_user_id ON public.doctor_profiles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_specialty ON public.doctor_profiles USING btree (specialty);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_available ON public.doctor_profiles USING btree (available);

-- ============================================================
-- document_access_log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_access_log (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    document_id UUID,
    request_id UUID,
    user_id UUID,
    action TEXT NOT NULL,
    actor_type TEXT NOT NULL DEFAULT 'patient'::text,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_access_log_doc ON public.document_access_log USING btree (document_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_log_req ON public.document_access_log USING btree (request_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_log_date ON public.document_access_log USING btree (created_at DESC);

-- ============================================================
-- encounters
-- ============================================================

CREATE TABLE IF NOT EXISTS public.encounters (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    practitioner_id UUID NOT NULL,
    request_id UUID,
    encounter_type TEXT NOT NULL DEFAULT 'consultation'::text,
    status TEXT NOT NULL DEFAULT 'in-progress'::text,
    reason_text TEXT,
    clinical_notes TEXT,
    diagnosis_codes JSONB DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    type TEXT,
    finished_at TIMESTAMPTZ,
    channel TEXT,
    reason TEXT,
    anamnesis TEXT,
    physical_exam TEXT,
    plan TEXT,
    main_icd10_code TEXT,
    source_request_id TEXT,
    is_presential TEXT,
    differential_diagnosis TEXT,
    patient_instructions TEXT,
    red_flags TEXT,
    structured_anamnesis TEXT
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON public.encounters USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_patient_id ON public.encounters USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_practitioner_id ON public.encounters USING btree (practitioner_id);
CREATE INDEX IF NOT EXISTS idx_encounters_started_at ON public.encounters USING btree (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_encounters_source_request ON public.encounters USING btree (source_request_id) WHERE (source_request_id IS NOT NULL);

-- ============================================================
-- medical_documents
-- ============================================================

CREATE TABLE IF NOT EXISTS public.medical_documents (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    encounter_id UUID,
    patient_id UUID NOT NULL,
    practitioner_id UUID NOT NULL,
    request_id UUID,
    document_type TEXT NOT NULL,
    title TEXT,
    content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    pdf_url TEXT,
    signed BOOLEAN NOT NULL DEFAULT false,
    signed_at TIMESTAMPTZ,
    signature_id TEXT,
    provenance_source TEXT,
    provenance_request_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_request_id UUID,
    signed_document_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft'::text,
    previous_document_id UUID,
    medications TEXT,
    exams TEXT,
    report_body TEXT,
    clinical_justification TEXT,
    priority TEXT,
    icd10_code VARCHAR(10),
    leave_days INTEGER,
    general_instructions TEXT,
    signature_hash TEXT,
    signature_algorithm TEXT,
    signature_certificate TEXT,
    signature_is_valid BOOLEAN,
    signature_validation_result TEXT,
    signature_policy_oid TEXT,
    expires_at TIMESTAMPTZ,
    dispensed_at TIMESTAMPTZ,
    dispensed_by TEXT,
    dispensed_count INTEGER NOT NULL DEFAULT 0,
    max_dispenses INTEGER NOT NULL DEFAULT 1,
    verify_code_hash TEXT,
    access_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_medical_documents_patient ON public.medical_documents USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_id ON public.medical_documents USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_documents_encounter_id ON public.medical_documents USING btree (encounter_id);
CREATE INDEX IF NOT EXISTS idx_medical_documents_created_at ON public.medical_documents USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_documents_source_request ON public.medical_documents USING btree (source_request_id) WHERE (source_request_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_med_docs_expires ON public.medical_documents USING btree (expires_at) WHERE (expires_at IS NOT NULL);

-- ============================================================
-- notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL DEFAULT 'info'::text,
    read BOOLEAN NOT NULL DEFAULT false,
    data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications USING btree (user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications USING btree (user_id, created_at DESC) WHERE (read = false);

-- ============================================================
-- outbox_events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.outbox_events (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending'::text,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    aggregate_type TEXT DEFAULT 'legacy'::text,
    aggregate_id UUID DEFAULT gen_random_uuid(),
    payload_json JSONB DEFAULT '{}'::jsonb,
    idempotency_key TEXT DEFAULT (gen_random_uuid())::text
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created_at ON public.outbox_events USING btree (status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_outbox_events_idempotency_key ON public.outbox_events USING btree (idempotency_key);

-- ============================================================
-- password_reset_tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_tokens_token_key ON public.password_reset_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens USING btree (expires_at);

-- ============================================================
-- patient_allergies
-- ============================================================

CREATE TABLE IF NOT EXISTS public.patient_allergies (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    type TEXT,
    description TEXT NOT NULL,
    severity TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient_id ON public.patient_allergies USING btree (patient_id);

-- ============================================================
-- patient_clinical_events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.patient_clinical_events (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    description TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_clinical_events_patient_id ON public.patient_clinical_events USING btree (patient_id);

-- ============================================================
-- patient_conditions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.patient_conditions (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    icd10_code VARCHAR(10),
    description TEXT NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient_id ON public.patient_conditions USING btree (patient_id);

-- ============================================================
-- patient_medications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.patient_medications (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    drug TEXT NOT NULL,
    dose TEXT,
    form TEXT,
    posology TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_medications_patient_id ON public.patient_medications USING btree (patient_id);

-- ============================================================
-- patients
-- ============================================================

CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON public.patients USING btree (cpf);

-- ============================================================
-- prescriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.prescriptions (
    id UUID PRIMARY KEY NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'::text,
    issued_at TIMESTAMPTZ NOT NULL,
    issued_date_str TEXT NOT NULL DEFAULT ''::text,
    patient_initials TEXT NOT NULL DEFAULT ''::text,
    prescriber_crm_uf TEXT NOT NULL DEFAULT ''::text,
    prescriber_crm_last4 TEXT NOT NULL DEFAULT ''::text,
    verify_code_hash TEXT NOT NULL DEFAULT ''::text,
    pdf_storage_path TEXT NOT NULL DEFAULT ''::text,
    pdf_hash TEXT,
    dispensed_at TIMESTAMPTZ,
    dispensed_pharmacy TEXT,
    dispensed_pharmacist TEXT,
    dispensed_pharmacist_crf TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_verify_code_hash ON public.prescriptions USING btree (verify_code_hash) WHERE (verify_code_hash <> ''::text);

-- ============================================================
-- prescription_verification_logs (anti-fraude, auditoria LGPD)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.prescription_verification_logs (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescription_verification_logs_prescription ON public.prescription_verification_logs USING btree (prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_verification_logs_created ON public.prescription_verification_logs USING btree (created_at DESC);

-- ============================================================
-- product_prices
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_prices (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    product_type TEXT NOT NULL,
    subtype TEXT NOT NULL DEFAULT 'default'::text,
    price_brl DECIMAL(10) NOT NULL,
    name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_prices_unique ON public.product_prices USING btree (product_type, subtype);
CREATE INDEX IF NOT EXISTS idx_product_prices_active ON public.product_prices USING btree (is_active);

-- ============================================================
-- push_tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'unknown'::text,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    role TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_unique ON public.push_tokens USING btree (user_id, token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens USING btree (token);

-- ============================================================
-- requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.requests (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    patient_name TEXT,
    doctor_id UUID,
    doctor_name TEXT,
    request_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted'::text,
    prescription_type TEXT,
    prescription_kind VARCHAR(30),
    medications JSONB NOT NULL DEFAULT '[]'::jsonb,
    prescription_images JSONB NOT NULL DEFAULT '[]'::jsonb,
    exam_type TEXT,
    exams JSONB NOT NULL DEFAULT '[]'::jsonb,
    exam_images JSONB NOT NULL DEFAULT '[]'::jsonb,
    symptoms TEXT,
    price DECIMAL(10),
    notes TEXT,
    rejection_reason TEXT,
    access_code TEXT,
    signed_at TIMESTAMPTZ,
    signed_document_url TEXT,
    signature_id TEXT,
    ai_summary_for_doctor TEXT,
    ai_extracted_json TEXT,
    ai_risk_level TEXT,
    ai_urgency TEXT,
    ai_readability_ok BOOLEAN,
    ai_message_to_user TEXT,
    consultation_type TEXT,
    contracted_minutes INTEGER,
    price_per_minute DECIMAL(10),
    consultation_started_at TIMESTAMPTZ,
    triage_conduct TEXT,
    triage_observation TEXT,
    prescription_valid_days INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version INTEGER DEFAULT 0,
    clicksign_envelope_id TEXT,
    clicksign_document_id TEXT,
    doctor_call_connected_at TEXT,
    patient_call_connected_at TEXT,
    auto_observation TEXT,
    doctor_conduct_notes TEXT,
    include_conduct_in_pdf TEXT,
    ai_conduct_suggestion TEXT,
    ai_suggested_exams TEXT,
    conduct_updated_at TEXT,
    conduct_updated_by TEXT,
    short_code TEXT,
    expires_at TIMESTAMPTZ,
    dispensed_at TIMESTAMPTZ,
    dispensed_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_requests_patient_id ON public.requests USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_requests_doctor_id ON public.requests USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_requests_type ON public.requests USING btree (request_type);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON public.requests USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_patient_created ON public.requests USING btree (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_patient_status_created ON public.requests USING btree (patient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_doctor_created ON public.requests USING btree (doctor_id, created_at DESC) WHERE (doctor_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_requests_has_conduct ON public.requests USING btree (doctor_conduct_notes) WHERE (doctor_conduct_notes IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_requests_queue_available ON public.requests USING btree (status, created_at DESC) WHERE (doctor_id IS NULL);
CREATE INDEX IF NOT EXISTS idx_requests_conduct_audit ON public.requests USING btree (conduct_updated_by, conduct_updated_at) WHERE (conduct_updated_at IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_short_code ON public.requests USING btree (short_code) WHERE (short_code IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_requests_access_code ON public.requests USING btree (access_code) WHERE (access_code IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_requests_expires ON public.requests USING btree (expires_at) WHERE (expires_at IS NOT NULL);

-- ============================================================
-- saved_cards
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saved_cards (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    mp_customer_id TEXT NOT NULL,
    mp_card_id TEXT NOT NULL,
    last_four TEXT NOT NULL,
    brand TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_cards_user_id ON public.saved_cards USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_cards_mp_card ON public.saved_cards USING btree (mp_card_id);

-- ============================================================
-- user_push_preferences
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_push_preferences (
    user_id UUID PRIMARY KEY NOT NULL,
    requests_enabled BOOLEAN NOT NULL DEFAULT true,
    payments_enabled BOOLEAN NOT NULL DEFAULT true,
    consultations_enabled BOOLEAN NOT NULL DEFAULT true,
    reminders_enabled BOOLEAN NOT NULL DEFAULT true,
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo'::text,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_push_preferences_user_id ON public.user_push_preferences USING btree (user_id);

-- ============================================================
-- users
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
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
    role TEXT NOT NULL DEFAULT 'patient'::text,
    profile_complete BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);
CREATE INDEX IF NOT EXISTS idx_users_cpf ON public.users USING btree (cpf);

-- ============================================================
-- video_rooms
-- ============================================================

CREATE TABLE IF NOT EXISTS public.video_rooms (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    room_name TEXT NOT NULL,
    room_url TEXT,
    status TEXT NOT NULL DEFAULT 'waiting'::text,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_rooms_request_id ON public.video_rooms USING btree (request_id);
CREATE INDEX IF NOT EXISTS idx_video_rooms_status ON public.video_rooms USING btree (status);

-- ============================================================
-- webhook_events
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    event_id TEXT,
    event_type TEXT DEFAULT 'payment'::text,
    source TEXT DEFAULT 'mercadopago'::character varying,
    payload JSONB,
    status TEXT DEFAULT 'processed'::character varying,
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
    is_duplicate BOOLEAN NOT NULL DEFAULT false,
    is_processed BOOLEAN NOT NULL DEFAULT false,
    processing_error TEXT,
    payment_status TEXT,
    payment_status_detail TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_correlation_id ON public.webhook_events USING btree (correlation_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_mp_payment_id ON public.webhook_events USING btree (mercado_pago_payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_mp_request_id ON public.webhook_events USING btree (mercado_pago_request_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events USING btree (created_at DESC);

-- Fim do schema RenoveJá+
