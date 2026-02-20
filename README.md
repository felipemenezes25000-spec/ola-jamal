# RenoveJá+ — Plataforma de Telemedicina

Plataforma para **renovação de receitas**, **pedidos de exame** e **consultas online**. Fluxo completo: solicitação pelo paciente, aprovação e assinatura digital (ICP-Brasil) pelo médico, pagamento PIX (Mercado Pago) e verificação pública de receitas/exames por QR Code.

---

## Índice

- [Visão geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Como rodar](#como-rodar)
- [Fluxos principais](#fluxos-principais)
- [Verificação de documentos (Verify v2)](#verificação-de-documentos-verify-v2)
- [Documentação adicional](#documentação-adicional)
- [Deploy](#deploy)

---

## Visão geral

| Parte | Stack | Descrição |
|-------|-------|-----------|
| **Backend** | .NET 8, C#, Clean Architecture, Supabase | API REST: auth, solicitações, pagamentos PIX, PDF, assinatura digital ICP-Brasil, Verify |
| **Mobile** | Expo (React Native), TypeScript | App iOS/Android/Web: paciente e médico, PIX, notificações, vídeo |
| **Web** | React (Vite), TypeScript | Página pública de verificação de receitas/exames (QR Code + código) |
| **Supabase** | Edge Functions, Storage, PostgreSQL | Edge Function `verify` + tabela `prescriptions` + bucket privado |

- **Paciente:** solicita receita/exame, paga PIX, acompanha status, baixa PDF assinado.
- **Médico:** aprova/rejeita, assina digitalmente (certificado ICP-Brasil), consultas por vídeo.
- **Farmacêutico / terceiros:** verificam autenticidade escaneando o QR Code e digitando o código de 6 dígitos.

---

## Arquitetura

```
┌─────────────────┐     HTTP + JWT      ┌─────────────────┐
│ frontend-mobile │ ◄──────────────────►│ backend-dotnet  │
│ (Expo RN)       │                     │ (.NET 8 API)    │
└─────────────────┘                     └────────┬────────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    │                            │                            │
                    ▼                            ▼                            ▼
           ┌────────────────┐          ┌────────────────┐          ┌────────────────┐
           │ Supabase       │          │ Supabase       │          │ Mercado Pago   │
           │ PostgreSQL     │          │ Storage        │          │ (PIX, webhook) │
           └────────────────┘          │ prescriptions  │          └────────────────┘
                    ▲                   └────────┬───────┘
                    │                            │
┌───────────────────┴──────────────┐   ┌─────────┴──────────┐
│ frontend-web (Verify page)       │   │ Edge Function      │
│ renovejasaude.com.br/verify/:id  │──►│ verify (Deno)      │
│ QR Code → digita código → PDF    │   │ createSignedUrl    │
└──────────────────────────────────┘   └────────────────────┘
```

---

## Estrutura do projeto

```
ola-jamal/
├── backend-dotnet/         # API .NET 8 (Clean Architecture)
│   ├── src/                # RenoveJa.Api, Application, Domain, Infrastructure
│   ├── tests/
│   └── scripts/            # iniciar-ngrok.ps1 (webhook local)
├── frontend-mobile/        # App Expo (React Native)
│   ├── app/                # Telas (Expo Router)
│   ├── components/, contexts/, lib/
│   └── package.json
├── frontend-web/           # SPA React (Vite) — página de verificação
│   └── src/pages/Verify.tsx
├── supabase/               # Edge Functions + migrations
│   ├── functions/verify/   # Edge Function Verify v2
│   └── migrations/         # prescriptions, prescription_verification_logs, bucket
├── scripts/                # seedPrescription.ts (dados de teste)
├── test-signature/         # Utilitário de teste de assinatura PDF
├── docs/                   # QUICK_START, VERIFY_DEPLOY, FLUXO_RECEITA
└── README.md
```

---

## Pré-requisitos

- **.NET 8 SDK** — backend
- **Node.js 18+** e **npm** — frontend
- **Conta Supabase** — banco, storage e Edge Functions
- **Mercado Pago** — Access Token para PIX (produção ou sandbox)
- **Expo Go** ou emulador — para rodar o app mobile

---

## Variáveis de ambiente

### Backend (`backend-dotnet/src/RenoveJa.Api/.env`)

```env
Supabase__Url=https://SEU_PROJETO.supabase.co
Supabase__ServiceKey=sua_service_role_key
MercadoPago__AccessToken=APP_USR_...
MercadoPago__NotificationUrl=https://SEU_DOMINIO/api/payments/webhook
Verification__BaseUrl=https://renovejasaude.com.br/verify
OpenAI__ApiKey=sk-...           # opcional
CertificateEncryption__Key=...  # chave para criptografar PFX
```

### Mobile (`frontend-mobile/.env`)

```env
EXPO_PUBLIC_API_URL=http://SEU_IP:5000
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
```

### Web (`frontend-web/.env`)

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

---

## Como rodar

### Backend

```bash
cd backend-dotnet/src/RenoveJa.Api
dotnet run
```

API: **http://localhost:5000** | Swagger: **http://localhost:5000/swagger**

### Mobile

```bash
cd frontend-mobile
npm install
npm start
```

Use `npm run start:tunnel` para testar em dispositivo físico via URL pública.

### Web (Verify)

```bash
cd frontend-web
npm install
npm run dev
```

### Supabase (Edge Function + migrations)

Migrations: via Supabase Dashboard ou CLI.  
Edge Function: deploy via MCP ou CLI:

```bash
supabase functions deploy verify --no-verify-jwt
```

---

## Fluxos principais

### Receita

1. Paciente envia foto/medicamentos → IA analisa (OpenAI opcional)
2. Médico aprova → status `approved_pending_payment`
3. Paciente paga PIX → webhook confirma → status `paid`
4. Médico assina com certificado ICP-Brasil → PDF gerado e enviado para Supabase
5. Backend registra na tabela `prescriptions` (Verify v2)
6. Paciente baixa PDF; farmácia verifica via QR Code + código de 6 dígitos

### Exame

1. Paciente envia exames + sintomas (foto opcional) → IA analisa
2. Mesmo fluxo de aprovação, pagamento e assinatura
3. PDF de pedido de exame também é registrado no Verify v2

### Consulta

1. Paciente solicita consulta (tipo, duração, sintomas)
2. Médico aceita → sala Daily.co criada
3. Videoconferência; transcrição opcional (Whisper)
4. Anamnese gerada por IA (OpenAI)

---

## Verificação de documentos (Verify v2)

| Recurso | URL | Descrição |
|---------|-----|-----------|
| Página de verificação | `https://renovejasaude.com.br/verify/:id` | SPA React; usuário digita código de 6 dígitos |
| Edge Function | `POST {SUPABASE_URL}/functions/v1/verify` | Body: `{ id, code, v? }` — verifica e retorna signed URL do PDF |
| QR Code no PDF | `renovejasaude.com.br/verify/{id}` | Aponta para a página; código impresso no documento |

Fluxo: farmacêutico escaneia QR Code → abre página → digita os 6 dígitos → valida → botão "Baixar PDF (2ª via)".

---

## Documentação adicional

| Documento | Conteúdo |
|-----------|----------|
| [docs/QUICK_START.md](docs/QUICK_START.md) | Guia rápido de setup |
| [docs/VERIFY_DEPLOY.md](docs/VERIFY_DEPLOY.md) | Deploy da Edge Function Verify v2 |
| [docs/FLUXO_RECEITA_TELAS_E_STATUS.md](docs/FLUXO_RECEITA_TELAS_E_STATUS.md) | Fluxo de receita e status |
| [backend-dotnet/README.md](backend-dotnet/README.md) | Arquitetura e endpoints do backend |

---

## Deploy

- **Backend:** hospedagem .NET (ex.: Azure, AWS, VPS)
- **Mobile:** Expo EAS Build → App Store / Google Play
- **Web (Verify):** Vercel ou similar, apontando domínio `renovejasaude.com.br/verify`
- **Supabase:** migrations e Edge Function deployados via CLI ou Dashboard
- **Webhook Mercado Pago:** `https://SEU_DOMINIO/api/payments/webhook`

---

**RenoveJá+** — .NET 8 · Expo · Supabase · Mercado Pago (PIX) · ICP-Brasil
