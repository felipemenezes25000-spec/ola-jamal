-- ============================================================
-- RENOVEJÁ — Policies RLS detalhadas para todas as tabelas
-- Migração: 20260303200000_rls_policies_detalhadas.sql
-- ============================================================
-- O backend usa service_role (bypassa RLS).
-- Estas policies protegem acesso direto via PostgREST/client SDK.
-- ============================================================

-- ============================================================
-- 1. USERS — cada usuário vê apenas seu próprio registro
-- ============================================================

-- Impedir que password_hash seja retornado via PostgREST
-- (Nota: o ideal seria ter uma VIEW sem password_hash, mas como
-- proteção extra, o SELECT policy limita ao próprio registro)

CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY users_update_own ON public.users
  FOR UPDATE USING (id = auth.uid());

-- Médicos podem ver dados básicos de pacientes que atendem
CREATE POLICY users_select_doctor_patients ON public.users
  FOR SELECT USING (
    id IN (
      SELECT r.patient_id FROM public.requests r
      WHERE r.doctor_id = auth.uid()
    )
  );

-- ============================================================
-- 2. AUTH_TOKENS — apenas o próprio usuário
-- ============================================================

CREATE POLICY auth_tokens_select_own ON public.auth_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY auth_tokens_insert_own ON public.auth_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY auth_tokens_delete_own ON public.auth_tokens
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 3. REQUESTS — paciente vê os seus, médico vê os atribuídos
-- ============================================================

CREATE POLICY requests_select_patient ON public.requests
  FOR SELECT USING (patient_id = auth.uid());

CREATE POLICY requests_select_doctor ON public.requests
  FOR SELECT USING (doctor_id = auth.uid());

-- Médicos veem requests sem doctor (na fila)
CREATE POLICY requests_select_queue ON public.requests
  FOR SELECT USING (
    doctor_id IS NULL
    AND status IN ('submitted', 'in_queue', 'in_review')
  );

CREATE POLICY requests_insert_patient ON public.requests
  FOR INSERT WITH CHECK (patient_id = auth.uid());

CREATE POLICY requests_update_doctor ON public.requests
  FOR UPDATE USING (doctor_id = auth.uid());

CREATE POLICY requests_update_patient ON public.requests
  FOR UPDATE USING (patient_id = auth.uid());

-- ============================================================
-- 4. PAYMENTS — paciente vê os seus pagamentos
-- ============================================================

CREATE POLICY payments_select_own ON public.payments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY payments_insert_own ON public.payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY payments_update_own ON public.payments
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- 5. CHAT_MESSAGES — participantes da solicitação
-- ============================================================

CREATE POLICY chat_messages_select ON public.chat_messages
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM public.requests
      WHERE patient_id = auth.uid() OR doctor_id = auth.uid()
    )
  );

CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- ============================================================
-- 6. NOTIFICATIONS — apenas o próprio usuário
-- ============================================================

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- 7. PASSWORD_RESET_TOKENS — apenas o próprio usuário
-- ============================================================

CREATE POLICY password_reset_tokens_select_own ON public.password_reset_tokens
  FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- 8. VIDEO_ROOMS — participantes da solicitação
-- ============================================================

CREATE POLICY video_rooms_select ON public.video_rooms
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM public.requests
      WHERE patient_id = auth.uid() OR doctor_id = auth.uid()
    )
  );

-- ============================================================
-- 9. PUSH_TOKENS — apenas o próprio usuário
-- ============================================================

CREATE POLICY push_tokens_select_own ON public.push_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY push_tokens_insert_own ON public.push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY push_tokens_delete_own ON public.push_tokens
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 10. AUDIT_LOGS — apenas admin (via service_role)
-- Nenhuma policy de SELECT para usuários normais
-- ============================================================

-- (audit_logs já tem RLS habilitado sem policies = bloqueado para todos exceto service_role)

-- ============================================================
-- 11. DOCTOR_PROFILES — leitura pública, escrita pelo próprio
-- ============================================================

CREATE POLICY doctor_profiles_select_all ON public.doctor_profiles
  FOR SELECT USING (true);

CREATE POLICY doctor_profiles_update_own ON public.doctor_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- 12. DOCTOR_CERTIFICATES — apenas o próprio médico
-- ============================================================

CREATE POLICY doctor_certificates_select_own ON public.doctor_certificates
  FOR SELECT USING (
    doctor_profile_id IN (
      SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY doctor_certificates_insert_own ON public.doctor_certificates
  FOR INSERT WITH CHECK (
    doctor_profile_id IN (
      SELECT id FROM public.doctor_profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 13. SAVED_CARDS — apenas o próprio usuário
-- ============================================================

CREATE POLICY saved_cards_select_own ON public.saved_cards
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY saved_cards_insert_own ON public.saved_cards
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_cards_delete_own ON public.saved_cards
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 14. CONSULTATION_ANAMNESIS — participantes
-- ============================================================

CREATE POLICY consultation_anamnesis_select ON public.consultation_anamnesis
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM public.requests
      WHERE patient_id = auth.uid() OR doctor_id = auth.uid()
    )
  );

-- ============================================================
-- 15. FEATURE_FLAGS — leitura para todos autenticados
-- ============================================================

CREATE POLICY feature_flags_select_all ON public.feature_flags
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- 16. PRODUCT_PRICES — leitura para todos
-- ============================================================

CREATE POLICY product_prices_select_all ON public.product_prices
  FOR SELECT USING (true);

-- ============================================================
-- FIM
-- ============================================================
