# INVENTÁRIO DO BACKEND RENOVEJA - Python/FastAPI → .NET/DDD

## 1. ENDPOINTS MAPEADOS (Backend Atual)

### 1.1 Health & Status
- **GET /api/health** - Health check
- **GET /api/integrations/status** - Status das integrações

### 1.2 Authentication (/api/auth/*)
- **POST /api/auth/register** - Cadastro de paciente
  - Input: name, email, password, phone?, cpf?, birth_date?
  - Output: user, token
- **POST /api/auth/register-doctor** - Cadastro de médico
  - Input: name, email, password, phone, crm, crm_state, specialty, bio?
  - Output: user, doctor_profile, token
- **POST /api/auth/login** - Login
  - Input: email, password
  - Output: user, token (+ doctor_profile se role=doctor)
- **GET /api/auth/me** - Dados do usuário autenticado
  - Headers: Authorization Bearer <token>
  - Output: user (+ doctor_profile se role=doctor)
- **POST /api/auth/logout** - Logout
  - Headers: Authorization Bearer <token>
  - Output: success message
- **POST /api/auth/google** - Login/registro via Google
  - Input: google_token
  - Output: user, token

### 1.3 Requests (/api/requests/*)
- **POST /api/requests/prescription** - Criar solicitação de receita
  - Input: prescription_type, medications[], prescription_images[]?
  - Output: request, payment
- **POST /api/requests/exam** - Criar solicitação de exame
  - Input: exam_type, exams[], symptoms?
  - Output: request, payment
- **POST /api/requests/consultation** - Criar solicitação de consulta
  - Input: symptoms
  - Output: request, payment
- **GET /api/requests** - Listar solicitações do usuário
  - Query: status?, type?
  - Output: requests[]
- **GET /api/requests/{id}** - Detalhar solicitação
  - Output: request (+ payment, doctor, video_room)
- **PUT /api/requests/{id}/status** - Atualizar status (admin/doctor)
  - Input: status, rejection_reason?
  - Output: request
- **POST /api/requests/{id}/approve** - Aprovar e processar (doctor)
  - Input: notes?, price?
  - Output: request
- **POST /api/requests/{id}/reject** - Rejeitar (doctor)
  - Input: rejection_reason
  - Output: request
- **POST /api/requests/{id}/assign-queue** - Atribuir médico da fila (system)
  - Output: request
- **POST /api/requests/{id}/accept-consultation** - Médico aceita consulta
  - Output: request, video_room
- **POST /api/requests/{id}/sign** - Assinar digitalmente (doctor)
  - Input: signature_data
  - Output: request, signed_document_url

### 1.4 Payments (/api/payments/*)
- **POST /api/payments** - Criar pagamento PIX
  - Input: request_id, amount
  - Output: payment (+ qr_code, copy_paste)
- **GET /api/payments/{id}** - Detalhar pagamento
  - Output: payment
- **POST /api/payments/{id}/confirm** - Confirmar pagamento manualmente (dev/test)
  - Output: payment, request updated
- **POST /api/payments/webhook** - Webhook MercadoPago
  - Input: event data do MercadoPago
  - Output: success

### 1.5 Chat (/api/chat/*)
- **POST /api/chat/{request_id}/messages** - Enviar mensagem
  - Input: message
  - Output: chat_message
- **GET /api/chat/{request_id}/messages** - Listar mensagens
  - Output: messages[]
- **GET /api/chat/unread-count** - Contador de não lidas
  - Output: unread_count
- **PUT /api/chat/{request_id}/mark-read** - Marcar como lidas
  - Output: success

### 1.6 Notifications (/api/notifications/*)
- **GET /api/notifications** - Listar notificações do usuário
  - Output: notifications[]
- **PUT /api/notifications/{id}/read** - Marcar como lida
  - Output: notification
- **PUT /api/notifications/read-all** - Marcar todas como lidas
  - Output: success

### 1.7 Video (/api/video/*)
- **POST /api/video/rooms** - Criar sala de vídeo
  - Input: request_id
  - Output: video_room (+ room_url)
- **GET /api/video/rooms/{id}** - Obter sala de vídeo
  - Output: video_room

### 1.8 Doctors (/api/doctors/*)
- **GET /api/doctors** - Listar médicos
  - Query: specialty?, available?
  - Output: doctors[] (user + doctor_profile)
- **GET /api/doctors/{id}** - Detalhar médico
  - Output: doctor (user + doctor_profile)
- **GET /api/doctors/queue** - Fila de médicos disponíveis (system)
  - Query: specialty?
  - Output: doctors[]
- **PUT /api/doctors/{id}/availability** - Atualizar disponibilidade (doctor)
  - Input: available
  - Output: doctor_profile

### 1.9 Specialties
- **GET /api/specialties** - Listar especialidades médicas
  - Output: specialties[] (lista estática ou dinâmica)

### 1.10 Push Tokens
- **POST /api/push-tokens** - Registrar token de push
  - Input: token
  - Output: success
- **DELETE /api/push-tokens** - Remover token
  - Output: success

---

## 2. MODELOS DE DADOS (DB Schema)

### 2.1 users
- id (uuid, PK)
- name (varchar)
- email (varchar, unique)
- password_hash (varchar)
- phone (varchar, nullable)
- cpf (varchar, nullable)
- birth_date (date, nullable)
- avatar_url (text, nullable)
- role (varchar: 'patient' | 'doctor', default 'patient')
- created_at (timestamptz)
- updated_at (timestamptz)

### 2.2 doctor_profiles
- id (uuid, PK)
- user_id (uuid, FK → users, unique)
- crm (varchar)
- crm_state (varchar)
- specialty (varchar)
- bio (text, nullable)
- rating (numeric, default 5.0)
- total_consultations (int, default 0)
- available (bool, default true)
- created_at (timestamptz)

### 2.3 requests
- id (uuid, PK)
- patient_id (uuid, FK → users)
- patient_name (varchar, nullable)
- doctor_id (uuid, FK → users, nullable)
- doctor_name (varchar, nullable)
- request_type (varchar: 'prescription' | 'exam' | 'consultation')
- status (varchar: 'submitted', 'in_review', 'approved_pending_payment', 'paid', 'signed', 'delivered', 'rejected', 'pending_payment', 'searching_doctor', 'consultation_ready', 'in_consultation', 'consultation_finished', 'cancelled', 'pending', 'analyzing', 'approved', 'completed')
- prescription_type (varchar: 'simple' | 'controlled' | 'blue', nullable)
- medications (jsonb, default [])
- prescription_images (jsonb, default [])
- exam_type (varchar, nullable)
- exams (jsonb, default [])
- symptoms (text, nullable)
- price (numeric, nullable)
- notes (text, nullable)
- rejection_reason (text, nullable)
- signed_at (timestamptz, nullable)
- signed_document_url (text, nullable)
- signature_id (varchar, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)

### 2.4 payments
- id (uuid, PK)
- request_id (uuid, FK → requests)
- user_id (uuid, FK → users)
- amount (numeric)
- status (varchar: 'pending' | 'approved' | 'rejected' | 'refunded', default 'pending')
- payment_method (varchar, default 'pix')
- external_id (varchar, nullable)
- pix_qr_code (text, nullable)
- pix_qr_code_base64 (text, nullable)
- pix_copy_paste (text, nullable)
- paid_at (timestamptz, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)

### 2.5 chat_messages
- id (uuid, PK)
- request_id (uuid, FK → requests)
- sender_id (uuid, FK → users)
- sender_name (varchar, nullable)
- sender_type (varchar: 'patient' | 'doctor' | 'support' | 'system')
- message (text)
- read (bool, default false)
- created_at (timestamptz)

### 2.6 notifications
- id (uuid, PK)
- user_id (uuid, FK → users)
- title (varchar)
- message (text)
- notification_type (varchar: 'info' | 'success' | 'warning' | 'error', default 'info')
- read (bool, default false)
- data (jsonb, nullable)
- created_at (timestamptz)

### 2.7 video_rooms
- id (uuid, PK)
- request_id (uuid, FK → requests)
- room_name (varchar)
- room_url (text, nullable)
- status (varchar: 'waiting' | 'active' | 'ended', default 'waiting')
- started_at (timestamptz, nullable)
- ended_at (timestamptz, nullable)
- duration_seconds (int, nullable)
- created_at (timestamptz)

### 2.8 auth_tokens
- id (uuid, PK)
- user_id (uuid, FK → users)
- token (varchar, unique)
- expires_at (timestamptz)
- created_at (timestamptz)

### 2.9 push_tokens
- id (uuid, PK)
- user_id (uuid, FK → users)
- token (text)
- created_at (timestamptz)

---

## 3. BOUNDED CONTEXTS / MÓDULOS DDD

### 3.1 Identity (Authentication & Authorization)
**Agregados:**
- User (root)
  - UserProfile (VO: name, email, phone, cpf, birth_date, avatar)
  - Credentials (VO: password_hash)
  - Role (VO: enum Patient/Doctor)
- AuthToken
- PushToken

**Regras de Negócio:**
- Email único
- Senha com hash BCrypt
- Token gerado e validado
- Roles: patient ou doctor
- Google OAuth integration

### 3.2 Medical (Doctors)
**Agregados:**
- DoctorProfile (root)
  - CRM (VO: number + state)
  - Specialty (VO)
  - Rating (VO)
  - Availability (VO: bool)

**Regras de Negócio:**
- CRM único por estado
- Rating 0-5
- Disponibilidade para atendimento

### 3.3 Requests (Solicitações)
**Agregados:**
- MedicalRequest (root)
  - RequestType (VO: enum Prescription/Exam/Consultation)
  - RequestStatus (VO: enum com ~17 estados)
  - Prescription (Entity: type, medications, images)
  - Exam (Entity: type, exams list)
  - Consultation (Entity: symptoms)
  - DigitalSignature (VO: signed_at, document_url, signature_id)

**Regras de Negócio:**
- Transições de status válidas
- Preço obrigatório para aprovação
- Assinatura digital obrigatória para entrega
- Patient e Doctor associados

### 3.4 Payments
**Agregados:**
- Payment (root)
  - Amount (VO: Money)
  - PaymentStatus (VO: enum)
  - PixData (VO: qr_code, copy_paste, etc.)
  - ExternalReference (VO: external_id do MercadoPago)

**Regras de Negócio:**
- Pagamento vinculado a Request
- Webhook MercadoPago atualiza status
- Status 'approved' atualiza Request para 'paid'

### 3.5 Communication
**Agregados:**
- ChatMessage (root)
  - SenderInfo (VO: sender_id, sender_name, sender_type)
  - Content (VO: message text)
  - ReadStatus (VO: bool)
- Notification (root)
  - NotificationType (VO: enum)
  - Content (VO: title, message)
  - ReadStatus (VO: bool)
  - Metadata (VO: jsonb data)

**Regras de Negócio:**
- Mensagens vinculadas a Request
- Notificações por usuário
- Push notifications

### 3.6 Video
**Agregados:**
- VideoRoom (root)
  - RoomIdentifier (VO: room_name, room_url)
  - RoomStatus (VO: enum)
  - Duration (VO: started_at, ended_at, duration_seconds)

**Regras de Negócio:**
- Sala vinculada a Request de consultation
- Status: waiting → active → ended

---

## 4. MAPA DE ENTIDADES E RELACIONAMENTOS

```
User (1) ----< (N) AuthToken
User (1) ----< (N) PushToken
User (1) ----< (N) Notification
User (1) ----< (N) ChatMessage (as sender)
User (1) ----(0..1) DoctorProfile
User (1) ----< (N) Request (as patient)
User (1) ----< (N) Request (as doctor)
User (1) ----< (N) Payment

Request (1) ----(0..1) Payment
Request (1) ----< (N) ChatMessage
Request (1) ----(0..1) VideoRoom

Payment (1) ---- (1) Request
```

---

## 5. INTEGRAÇÕES EXTERNAS

### 5.1 MercadoPago
- Criação de pagamento PIX
- Webhook de confirmação
- Consulta de status

### 5.2 PDF Generator
- Geração de receitas/exames
- Documento assinado digitalmente

### 5.3 Push Notification Service
- Envio de notificações push (Expo/FCM)

### 5.4 Video Service
- Geração de salas de vídeo (pode ser mock ou Jitsi/Whereby)

### 5.5 Queue Manager
- Atribuição automática de médicos

---

## 6. ESTRUTURA DE PASTAS PROPOSTA (.NET)

```
/backend-dotnet
  /src
    /RenoveJa.Api                  # Presentation Layer (Controllers, Middlewares)
    /RenoveJa.Application          # Application Layer (Use Cases, DTOs, Services)
    /RenoveJa.Domain               # Domain Layer (Entities, VOs, Aggregates, Interfaces)
    /RenoveJa.Infrastructure       # Infrastructure Layer (Repositories, External Services)
  /tests
    /RenoveJa.UnitTests
    /RenoveJa.IntegrationTests (opcional)
  RenoveJa.sln
  README.md
  DECISIONS.md
  INVENTORY.md (este arquivo)
```

### 6.1 RenoveJa.Domain
```
/Entities
  User.cs
  DoctorProfile.cs
  MedicalRequest.cs
  Payment.cs
  ChatMessage.cs
  Notification.cs
  VideoRoom.cs
  AuthToken.cs
  PushToken.cs

/ValueObjects
  Email.cs
  Phone.cs
  Cpf.cs
  Money.cs
  RequestType.cs
  RequestStatus.cs
  PaymentStatus.cs
  Role.cs
  CRM.cs
  Specialty.cs
  NotificationType.cs
  SenderType.cs

/Aggregates
  UserAggregate/
  DoctorAggregate/
  RequestAggregate/
  PaymentAggregate/
  CommunicationAggregate/

/Interfaces
  IUserRepository.cs
  IDoctorRepository.cs
  IRequestRepository.cs
  IPaymentRepository.cs
  IChatRepository.cs
  INotificationRepository.cs
  IVideoRoomRepository.cs
  IAuthTokenRepository.cs
  IPushTokenRepository.cs

/Events (opcional)
  PaymentApprovedEvent.cs
  RequestStatusChangedEvent.cs
```

### 6.2 RenoveJa.Application
```
/DTOs
  /Auth
    RegisterRequestDto.cs
    RegisterDoctorRequestDto.cs
    LoginRequestDto.cs
    AuthResponseDto.cs
  /Requests
    CreatePrescriptionDto.cs
    CreateExamDto.cs
    CreateConsultationDto.cs
    RequestResponseDto.cs
  /Payments
    CreatePaymentDto.cs
    PaymentResponseDto.cs
  /Chat
    SendMessageDto.cs
    MessageResponseDto.cs
  /Notifications
    NotificationResponseDto.cs
  /Video
    CreateRoomDto.cs
    RoomResponseDto.cs
  /Doctors
    DoctorResponseDto.cs

/Services
  /Auth
    IAuthService.cs
    AuthService.cs
  /Requests
    IRequestService.cs
    RequestService.cs
  /Payments
    IPaymentService.cs
    PaymentService.cs
  /Chat
    IChatService.cs
    ChatService.cs
  /Notifications
    INotificationService.cs
    NotificationService.cs
  /Video
    IVideoService.cs
    VideoService.cs
  /Doctors
    IDoctorService.cs
    DoctorService.cs

/Validators (FluentValidation)
  RegisterRequestValidator.cs
  CreatePrescriptionValidator.cs
  etc.

/Mappers
  UserMapper.cs
  RequestMapper.cs
  PaymentMapper.cs
  etc.
```

### 6.3 RenoveJa.Infrastructure
```
/Data
  /Supabase
    SupabaseClient.cs
    SupabaseConfig.cs
  /Models (Persistence Models)
    UserModel.cs
    DoctorProfileModel.cs
    RequestModel.cs
    PaymentModel.cs
    ChatMessageModel.cs
    NotificationModel.cs
    VideoRoomModel.cs
    AuthTokenModel.cs
    PushTokenModel.cs

/Repositories
  UserRepository.cs
  DoctorRepository.cs
  RequestRepository.cs
  PaymentRepository.cs
  ChatRepository.cs
  NotificationRepository.cs
  VideoRoomRepository.cs
  AuthTokenRepository.cs
  PushTokenRepository.cs

/ExternalServices
  /MercadoPago
    IMercadoPagoService.cs
    MercadoPagoService.cs
  /PdfGenerator
    IPdfGeneratorService.cs
    PdfGeneratorService.cs
  /PushNotification
    IPushNotificationService.cs
    PushNotificationService.cs
  /VideoService
    IVideoServiceProvider.cs
    VideoServiceProvider.cs

/Logging
  CorrelationIdMiddleware.cs
  StructuredLogger.cs
```

### 6.4 RenoveJa.Api
```
/Controllers
  HealthController.cs
  AuthController.cs
  RequestsController.cs
  PaymentsController.cs
  ChatController.cs
  NotificationsController.cs
  VideoController.cs
  DoctorsController.cs
  SpecialtiesController.cs
  IntegrationsController.cs

/Middleware
  ExceptionHandlingMiddleware.cs
  AuthenticationMiddleware.cs (ou use .NET Authentication Handler)

/Authentication
  BearerAuthenticationHandler.cs (custom handler que valida via auth_tokens)

/Filters
  AuthorizeRoleAttribute.cs

Program.cs
appsettings.json
appsettings.Development.json
```

### 6.5 RenoveJa.UnitTests
```
/Domain
  UserTests.cs
  RequestTests.cs
  PaymentTests.cs

/Application
  AuthServiceTests.cs
  RequestServiceTests.cs
  PaymentServiceTests.cs

/Infrastructure
  SupabaseClientTests.cs (mock)
  RepositoryTests.cs (mock)
```

---

## 7. DECISÕES ARQUITETURAIS PRELIMINARES

1. **Supabase via PostgREST:** Usar biblioteca/cliente HTTP para chamar a API REST do Supabase (evitar conexão Postgres direta).
2. **BCrypt:** Manter compatibilidade com hashes do Python (usar BCrypt.Net-Next).
3. **Token-based Auth:** Validar tokens consultando tabela `auth_tokens` (não JWT inicial).
4. **FluentValidation:** Para validação de DTOs.
5. **Dependency Injection nativa:** ASP.NET Core DI.
6. **Logging:** Serilog (estruturado).
7. **Swagger:** Para documentação da API.
8. **Mappers:** AutoMapper ou mappers manuais (avaliar).
9. **Unit of Work:** Implementar se necessário para transações (Supabase tem limitações).
10. **MercadoPago SDK:** Usar SDK oficial .NET do MercadoPago.

---

## 8. CHECKLIST DE PARIDADE (Endpoints)

| Endpoint | Método | Status | Notas |
|----------|--------|--------|-------|
| /api/health | GET | ⏳ Pendente | |
| /api/integrations/status | GET | ⏳ Pendente | |
| /api/auth/register | POST | ⏳ Pendente | |
| /api/auth/register-doctor | POST | ⏳ Pendente | |
| /api/auth/login | POST | ⏳ Pendente | |
| /api/auth/me | GET | ⏳ Pendente | |
| /api/auth/logout | POST | ⏳ Pendente | |
| /api/auth/google | POST | ⏳ Pendente | |
| /api/requests/prescription | POST | ⏳ Pendente | |
| /api/requests/exam | POST | ⏳ Pendente | |
| /api/requests/consultation | POST | ⏳ Pendente | |
| /api/requests | GET | ⏳ Pendente | |
| /api/requests/{id} | GET | ⏳ Pendente | |
| /api/requests/{id}/status | PUT | ⏳ Pendente | |
| /api/requests/{id}/approve | POST | ⏳ Pendente | |
| /api/requests/{id}/reject | POST | ⏳ Pendente | |
| /api/requests/{id}/assign-queue | POST | ⏳ Pendente | |
| /api/requests/{id}/accept-consultation | POST | ⏳ Pendente | |
| /api/requests/{id}/sign | POST | ⏳ Pendente | |
| /api/payments | POST | ⏳ Pendente | |
| /api/payments/{id} | GET | ⏳ Pendente | |
| /api/payments/{id}/confirm | POST | ⏳ Pendente | |
| /api/payments/webhook | POST | ⏳ Pendente | |
| /api/chat/{request_id}/messages | POST | ⏳ Pendente | |
| /api/chat/{request_id}/messages | GET | ⏳ Pendente | |
| /api/chat/unread-count | GET | ⏳ Pendente | |
| /api/chat/{request_id}/mark-read | PUT | ⏳ Pendente | |
| /api/notifications | GET | ⏳ Pendente | |
| /api/notifications/{id}/read | PUT | ⏳ Pendente | |
| /api/notifications/read-all | PUT | ⏳ Pendente | |
| /api/video/rooms | POST | ⏳ Pendente | |
| /api/video/rooms/{id} | GET | ⏳ Pendente | |
| /api/doctors | GET | ⏳ Pendente | |
| /api/doctors/{id} | GET | ⏳ Pendente | |
| /api/doctors/queue | GET | ⏳ Pendente | |
| /api/doctors/{id}/availability | PUT | ⏳ Pendente | |
| /api/specialties | GET | ⏳ Pendente | |
| /api/push-tokens | POST | ⏳ Pendente | |
| /api/push-tokens | DELETE | ⏳ Pendente | |

---

## 9. PRÓXIMOS PASSOS

1. ✅ Inventário completo
2. ⏳ Criar estrutura de pastas e arquivos .csproj
3. ⏳ Implementar Domain Layer (Entities, VOs)
4. ⏳ Implementar Application Layer (DTOs, Services, Interfaces)
5. ⏳ Implementar Infrastructure Layer (Repositories, Supabase, Integrations)
6. ⏳ Implementar Api Layer (Controllers, Auth, Middleware)
7. ⏳ Testes unitários (Auth, Requests, Payments)
8. ⏳ Documentação (README, DECISIONS.md)
9. ⏳ Deploy e validação

---

**Data:** 2026-02-02  
**Autor:** Claude (Arquiteto .NET + DDD)  
**Status:** Inventário Completo ✅
