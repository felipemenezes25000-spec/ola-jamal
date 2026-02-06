# Como testar o login com Google

O endpoint `POST /api/auth/google` recebe o **ID token** retornado pelo Google Sign-In no frontend, valida no backend e devolve o token da aplicação (mesmo formato do login por e-mail/senha).

---

## 1. Configurar o Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto ou selecione um existente.
3. Vá em **APIs e serviços** → **Credenciais**.
4. Clique em **Criar credenciais** → **ID do cliente OAuth 2.0**.
5. Tipo: **Aplicativo da Web** (para testar no navegador).
6. Em **Origens JavaScript autorizadas** adicione:
   - `http://localhost:5000` (ou a porta da sua API)
   - `http://localhost:3000` (se tiver frontend em outra porta)
   - Para teste local com arquivo HTML: `http://localhost` ou use um túnel (ex.: ngrok).
7. Copie o **ID do cliente** (algo como `123456789-xxx.apps.googleusercontent.com`).

---

## 2. Configurar o backend

O Client ID já está configurado em `appsettings.json` e `appsettings.Development.json` na seção `Google:ClientId`. Se precisar trocar (outro projeto Google), edite essa chave.

---

## 3. Obter um ID token para testar

O backend espera o **ID token** (JWT) que o Google devolve após o usuário fazer login. Duas formas de testar:

### Opção A: Página HTML de teste (recomendado)

1. Crie um arquivo HTML (ex.: `test-google-login.html`) com o código abaixo.
2. **Importante:** use a mesma origem que você colocou nas “Origens JavaScript autorizadas” (ex.: servir o HTML por um servidor em `http://localhost:5500` ou pela porta que você autorizou).
3. Abra no navegador, clique em “Entrar com Google”, faça login e use o ID token que aparecer no `textarea` no corpo do `POST /api/auth/google`.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Teste Login Google</title>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <h1>Teste Login Google</h1>
  <div id="buttonDiv"></div>
  <br>
  <textarea id="token" rows="6" cols="80" placeholder="ID Token aparecerá aqui após login"></textarea>
  <br>
  <button id="copy">Copiar token</button>

  <script>
    const clientId = 'SEU_CLIENT_ID.apps.googleusercontent.com'; // substitua
    const tokenEl = document.getElementById('token');
    const copyBtn = document.getElementById('copy');

    window.onload = function () {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: function (res) {
          tokenEl.value = res.credential || '';
        }
      });
      google.accounts.id.renderButton(document.getElementById('buttonDiv'), {
        type: 'standard',
        size: 'large',
        text: 'continue_with',
        theme: 'outline'
      });
    };

    copyBtn.onclick = () => {
      tokenEl.select();
      document.execCommand('copy');
      copyBtn.textContent = 'Copiado!';
    };
  </script>
</body>
</html>
```

Há uma página pronta em **`docs/test-google-login.html`** com o Client ID já preenchido. Para usá-la:

```bash
cd backend-dotnet/docs
npx serve .
# ou: python -m http.server 3000
```

Abra a URL (ex.: `http://localhost:3000`), faça login com Google; use o botão **Chamar POST /api/auth/google** na página para testar o fluxo completo (API em `http://localhost:5000`).

### Opção B: Swagger

1. Gere o ID token usando a Opção A (ou um app que já use Google Sign-In).
2. No Swagger, em **POST /api/auth/google**, no body use:

```json
{
  "googleToken": "COLE_AQUI_O_ID_TOKEN_LONGO"
}
```

3. Execute a requisição. A resposta deve trazer `user`, `token` (token da aplicação) e opcionalmente `doctorProfile`.

---

## 4. Fluxo resumido

1. **Frontend:** Usuário clica em “Entrar com Google” → Google retorna um **ID token** (JWT).
2. **Frontend:** Envia esse ID token no body para `POST /api/auth/google` com `{ "googleToken": "<id_token>" }`.
3. **Backend:** Valida o ID token com o Google (usando o ClientId), extrai e-mail e nome.
4. **Backend:** Busca usuário pelo e-mail; se não existir, cria um (paciente) com esse e-mail e nome.
5. **Backend:** Gera o token da aplicação e retorna no mesmo formato do login por e-mail (`user`, `token`, `doctorProfile`).

---

## 5. Erros comuns

| Erro | Causa |
|------|--------|
| `Google:ClientId não configurado` | Falta a chave `Google:ClientId` no `appsettings` (ou está vazia). |
| `Token do Google inválido ou expirado` | Token expirado, token de outro app (Client ID diferente) ou token corrompido. Gere um novo com a página de teste. |
| `Token do Google não contém e-mail` | Conta Google sem e-mail ou escopo insuficiente; use o fluxo “Sign-In com Google” que retorna ID token com e-mail. |
| CORS / “origem não autorizada” no front | Inclua a origem do seu front (ex.: `http://localhost:3000`) em **Origens JavaScript autorizadas** no cliente OAuth no Google Cloud. |

Depois de configurar o Client ID e obter um ID token válido (Opção A ou seu app), usar o Swagger (Opção B) é a forma mais rápida de testar o `POST /api/auth/google`.

---

## 6. Médico criando perfil via Google

Para o usuário **se cadastrar como médico** com Google:

1. No login Google, enviar **role** no body: `POST /api/auth/google` com `{ "googleToken": "<id_token>", "role": "doctor" }`. (Omitir `role` ou enviar `"patient"` para paciente.)
2. O backend cria o usuário com `role: "doctor"` e `profileComplete: false` (sem criar `doctor_profiles` ainda).
3. O frontend deve exibir a tela **"Complete seu cadastro"** para médico: telefone, CPF, data de nascimento (opcional), **CRM**, **CrmState** (UF, 2 letras), **Specialty** (uma das opções de `GET /api/specialties`), **Bio** (opcional).
4. **Salvar:** `PATCH /api/auth/complete-profile` com body por exemplo:
   ```json
   {
     "phone": "11987654321",
     "cpf": "12345678901",
     "birthDate": "1990-01-15",
     "crm": "123456",
     "crmState": "SP",
     "specialty": "Cardiologia",
     "bio": "Opcional"
   }
   ```
   O backend valida, atualiza o user, cria o registro em `doctor_profiles` e marca `profileComplete: true`. Se a criação do perfil médico falhar, o cadastro continua incompleto (rollback parcial) e o usuário pode tentar de novo.
5. **Cancelar:** `POST /api/auth/cancel-registration` remove o usuário e, se existir, o `doctor_profiles` associado (rollback).

---

## 7. Conclusão de cadastro (resumo UX)

Usuários criados via Google entram com **cadastro incompleto**. O frontend deve:

1. **Verificar** na resposta do login Google (ou em `GET /api/auth/me`) o campo **`user.profileComplete`** (ou `profileComplete` na raiz da resposta).
2. Se for `false`, exibir a tela **"Complete seu cadastro"**:
   - **Paciente:** telefone, CPF, data de nascimento (opcional).
   - **Médico:** os mesmos campos + CRM, CrmState (2 letras), Specialty (lista de `GET /api/specialties`), Bio (opcional).
3. **Salvar:** `PATCH /api/auth/complete-profile` com o body adequado (token no header). Após sucesso, `profileComplete: true`.
4. **Cancelar:** `POST /api/auth/cancel-registration` (com token). O usuário é **removido** (rollback) e o token deixa de valer.

**Migração no Supabase:** a tabela `users` precisa da coluna `profile_complete` (boolean, default true). No SQL Editor do Supabase:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete boolean NOT NULL DEFAULT true;
```

Depois, para usuários já criados via Google sem a coluna, você pode rodar uma vez: `UPDATE users SET profile_complete = true WHERE phone IS NOT NULL AND cpf IS NOT NULL;` (ou deixar o default true para todos os existentes).
