# RenoveJá+

Plataforma de telemedicina para **renovação de receitas**, **pedidos de exame** e **consultas por vídeo**. Fluxo completo: solicitação do paciente → triagem com IA → aprovação e assinatura digital ICP-Brasil pelo médico → pagamento PIX/cartão → verificação pública via QR Code.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| **Backend** | .NET 8, Clean Architecture |
| **Mobile** | Expo 54, React Native, TypeScript |
| **Web** | React (Vite), TypeScript |
| **Banco** | Supabase (PostgreSQL, Storage, Edge Functions) |
| **Pagamentos** | Mercado Pago |
| **Vídeo** | Daily.co |
| **IA** | OpenAI GPT-4o, Deepgram |
| **Assinatura** | ICP-Brasil (PAdES) |

---

## Estrutura do Projeto

```
ola-jamal/
├── backend-dotnet/     # API .NET 8 (Clean Architecture)
├── frontend-mobile/    # App Expo (iOS/Android/Web)
├── frontend-web/       # Landing + verificação de receitas
├── supabase/           # Migrations + Edge Function verify
├── docs/               # Documentação organizada
│   ├── guides/         # Tutoriais e guias
│   ├── architecture/   # Arquitetura e fluxos
│   ├── compliance/     # LGPD, contratos
│   ├── deploy/         # Deploy (Vercel, Render)
│   └── setup/          # Configuração inicial
└── scripts/            # Scripts utilitários (FCM, testes)
```

---

## Quick Start

### Backend

```bash
cd backend-dotnet
dotnet build
dotnet test
cd src/RenoveJa.Api
# Configure appsettings.Development.json ou variáveis de ambiente
dotnet run
```

API em `http://localhost:5000`, Swagger em `/swagger` (Development).

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
npm run build
```

### Docker (Backend)

```bash
cd backend-dotnet
docker-compose up --build
```

---

## Variáveis de Ambiente

| Módulo | Principais variáveis |
|--------|----------------------|
| **Backend** | `Supabase__Url`, `Supabase__ServiceKey`, `OpenAI__ApiKey`, `MercadoPago__AccessToken` |
| **Mobile** | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |

Consulte `backend-dotnet/docs/VARIAVEIS_AMBIENTE.md` e `docs/setup/CONFIG_GOOGLE_OAUTH.md` para detalhes.

---

## Funcionalidades

- **Paciente:** Renovação de receita, pedido de exame, teleconsulta, pagamento PIX/cartão, prontuário
- **Médico:** Fila de atendimentos, triagem com IA, aprovação/rejeição, assinatura digital, vídeo
- **Verificação:** QR Code no documento → digitar código → validar e baixar 2ª via (sem login)
- **Admin:** Trilha de auditoria, feature flags, gestão de médicos

---

## Deploy

| Componente | Plataforma |
|------------|------------|
| Backend | Render (Docker) |
| Web | Vercel |
| Mobile | EAS Build |
| Supabase | Dashboard |

Ver `docs/deploy/` para instruções específicas.

---

## Documentação

| Categoria | Conteúdo |
|-----------|----------|
| [Guides](docs/guides/) | Quick Start, tutoriais, deploy, Expo |
| [Architecture](docs/architecture/) | Análise ponta a ponta, fluxos |
| [Compliance](docs/compliance/) | LGPD, RIPD, ROPA, checklists |
| [Setup](docs/setup/) | Google OAuth, configuração |
| [Backend](backend-dotnet/docs/) | Variáveis, debug, Mercado Pago |

---

## Testes

```bash
# Backend
cd backend-dotnet && dotnet test

# Mobile
cd frontend-mobile && npm test

# Web
cd frontend-web && npm run build
```

---

## CI/CD

GitHub Actions em `main` e `fix/frontend-performance-responsive`:

- Backend: build + test
- Docker: build da imagem
- Frontend Web: build
- Frontend Mobile: typecheck + lint + test + export web

---

**RenoveJá+** — .NET 8 · Expo · Supabase · Mercado Pago · Daily.co · OpenAI · ICP-Brasil
