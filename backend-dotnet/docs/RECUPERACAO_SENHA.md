# Recuperação de senha (Esqueci minha senha)

## Erro 400: "Could not find the table 'public.password_reset_tokens'"

Esse erro ocorre quando a tabela ainda não existe no Supabase. **Escolha uma das opções:**

### Opção A – Executar SQL no Dashboard (recomendado)

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard) e faça login.
2. Abra o projeto (ex.: `ifgxgppxsawauaceudec`).
3. No menu lateral: **SQL Editor** → **New query**.
4. Cole o conteúdo do arquivo **`docs/migrations/run_all_migrations.sql`** (cria `password_reset_tokens`, `chat_messages` e colunas de IA em `requests`) e clique em **Run**.  
   Se quiser só recuperação de senha: use `docs/migrations/add_password_reset_tokens.sql`.

### Opção B – Migration automática na subida da API

1. No Supabase: **Project Settings** → **Database** → copie a **Connection string** (URI, com a senha do banco).
2. Em `appsettings.Development.json`, na seção `Supabase`, defina `"DatabaseUrl": "postgresql://postgres.[ref]:[SENHA]@..."` (a string completa).
3. Reinicie a API; na primeira subida a tabela será criada automaticamente.

---

## 1. Migration no Supabase (referência)

Execute o SQL no **SQL Editor** do projeto Supabase (Dashboard):

```sql
-- Arquivo: docs/migrations/add_password_reset_tokens.sql
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);
```

## 2. Configuração SMTP

Em `appsettings.Development.json` (ou variáveis de ambiente) a seção `Smtp` já está preenchida para **contato@renovejasaude.com.br**. Se o seu provedor usar outro host/porta, ajuste:

- **Host:** `mail.renovejasaude.com.br` (comum para domínio próprio). Se usar Gmail/Google Workspace: `smtp.gmail.com`; Microsoft 365: `smtp.office365.com`.
- **Porta:** 587 (TLS) ou 465 (SSL).
- **ResetPasswordBaseUrl:** URL da tela de “Redefinir senha” no front (o link no e-mail será `{ResetPasswordBaseUrl}?token=...`).

### Erro "Este host não é conhecido" (SocketException 11001)

O host `mail.renovejasaude.com.br` pode não ser resolvido na sua rede (DNS) em máquina local. **Para teste em desenvolvimento**, use Gmail no `appsettings.Development.json`:

- **Host:** `smtp.gmail.com`
- **Port:** 587
- **UserName / FromEmail:** seu e-mail Gmail (ex.: `seuemail@gmail.com`)
- **Password:** [Senha de app do Google](https://myaccount.google.com/apppasswords) (não use a senha normal da conta)

Em produção, mantenha `mail.renovejasaude.com.br` no `appsettings.json` (ou variáveis de ambiente) no servidor onde o DNS resolve.

### Erro 535 "Username and Password not accepted" (BadCredentials)

A **senha de app** do Google só funciona com a **conta em que foi criada**. Em `appsettings.json` (e `appsettings.Development.json`):

- **UserName** e **FromEmail** devem ser o **mesmo e-mail Gmail** em que você estava logado ao criar a senha de app (em [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
- **Password** deve ser a senha de app de 16 caracteres (sem espaços).

Se estiver usando `contato@renovejasaude.com.br` mas a senha de app foi criada em outro Gmail (ex.: `seuemail@gmail.com`), troque UserName e FromEmail para esse Gmail.

## 3. Como testar localmente

1. **Subir a API em ambiente Development**  
   - No terminal: `cd backend-dotnet/src/RenoveJa.Api` e `dotnet run` (ou F5 no Visual Studio).  
   - Confirme que está em Development (a API usa `appsettings.Development.json` e envia e-mail via Gmail).

2. **Link do e-mail abrindo no app local (opcional)**  
   - Se o seu front roda em `http://localhost:3000` (ou outra porta), no `appsettings.Development.json` defina:  
     `"ResetPasswordBaseUrl": "http://localhost:3000/recuperar-senha"`  
   - Assim o link do e-mail abre sua tela de redefinição local. (Em produção, use `https://renovejasaude.com.br/recuperar-senha`.)

3. **Pedir redefinição de senha**  
   - Use um e-mail que **exista** na tabela `users` do Supabase.  
   - **PowerShell:**  
     ```powershell
     Invoke-RestMethod -Uri "http://localhost:5000/api/auth/forgot-password" -Method POST -ContentType "application/json" -Body '{"email":"felipemenezes25000@gmail.com"}'
     ```  
   - **curl (Git Bash / WSL):**  
     ```bash
     curl -X POST http://localhost:5000/api/auth/forgot-password -H "Content-Type: application/json" -d "{\"email\":\"felipemenezes25000@gmail.com\"}"
     ```  
   - Resposta esperada: **200** (sem corpo). O e-mail é enviado para o endereço informado.

4. **Abrir o e-mail e pegar o token**  
   - Abra a caixa de entrada do e-mail que você usou.  
   - O link vem no formato: `https://renovejasaude.com.br/recuperar-senha?token=XXXXX` (ou `http://localhost:3000/...` se configurou no passo 2).  
   - Copie só o valor do **token** (a parte depois de `token=`; pode vir codificado em URL, use como está).

5. **Redefinir a senha (API)**  
   - **PowerShell:**  
     ```powershell
     Invoke-RestMethod -Uri "http://localhost:5000/api/auth/reset-password" -Method POST -ContentType "application/json" -Body '{"token":"COLE_O_TOKEN_AQUI","newPassword":"SuaNovaSenha123"}'
     ```  
   - **curl:**  
     ```bash
     curl -X POST http://localhost:5000/api/auth/reset-password -H "Content-Type: application/json" -d "{\"token\":\"COLE_O_TOKEN_AQUI\",\"newPassword\":\"SuaNovaSenha123\"}"
     ```  
   - Ou use o **Swagger**: `http://localhost:5000/swagger` → **POST /api/auth/reset-password** → preencha `token` e `newPassword`.

6. **Conferir**  
   - Faça login com o e-mail e a **nova senha** (POST /api/auth/login).  
   - Se funcionar, o fluxo local está ok.

**Resumo:** Rode a API em Development → chame forgot-password com um e-mail que existe no banco → abra o e-mail, copie o token do link → chame reset-password com esse token e uma nova senha → teste o login.

---

## 4. Endpoints

| Método | Endpoint | Body | Descrição |
|--------|----------|------|-----------|
| POST | `/api/auth/forgot-password` | `{ "email": "usuario@email.com" }` | Envia e-mail com link (se o e-mail existir). Sempre retorna 200. |
| POST | `/api/auth/reset-password` | `{ "token": "...", "newPassword": "novaSenha123" }` | Redefine a senha. Token vem no link do e-mail. |

## 5. Fluxo

1. Usuário informa o e-mail em “Esqueci minha senha”.
2. Front chama `POST /api/auth/forgot-password` com o e-mail.
3. Backend gera token (1h de validade), grava em `password_reset_tokens` e envia e-mail com link: `{ResetPasswordBaseUrl}?token={token}`.
4. Usuário clica no link; o front exibe formulário “Nova senha” e envia `POST /api/auth/reset-password` com `token` (da URL) e `newPassword`.
5. Backend valida o token, atualiza a senha do usuário e invalida o token.

## 6. Segurança

- Token de uso único; após redefinir, fica inválido.
- Resposta de “forgot-password” é sempre a mesma (não revela se o e-mail existe).
- Em produção, use variáveis de ambiente para `Smtp:Password` e não commite a senha.
