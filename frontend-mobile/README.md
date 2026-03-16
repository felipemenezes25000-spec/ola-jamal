# RenoveJá+ — App Mobile (Paciente e Médico)

App mobile em **Expo 54 (React Native)** e **TypeScript**. Consome apenas o **backend .NET 8** (REST + SignalR).

Documentação geral: [README principal](../README.md) · [docs/](../docs/README.md).

---

## Funcionalidades

### Paciente
- Autenticação (login, cadastro, Google OAuth, esqueci minha senha)
- Solicitar renovação de receitas (simples, controladas, azul)
- Solicitar pedidos de exame
- Agendar/entrar em consultas por vídeo (Daily.co)
- Pagamento via PIX ou cartão (Mercado Pago)
- Visualizar e baixar PDFs assinados
- Notificações de status em tempo real (SignalR + Expo Push)
- Prontuário e histórico de solicitações
- Planos de cuidado

### Médico
- Dashboard com fila de atendimentos e indicadores
- Assumir, revisar, aprovar ou rejeitar solicitações
- Assinatura digital ICP-Brasil (via backend)
- Videochamada com transcrição automática (Daily.co + Deepgram)
- Anamnese gerada por IA após consulta
- Prontuário do paciente
- Gestão de certificado digital (upload de PFX)
- Triagem IA ("Dra. Renova") com conduta sugerida

---

## Stack técnica

| Item | Tecnologia |
|------|------------|
| Framework | Expo SDK 54 + Expo Router (file-based routing) |
| Linguagem | TypeScript |
| Backend | API .NET 8 (`EXPO_PUBLIC_API_URL`) |
| Navegação | Expo Router (grupos `(auth)`, `(patient)`, `(doctor)`, `(sus)`) |
| Estado | React Context API |
| Armazenamento local | AsyncStorage |
| Vídeo | Daily.co (`@daily-co/react-native-webrtc`) |
| Push | Expo Notifications + FCM |
| Monitoramento | Sentry (`@sentry/react-native`) |
| Testes | Jest + Testing Library |

---

## Estrutura do projeto

```
frontend-mobile/
├── app/                      # Telas (Expo Router — file-based)
│   ├── (auth)/               # Login, cadastro, recuperação de senha
│   ├── (patient)/            # Tabs do paciente
│   ├── (doctor)/             # Tabs do médico
│   ├── (sus)/                # Fluxo SUS
│   ├── new-request/          # Criação de solicitações
│   ├── request-detail/       # Detalhe (paciente)
│   ├── doctor-request/       # Revisão (médico)
│   ├── video/                # Consulta por vídeo
│   ├── care-plans/           # Planos de cuidado
│   ├── consultation-summary/ # Resumo pós-consulta
│   └── _layout.tsx           # Layout raiz
├── components/               # Componentes reutilizáveis
│   ├── doctor/               # Componentes específicos do médico
│   ├── triage/               # Triagem IA (Dra. Renova)
│   ├── video/                # Componentes de videochamada
│   └── ui/                   # Componentes base
├── contexts/                 # AuthContext, TriageAssistantProvider, etc.
├── hooks/                    # useDailyCall, useAudioRecorder, useRequestActions, etc.
├── lib/                      # Clientes de API, utilitários, design system
│   ├── api-*.ts              # Módulos de API por domínio
│   ├── triage/               # Rules engine da triagem IA
│   └── validation/           # Schemas Zod
├── types/                    # Tipos TypeScript (database.ts, sus.ts)
└── constants/                # Tema, cores, constantes
```

---

## Variáveis de ambiente

Arquivo: `frontend-mobile/.env` (copie de `.env.example`)

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `EXPO_PUBLIC_API_URL` | URL base do backend .NET | ✅ |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Client ID Google OAuth (web) | Login Google |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Client ID Google OAuth (Android) | Login Google |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Client ID Google OAuth (iOS) | Login Google |
| `EXPO_PUBLIC_TRIAGE_ENABLED` | Habilita triagem IA Dra. Renova (`true`/`false`) | Opcional |
| `EXPO_PUBLIC_SENTRY_DSN` | DSN Sentry — desativa se vazio | Opcional |

---

## Autenticação

O app usa autenticação customizada via Bearer Token:

1. Login/cadastro → `POST /api/auth/login` ou `/register` no backend .NET
2. Backend valida credenciais no PostgreSQL, gera token, persiste em `auth_tokens`
3. Token armazenado em AsyncStorage pelo app
4. Requests protegidos enviam `Authorization: Bearer <token>`

Login com Google: ID token do Google enviado para `POST /api/auth/google`, validado pelo backend.

---

## Fluxo de status das solicitações

```
Receitas/Exames:
submitted → pending_payment → paid → in_review → approved → signed → delivered → completed

Consultas:
submitted → searching_doctor → approved_pending_payment → paid →
in_consultation → consultation_finished → completed
```

---

## Como rodar

```bash
cd frontend-mobile
npm install
cp .env.example .env
# Edite .env com EXPO_PUBLIC_API_URL

npx expo start          # Metro bundler
npx expo start --android  # Android
npx expo start --ios      # iOS
```

Para testar em dispositivo físico na mesma rede, use o IP da sua máquina ou ngrok:
```
EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
```

---

## Testes

```bash
npm run test -- --watchAll=false   # Jest (unitários)
npm run typecheck                   # TypeScript
npm run lint                        # ESLint
```

---

## Build de produção (EAS)

```bash
npx eas build --platform android --profile preview   # APK de teste
npx eas build --platform android --profile production # AAB para Play Store
```

Configuração em `eas.json`. Credenciais gerenciadas pelo EAS.

---

## Triagem IA — Dra. Renova

Assistente de triagem implementado com rules engine pura (`lib/triage/`):

- `TriageAssistantProvider` — contexto global, AsyncStorage, anti-spam/cooldown
- Rules engine determinística (`lib/triage/rulesEngine.ts`) — sem chamadas de IA no mobile
- Sugestões de conduta geradas pelo backend (`POST /api/triage/conduct`)
- Componentes: banner, modal, ícone pulsante

---

## Videochamada (Daily.co)

Implementada com `@daily-co/react-native-webrtc`:

- `useDailyCall` / `useDailyJoin` — hooks de ciclo de vida da sala
- `useDailyTranscription` — transcrição via Deepgram (gerenciada pelo Daily.co)
- `useQualityMonitor` — monitoramento de qualidade em tempo real
- PiP (Picture-in-Picture) via plugin nativo (`withDailyPipForeground`)
