# Validation Map & Quality Backlog

## Overview

This document maps all frontend inputs, forms, HTTP payloads, and UI edge cases. Used for shift-left quality and regression prevention.

---

## 1. Form & Input Map

| Screen | Field | Type | Normalizer | Schema | API Endpoint |
|--------|-------|------|------------|--------|--------------|
| `login` | email | email | normalizeEmail | loginSchema | POST /api/auth/login |
| `login` | password | password | - | loginSchema | POST /api/auth/login |
| `register` | name | text | normalizeText | registerSchema | POST /api/auth/register |
| `register` | email | email | normalizeEmail | registerSchema | POST /api/auth/register |
| `register` | password | password | - | registerSchema | POST /api/auth/register |
| `register` | phone | phone | normalizePhone | registerSchema | POST /api/auth/register |
| `register` | cpf | cpf | normalizeCpf | registerSchema | POST /api/auth/register |
| `register` (doctor) | crm | text | normalizeText | registerDoctorSchema | POST /api/auth/register-doctor |
| `register` (doctor) | crmState | text | 2 chars UF | registerDoctorSchema | POST /api/auth/register-doctor |
| `register` (doctor) | specialty | text | normalizeText | registerDoctorSchema | POST /api/auth/register-doctor |
| `complete-profile` | phone | phone | normalizePhone | completeProfileSchema | PATCH /api/auth/complete-profile |
| `complete-profile` | cpf | cpf | normalizeCpf | completeProfileSchema | PATCH /api/auth/complete-profile |
| `forgot-password` | email | email | normalizeEmail | forgotPasswordSchema | POST /api/auth/forgot-password |
| `change-password` | currentPassword | password | - | changePasswordSchema | PATCH /api/auth/change-password |
| `change-password` | newPassword | password | - | changePasswordSchema | PATCH /api/auth/change-password |
| `change-password` | confirmPassword | password | - | changePasswordSchema | PATCH /api/auth/change-password |
| `new-request/prescription` | prescriptionType | enum | - | createPrescriptionSchema | POST /api/requests/prescription |
| `new-request/prescription` | medications | string[] | trim | createPrescriptionSchema | POST /api/requests/prescription |
| `new-request/exam` | exams | string[] | trim | createExamSchema | POST /api/requests/exam |
| `new-request/exam` | symptoms | text | normalizeText | createExamSchema | POST /api/requests/exam |
| `new-request/consultation` | symptoms | text | normalizeText | createConsultationSchema | POST /api/requests/consultation |
| `doctor-request/[id]` | rejectionReason | text | normalizeText | rejectRequestSchema | POST /api/requests/:id/reject |
| `doctor-request/[id]` | certPassword | password | - | signRequestSchema | POST /api/requests/:id/sign |
| `doctor-request/editor/[id]` | medications | string[] | trim | - | PATCH prescription-content |
| `doctor-request/editor/[id]` | notes | text | trim | - | PATCH prescription-content |
| `doctor-request/editor/[id]` | certPassword | password | - | signRequestSchema | POST /api/requests/:id/sign |
| `certificate/upload` | password | password | - | uploadCertificateSchema | POST /api/certificates/upload |
| `payment/card` | token | token | - | - | POST /api/payments/saved-card |

---

## 2. HTTP Payload Contracts (Frontend → Backend)

| Endpoint | Method | Payload | Validator |
|----------|--------|---------|-----------|
| /api/auth/login | POST | { email, password } | validateLogin |
| /api/auth/register | POST | { name, email, password, phone, cpf } | validateRegister |
| /api/auth/register-doctor | POST | + crm, crmState, specialty | validateRegisterDoctor |
| /api/auth/complete-profile | PATCH | { phone, cpf } | validateCompleteProfile |
| /api/auth/forgot-password | POST | { email } | validateForgotPassword |
| /api/auth/change-password | PATCH | { currentPassword, newPassword } | validateChangePassword |
| /api/requests/prescription | POST | { prescriptionType, medications?, images? } | validateCreatePrescription |
| /api/requests/exam | POST | { examType, exams, symptoms?, images? } | validateCreateExam |
| /api/requests/consultation | POST | { symptoms } | validateCreateConsultation |
| /api/requests/:id/reject | POST | { rejectionReason } | validateRejectRequest |
| /api/requests/:id/sign | POST | { pfxPassword } | validateSignRequest |
| /api/certificates/upload | POST | FormData(pfxFile, password) | validateUploadCertificate |

---

## 3. UI Edge Cases & Backlog

| Component | Issue | Status | Fix |
|-----------|-------|--------|-----|
| StatusBadge | Long labels may clip | Fixed | flexShrink: 1, numberOfLines: 1 |
| RequestCard | Right side overflow (badge + price) | Fixed | flexShrink on badge |
| GradientHeader | Safe area consistency | OK | Uses useSafeAreaInsets |
| AppInput | Error state display | OK | error prop |
| Tabs | Badge overflow (unread count) | Check | tabBarBadge number |
| Modal | Keyboard covering inputs | Check | KeyboardAvoidingView |

---

## 4. Centralized Normalizers (lib/validation/normalizers.ts)

| Function | Purpose |
|----------|---------|
| `digitsOnly(s)` | Remove non-digits |
| `normalizeCpf(s)` | 11 digits only |
| `normalizePhone(s)` | 10-11 digits only |
| `normalizeEmail(s)` | trim, lowercase |
| `normalizeText(s)` | trim |
| `formatCpfDisplay(s)` | 000.000.000-00 |
| `formatPhoneDisplay(s)` | (11) 99999-9999 |
| `formatMoneyDisplay(n)` | R$ 0,00 |
| `parseMoney(s)` | Parse BRL input |
| `toIsoDate(v)` | ISO string for backend |

---

## 5. Schema-Based Validation (lib/validation/schemas.ts)

All schemas use Zod and mirror backend FluentValidation:

- `loginSchema` — email format, password required
- `registerSchema` — name 2+ words, email, password min 8, phone 10-11 digits, CPF 11 digits
- `registerDoctorSchema` — + CRM max 20, CrmState 2 chars, specialty
- `completeProfileSchema` — phone 10-11 digits, CPF 11 digits
- `forgotPasswordSchema` — email format
- `changePasswordSchema` — newPassword min 8, confirm match
- `createPrescriptionSchema` — prescriptionType enum, medications optional
- `createConsultationSchema` — symptoms min 10 chars
- `createExamSchema` — at least one of exams/images/symptoms
- `rejectRequestSchema` — rejectionReason required
- `signRequestSchema` — certPassword required

---

## 6. Test Coverage Plan

| Area | Tests |
|------|-------|
| normalizers | CPF, phone, email, digits, format |
| schemas | login, register, complete-profile, consultation, exam |
| api-contracts | validate* return success/errors |
| components | StatusBadge, RequestCard (smoke) |
| screens | Login, Register submit (integration) |

---

## 7. Regression Checklist

- [ ] All forms use schema validation before API call
- [ ] CPF/phone normalized to digits before submit
- [ ] Email lowercased before submit
- [ ] Status badges wrap/ellipsis long text
- [ ] No hardcoded validation strings (use schema messages)
- [ ] Unit tests pass: `npm test`
- [ ] Smoke test: login, register, create request
