# Como configurar o login com Google (OAuth)

## 1. Google Cloud Console

1. Acesse: **https://console.cloud.google.com**
2. Crie um projeto ou selecione o projeto do RenoveJá.
3. No menu lateral: **APIs e serviços** → **Credenciais**.

---

## 2. Tela de consentimento OAuth (se ainda não fez)

- **APIs e serviços** → **Tela de consentimento OAuth**.
- Tipo: **Externo** (para testar com qualquer conta Google).
- Preencha: Nome do app (RenoveJá), e-mail de suporte, domínios autorizados (ex.: `renovejasaude.com.br`).
- Salve.

---

## 3. Criar credenciais OAuth 2.0

Você vai criar **três** tipos de cliente (ou só o que for usar):

### A) Cliente Web (obrigatório para o app)

- **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**.
- Tipo: **Aplicativo da Web**.
- Nome: ex. `RenoveJá Web`.
- **URIs de redirecionamento autorizados** (para Expo/Web):
  - `https://auth.expo.io/@seu-usuario/renoveja-app`  
  - ou o que o Expo mostrar ao rodar o app (ele pode indicar a URL).
- Clique em **Criar**.
- Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`).

→ Esse valor vai no **EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID** no `.env`.

---

### B) Cliente Android (para build Android)

- **Criar credenciais** → **ID do cliente OAuth**.
- Tipo: **Android**.
- Nome: ex. `RenoveJá Android`.
- **Nome do pacote**: `com.renoveja.app` (igual ao `package` do `app.config.js`).
- Para obter o **Impressão digital do certificado SHA-1**:
  - Debug: `cd android && ./gradlew signingReport` (ou use o que o EAS/Expo mostrar).
  - Ou no Android Studio: **Gradle** → **app** → **android** → **signingReport**.
- Crie e copie o **ID do cliente** (também termina em `.apps.googleusercontent.com`).

→ Esse valor vai no **EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID** no `.env`.

---

### C) Cliente iOS (para build iOS)

- **Criar credenciais** → **ID do cliente OAuth**.
- Tipo: **iOS**.
- Nome: ex. `RenoveJá iOS`.
- **ID do pacote**: `com.renoveja.app` (igual ao `bundleIdentifier` do `app.config.js`).
- Crie e copie o **ID do cliente**.

→ Esse valor vai no **EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID** no `.env`.

---

## 4. Colocar no `.env` do mobile

Abra o arquivo **`frontend-mobile/.env`** e preencha (troque pelos IDs que você copiou):

```env
# Login com Google — use os IDs da Google Cloud Console
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789-yyyy.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-zzzz.apps.googleusercontent.com
```

- **Web** é obrigatório se o app (ou a tela de login web) usa Google.
- **Android** e **iOS** só são necessários se for fazer build nativo (Expo/Android e Expo/iOS).

---

## 5. Backend (API)

A API .NET também precisa do **mesmo Client ID Web** (ou um Client ID Web só para a API) nas configs:

- **Google:ClientId** no `appsettings.json` ou variável de ambiente.

O valor costuma ser o **mesmo** que o `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` quando o app envia o token para a API validar.

---

## Resumo

| Onde | O que colocar |
|------|----------------|
| **Google Cloud** | Criar projeto → Tela de consentimento → 3 credenciais OAuth (Web, Android, iOS). |
| **frontend-mobile/.env** | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, opcionalmente `_ANDROID` e `_IOS` com os IDs copiados. |
| **Backend** | `Google:ClientId` = mesmo Client ID Web (para validar o token do app). |

Depois de alterar o `.env`, faça um **novo build** do app para as variáveis serem aplicadas.
