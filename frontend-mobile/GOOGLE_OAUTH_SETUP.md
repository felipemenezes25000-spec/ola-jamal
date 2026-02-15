# Guia: Configurar Login com Google no Projeto RenoveJá

O projeto já está preparado para login com Google. Falta configurar o **Google Cloud Console**.

---

## Passo 1: Criar ou usar um projeto no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Faça login com sua conta Google
3. Crie um **projeto** ou selecione um existente
4. Anote o nome do projeto

---

## Passo 2: Configurar a Tela de Consentimento OAuth

1. Vá em **APIs e Serviços** → **Tela de consentimento OAuth**
2. Se for o primeiro uso, escolha **Externo** (para qualquer conta Google)
3. Preencha:
   - **Nome do aplicativo:** RenoveJá
   - **E-mail de suporte:** seu e-mail
   - **Logo:** opcional
4. Clique em **Salvar e continuar**
5. Em **Escopos**, clique em **Adicionar ou remover escopos** e inclua:
   - `openid`
   - `email`
   - `profile`
6. Em **Usuários de teste** (se o app estiver em "Em teste"):
   - Adicione os e-mails que poderão fazer login
   - Ex.: seu e-mail, e-mail de colegas
7. Clique em **Salvar e continuar**

---

## Passo 3: Criar credencial OAuth 2.0

1. Vá em **APIs e Serviços** → **Credenciais**
2. Clique em **+ Criar credenciais** → **ID do cliente OAuth**
3. Tipo de aplicativo: **Aplicativo da Web**
4. Nome: `RenoveJá Web Client`
5. Em **URIs de redirecionamento autorizados**, clique em **+ Adicionar URI** e adicione:
   ```
   renoveja://auth
   ```
   e:
   ```
   com.renoveja.app:/auth
   ```
6. Clique em **Criar**
7. Copie o **ID do cliente** (formato: `xxxxx.apps.googleusercontent.com`)

---

## Passo 4: Atualizar o Client ID no projeto (se for novo)

Se você criou um novo Client ID, atualize no código:

**Frontend** – `app/(auth)/login.tsx`:
```javascript
const GOOGLE_CLIENT_ID = 'SEU_CLIENT_ID_AQUI.apps.googleusercontent.com';
```

**Backend** – `backend-dotnet/src/RenoveJa.Api/appsettings.json` e `appsettings.Development.json`:
```json
"Google": {
  "ClientId": "SEU_CLIENT_ID_AQUI.apps.googleusercontent.com"
}
```

O projeto já usa: `393882962431-141i571c0527230j11q544rvhm1633af.apps.googleusercontent.com`

Se esse for o Client ID do seu projeto no Google Cloud, não precisa alterar nada.

---

## Passo 5: Como testar o login

### Importante: Expo Go não suporta OAuth

O Google não aceita o redirect do **Expo Go** (`exp://...`). Para testar o login com Google:

**Opção A – Development build (recomendado):**
```bash
npx expo run:android
```
*(Exige Android Studio e SDK configurados)*

**Opção B – EAS Build (produção/teste):**
```bash
npx eas build --profile development --platform android
```
*(Exige conta Expo)*

**Opção C – Web (para testes rápidos):**
```bash
npx expo start --web
```
*(O login com Google pode funcionar no navegador; pode ser necessário adicionar `http://localhost:8081` como redirect URI no Google Console)*

---

## Passo 6: Configurações avançadas (se der erro)

### Erro 400: invalid_request
- Confirme que os redirect URIs estão **exatamente** como acima
- Verifique se não há espaços no início ou no fim

### Access blocked / App não verificado
- Se o app está em **Em teste**, inclua seu e-mail em **Usuários de teste**
- Para produção, é preciso passar pela verificação do Google

### Android – Esquema de URI personalizado
1. Em **Credenciais** → seu Client ID → **Editar**
2. Role até **Configurações avançadas**
3. Se existir, ative **Habilitar esquema de URI personalizado para Android**

---

## Resumo rápido

| Item | Valor |
|------|-------|
| Redirect URIs | `renoveja://auth`, `com.renoveja.app:/auth` |
| Escopos | openid, email, profile |
| Client ID (atual) | `393882962431-...apps.googleusercontent.com` |
| Onde testar | Development build ou web (não Expo Go) |

---

## Fluxo técnico do projeto

1. **App** → Usuário toca em "Entrar com Google"
2. **expo-auth-session** → Abre o navegador na tela de login do Google
3. **Google** → Usuário faz login e aprova
4. **Google** → Redireciona para `renoveja://auth` com código/token
5. **App** → Envia o id_token para `POST /api/auth/google`
6. **Backend** → Valida o token com a biblioteca Google e cria/retorna o usuário
7. **App** → Salva o token do app e redireciona para a tela principal
