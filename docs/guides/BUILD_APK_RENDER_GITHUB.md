# Build APK com Render e GitHub

Guia para gerar o APK do RenoveJá+ via GitHub Actions, conectado à API no Render.

---

## Visão geral

| Componente | Onde roda | URL |
|------------|-----------|-----|
| **Backend (API)** | Render | `https://SEU-SERVICO.onrender.com` |
| **Build APK** | GitHub Actions | Workflow manual `Build Android APK` |
| **APK gerado** | Artifact do GitHub | Download após o build |

O APK usa `EXPO_PUBLIC_API_URL` para conectar à API. Essa URL é definida no momento do build (prebuild) e fica embutida no app.

---

## 1. Pré-requisitos

- [ ] Backend publicado no Render e acessível (ex.: `https://ola-jamal.onrender.com`)
- [ ] Repositório no GitHub com o código
- [ ] Conta no Firebase (para `google-services.json` — push, login Google)

---

## 2. Configurar secrets no GitHub

Acesse: **GitHub → seu repositório → Settings → Secrets and variables → Actions**

Adicione os seguintes **secrets**:

| Secret | Obrigatório | Descrição |
|--------|-------------|-----------|
| `EXPO_PUBLIC_API_URL` | **Sim** | URL da API no Render (ex.: `https://ola-jamal.onrender.com`) — **sem barra no final** |
| `GOOGLE_SERVICES_JSON_BASE64` | **Sim** | Conteúdo do `google-services.json` em base64 |
| `ANDROID_KEYSTORE_BASE64` | Não (release) | Keystore em base64 para assinar o APK release |
| `ANDROID_KEYSTORE_PASSWORD` | Com keystore | Senha do keystore |
| `ANDROID_KEY_ALIAS` | Com keystore | Alias da chave (ex.: `renoveja`) |
| `ANDROID_KEY_PASSWORD` | Com keystore | Senha da chave |

### 2.1 Gerar `GOOGLE_SERVICES_JSON_BASE64`

1. Baixe o `google-services.json` do Firebase Console (Android app).
2. No terminal (PowerShell ou Git Bash):
   ```bash
   base64 -w 0 google-services.json
   ```
   ou no PowerShell:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json"))
   ```
3. Copie o resultado e cole no secret `GOOGLE_SERVICES_JSON_BASE64`.

### 2.2 Gerar keystore (opcional, para release assinado)

```bash
keytool -genkey -v -keystore release-keystore.jks -alias renoveja -keyalg RSA -keysize 2048 -validity 10000
```

Depois:
```bash
base64 -w 0 release-keystore.jks
```

Cole no secret `ANDROID_KEYSTORE_BASE64`. Se não configurar, o build release usará assinatura de debug (apenas para testes).

---

## 3. Disparar o build

1. Abra: **GitHub → seu repositório → Actions**
2. Selecione o workflow **`Build Android APK`**
3. Clique em **Run workflow**
4. Escolha:
   - **build_type**: `release` ou `debug`
   - **api_url**: deixe vazio para usar o secret `EXPO_PUBLIC_API_URL`, ou informe uma URL para testar (ex.: `https://outro-servico.onrender.com`)
5. Clique em **Run workflow**

---

## 4. Baixar o APK

1. Após o build terminar (cerca de 10–15 min), clique no job **Build APK**
2. Na seção **Artifacts**, baixe `renoveja-release-apk` ou `renoveja-debug-apk`
3. Instale no celular: transfira o APK e abra o arquivo para instalar

---

## 5. Checklist de verificação

| Item | Verificação |
|------|-------------|
| API no Render | `GET https://SEU-SERVICO.onrender.com/api/health` retorna 200 |
| Secret `EXPO_PUBLIC_API_URL` | Mesma URL do Render, sem barra no final |
| CORS no Render | `Cors:AllowedOrigins` inclui `https://renovejasaude.com.br` (se aplicável) |
| AppSettings | `Cors:AllowedOrigins` inclui `https://renovejasaude.com.br` (ou domínio do app) |

---

## 6. Erros comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `GOOGLE_SERVICES_JSON_BASE64 não configurado` | Secret ausente | Adicionar o secret no GitHub |
| `EXPO_PUBLIC_API_URL` vazio | Secret ausente ou não usado | Configurar o secret e deixar `api_url` vazio no workflow |
| App não conecta à API | URL incorreta ou CORS | Conferir `EXPO_PUBLIC_API_URL` e CORS no Render |
| Build release usa debug signing | Keystore não configurado | Adicionar os 4 secrets do keystore |

---

## 7. URL da API no Render

A URL do seu serviço no Render está em:

**Dashboard Render → seu serviço → Settings → URL**

Exemplo: `https://ola-jamal.onrender.com`

Use essa URL exata em `EXPO_PUBLIC_API_URL` (sem barra no final).
