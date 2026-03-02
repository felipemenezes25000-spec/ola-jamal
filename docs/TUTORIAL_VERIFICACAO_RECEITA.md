# Tutorial completo: Verificação de Receita — verificar e ajustar tudo

Este guia cobre como configurar, publicar e validar o fluxo de **Verificação de Receita** quando o **front do validador** está na **Vercel** e a **API** está no **Render**.

---

## 1. Visão geral da arquitetura

| Componente | Onde roda | Função |
|-----------|-----------|--------|
| **Frontend (validador)** | Vercel | Página `/verify/:id` — usuário informa o código de 6 dígitos e vê o resultado (emitida em, assinada em, CRM, download). |
| **API (backend .NET)** | Render | `POST /api/prescriptions/verify` — valida o código, retorna dados reais (sem mock). |

Fluxo:

1. Usuário acessa `https://renovejasaude.com.br/verify/{id}` (ou o domínio do site na Vercel).
2. Informa o código de 6 dígitos e clica em **Validar**.
3. O front envia **POST** para `{VITE_API_URL}/api/prescriptions/verify` com `{ prescriptionId, verificationCode }`.
4. A API (no Render) valida e responde com `isValid`, datas, CRM completo, `downloadUrl`, etc.
5. O front exibe o resultado ou a mensagem de erro.

**Problema típico (405):** Se `VITE_API_URL` em produção apontar para o mesmo domínio do front (Vercel), o POST vai para a Vercel, que não tem essa rota → **405 Method Not Allowed**. A variável precisa apontar para a **URL da API no Render**.

---

## 2. Pré-requisitos

- Conta **Vercel** (front) e **Render** (API).
- Repositório conectado à Vercel (ex.: `med-renew` ou `ola-jamal` com root em `frontend-web`).
- API .NET publicada no Render e acessível por HTTPS.
- Uma receita já **assinada** no sistema (para testar com código válido).

---

## 3. Backend (API no Render)

### 3.1 Endpoint esperado

- **Método:** `POST`
- **URL:** `https://SEU-SERVICO.onrender.com/api/prescriptions/verify`
- **Body (JSON):** `{ "prescriptionId": "uuid-da-receita", "verificationCode": "123456" }`
- **Resposta 200 (válida):** `{ "isValid": true, "status": "valid", "issuedAt": "...", "signedAt": "...", "patientName": "...", "doctorName": "...", "doctorCrm": "...", "downloadUrl": "..." }`
- **Resposta 200 (inválida):** `{ "isValid": false, "status": "invalid", "reason": "INVALID_CODE" }` (ou NOT_SIGNED, NOT_FOUND, REVOKED)

### 3.2 Variáveis de ambiente no Render

No **Dashboard do Render** → seu serviço (API) → **Environment**:

| Variável | Exemplo | Obrigatório |
|----------|---------|-------------|
| `ASPNETCORE_ENVIRONMENT` | `Production` | Sim |
| `Api__BaseUrl` | `https://SEU-SERVICO.onrender.com` (ou domínio customizado) | Sim (para montar `downloadUrl`) |
| Supabase, OpenAI, etc. | Conforme seu `.env` / documentação | Conforme app |

`Api__BaseUrl` é usada para gerar o link de download do PDF na resposta (`downloadUrl`). Deve ser a URL pública pela qual a API é acessada.

### 3.3 CORS no Render (produção)

A API em produção usa a **DefaultPolicy** de CORS. Origens permitidas vêm de:

1. **Configuração:** seção `Cors:AllowedOrigins` (array no `appsettings.json` ou variáveis de ambiente).
2. **Fallback (se não houver config):**  
   `https://renovejasaude.com.br`, `https://www.renovejasaude.com.br`, `https://app.renovejasaude.com.br`.

**Se o site do validador estiver em outro domínio** (ex.: `https://med-renew.vercel.app`), adicione essa origem no Render:

**Opção A – Variáveis de ambiente (Render):**

- `Cors__AllowedOrigins__0` = `https://renovejasaude.com.br`
- `Cors__AllowedOrigins__1` = `https://med-renew.vercel.app`

(Ajuste os índices e valores conforme os domínios que você usa.)

**Opção B – appsettings.Production.json** (se o Render usar):

```json
{
  "Cors": {
    "AllowedOrigins": [
      "https://renovejasaude.com.br",
      "https://www.renovejasaude.com.br",
      "https://med-renew.vercel.app"
    ]
  }
}
```

Depois de alterar CORS ou env, faça **redeploy** do serviço no Render.

### 3.4 Como verificar a API no Render

1. **Health (se existir):**  
   `GET https://SEU-SERVICO.onrender.com/api/health` (ou o path que você tiver) → deve retornar 200.

2. **Verificação (POST):**  
   Use Postman, Insomnia ou `curl`:

   ```bash
   curl -X POST "https://SEU-SERVICO.onrender.com/api/prescriptions/verify" \
     -H "Content-Type: application/json" \
     -d "{\"prescriptionId\": \"SEU-UUID-AQUI\", \"verificationCode\": \"123456\"}"
   ```

   - Código inválido → 200 com `"isValid": false` e `"reason": "INVALID_CODE"`.
   - Código válido → 200 com `"isValid": true` e os campos preenchidos.

3. **OPTIONS (CORS preflight):**  
   O navegador envia `OPTIONS` antes do POST. A API deve responder 200 com headers `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, etc. Se OPTIONS falhar ou não tiver esses headers, o POST pode ser bloqueado por CORS no browser.

---

## 4. Frontend (validador na Vercel)

### 4.1 Variável obrigatória: VITE_API_URL

O front chama a API em `{VITE_API_URL}/api/prescriptions/verify`. Em **produção**, essa URL **tem que ser a do Render** (não o domínio do site na Vercel).

**Vercel** → projeto do validador (med-renew ou o que servir a página de verificação) → **Settings** → **Environment Variables**:

| Name | Value | Environments |
|------|--------|---------------|
| `VITE_API_URL` | `https://SEU-SERVICO.onrender.com` | Production (e Preview se quiser) |

- **Sem barra no final.**
- Exemplo: `https://renoveja-api.onrender.com` (substitua pelo URL real do seu serviço no Render).

Depois de salvar, faça **Redeploy** do projeto para o build de produção usar a nova variável (variáveis do Vite são embutidas no build).

### 4.2 Root Directory e Build (Vercel)

- Se o repositório tiver vários projetos, defina **Root Directory** para a pasta do front (ex.: `frontend-web` no ola-jamal ou raiz no med-renew).
- **Build Command:** deixe o padrão ou `npm run build`.
- **Output Directory:** `dist` (padrão do Vite).

### 4.3 Como verificar o front na Vercel

1. Abra o site em produção: `https://seu-dominio.com/verify/algum-uuid`.
2. Abra as **DevTools** (F12) → aba **Network**.
3. Digite um código de 6 dígitos e clique em **Validar**.
4. Procure a requisição para `.../api/prescriptions/verify`:
   - **Request URL** deve ser `https://SEU-SERVICO.onrender.com/api/prescriptions/verify` (não o domínio do Vercel).
   - **Method:** POST.
   - Se der **405**, a URL ainda está errada (provavelmente apontando para o Vercel).
   - Se der **0** ou bloqueio por CORS, verifique CORS no Render (ver seção 3.3).

---

## 5. Teste local

### 5.1 Front local + API local

1. **API:** na pasta do backend (ex.: `backend-dotnet/src/RenoveJa.Api`), rode a API (ex.: `dotnet run`). Anote a porta (ex.: 5000).
2. **Front:** na pasta do front (med-renew ou `frontend-web`), crie ou edite `.env`:
   - `VITE_API_URL=http://localhost:5000` (ou a porta correta).
3. Rode o front (`npm run dev`).
4. Acesse `http://localhost:8080/verify/{id}` (ou a URL que o Vite mostrar).
5. Valide: no Network, a chamada deve ir para `http://localhost:5000/api/prescriptions/verify`.

Em **Development**, a API usa a policy de CORS **Development**, que já inclui `http://localhost:8080`, `http://localhost:5173`, etc.

### 5.2 Front local + API no Render (prod)

1. No `.env` do front local: `VITE_API_URL=https://SEU-SERVICO.onrender.com`.
2. Rode o front e teste em `/verify/:id`.
3. A requisição vai para o Render. Para funcionar, a origem `http://localhost:8080` (ou a que você usar) precisa estar permitida no CORS. Em produção a API usa a **DefaultPolicy**; se você não adicionar `http://localhost:8080` em `Cors:AllowedOrigins` no Render, o browser pode bloquear por CORS. Use essa opção só para testes pontuais ou adicione localhost em produção temporariamente.

---

## 6. Checklist de verificação (produção)

Use esta lista para garantir que tudo está certo:

- [ ] **Render**
  - [ ] Serviço da API está **Live** (verde).
  - [ ] `Api__BaseUrl` = URL pública da API (ex.: `https://xxx.onrender.com`).
  - [ ] CORS inclui o domínio exato do site do validador (ex.: `https://renovejasaude.com.br`, `https://med-renew.vercel.app`).
  - [ ] `POST /api/prescriptions/verify` responde 200 (com body válido ou inválido) quando testado com `curl`/Postman.

- [ ] **Vercel**
  - [ ] `VITE_API_URL` em **Production** = URL da API no Render (sem barra no final).
  - [ ] Depois de alterar a variável, **Redeploy** foi feito.
  - [ ] Em **Deployments**, o deploy em produção está **Ready**.

- [ ] **Browser (site em produção)**
  - [ ] Abrir `/verify/{id}` e **Validar** com um código.
  - [ ] No Network, a requisição vai para o domínio do **Render** (não do Vercel).
  - [ ] Não aparece **405**; se aparecer, revisar `VITE_API_URL`.
  - [ ] Não aparece erro de CORS (bloqueio por origem); se aparecer, revisar CORS no Render.
  - [ ] Código inválido → mensagem de erro clara (ex.: "Código inválido.").
  - [ ] Código válido → dados reais (Emitida em, Assinada em, CRM completo, botão de download se houver).

---

## 7. Troubleshooting

### Erro 405 (Method Not Allowed)

- **Causa:** O POST está indo para um servidor que não tem a rota ou não aceita POST (ex.: o próprio Vercel).
- **Solução:** Garantir que `VITE_API_URL` em produção seja a **URL do Render**. Fazer Redeploy na Vercel após alterar.

### CORS (requisição bloqueada no browser)

- **Causa:** A origem do site (ex.: `https://renovejasaude.com.br`) não está em `Cors:AllowedOrigins` da API no Render.
- **Solução:** Adicionar a origem exata (com `https://`, sem barra no final) nas variáveis de ambiente do Render (`Cors__AllowedOrigins__0`, etc.) ou em `appsettings.Production.json`, e redeployar a API.

### 404 no /api/prescriptions/verify

- **Causa:** Rota não existe ou API não está rodando no Render / URL errada.
- **Solução:** Confirmar que o backend é o do ola-jamal (ou o que contém o `PrescriptionsController`) e que a URL em `VITE_API_URL` é a correta e está acessível (testar no navegador ou com `curl`).

### “URL da API não configurada”

- **Causa:** No build do front, `VITE_API_URL` estava vazia (variável não definida na Vercel ou não aplicada ao ambiente do deploy).
- **Solução:** Definir `VITE_API_URL` em **Production** (e Preview se necessário) na Vercel e fazer **Redeploy**.

### Download do PDF não abre

- **Causa:** `downloadUrl` na resposta usa `Api__BaseUrl`; se estiver errada ou inacessível, o link quebra.
- **Solução:** Garantir `Api__BaseUrl` no Render = URL pública da API. O link será `{Api__BaseUrl}/api/verify/{id}/document?code=xxx`.

---

## 8. Resumo rápido

| Onde | O que verificar / ajustar |
|------|----------------------------|
| **Render** | API no ar; `Api__BaseUrl`; CORS com o domínio do site; POST `/api/prescriptions/verify` respondendo. |
| **Vercel** | `VITE_API_URL` = URL do Render; Redeploy após mudar. |
| **Browser** | Requisição POST indo para o Render; sem 405; sem erro de CORS; resultado correto na tela. |

Com isso você consegue verificar e ajustar todo o fluxo de verificação de receita de ponta a ponta.
