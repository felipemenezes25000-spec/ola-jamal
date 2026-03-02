# Tutorial: o que fazer no navegador (Verificação de Receita)

Passo a passo **só no navegador**: Vercel, Render e teste do validador. Sem terminal, sem código.

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
     Exemplo: `https://renoveja-api.onrender.com`  
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
   — você vai usar esse endereço para testar e, se precisar, para configurar CORS no Render

---

## Parte 2 — Render (API)

### 2.1 Entrar no Render

1. Abra **https://dashboard.render.com** (ou https://render.com e depois **Dashboard**)
2. Faça **Login** se precisar
3. Na lista **Services**, clique no serviço da **API** (o que roda o backend .NET)

### 2.2 Ver a URL da API

1. No topo da página do serviço, veja o **URL** (ex.: `https://renoveja-api.onrender.com`)
2. Copie essa URL (sem barra no final) — é ela que você colocou em **VITE_API_URL** na Vercel
3. Se o serviço estiver **Suspended** (plano gratuito), clique em **Manual Deploy** → **Deploy latest commit** para subir de novo

### 2.3 Variáveis de ambiente (Api__BaseUrl e CORS)

1. No menu do serviço (lado esquerdo), clique em **Environment**
2. Confira se existe:
   - **Api__BaseUrl** = mesma URL do serviço (ex.: `https://renoveja-api.onrender.com`)
3. Se o site do validador for em **outro domínio** que não seja `renovejasaude.com.br` / `www` / `app`, adicione CORS:
   - Clique em **Add Environment Variable**
   - **Key:** `Cors__AllowedOrigins__0` → **Value:** `https://renovejasaude.com.br`
   - Adicione outra: **Key:** `Cors__AllowedOrigins__1` → **Value:** `https://med-renew.vercel.app` (ou o domínio exato do seu site na Vercel)
4. Clique em **Save Changes**
5. Se você adicionou ou mudou variável, o Render pode pedir **Deploy** — clique em **Confirm** para redeployar

### 2.4 Testar a API no navegador (só para conferir)

1. Abra uma **nova aba**
2. Na barra de endereço, digite a URL do serviço + `/api/prescriptions/verify`  
   Exemplo: `https://renoveja-api.onrender.com/api/prescriptions/verify`  
   e pressione Enter
3. Você deve ver algo como **405** ou uma mensagem de “method not allowed” — **isso é esperado**, porque a API espera **POST**, não GET. O importante é a página carregar do **Render** (URL da barra de endereço é do Render), não dar erro de “site não encontrado”
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

### 3.2 Abrir as ferramentas do desenvolvedor (Network)

1. Pressione **F12** (ou botão direito na página → **Inspecionar**)
2. Clique na aba **Rede** (ou **Network**)
3. Deixe a aba Rede aberta e **não minimize** a janela de inspeção (pode deixar embaixo ou ao lado)
4. Se já houver muitas linhas na Rede, clique no ícone de **limpar** (círculo com risco) para zerar a lista

### 3.3 Fazer uma verificação e observar a requisição

1. Na página, no campo **Código de verificação**, digite **6 dígitos** (pode ser um código inválido para teste, ex.: `000000`)
2. Clique em **Validar**
3. Na aba **Rede (Network)**:
   - Deve aparecer uma nova linha com nome tipo **verify** ou **prescriptions/verify**
   - Clique nessa linha para ver os detalhes
4. Confira no painel à direita (ou embaixo):
   - **Cabeçalhos (Headers)** → **Request URL:**  
     - **Certo:** URL do **Render** (ex.: `https://....onrender.com/api/prescriptions/verify`)  
     - **Errado:** URL do mesmo domínio do site (ex.: `https://renovejasaude.com.br/api/...`) — nesse caso o 405 aparece porque o POST foi para a Vercel
   - **Request Method:** deve ser **POST**
   - **Status:**  
     - **200** = servidor respondeu (pode ser válido ou inválido no corpo da resposta)  
     - **405** = método não permitido → em geral **VITE_API_URL** ainda apontando para o site (Vercel)  
     - **0** ou bloqueado = muitas vezes CORS (origem do site não permitida no Render)

### 3.4 Ver a resposta da API (corpo)

1. Com a linha da requisição **verify** selecionada na aba Rede, clique na subaba **Resposta** (ou **Response**)
2. Você deve ver um JSON, por exemplo:
   - Código inválido: `{ "isValid": false, "status": "invalid", "reason": "INVALID_CODE" }`
   - Código válido: `{ "isValid": true, "status": "valid", "issuedAt": "...", "doctorCrm": "...", ... }`
3. Se o status da requisição for 200 e o JSON estiver correto, a integração está ok; o que aparece na tela (mensagem de erro ou dados da receita) deve bater com esse JSON

### 3.5 Testar código válido (opcional)

1. Se você tiver o **ID** e o **código de 6 dígitos** de uma receita já assinada:
2. Abra de novo a página: `https://seu-site.com/verify/{id-da-receita}`
3. Digite o código correto e clique em **Validar**
4. Deve aparecer **Receita válida**, com Emitida em, Assinada em, Médico, **CRM completo** (não mascarado) e, se houver, o botão **Baixar PDF (2ª via)**

---

## Resumo rápido (checklist no navegador)

| Onde | O que fazer |
|------|-------------|
| **Vercel** | Settings → Environment Variables → `VITE_API_URL` = URL do Render → Save → Deployments → Redeploy |
| **Render** | Environment → `Api__BaseUrl` = URL do serviço; se precisar, adicionar `Cors__AllowedOrigins__0/1` com o domínio do site → Save |
| **Navegador (teste)** | Abrir `/verify/{id}` → F12 → Rede → Validar → Ver se a requisição vai para o Render (POST, status 200 ou 405/0 para diagnosticar) |

Se a requisição no passo “teste” for para o **Render** e retornar **200** com JSON, a parte “no navegador” está correta; se der 405, volte na Vercel e confira **VITE_API_URL** e o **Redeploy**.
