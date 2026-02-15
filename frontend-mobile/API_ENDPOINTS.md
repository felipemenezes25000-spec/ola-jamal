# RenoveJá Backend API Endpoints

Base URL: configurável via env (ex: http://localhost:5000 ou produção)

## Auth
- POST /api/auth/register - { name, email, password, phone, cpf, birthDate? } → { user, token, profileComplete }
- POST /api/auth/register-doctor - { name, email, password, phone, cpf, crm, crmState, specialty, birthDate?, bio? } → { user, token, doctorProfile }
- POST /api/auth/login - { email, password } → { user, token, doctorProfile?, profileComplete }
- GET /api/auth/me - [Auth] → UserDto
- POST /api/auth/logout - [Auth]
- POST /api/auth/google - { googleToken, role? } → { user, token, profileComplete }
- PATCH /api/auth/complete-profile - [Auth] { phone, cpf, birthDate?, crm?, crmState?, specialty?, bio? } → UserDto
- POST /api/auth/cancel-registration - [Auth]
- POST /api/auth/forgot-password - { email }
- POST /api/auth/reset-password - { token, newPassword }

## Requests
- POST /api/requests/prescription - [Auth] multipart(prescriptionType, images[]) OR json { prescriptionType, medications?, prescriptionImages? } → { request, payment? }
- POST /api/requests/exam - [Auth] multipart(examType, exams, symptoms?, images[]) OR json { examType, exams[], symptoms?, examImages? } → { request, payment? }
- POST /api/requests/consultation - [Auth] { symptoms } → { request, payment? }
- GET /api/requests?status=&type=&page=1&pageSize=20 - [Auth] → PagedResponse<RequestResponseDto>
- GET /api/requests/{id} - [Auth] → RequestResponseDto
- PUT /api/requests/{id}/status - [Auth,Doctor] { status, rejectionReason? }
- POST /api/requests/{id}/approve - [Auth,Doctor] {} 
- POST /api/requests/{id}/reject - [Auth,Doctor] { rejectionReason }
- POST /api/requests/{id}/assign-queue - [Auth]
- POST /api/requests/{id}/accept-consultation - [Auth,Doctor] → { request, video_room }
- POST /api/requests/{id}/sign - [Auth,Doctor] { signatureData?, signedDocumentUrl? }
- POST /api/requests/{id}/reanalyze-prescription - [Auth] { prescriptionImageUrls[] }
- POST /api/requests/{id}/reanalyze-exam - [Auth] { examImageUrls?, textDescription? }
- POST /api/requests/{id}/generate-pdf - [Auth,Doctor]

## Payments
- POST /api/payments - [Auth] { requestId, paymentMethod?("pix"), token?, installments?, paymentMethodId?, issuerId? } → PaymentResponseDto
- GET /api/payments/by-request/{requestId} - [Auth] → PaymentResponseDto
- GET /api/payments/{id} - [Auth] → PaymentResponseDto
- GET /api/payments/{id}/pix-code - [Auth] → text/plain
- POST /api/payments/{id}/confirm - test endpoint
- POST /api/payments/confirm-by-request/{requestId} - test endpoint

## Notifications
- GET /api/notifications?page=1&pageSize=20 - [Auth] → PagedResponse<NotificationResponseDto>
- PUT /api/notifications/{id}/read - [Auth]
- PUT /api/notifications/read-all - [Auth]

## Doctors
- GET /api/doctors?specialty=&available=&page=1&pageSize=20 → PagedResponse<DoctorListResponseDto>
- GET /api/doctors/{id} → DoctorListResponseDto
- GET /api/doctors/queue?specialty= - [Auth,Doctor]
- PUT /api/doctors/{id}/availability - [Auth,Doctor] { available: bool }
- POST /api/doctors/validate-crm - { crm, uf } → { valid, doctorName, crm, uf, specialty, situation, error }

## Push Tokens
- POST /api/push-tokens - [Auth] { token, deviceType }
- DELETE /api/push-tokens?token= - [Auth]
- GET /api/push-tokens - [Auth]

## Video
- POST /api/video/rooms - [Auth] { requestId } → VideoRoomResponseDto
- GET /api/video/rooms/{id} - [Auth] → VideoRoomResponseDto

## Certificates
- POST /api/certificates/upload - [Auth,Doctor] multipart(pfxFile, password) → { success, message, certificateId, validation }
- POST /api/certificates/validate - [Auth] multipart(pfxFile, password)
- GET /api/certificates/active - [Auth,Doctor] → CertificateInfoDto
- GET /api/certificates/status - [Auth,Doctor] → { hasValidCertificate }
- POST /api/certificates/{id}/revoke - [Auth] { reason }

## Specialties
- GET /api/specialties → string[]

## Verification (public)
- GET /api/verify/{id} → VerificationPublicDto
- POST /api/verify/{id}/full - { accessCode } → VerificationFullDto

## Auth Header
Authorization: Bearer {token}
Token comes from login/register response.
