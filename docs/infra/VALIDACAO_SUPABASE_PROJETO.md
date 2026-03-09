# Validação: Projeto ↔ Supabase (MCP)

**Data da verificação:** 2026-02-23  
**Método:** Consultas ao Supabase via MCP (`execute_sql`, `list_migrations`) e comparação com modelos do backend.

---

## Resultado: **Em acordo**

O schema do Supabase está alinhado com as tabelas e colunas que o backend (.NET) utiliza.

---

## Tabelas usadas pelo backend

| Tabela | Existe no Supabase | Colunas críticas conferidas |
|--------|--------------------|-----------------------------|
| `users` | ✅ | id, name, email, password_hash, role, birth_date, profile_complete, street, number, neighborhood, city, state, postal_code, etc. |
| `requests` | ✅ | id, patient_id, doctor_id, request_type, status, medications, exams, symptoms, price, **consultation_type**, **contracted_minutes**, **price_per_minute**, access_code, prescription_kind, ai_*, signed_at, signed_document_url, created_at, updated_at |
| `consultation_time_bank` | ✅ | id, patient_id, consultation_type, balance_seconds, last_updated_at, created_at |
| `consultation_time_bank_transactions` | ✅ | id, patient_id, request_id, consultation_type, delta_seconds, reason, created_at |
| `consultation_anamnesis` | ✅ | id, request_id, patient_id, transcript_text, anamnesis_json, ai_suggestions_json, created_at |
| `doctor_profiles` | ✅ | id, user_id, crm, crm_state, specialty, active_certificate_id, crm_validated, crm_validated_at, professional_address, professional_phone, etc. |
| `doctor_certificates` | ✅ | id, doctor_profile_id, subject_name, issuer_name, serial_number, not_before, not_after, pfx_storage_path, is_valid, is_revoked, etc. |
| `video_rooms` | ✅ | id, request_id, room_name, room_url, status, started_at, ended_at, duration_seconds, created_at |
| `product_prices` | ✅ | id, product_type, subtype, price_brl, name, is_active |
| `payments` | ✅ | id, request_id, user_id, amount, status, payment_method, external_id, pix_*, paid_at, created_at, updated_at |
| `payment_attempts` | ✅ | id, payment_id, request_id, user_id, correlation_id, amount, is_success, created_at, updated_at |
| `notifications` | ✅ | id, user_id, title, message, notification_type, read, data, created_at |
| `auth_tokens` | ✅ | id, user_id, token, expires_at, created_at |
| `password_reset_tokens` | ✅ | id, user_id, token, expires_at, used, created_at |
| `saved_cards` | ✅ | id, user_id, mp_customer_id, mp_card_id, last_four, brand, created_at |
| `push_tokens` | ✅ | id, user_id, token, device_type, active, created_at |
| `audit_logs` | ✅ | id, user_id, action, entity_type, entity_id, old_values, new_values, correlation_id, metadata, created_at |
| `webhook_events` | ✅ | id, event_type, source, payload, processed_at, status, created_at, etc. |
| `prescriptions` | ✅ | id, status, verify_code_hash, qr_token_hash, patient_initials, pdf_storage_path, etc. |

---

## Dados de configuração

- **Preços de consulta por minuto** em `product_prices`:
  - `consultation` / `psicologo` → 3,99
  - `consultation` / `medico_clinico` → 6,99
  - `consultation` / `default` → 1,00

---

## Migrations aplicadas no Supabase

A migration **consultation_time_bank** (banco de horas) consta em `list_migrations` como aplicada.  
As demais migrations listadas no projeto também estão refletidas no schema atual.

---

## Conclusão

Não há divergência entre o que o código espera e o que existe no Supabase. Nenhuma alteração de schema é necessária para o estado atual do projeto.
