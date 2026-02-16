# RenoveJá — Plataforma de Telemedicina

Plataforma de telemedicina para **renovação de receitas**, **pedidos de exame** e **consultas online**. Inclui fluxo completo: solicitação pelo paciente, aprovação e assinatura digital pelo médico, pagamento via PIX (Mercado Pago) e verificação pública de receitas por QR Code.

---

## Índice

- [Visão geral](#visão-geral)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Pré-requisitos](#pré-requisitos)
- [Configuração](#configuração)
- [Como rodar](#como-rodar)
- [Funcionalidades principais](#funcionalidades-principais)
- [Verificação de receitas (QR Code)](#verificação-de-receitas-qr-code)
- [Documentação adicional](#documentação-adicional)
- [Licença](#licença)

---

## Visão geral

| Parte | Stack | Descrição |
|-------|--------|-----------|
| **Backend** | .NET 8, C#, Clean Architecture, Supabase | API REST: auth, solicitações, pagamentos PIX, webhook MP, verificação pública, PDF, assinatura digital |
| **Frontend** | Expo (React Native), TypeScript | App mobile (iOS/Android/Web): paciente e médico, PIX, chat, notificações, vídeo |

- **Paciente:** solicita receita/exame, paga com PIX, acompanha status, baixa receita assinada, chata com o médico.
- **Médico:** aprova/rejeita pedidos, assina digitalmente (certificado ICP-Brasil), consultas por vídeo.
- **Farmacêutico / terceiros:** verificam autenticidade da receita escaneando o QR Code (sem login).

---

## Estrutura do repositório

```
ola-jamal/
├── backend-dotnet/          # API .NET 8
│   ├── src/
│   │   ├── RenoveJa.Api/           # Host (Controllers, Program.cs)
│   │   ├── RenoveJa.Application/   # Serviços, DTOs, interfaces
│   │   ├── RenoveJa.Domain/        # Entidades, enums, contratos
│   │   └── RenoveJa.Infrastructure/# Supabase, Mercado Pago, PDF, Storage
│   ├── tests/
│   └── docs/                 # Fluxos, storage, assinatura, etc.
├── frontend-mobile/          # App Expo (RenoveJá)
│   ├── app/                  # Telas (Expo Router)
│   ├── components/
│   ├── contexts/
│   ├── lib/                  # API client
│   └── types/
├── test-signature/           # Utilitário de teste de assinatura PDF
└── README.md                 # Este arquivo
```

---

## Pré-requisitos

- **.NET 8 SDK** — backend
- **Node.js 18+** e **npm** (ou yarn) — frontend
- **Conta Supabase** — banco (PostgreSQL) e storage
- **Mercado Pago** — Access Token para PIX (produção ou sandbox)
- **Expo Go** (celular) ou emulador iOS/Android — para rodar o app

---

## Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/SEU_USUARIO/ola-jamal.git
cd ola-jamal
```

### 2. Backend — variáveis de ambiente

Na pasta da API, use **`.env`** (não commitar):

```bash
cd backend-dotnet/src/RenoveJa.Api
```

Crie ou edite `.env`:

```env
# Obrigatório
Supabase__Url=https://SEU_PROJETO.supabase.co
Supabase__ServiceKey=sua_service_role_key

# PIX (Mercado Pago)
MercadoPago__AccessToken=APP_USR_...

# Opcional: IA para análise de receita
OpenAI__ApiKey=sk-...

# Opcional: webhook HMAC (produção)
MercadoPago__WebhookSecret=...
```

- **Supabase:** Project Settings → API → URL e **service_role** (secret).
- **Mercado Pago:** [Credenciais](https://www.mercadopago.com.br/developers) — Access Token (produção ou teste).

### 3. Frontend — URL da API

No app, a base da API é configurada por variável de ambiente. Para dispositivo físico ou emulador apontando para a máquina local:

```env
# .env ou no comando
EXPO_PUBLIC_API_URL=http://SEU_IP_LOCAL:5000
```

Ex.: `EXPO_PUBLIC_API_URL=http://192.168.1.10:5000` (troque pelo IP da sua rede).

### 4. Banco e storage (Supabase)

- Crie as tabelas necessárias (o backend aplica migrações na subpasta `Supabase` ao iniciar).
- Para storage de imagens e PDFs: bucket `prescription-images` **público** para leitura. Ver `backend-dotnet/docs/STORAGE_BUCKET.sql` e documentação em `backend-dotnet/docs/`.

---

## Como rodar

### Backend

```bash
cd backend-dotnet/src/RenoveJa.Api
dotnet run
```

- API: **http://localhost:5000**
- Swagger: **http://localhost:5000/swagger**
- Ambiente padrão: **Development** (webhook HMAC desabilitado para facilitar teste com ngrok).

### Frontend (Expo)

```bash
cd frontend-mobile
npm install
npm start
```

Depois: escaneie o QR Code com o Expo Go (celular) ou use **i** para iOS / **a** para Android no terminal.

- Garanta que `EXPO_PUBLIC_API_URL` aponte para o IP onde o backend está acessível (ex.: `http://192.168.1.10:5000`).

### Teste rápido de fluxo

1. Registrar usuário (paciente) e médico no app.
2. Paciente: nova solicitação (receita ou exame), enviar foto.
3. Médico: aprovar pedido (status → aguardando pagamento).
4. Paciente: pagar com PIX (QR Code ou copia e cola).
5. Webhook do Mercado Pago confirma o pagamento (em dev pode usar ngrok + URL do webhook no MP).
6. Médico: assinar documento; paciente pode baixar a receita.

---

## Funcionalidades principais

- **Autenticação:** registro, login, logout, Bearer token (tabela `auth_tokens`).
- **Solicitações:** receita (simples/controlada/azul), exame, consulta; fluxo por status (submitted → paid → signed → delivered, etc.).
- **Pagamentos:** PIX via Mercado Pago (QR Code + copia e cola); webhook para confirmação automática; idempotência e persistência de eventos.
- **Assinatura digital:** receita assinada com certificado (ICP-Brasil); PDF gerado e armazenado; link público para verificação.
- **Verificação de receitas:** página e API públicas (sem login); código de acesso; link para abrir o documento (PDF) só com o código.
- **Chat:** mensagens por solicitação (paciente ↔ médico).
- **Notificações:** in-app e push (Expo).
- **Vídeo:** salas para consulta (integração configurável).
- **IA:** análise de legibilidade e resumo em pedidos de exame (OpenAI opcional).

---

## Verificação de receitas (QR Code)

A receita pode ser verificada **sem login**, apenas com o QR Code (e código de acesso quando aplicável).

| Recurso | URL / Uso |
|--------|------------|
| Página de verificação | `GET /api/verify/{id}/page` — HTML responsivo (mobile-first). |
| Dados públicos | `GET /api/verify/{id}` — dados mascarados (sem CPF completo). |
| Dados completos | `POST /api/verify/{id}/full` com `{ "accessCode": "1234" }`. |
| **Abrir documento (PDF)** | `GET /api/verify/{id}/document?code=1234` — redireciona para o PDF; **não exige autenticação**, só o código. |
| Protocolo ITI | `GET /api/verify/{id}?_format=application/validador-iti+json&_secretCode=...` — para validar.iti.gov.br. |

Fluxo típico: farmacêutico escaneia o QR Code → abre a página → digita o código de 4 dígitos → clica em “Verificar” → “Abrir documento (PDF)” abre o PDF sem precisar de conta.

---

## Documentação adicional

| Documento | Conteúdo |
|-----------|----------|
| [backend-dotnet/README.md](backend-dotnet/README.md) | Arquitetura, endpoints, segurança, testes do backend. |
| [backend-dotnet/docs/FLUXO_RECEITA.md](backend-dotnet/docs/FLUXO_RECEITA.md) | Fluxo passo a passo: receita, aprovação, pagamento, assinatura. |
| [backend-dotnet/docs/STORAGE_BUCKET.sql](backend-dotnet/docs/STORAGE_BUCKET.sql) | Criação do bucket no Supabase. |
| [backend-dotnet/src/RenoveJa.Api/README_CONFIG.md](backend-dotnet/src/RenoveJa.Api/README_CONFIG.md) | Configuração (.env) da API. |
| [frontend-mobile/README.md](frontend-mobile/README.md) | Estrutura do app, cores, setup e scripts. |

---

## Licença

Projeto proprietário. Todos os direitos reservados.

---

**RenoveJá** — Backend .NET 8 + Expo (React Native) · Supabase · Mercado Pago (PIX)
