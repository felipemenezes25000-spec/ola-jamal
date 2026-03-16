# Distribuição das variáveis de ambiente

Cada parte do projeto tem seu próprio `.env` e `.env.example`. **Não misture**: variáveis do backend não vão no mobile/web e vice-versa.

---

## 1. Backend (API .NET)

| Arquivo | Conteúdo | Commitar? |
| --- | --- | --- |
| `backend-dotnet/src/RenoveJa.Api/.env` | Valores reais (local ou copiados da API na AWS) | **Não** |
| `backend-dotnet/src/RenoveJa.Api/.env.example` | Todas as chaves com placeholders | Sim |

**Chaves usadas pela API (só backend):**

- Runtime: `ASPNETCORE_ENVIRONMENT`, `PORT`, `ASPNETCORE_URLS`
- API: `Api__BaseUrl`, `Api__DocumentTokenSecret`
- Verificação ITI: `Verification__BaseUrl`, `Verification__FrontendUrl`
- Google: `Google__ClientId`
- OpenAI: `OpenAI__ApiKey`, `OpenAI__Model`
- Certificado: `CertificateEncryption__Key`
- SMTP: `Smtp__Host`, `Smtp__Port`, `Smtp__EnableSsl`, `Smtp__UserName`, `Smtp__Password`, `Smtp__FromEmail`, `Smtp__FromName`, `Smtp__ResetPasswordBaseUrl`, `Smtp__ContactToEmail` (formulário de contato)
- InfoSimples: `InfoSimples__ApiToken`
- Daily.co: `DAILY_API_KEY`, `DAILY_DOMAIN`, `DAILY_ROOM_PREFIX`, `DAILY_ROOM_EXPIRY_MINUTES`

CORS é definido em `appsettings.json` (`Cors:AllowedOrigins`), não em `.env`.

Na **API (AWS)**, configure as mesmas chaves na Task Definition ou no Parameter Store.

---

## 2. Frontend mobile (Expo / React Native)

| Arquivo | Conteúdo | Commitar? |
| --- | --- | --- |
| `frontend-mobile/.env` | Valores reais (local / EAS) | **Não** |
| `frontend-mobile/.env.example` | Chaves com placeholders | Sim |

**Chaves (só mobile):**

- `EXPO_PUBLIC_API_URL` — URL base da API
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` — Google OAuth (obrigatório)
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` — opcional (build Android)
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — opcional (build iOS)
- `EXPO_PUBLIC_TRIAGE_ENABLED` — assistente Dra. Renova (true/false)

Não coloque no mobile: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, OpenAI, etc.

**Login com Google:** para o botão "Continuar com Google" funcionar, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` no mobile deve ser **o mesmo** Client ID (Web) que está em `Google__ClientId` no backend. Use o mesmo valor nos dois.

---

## 3. Frontend web (Vite)

| Arquivo | Conteúdo | Commitar? |
| --- | --- | --- |
| `frontend-web/.env` | Valores reais | **Não** |
| `frontend-web/.env.example` | Chaves com placeholders | Sim |

**Chaves (só web):**

- `VITE_API_URL` — URL base da API

---

## Resumo

| Parte | Pasta | .env (valores reais) | .env.example (placeholders) |
| --- | --- | --- | --- |
| Backend | `backend-dotnet/src/RenoveJa.Api/` | Não commitar | Commitar |
| Mobile | `frontend-mobile/` | Não commitar | Commitar |
| Web | `frontend-web/` | Não commitar | Commitar |

Os arquivos `.env` estão listados no `.gitignore` de cada pasta / raiz; apenas os `.env.example` devem ser versionados.
