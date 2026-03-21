# Variáveis de Ambiente — Backend .NET 8

Referência completa das variáveis necessárias para o backend RenoveJá+.

---

## 1. Lista de variáveis

| Variável | appsettings | Descrição | Obrigatória |
|----------|-------------|-----------|-------------|
| `ConnectionStrings__DefaultConnection` | `ConnectionStrings:DefaultConnection` | Connection string PostgreSQL (AWS RDS) | ✅ |
| `OpenAI__ApiKey` | `OpenAI:ApiKey` | Chave OpenAI (`sk-proj-...`) — leitura de receitas/exames, anamnese, sugestão de conduta | ✅ |
| `Gemini__ApiKey` | `Gemini:ApiKey` | Chave Gemini 2.5 Flash (fallback da OpenAI) | Recomendada |
| `Api__BaseUrl` | `Api:BaseUrl` | URL pública da API — usada para proxy de imagens e links de documentos | ✅ |
| `Api__DocumentTokenSecret` | `Api:DocumentTokenSecret` | String 32+ chars para tokens temporários de acesso a documentos | ✅ |
| `DAILY_API_KEY` | — | Chave API Daily.co (videochamadas) | ✅ |
| `DAILY_DOMAIN` | — | Domínio Daily.co (ex: `renove`) | ✅ |
| `DAILY_ROOM_PREFIX` | — | Prefixo das salas Daily.co (ex: `consult`) | Opcional |
| `DAILY_ROOM_EXPIRY_MINUTES` | — | Expiração das salas em minutos (default: 120) | Opcional |
| `DAILY_WEBHOOK_SECRET` | — | Secret para validar webhooks do Daily.co (Dashboard → Developers → Webhooks) | Recomendada |
| `CertificateEncryption__Key` | `CertificateEncryption:Key` | Chave AES-256 em base64 para criptografar PFX dos médicos | ✅ |
| `Google__ClientId` | `Google:ClientId` | Client ID Google OAuth (Web) | Login Google |
| `Google__AndroidClientId` | `Google:AndroidClientId` | Client ID Android (aceito como audience válido além do Web) | Login Google (Android) |
| `Smtp__Host` | `Smtp:Host` | Host SMTP (ex: `smtp.gmail.com`) | Recuperação de senha |
| `Smtp__Port` | `Smtp:Port` | Porta SMTP (ex: `587`) | Recuperação de senha |
| `Smtp__UserName` | `Smtp:UserName` | E-mail remetente | Recuperação de senha |
| `Smtp__Password` | `Smtp:Password` | Senha de app SMTP | Recuperação de senha |
| `Smtp__FromEmail` | `Smtp:FromEmail` | E-mail de envio | Recuperação de senha |
| `Smtp__ResetPasswordBaseUrl` | `Smtp:ResetPasswordBaseUrl` | URL base para link de reset de senha | Recuperação de senha |
| `Verification__BaseUrl` | `Verification:BaseUrl` | URL do endpoint de verificação (codificada no QR) | QR Code |
| `Verification__FrontendUrl` | `Verification:FrontendUrl` | URL do frontend de verificação | QR Code |
| `Verification__ShortUrlBase` | `Verification:ShortUrlBase` | URL base para links curtos no QR | QR Code |
| `InfoSimples__ApiToken` | `InfoSimples:ApiToken` | Token InfoSimples (validação de CRM) | Validação CRM |
| `AWS_ACCESS_KEY_ID` | — | Credenciais AWS S3 (dev local) | Dev local |
| `AWS_SECRET_ACCESS_KEY` | — | Credenciais AWS S3 (dev local) | Dev local |
| `AWS_S3_PRESCRIPTIONS_BUCKET` | — | Bucket S3 receitas (default: `renoveja-prescriptions`) | Opcional |
| `AWS_S3_CERTIFICATES_BUCKET` | — | Bucket S3 certificados (default: `renoveja-certificates`) | Opcional |
| `AWS_S3_AVATARS_BUCKET` | — | Bucket S3 avatares (default: `renoveja-avatars`) | Opcional |
| `AWS_S3_TRANSCRIPTS_BUCKET` | — | Bucket S3 transcrições (default: `renoveja-transcripts`) | Opcional |
| `AWS_S3_PUBLIC_BASE_URL` | — | URL base CloudFront para URLs públicas (opcional) | Opcional |

**Estrutura de paths no S3:** ver [STORAGE_S3_ESTRUTURA.md](STORAGE_S3_ESTRUTURA.md) — pedidos (receita/exame), consultas (transcrição/gravação), usuários (avatar/certificados), planos de cuidado.
| `ASPNETCORE_ENVIRONMENT` | — | `Development` ou `Production` | Opcional |

---

## 2. Configuração local (desenvolvimento)

Crie `src/RenoveJa.Api/appsettings.Development.json` (nunca commitar — está no `.gitignore`):

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=renoveja;Username=postgres;Password=SUA_SENHA"
  },
  "OpenAI": {
    "ApiKey": "sk-proj-SUA_CHAVE_REAL"
  },
  "Gemini": {
    "ApiKey": "SUA_CHAVE_GEMINI"
  },
  "Api": {
    "BaseUrl": "http://localhost:5000",
    "DocumentTokenSecret": "CHAVE_ALEATORIA_MINIMO_32_CARACTERES"
  },
  "CertificateEncryption": {
    "Key": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
  }
}
```

Copie também `.env.example` para `.env` e preencha `DAILY_API_KEY`, `DAILY_DOMAIN`, etc.

Para rodar:

```bash
cd src/RenoveJa.Api
dotnet run
```

---

## 3. Diagnóstico de problemas comuns

### IA não funciona (leitura de receita/exame)

| Causa | Log | Solução |
|-------|-----|---------|
| `OpenAI:ApiKey` ausente ou placeholder | `IA receita: OpenAI:ApiKey não configurada` | Definir chave real em `appsettings.Development.json` ou env var |
| Chave expirada ou inválida | `OpenAI API error: StatusCode=401` | Gerar nova chave em platform.openai.com |
| Rate limit | `OpenAI API error: StatusCode=429` | Aguardar ou verificar limites da conta |

### Imagens de receita/exame não carregam para o médico

**Causa:** O bucket S3 `renoveja-prescriptions` é privado. O app precisa usar o proxy da API.

**Solução:** Configure `Api__BaseUrl` e `Api__DocumentTokenSecret`. O backend retornará URLs de proxy (`/api/requests/{id}/image/...`) em vez de URLs diretas do S3.

### Transcrição da consulta não funciona

**Causa:** A transcrição é feita pelo **Daily.co com Deepgram** — não há Whisper. Verifique:

| Causa | Verificação | Solução |
|-------|-------------|---------|
| `DAILY_API_KEY` não configurada | Sala não é criada | Definir `DAILY_API_KEY` |
| Microfone mutado durante consulta | Banner "0 transcrições" após 10s+ | Desmutar o microfone |
| Request não em `InConsultation` | API retorna 400 | Clicar em "Iniciar Consulta" antes de falar |

### API retorna 400 em todos os endpoints

**Causa mais comum:** `ConnectionStrings__DefaultConnection` não configurada ou inválida. O `PostgresClient` falha na primeira query e lança exceção.

---

## 4. Fluxo de dados resumido

```
Mobile/Web
  │
  ├── POST /api/auth/login ──────────────> PostgreSQL (auth_tokens)
  ├── POST /api/requests/prescription ───> S3 (imagens) + PostgreSQL (request)
  │                                           └── OpenAI (leitura IA)
  ├── POST /api/requests/{id}/approve ───> PostgreSQL (update status)
  ├── POST /api/requests/{id}/sign ──────> S3 (PDF assinado) + PostgreSQL
  └── POST /api/video/rooms ─────────────> Daily.co (cria sala)
```

---

## 5. Checklist de verificação

- [ ] `appsettings.Development.json` existe com `ConnectionStrings:DefaultConnection` e `OpenAI:ApiKey` reais
- [ ] `OpenAI:ApiKey` começa com `sk-proj-` ou `sk-`
- [ ] `Api:BaseUrl` e `Api:DocumentTokenSecret` configurados
- [ ] `DAILY_API_KEY` e `DAILY_DOMAIN` configurados para videochamadas
- [ ] AWS credentials disponíveis para acesso ao S3 (dev local)
- [ ] `ASPNETCORE_ENVIRONMENT=Development` ao rodar o backend localmente
- [ ] Frontend `.env` com `EXPO_PUBLIC_API_URL` apontando para o IP/URL correto
