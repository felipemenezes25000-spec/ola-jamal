# RenoveJá Backend .NET - Clean Architecture + DDD

Backend do RenoveJá reimplementado em C#/.NET 8 com arquitetura DDD (Domain-Driven Design) e Clean Architecture, mantendo total compatibilidade com o backend Python/FastAPI existente.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Execução](#execução)
- [Testes](#testes)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Endpoints](#endpoints)
- [Decisões Arquiteturais](#decisões-arquiteturais)

---

## 🎯 Visão Geral

O RenoveJá é uma plataforma de telemedicina que permite:
- Renovação de receitas médicas
- Solicitação de exames
- Consultas online
- Chat entre paciente e médico
- Notificações
- Pagamentos via PIX (MercadoPago)
- Salas de vídeo para consultas

Este backend .NET mantém **100% de compatibilidade** com o frontend existente, preservando as mesmas rotas, payloads JSON e regras de negócio.

---

## 🏗️ Arquitetura

### Clean Architecture + DDD

Estrutura convencional .NET (Microsoft / eShopOnWeb / Clean Architecture): pasta **src/** para código, **tests/** para testes, projetos com prefixo da solution (`RenoveJa.*`).

```
/backend-dotnet
├── src/
│   ├── RenoveJa.Domain/           # Camada de Domínio
│   │   ├── Entities/              # Entidades e raízes de agregado
│   │   ├── ValueObjects/          # VOs (Email, Phone, Money)
│   │   ├── Enums/                 # Enumerações
│   │   ├── Interfaces/            # Contratos de Repositórios
│   │   └── Exceptions/            # Exceções de Domínio
│   │
│   ├── RenoveJa.Application/      # Camada de Aplicação
│   │   ├── DTOs/                  # Data Transfer Objects (por bounded context)
│   │   ├── Services/              # Use Cases (AuthService, RequestService, etc.)
│   │   ├── Interfaces/            # Contratos de Serviços
│   │   └── Validators/            # FluentValidation
│   │
│   ├── RenoveJa.Infrastructure/   # Camada de Infraestrutura
│   │   ├── Data/
│   │   │   ├── Supabase/          # Cliente Supabase
│   │   │   └── Models/            # Modelos de Persistência
│   │   └── Repositories/          # Implementações de Repositórios
│   │
│   └── RenoveJa.Api/              # Camada de Apresentação (Host)
│       ├── Controllers/           # Endpoints REST
│       ├── Middleware/            # Exception Handling, Correlation ID
│       └── Authentication/        # Bearer Token Handler
│
├── tests/
│   └── RenoveJa.UnitTests/        # Testes unitários (xUnit)
│
└── RenoveJa.sln
```

---

## ✅ Pré-requisitos

- **.NET 8 SDK** ou superior
- **Supabase Account** (URL e Service Key)
- **MercadoPago Access Token** (para pagamentos)
- **IDE:** Visual Studio 2022, VS Code ou Rider

---

## ⚙️ Configuração

### 1. Clonar o Repositório

```bash
git clone https://github.com/felipemenezes25000-spec/teste-do-jamal.git
cd teste-do-jamal/backend-dotnet
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `appsettings.Development.json` em `src/RenoveJa.Api/`:

```json
{
  "Supabase": {
    "Url": "https://ifgxgppxsawauaceudec.supabase.co",
    "ServiceKey": "SEU_SERVICE_KEY_AQUI"
  },
  "MercadoPago": {
    "AccessToken": "SEU_TOKEN_MERCADOPAGO_AQUI"
  }
}
```

**IMPORTANTE:** Nunca commitar este arquivo! Ele está no `.gitignore`.

### 3. Restaurar Pacotes

```bash
dotnet restore
```

---

## 🚀 Execução

### Modo Desenvolvimento

```bash
cd src/RenoveJa.Api
dotnet run
```

O servidor estará disponível em:
- **HTTP:** http://localhost:5000
- **HTTPS:** https://localhost:5001
- **Swagger:** http://localhost:5000/swagger

### Modo Produção

```bash
dotnet run --configuration Release
```

---

## 🧪 Testes

### Executar Todos os Testes

```bash
dotnet test
```

### Executar com Cobertura

```bash
dotnet test --collect:"XPlat Code Coverage"
```

---

## 📁 Estrutura do Projeto

### Domain Layer (Núcleo do Negócio)

**Entities:**
- `User` - Usuário (paciente ou médico)
- `DoctorProfile` - Perfil do médico
- `MedicalRequest` - Solicitação (receita/exame/consulta)
- `Payment` - Pagamento
- `ChatMessage` - Mensagem de chat
- `Notification` - Notificação
- `VideoRoom` - Sala de vídeo
- `AuthToken` - Token de autenticação
- `PushToken` - Token de push notification

**Value Objects:**
- `Email` - Email validado
- `Phone` - Telefone validado
- `Money` - Valor monetário

**Enums:**
- `UserRole` (Patient, Doctor)
- `RequestType` (Prescription, Exam, Consultation)
- `RequestStatus` (17 estados diferentes)
- `PaymentStatus` (Pending, Approved, Rejected, Refunded)

### Application Layer (Casos de Uso)

**Services:**
- `AuthService` - Registro, login, logout, validação de token
- `RequestService` - CRUD de solicitações, aprovação, rejeição, assinatura
- `PaymentService` - Criação de pagamento, webhook, confirmação
- `ChatService` - Envio e listagem de mensagens
- `NotificationService` - Notificações do usuário
- `VideoService` - Criação e gerenciamento de salas
- `DoctorService` - Listagem e detalhes de médicos

### Infrastructure Layer (Implementações)

**Supabase Client:**
- Cliente HTTP customizado para PostgREST
- Métodos: `GetAllAsync`, `GetSingleAsync`, `InsertAsync`, `UpdateAsync`, `DeleteAsync`

**Repositories:**
- Implementam interfaces do Domain
- Mapeiam Domain <-> Persistence Models

### API Layer (Endpoints)

**Controllers:**
- `HealthController` - `/api/health`
- `AuthController` - `/api/auth/*`
- `RequestsController` - `/api/requests/*`
- `PaymentsController` - `/api/payments/*`
- `ChatController` - `/api/chat/*`
- `NotificationsController` - `/api/notifications/*`
- `VideoController` - `/api/video/*`
- `DoctorsController` - `/api/doctors/*`

---

## 🔌 Endpoints

### Health

```http
GET /api/health
```

### Autenticação

```http
POST /api/auth/register
POST /api/auth/register-doctor
POST /api/auth/login
GET  /api/auth/me               [Requires: Bearer Token]
POST /api/auth/logout           [Requires: Bearer Token]
POST /api/auth/google
```

### Solicitações (Requests)

```http
POST /api/requests/prescription     [Requires: Bearer Token]
POST /api/requests/exam             [Requires: Bearer Token]
POST /api/requests/consultation     [Requires: Bearer Token]
GET  /api/requests                  [Requires: Bearer Token]
GET  /api/requests/{id}             [Requires: Bearer Token]
PUT  /api/requests/{id}/status      [Requires: Bearer Token, Role: Doctor]
POST /api/requests/{id}/approve     [Requires: Bearer Token, Role: Doctor]
POST /api/requests/{id}/reject      [Requires: Bearer Token, Role: Doctor]
POST /api/requests/{id}/sign        [Requires: Bearer Token, Role: Doctor]
```

### Pagamentos

```http
POST /api/payments                  [Requires: Bearer Token]
GET  /api/payments/{id}             [Requires: Bearer Token]
POST /api/payments/{id}/confirm     [Dev/Test Only]
POST /api/payments/webhook          [MercadoPago Webhook]
```

### Chat

```http
POST /api/chat/{request_id}/messages    [Requires: Bearer Token]
GET  /api/chat/{request_id}/messages    [Requires: Bearer Token]
GET  /api/chat/unread-count             [Requires: Bearer Token]
PUT  /api/chat/{request_id}/mark-read   [Requires: Bearer Token]
```

### Notificações

```http
GET /api/notifications              [Requires: Bearer Token]
PUT /api/notifications/{id}/read    [Requires: Bearer Token]
PUT /api/notifications/read-all     [Requires: Bearer Token]
```

### Vídeo

```http
POST /api/video/rooms               [Requires: Bearer Token]
GET  /api/video/rooms/{id}          [Requires: Bearer Token]
```

### Médicos

```http
GET /api/doctors                    
GET /api/doctors/{id}               
GET /api/doctors/queue              [Requires: Bearer Token, Role: Doctor]
PUT /api/doctors/{id}/availability  [Requires: Bearer Token, Role: Doctor]
```

---

## 🛡️ Segurança

### Autenticação Bearer Token

O sistema usa autenticação customizada via Bearer Token:

1. **Login/Registro** → Gera token e armazena na tabela `auth_tokens`
2. **Requests Protegidos** → Valida token consultando o banco
3. **Claims Populadas** → `userId` e `role` (patient/doctor)
4. **Autorização** → Policies baseadas em roles

**Exemplo de Request:**

```http
GET /api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Senhas

- **Hashing:** BCrypt (compatível com Python)
- **Salt:** Gerado automaticamente pelo BCrypt
- **Validação:** Mínimo 8 caracteres (FluentValidation)

### CORS

Configurado para aceitar requisições do frontend (ajustar em produção):

```csharp
app.UseCors(policy => 
    policy.AllowAnyOrigin()
          .AllowAnyMethod()
          .AllowAnyHeader()
);
```

---

## 📊 Banco de Dados (Supabase)

### Tabelas

- `users` - Usuários (pacientes e médicos)
- `doctor_profiles` - Perfis de médicos
- `requests` - Solicitações (receitas, exames, consultas)
- `payments` - Pagamentos
- `chat_messages` - Mensagens de chat
- `notifications` - Notificações
- `video_rooms` - Salas de vídeo
- `auth_tokens` - Tokens de autenticação
- `push_tokens` - Tokens de push notification

### Acesso

O backend acessa o Supabase via **PostgREST API** (HTTP):

- **Base URL:** `https://ifgxgppxsawauaceudec.supabase.co/rest/v1/`
- **Header:** `apikey: SERVICE_KEY`
- **Header:** `Authorization: Bearer SERVICE_KEY`

**Sem necessidade de conexão Postgres direta!**

---

## 🧩 Integrações Externas

### MercadoPago (Pagamentos PIX)

```csharp
// TODO: Implementar MercadoPagoService
// SDK: MercadoPago.Client
```

### PDF Generator (Receitas/Exames)

```csharp
// TODO: Implementar PdfGeneratorService
// Biblioteca: QuestPDF ou iTextSharp
```

### Push Notifications

```csharp
// TODO: Implementar PushNotificationService
// FCM ou Expo Push
```

### Video Service

```csharp
// TODO: Implementar VideoServiceProvider
// Jitsi, Whereby ou Agora.io
```

---

## 📝 Decisões Arquiteturais

Veja [DECISIONS.md](./DECISIONS.md) para decisões detalhadas sobre:

- Clean Architecture + DDD
- Supabase via PostgREST
- Autenticação customizada
- BCrypt para senhas
- FluentValidation
- Patterns utilizados

---

## 🧪 Status de Implementação

### ✅ Completo

- [x] Domain Layer (Entities, VOs, Enums, Interfaces)
- [x] Application Layer (DTOs, AuthService, Interfaces)
- [x] Infrastructure Layer (SupabaseClient, UserRepository)
- [x] API Layer (Program.cs, HealthController, AuthController)
- [x] Middleware (Exception Handling, Correlation ID)
- [x] Authentication (Bearer Token Handler)

### ⏳ Em Progresso

- [ ] Repositories restantes (Doctor, Request, Payment, etc.)
- [ ] Services restantes (Request, Payment, Chat, etc.)
- [ ] Controllers restantes
- [ ] FluentValidation Validators
- [ ] Integrações externas (MercadoPago, PDF, Push)
- [ ] Testes unitários

### 📋 Backlog

- [ ] Testes de integração
- [ ] Logging estruturado (Serilog)
- [ ] Docker e CI/CD
- [ ] Migração para JWT (futuro)
- [ ] CQRS (se necessário)

---

## 🤝 Contribuição

### Fluxo de Desenvolvimento

1. **Clone o repo**
2. **Crie uma branch:** `git checkout -b feature/minha-feature`
3. **Implemente incrementalmente** (Domain → Application → Infrastructure → API)
4. **Escreva testes unitários**
5. **Build sem warnings:** `dotnet build`
6. **Testes passando:** `dotnet test`
7. **Commit lógico:** `git commit -m "feat: implementa RequestService"`
8. **Push:** `git push origin feature/minha-feature`
9. **Pull Request**

---

## 📞 Suporte

- **Documentação Técnica:** [DECISIONS.md](./DECISIONS.md)
- **Inventário de Endpoints:** [INVENTORY.md](./INVENTORY.md)
- **Issues:** GitHub Issues
- **Email:** suporte@renoveja.com

---

## 📜 Licença

Este projeto é proprietário. Todos os direitos reservados.

---

## 🎉 Agradecimentos

- **Arquitetura:** Clean Architecture (Uncle Bob) + DDD (Eric Evans)
- **Framework:** .NET 8 (Microsoft)
- **Backend de Dados:** Supabase
- **Pagamentos:** MercadoPago

---

**Versão:** 1.0.0  
**Data:** 2026-02-02  
**Autor:** Equipe RenoveJá + Claude (Arquiteto .NET + DDD)
