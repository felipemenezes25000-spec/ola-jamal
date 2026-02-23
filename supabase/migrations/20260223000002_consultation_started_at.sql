-- ============================================================
-- Migration: Momento em que a consulta foi iniciada (ambos conectados)
-- Timer só começa quando médico e paciente estão na chamada (WebRTC conectado).
-- ============================================================

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS consultation_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS doctor_call_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS patient_call_connected_at TIMESTAMPTZ;

COMMENT ON COLUMN public.requests.consultation_started_at IS 'Quando médico e paciente estão conectados na chamada (timer começa).';
COMMENT ON COLUMN public.requests.doctor_call_connected_at IS 'Quando o médico reportou WebRTC conectado.';
COMMENT ON COLUMN public.requests.patient_call_connected_at IS 'Quando o paciente reportou WebRTC conectado.';
