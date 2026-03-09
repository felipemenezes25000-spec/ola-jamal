# Login com Google — Guia Passo a Passo

Este guia configura o login com Google no app RenoveJá. **Mesmo usando o Google, o usuário precisa completar os dados obrigatórios** (telefone, CPF, endereço) na tela "Completar Cadastro".

---

## Resumo do fluxo

1. Usuário clica em **"Continuar com Google"** na tela de login
2. Escolhe a conta Google no popup
3. Se for **novo usuário**: é redirecionado para **Completar Cadastro** (telefone, CPF, endereço)
4. Se já tiver perfil completo: vai direto para Home ou Dashboard

---

## Passo 1: Google Cloud Console

1. Acesse: **https://console.cloud.google.com**
2. Faça login com sua conta Google
3. Crie um projeto ou selecione o projeto do RenoveJá

---

## Passo 2: Tela de consentimento OAuth

1. No menu lateral: **APIs e serviços** → **Tela de consentimento OAuth**
2. Tipo: **Externo** (permite testar com qualquer conta Google)
3. Preencha:
   - Nome do app: **RenoveJá**
   - E-mail de suporte: seu e-mail
   - Domínios autorizados: `renovejasaude.com.br` (se tiver)
4. Salve

---

## Passo 3: Criar credenciais OAuth

### A) Cliente Web (obrigatório)

1. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**
2. Tipo: **Aplicativo da Web**
3. Nome: `RenoveJá Web`
4. **URIs de redirecionamento autorizados**:
   - `https://auth.expo.io/@SEU_USUARIO_EXPO/renoveja-app`
   - Ou a URL que o Expo mostrar ao rodar o app
5. Clique em **Criar**
6. **Copie o ID do cliente** (termina em `.apps.googleusercontent.com`)

### B) Cliente Android (para build Android)

1. **Criar credenciais** → **ID do cliente OAuth**
2. Tipo: **Android**
3. Nome: `RenoveJá Android`
4. **Nome do pacote**: `com.renoveja.app`
5. **SHA-1**: Execute `cd android && ./gradlew signingReport` ou use o que o EAS mostrar
6. Copie o **ID do cliente**

### C) Cliente iOS (para build iOS)

1. **Criar credenciais** → **ID do cliente OAuth**
2. Tipo: **iOS**
3. Nome: `RenoveJá iOS`
4. **ID do pacote**: `com.renoveja.app`
5. Copie o **ID do cliente**

---

## Passo 4: Configurar o frontend (app mobile)

1. Abra `frontend-mobile/.env`
2. Preencha (use os IDs que você copiou):

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=SEU_ID_WEB.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=SEU_ID_ANDROID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=SEU_ID_IOS.apps.googleusercontent.com
```

3. **Reinicie o Metro/Expo** após alterar o `.env`

---

## Passo 5: Configurar o backend (API)

O backend precisa do **mesmo Client ID Web** para validar o token enviado pelo app.

### Desenvolvimento local

O `appsettings.json` já está configurado com o Client ID.

### Produção (Render)

1. Acesse o **Dashboard do Render** → seu serviço (ex: `ola-jamal`)
2. **Environment** → **Add Environment Variable**
3. Nome: `Google__ClientId`
4. Valor: o **mesmo** que `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
5. Salve e faça **redeploy** do serviço

---

## Passo 6: Testar

1. Inicie o app: `cd frontend-mobile && npx expo start`
2. Na tela de login, clique em **"Continuar com Google"**
3. Escolha sua conta Google
4. Se for novo usuário, preencha **telefone, CPF e endereço** na tela "Completar Cadastro"
5. Clique em **"Finalizar Cadastro"**

---

## Dados obrigatórios após login com Google

| Campo      | Obrigatório |
|-----------|-------------|
| Telefone  | Sim (10 ou 11 dígitos) |
| CPF       | Sim (11 dígitos) |
| CEP       | Sim (para buscar endereço) |
| Rua       | Sim |
| Número    | Sim |
| Bairro    | Sim |
| Cidade    | Sim |
| UF        | Sim (2 letras) |
| Complemento | Não |

---

## Solução de problemas

| Problema | Solução |
|----------|---------|
| Botão "Continuar com Google" desabilitado | Verifique se o `.env` tem as variáveis `EXPO_PUBLIC_GOOGLE_*` e reinicie o Metro |
| "Token do Google inválido" | O `Google__ClientId` do backend deve ser **igual** ao Web Client ID do frontend |
| Popup não abre | No Expo Go, pode haver limitações; teste em build de desenvolvimento (EAS) |
| "Login com Google indisponível" | Confirme que as credenciais OAuth estão ativas no Google Cloud Console |
