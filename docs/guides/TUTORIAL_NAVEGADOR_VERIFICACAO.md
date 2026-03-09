# Tutorial completo: o que fazer no navegador

Passo a passo **só no navegador** para deixar o validador de receita e o download/visualização de PDF funcionando em produção. Sem terminal, sem código.

---

## Parte 1 — Vercel (site do validador)

### 1.1 Entrar na Vercel

1. Abra o navegador e vá em **https://vercel.com**
2. Faça **Login** (GitHub ou e-mail)
3. No dashboard, clique no projeto do **validador** (ex.: **med-renew** ou o nome do site que tem a página de verificação)

### 1.2 Configurar a URL da API

1. No menu da esquerda, clique em **Settings**
2. Clique em **Environment Variables**
3. Na tabela de variáveis:
   - Se já existir **VITE_API_URL**: clique nos **três pontinhos (⋯)** à direita → **Edit**
   - Se não existir: clique em **Add New** (ou **Add**)
4. Preencha:
   - **Key (Name):** `VITE_API_URL`
   - **Value:** a URL do seu serviço no **Render**, **sem barra no final**  
     Exemplo: `https://ola-jamal.onrender.com`  
     (troque pelo URL real que aparece no Render)
   - **Environments:** marque **Production** (e **Preview** se quiser que previews também usem a API)
5. Clique em **Save**

### 1.3 Fazer o site usar a nova variável (Redeploy)

1. No menu da esquerda, clique em **Deployments**
2. No primeiro deploy da lista (o mais recente), clique nos **três pontinhos (⋯)** à direita
3. Clique em **Redeploy**
4. Na janela que abrir, confirme com **Redeploy** de novo
5. Espere o status ficar **Ready** (pode levar 1–2 minutos)
6. Opcional: clique em **Visit** para abrir o site

### 1.4 Conferir o domínio do site

1. No menu da esquerda, clique em **Settings**
2. Clique em **Domains**
3. Anote o domínio em produção (ex.: `renovejasaude.com.br` ou `med-renew.vercel.app`)  
   — você vai usar para testar e, se precisar, para configurar CORS no Render

---

## Parte 2 — Render (API)

### 2.1 Entrar no Render

1. Abra **https://dashboard.render.com** (ou https://render.com e depois **Dashboard**)
2. Faça **Login** se precisar
3. Na lista **Services**, clique no serviço da **API** (o que roda o backend .NET, ex.: **ola-jamal**)

### 2.2 Ver a URL da API

1. No topo da página do serviço, veja o **URL** (ex.: `https://ola-jamal.onrender.com`)
2. Copie essa URL (sem barra no final) — é ela que você usa em **VITE_API_URL** na Vercel
3. Se o serviço estiver **Suspended** (plano gratuito), clique em **Manual Deploy** → **Deploy latest commit** para subir de novo

### 2.3 Variáveis de ambiente (obrigatórias e CORS)

1. No menu do serviço (lado esquerdo), clique em **Environment**
2. Confira ou adicione estas variáveis:

| O que fazer | Key | Value |
|-------------|-----|--------|
| **Obrigatório** | `Api__BaseUrl` | A mesma URL do serviço (ex.: `https://ola-jamal.onrender.com`) |
| **Obrigatório para PDF no app/link** | `Api__DocumentTokenSecret` | Uma string secreta com **pelo menos 32 caracteres** (ex.: `minha-chave-secreta-prod-2025-com-32-chars` ou gere uma aleatória). Sem ela, ao tocar em “Visualizar PDF Assinado” ou abrir o link do documento no navegador aparece “Token de autenticação inválido ou ausente.” |
| **Se o site for em outro domínio** | `Cors__AllowedOrigins__0` | `https://renovejasaude.com.br` |
| **Se usar med-renew.vercel.app** | `Cors__AllowedOrigins__1` | `https://med-renew.vercel.app` |

3. Para **adicionar** variável:
   - Clique em **Add Environment Variable** (ou **Edit** e depois **+ Add** → **New variable**)
   - Preencha **Key** e **Value**
   - Não apague outras variáveis ao preencher (preste atenção em qual linha está editando)
4. Clique em **Save Changes** (ou **Save, rebuild, and deploy**)
5. Se o Render pedir **Deploy**, clique em **Confirm** para redeployar

### 2.4 Testar a API no navegador (só para conferir)

1. Abra uma **nova aba**
2. Na barra de endereço, digite a URL do serviço + `/api/prescriptions/verify`  
   Exemplo: `https://ola-jamal.onrender.com/api/prescriptions/verify`  
   e pressione Enter
3. Deve aparecer **405** ou “method not allowed” — **é esperado**, pois a API espera **POST**. O importante é a página carregar do **Render** (URL da barra é do Render), não “site não encontrado”
4. Se der “site não encontrado” ou timeout, a API não está acessível (serviço parado, URL errada ou rede)

---

## Parte 3 — Testar o validador no navegador

### 3.1 Abrir a página de verificação

1. Abra uma **nova aba**
2. Digite o endereço do site em produção + `/verify/` + um ID de receita  
   Exemplos:
   - `https://renovejasaude.com.br/verify/550e8400-e29b-42d4-a716-446655440000`
   - `https://med-renew.vercel.app/verify/550e8400-e29b-42d4-a716-446655440000`
3. Troque o UUID por um ID real que você tenha (pode ser o de uma receita de teste)
4. Pressione Enter — deve abrir a página **Verificação de Receita** com o campo de código

### 3.2 Abrir as ferramentas do desenvolvedor (Rede)

1. Pressione **F12** (ou botão direito na página → **Inspecionar**)
2. Clique na aba **Rede** (ou **Network**)
3. Deixe a aba Rede aberta (pode ficar embaixo ou ao lado)
4. Se já houver muitas linhas, clique no ícone de **limpar** (círculo com risco) para zerar a lista

### 3.3 Fazer uma verificação e observar a requisição

1. No campo **Código de verificação**, digite **6 dígitos** (pode ser inválido para teste, ex.: `000000`)
2. Clique em **Validar**
3. Na aba **Rede (Network)**:
   - Deve aparecer uma nova linha com nome tipo **verify** ou **prescriptions/verify**
   - Clique nessa linha para ver os detalhes
4. Confira:
   - **Headers** → **Request URL:**  
     - **Certo:** URL do **Render** (ex.: `https://....onrender.com/api/prescriptions/verify`)  
     - **Errado:** URL do mesmo domínio do site → costuma dar **405**
   - **Request Method:** deve ser **POST**
   - **Status:**  
     - **200** = servidor respondeu (válido ou inválido no corpo)  
     - **405** = em geral **VITE_API_URL** ainda apontando para o site (Vercel)  
     - **0** ou bloqueado = em geral CORS (origem não permitida no Render)

### 3.4 Ver a resposta da API (corpo)

1. Com a linha da requisição **verify** selecionada, clique na subaba **Resposta** (ou **Response**)
2. Você deve ver um JSON, por exemplo:
   - Código inválido: `{ "isValid": false, "status": "invalid", "reason": "INVALID_CODE" }`
   - Código válido: `{ "isValid": true, "status": "valid", "issuedAt": "...", "doctorCrm": "...", ... }`
3. Se o status for 200 e o JSON estiver correto, a integração está ok

### 3.5 Testar código válido e botão Baixar PDF (opcional)

1. Se você tiver o **ID** e o **código de 6 dígitos** de uma receita já assinada:
2. Abra de novo a página: `https://seu-site.com/verify/{id-da-receita}`
3. Digite o código correto e clique em **Validar**
4. Deve aparecer **Receita válida**, com Emitida em, Assinada em, Médico, **CRM completo** e o botão **Baixar PDF (2ª via)**
5. Clique em **Baixar PDF (2ª via)** — deve abrir ou baixar o PDF (a URL usa o endpoint `/api/verify/{id}/document?code=...`, que não exige token de login)

---

## Parte 4 — Baixar / visualizar PDF pelo app ou por link (evitar erro de token)

Quando o usuário toca em **“Visualizar PDF Assinado”** no app (ou abre um link enviado por e-mail) a URL é algo como:

`https://ola-jamal.onrender.com/api/requests/{id}/document`

Esse endpoint aceita **?token=...** (para abrir no navegador sem login). O token só é gerado se a variável **Api__DocumentTokenSecret** estiver configurada no Render.

### 4.1 O que fazer no navegador (Render)

1. No **Render**, no serviço da API, vá em **Environment**
2. Confira se existe **Api__DocumentTokenSecret** com um valor de **pelo menos 32 caracteres**
3. Se **não existir**:
   - Clique em **Add Environment Variable** (ou **Edit** → **+ Add** → **New variable**)
   - **Key:** `Api__DocumentTokenSecret`
   - **Value:** uma string secreta longa (ex.: `chave-super-secreta-prod-2025-min-32-caracteres` ou use um gerador de senha)
   - Salve e confirme o **Deploy** se o Render pedir
4. Depois do deploy, os links de documento passam a incluir `?token=...` e abrem no navegador sem “Token de autenticação inválido ou ausente.”

### 4.2 Como conferir

1. No **app** (mobile ou web), entre em uma receita já assinada e toque em **Visualizar PDF Assinado** (ou equivalente)
2. O link que abrir deve ter na URL algo como: `.../document?token=...`
3. A página deve mostrar ou baixar o PDF; não deve aparecer a mensagem de token inválido

---

## Resumo rápido (checklist no navegador)

| Onde | O que fazer |
|------|-------------|
| **Vercel** | Settings → Environment Variables → `VITE_API_URL` = URL do Render → Save → Deployments → Redeploy |
| **Render** | Environment → `Api__BaseUrl` = URL do serviço; **Api__DocumentTokenSecret** = chave de 32+ caracteres (para PDF no app/link); se precisar, `Cors__AllowedOrigins__0/1` com o domínio do site → Save → Deploy |
| **Teste validador** | Abrir `/verify/{id}` → F12 → Rede → Validar → Ver se a requisição vai para o Render (POST, status 200) |
| **Teste PDF app/link** | No app, tocar em Visualizar PDF → link deve ter `?token=...` e o PDF deve abrir sem erro de token |

Se a requisição do validador for para o **Render** e retornar **200**, e o link do documento abrir com **?token=** e o PDF carregar, tudo que depende do navegador está configurado.
