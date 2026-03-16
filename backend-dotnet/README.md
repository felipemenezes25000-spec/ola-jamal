# RenoveJá+ — Backend .NET 8

API do RenoveJá+ em C#/.NET 8 com Clean Architecture. PostgreSQL (AWS RDS), storage AWS S3, IA (OpenAI/Gemini), videochamadas (Daily.co), assinatura digital ICP-Brasil. Serviço 100% gratuito.

Documentação geral do monorepo: [README principal](../README.md) · [docs/](../docs/README.md)

---

## Arquitetura

Clean Architecture com 4 camadas:

```
backend-dotnet/
├── src/
│   ├── RenoveJa.Domain/          # Entidades, enums, value objects, interfaces de repositório
│   ├── RenoveJa.Application/     # DTOs, serviços (use cases), interfaces, validators
│   ├── RenoveJa.Infrastructure/  # Repositórios, PostgresClient, S3, OpenAI, Daily.co, etc.
│   └── RenoveJa.Api/             # Controllers, middlewares, autenticação, Program.cs
└── tests/
    └── RenoveJa.UnitTests/       # Testes unitários (xUnit + FluentAssertions)
```

**Fluxo de dependência:** `Api → Application → Domain ← Infrastructure`

---

## Pré-requisitos

- .NET 8 SDK
- PostgreSQL acessível (AWS RDS em prod, local em dev)
- AWS credentials com acesso ao S3 (dev local: `aws configure` ou variáveis de ambiente)
- Chaves: OpenAI, Daily.co, Google OAuth

---

## Configuração local

Crie `src/RenoveJa.Api/appsettings.Development.json` (não commitar — está no `.gitignore`):

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=renoveja;Username=postgres;Password=SUA_SENHA"
  },
  "OpenAI": {
    "ApiKey": "sk-proj-SUA_CHAVE"
  },
  "Api": {
    "BaseUrl": "http://localhost:5000",
    "DocumentTokenSecret": "CHAVE_MIN_32_CARACTERES_ALEATORIA"
  },
  "CertificateEncryption": {
    "Key": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
  }
}
```

Copie `.env.example` para `.env` e preencha as demais variáveis (Daily.co, Google, SMTP, etc.).

---

## Execução

```bash
cd backend-dotnet
dotnet restore
dotnet build

cd src/RenoveJa.Api
dotnet run
```

- API: `http://localhost:5000`
- Swagger: `http://localhost:5000/swagger` (apenas em Development)

### Docker

```bash
cd backend-dotnet
docker-compose up --build
```

---

## Testes

```bash
cd backend-dotnet
dotnet test

# Com cobertura
dotnet test --collect:"XPlat Code Coverage"
```

---

## Variáveis de ambiente

Ver `docs/VARIAVEIS_AMBIENTE.md` para lista completa. As principais:

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `ConnectionStrings__DefaultConnection` | Connection string PostgreSQL (AWS RDS) | ✅ |
| `OpenAI__ApiKey` | Chave OpenAI (leitura de receitas/exames, anamnese, IA) | ✅ |
| `Gemini__ApiKey` | Chave Gemini 2.5 Flash (fallback da OpenAI) | Recomendada |
| `Api__BaseUrl` | URL pública da API (proxy de documentos e imagens) | ✅ |
| `Api__DocumentTokenSecret` | Secret 32+ chars para tokens de documento | ✅ |
| `DAILY_API_KEY` | Chave Daily.co | ✅ |
| `DAILY_DOMAIN` | Domínio Daily.co | ✅ |
| `DAILY_WEBHOOK_SECRET` | Secret para validar webhooks do Daily.co | Recomendada |
| `CertificateEncryption__Key` | AES-256 key (base64) para PFX | ✅ |
| `Google__ClientId` | Google OAuth client ID | Para login Google |
| `Smtp__*` | Config SMTP (recuperação de senha) | Para e-mail |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Credenciais AWS (dev local) | Dev local |
| `AWS_S3_PRESCRIPTIONS_BUCKET` | Bucket S3 receitas (default: `renoveja-prescriptions`) | Opcional |
| `SENTRY_DSN` | DSN Sentry — desativa se vazio | Opcional |

---

## Banco de dados

PostgreSQL via **AWS RDS**. Acesso via Npgsql + Dapper através do `PostgresClient` (wrapper HTTP-REST-like sobre Dapper).

Migrations são executadas automaticamente no startup via `MigrationRunner` quando `ConnectionStrings__DefaultConnection` está configurada.

**Tabelas principais:** `users`, `doctor_profiles`, `requests`, `notifications`, `video_rooms`, `consultation_anamnesis`, `medical_documents`, `encounters`, `care_plans`, `push_tokens`, `audit_logs`, `certificates`.

---

## Storage (AWS S3)

Implementado em `S3StorageService`. Buckets configuráveis via env vars:

| Bucket (env var) | Default | Conteúdo |
|------------------|---------|----------|
| `AWS_S3_PRESCRIPTIONS_BUCKET` | `renoveja-prescriptions` | Imagens de receita, PDFs assinados |
| `AWS_S3_CERTIFICATES_BUCKET` | `renoveja-certificates` | Certificados PFX dos médicos |
| `AWS_S3_AVATARS_BUCKET` | `renoveja-avatars` | Fotos de perfil |
| `AWS_S3_TRANSCRIPTS_BUCKET` | `renoveja-transcripts` | Transcrições de consultas |

URLs públicas via CloudFront (`AWS_S3_PUBLIC_BASE_URL`) ou diretamente pelo S3.

---

## IA e transcrição

- **Leitura de receitas/exames:** OpenAI GPT-4o (fallback: Gemini 2.5 Flash)
- **Geração de anamnese:** GPT-4o/Gemini a partir da transcrição da consulta
- **Transcrição de consulta:** Daily.co com Deepgram (nativo — não usa Whisper)
- **Sugestão de conduta:** OpenAI com contexto clínico
- **Evidências clínicas:** PubMed + Europe PMC + Semantic Scholar + ClinicalTrials

---

## Controllers (42 endpoints)

Organizados em: Auth, Requests, RequestApproval, Prescriptions, Consultation, ConsultationWorkflow, Doctors, Patients, Video, Notifications, PushTokens, Certificates, ClinicalRecords, CarePlans, AuditLogs, Analytics, Assistant, Triage, Verification, Sus, Integrations, Rnds, FhirLite, Specialties, Cid10, Contact, ShortUrl, Health, AdminDoctors, AdminClinicalBackfill, GeminiTest, DevSample.

---

## Autenticação

Bearer token customizado: token gerado no login, armazenado na tabela `auth_tokens`, validado por `BearerAuthenticationHandler` em cada request. Senhas: BCrypt. Google OAuth: ID token validado pelo backend.

---

## Deploy (AWS)

- **AWS ECS Fargate (ou App Runner):** Docker (`backend-dotnet/Dockerfile`), variáveis via SSM Parameter Store (ver `infra/task-definition.json`)
- **Migrations:** aplicadas automaticamente no startup

---

## Decisões arquiteturais relevantes

- **Sem ORM pesado:** Dapper via `PostgresClient` — queries SQL diretas, rápidas e auditáveis.
- **S3 em todos os ambientes:** não há fallback para storage local. Em dev, use AWS credentials reais ou LocalStack.
- **Transcrição via Daily.co:** Deepgram é gerenciado pelo Daily.co — nenhuma configuração adicional além de `DAILY_API_KEY`.
- **`DatabaseConfig`** mantém apenas `DatabaseUrl` por compatibilidade com o `MigrationRunner`. A connection string real vem de `ConnectionStrings__DefaultConnection`.
