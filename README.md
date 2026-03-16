# RenoveJá+

Plataforma de **telemedicina** para renovação de receitas, pedidos de exame e consultas por vídeo. Fluxo completo: solicitação do paciente → triagem com IA → aprovação e assinatura digital ICP-Brasil pelo médico → verificação pública via QR Code. Serviço 100% gratuito para a população.

---

## Stack

| Camada      | Tecnologia |
|------------|------------|
| Backend    | .NET 8, Clean Architecture |
| Mobile     | Expo 54, React Native, TypeScript |
| Web        | Vite + React, TypeScript |
| Banco      | PostgreSQL (AWS RDS, Npgsql + Dapper) |
| Storage    | AWS S3 (receitas, certificados, avatares, transcrições) |
| Vídeo      | Daily.co (WebRTC + transcrição Deepgram) |
| IA         | OpenAI GPT-4o · fallback Gemini 2.5 Flash |
| Assinatura | ICP-Brasil PAdES (iText7 + BouncyCastle) |
| Deploy     | AWS (backend + web) · EAS Build (mobile) |
| Monitoramento | Sentry (todos os módulos) |

---

## Estrutura do repositório

```
ola-jamal/
├── backend-dotnet/   # API .NET 8 (Clean Architecture)
├── frontend-mobile/  # App Expo (iOS/Android)
├── frontend-web/     # Landing, portal médico, verificação de receitas
├── infra/            # Terraform (AWS: ECS, RDS, S3, CloudFront, WAF)
├── docs/             # Documentação central (arquitetura, compliance, guias)
└── scripts/          # Scripts auxiliares (ex.: perf-fix-all.ps1)
```

Cada módulo tem seu próprio **README** com setup e comandos. Documentação detalhada: **[docs/README.md](docs/README.md)**.

---

## Quick start

### Backend

```bash
cd backend-dotnet
dotnet restore && dotnet build
cd src/RenoveJa.Api && dotnet run
```

API em `http://localhost:5000` · Swagger em `/swagger` (apenas em Development).

### Mobile

```bash
cd frontend-mobile
npm install
cp .env.example .env   # Preencha EXPO_PUBLIC_API_URL
npx expo start
```

### Web

```bash
cd frontend-web
npm install
cp .env.example .env   # Preencha VITE_API_URL
npm run dev
```

### Infra (AWS)

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # Edite com seus valores
terraform init && terraform plan && terraform apply
```

---

## Variáveis de ambiente

- **Backend:** `backend-dotnet/docs/VARIAVEIS_AMBIENTE.md` e `backend-dotnet/README.md`
- **Mobile:** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, etc. — ver `.env.example`
- **Web:** `VITE_API_URL`, `VITE_FORMSPREE_FORM_ID`, `VITE_SENTRY_DSN` — ver `.env.example`

Nunca commitar `.env` ou chaves; usar `.env.example` como modelo.

---

## Testes

| Módulo | Comando |
|--------|---------|
| Backend | `cd backend-dotnet && dotnet test` |
| Mobile  | `cd frontend-mobile && npm run test -- --watchAll=false` |
| Web     | `cd frontend-web && npm run test:run` |

---

## Deploy

| Componente | Onde | Observação |
|-----------|------|------------|
| Backend   | AWS ECS Fargate (Docker) | `backend-dotnet/Dockerfile` |
| Web       | AWS CloudFront + S3 (ou Amplify) | Build: `npm run build` |
| Mobile    | EAS Build | `frontend-mobile/eas.json` |
| Banco     | AWS RDS PostgreSQL | Schema: `infra/schema.sql` e `infra/migrations/` |
| Infra     | Terraform | `infra/*.tf` |

---

## Documentação

Índice completo: **[docs/README.md](docs/README.md)** — guias, arquitetura, compliance (LGPD/RIPD/ROPA), troubleshooting e configuração por módulo.

---

**RenoveJá+** — .NET 8 · Expo 54 · PostgreSQL/RDS · AWS S3 · Daily.co · OpenAI · Gemini · ICP-Brasil · Sentry
