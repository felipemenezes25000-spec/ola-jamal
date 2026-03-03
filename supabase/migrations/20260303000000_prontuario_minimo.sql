-- RENOVEJÁ — Prontuário mínimo (patients, encounters, medical_documents, consent_records, audit_events)
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard/project/SEU_PROJETO/sql/new
-- Requer: tabela public.users existente

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
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON public.patients(cpf);

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
);
CREATE INDEX IF NOT EXISTS idx_encounters_patient_id ON public.encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_practitioner_id ON public.encounters(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_encounters_started_at ON public.encounters(started_at DESC);

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
);
CREATE INDEX IF NOT EXISTS idx_medical_documents_patient_id ON public.medical_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_documents_encounter_id ON public.medical_documents(encounter_id);
CREATE INDEX IF NOT EXISTS idx_medical_documents_created_at ON public.medical_documents(created_at DESC);

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
CREATE INDEX IF NOT EXISTS idx_consent_records_patient_id ON public.consent_records(patient_id);

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
CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON public.audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC);

-- ============================================================
-- RLS (Row Level Security) — proteção obrigatória LGPD
-- ============================================================

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- patients: paciente vê apenas o próprio registro
CREATE POLICY patients_select_own ON public.patients
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY patients_insert_own ON public.patients
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY patients_update_own ON public.patients
    FOR UPDATE USING (user_id = auth.uid());

-- encounters: paciente vê os próprios; médico vê os que atendeu
CREATE POLICY encounters_select_patient ON public.encounters
    FOR SELECT USING (
        patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
        OR practitioner_id = auth.uid()
    );
CREATE POLICY encounters_insert_practitioner ON public.encounters
    FOR INSERT WITH CHECK (practitioner_id = auth.uid());
CREATE POLICY encounters_update_practitioner ON public.encounters
    FOR UPDATE USING (practitioner_id = auth.uid());

-- medical_documents: paciente vê os próprios; médico vê os que emitiu
CREATE POLICY medical_documents_select ON public.medical_documents
    FOR SELECT USING (
        patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
        OR practitioner_id = auth.uid()
    );
CREATE POLICY medical_documents_insert ON public.medical_documents
    FOR INSERT WITH CHECK (practitioner_id = auth.uid());
CREATE POLICY medical_documents_update ON public.medical_documents
    FOR UPDATE USING (practitioner_id = auth.uid());

-- consent_records: paciente vê apenas os próprios
CREATE POLICY consent_records_select_own ON public.consent_records
    FOR SELECT USING (
        patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    );
CREATE POLICY consent_records_insert ON public.consent_records
    FOR INSERT WITH CHECK (
        patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
    );

-- audit_events: apenas o próprio usuário vê seus eventos (admin via service_role)
CREATE POLICY audit_events_select_own ON public.audit_events
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY audit_events_insert_system ON public.audit_events
    FOR INSERT WITH CHECK (true);

-- ============================================================
-- Tabelas de subentidades do paciente (prontuário completo)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.patient_allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    type TEXT,
    description TEXT NOT NULL,
    severity TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_allergies_patient_id ON public.patient_allergies(patient_id);

CREATE TABLE IF NOT EXISTS public.patient_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    icd10_code VARCHAR(10),
    description TEXT NOT NULL,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient_id ON public.patient_conditions(patient_id);

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
);
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient_id ON public.patient_medications(patient_id);

CREATE TABLE IF NOT EXISTS public.patient_clinical_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patient_clinical_events_patient_id ON public.patient_clinical_events(patient_id);

ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_clinical_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_allergies_select ON public.patient_allergies
    FOR SELECT USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY patient_allergies_insert ON public.patient_allergies
    FOR INSERT WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY patient_conditions_select ON public.patient_conditions
    FOR SELECT USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY patient_conditions_insert ON public.patient_conditions
    FOR INSERT WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY patient_medications_select ON public.patient_medications
    FOR SELECT USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY patient_medications_insert ON public.patient_medications
    FOR INSERT WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY patient_clinical_events_select ON public.patient_clinical_events
    FOR SELECT USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY patient_clinical_events_insert ON public.patient_clinical_events
    FOR INSERT WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
