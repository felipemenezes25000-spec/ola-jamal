# Tutorial: Login com Google em builds EAS

Guia passo a passo para configurar o login com Google em APKs gerados pelo **EAS Build** (profile `preview` ou `production`).

---

## Pré-requisitos

- Projeto RenoveJá configurado no [Expo Dashboard](https://expo.dev)
- Conta no [Firebase Console](https://console.firebase.google.com) (projeto `renoveja-be43f`)
- Conta no [Google Cloud Console](https://console.cloud.google.com)

---

## Parte 1: Obter o SHA-1 do certificado EAS

O EAS usa um keystore próprio para assinar os APKs. O SHA-1 desse certificado **precisa** estar cadastrado no Firebase/Google Cloud.

### Opção A: Pelo Expo Dashboard (recomendado)

1. Acesse [expo.dev](https://expo.dev) e faça login
2. Selecione o projeto **Renoveja**
3. No menu lateral: **Credentials** → **Android**
4. Localize a seção **Keystore** ou **Signing key**
5. Copie o **SHA-1** (formato: `XX:XX:XX:...` ou `XXXXXXXX...`)

### Opção B: Pelo terminal

```powershell
cd frontend-mobile
npx eas credentials --platform android
```

Siga o prompt e selecione o profile (`preview` ou `production`). O SHA-1 será exibido.

---

## Parte 2: Cadastrar o SHA-1 no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione o projeto **renoveja-be43f**
3. Clique no ícone de **engrenagem** → **Configurações do projeto**
4. Na aba **Seus apps**, localize o app Android (`com.renoveja.app`)
5. Clique em **Adicionar impressão digital**
6. Cole o SHA-1 obtido na Parte 1
7. Salve

> **Importante:** Se o app Android ainda não existir no Firebase, crie-o com o pacote `com.renoveja.app` e baixe o `google-services.json`. Coloque em `frontend-mobile/google-services.json`.

---

## Parte 3: Cadastrar o SHA-1 no Google Cloud (OAuth Android)

1. Acesse [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Selecione o projeto **renoveja-be43f** (ou o projeto vinculado ao Firebase)
3. Em **Credenciais** → **OAuth 2.0 Client IDs**
4. Localize o cliente **Android** (ex.: `RenoveJá Android`)
   - Se não existir: **Criar credenciais** → **ID do cliente OAuth** → tipo **Android**
5. Edite o cliente e confira:
   - **Nome do pacote:** `com.renoveja.app`
   - **Impressão digital SHA-1:** adicione o SHA-1 do EAS (da Parte 1)
6. Salve

---

## Parte 4: Verificar o eas.json

O `eas.json` já deve ter os Client IDs corretos (projeto 598286841038). Confira:

```json
"env": {
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "598286841038-j095u3iopiqltpgbvu0f5od924etobk7.apps.googleusercontent.com",
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "598286841038-780e9kksjoscthg0g611virnchlb7kcr.apps.googleusercontent.com",
  "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "598286841038-28ili7c5stg5524sicropmm7s7nkq936.apps.googleusercontent.com"
}
```

Se estiver diferente, use os IDs do projeto **598286841038** (renoveja-be43f).

---

## Parte 5: Gerar o APK

```powershell
cd frontend-mobile
npx eas-cli build --platform android --profile preview --clear-cache
```

Após o build, baixe o APK e instale em um dispositivo físico. O login com Google deve funcionar.

---

## Checklist rápido

| # | Etapa | Onde |
|---|-------|------|
| 1 | Obter SHA-1 do EAS | Expo Dashboard → Credentials → Android |
| 2 | Adicionar SHA-1 no Firebase | Firebase Console → Configurações → Seus apps → Android |
| 3 | Adicionar SHA-1 no Google Cloud | Google Cloud → Credenciais → Cliente OAuth Android |
| 4 | Verificar eas.json | Client IDs do projeto 598286841038 |
| 5 | Build | `npx eas-cli build --platform android --profile preview` |

---

## Erros comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `DEVELOPER_ERROR` | SHA-1 não cadastrado | Repetir Partes 1, 2 e 3 |
| Botão Google desabilitado | Variáveis de ambiente vazias | Conferir eas.json |
| `Token do Google inválido` | Backend com Client ID errado | `Google__ClientId` na API = Web Client ID (598286841038-j095u3iopiqltpgbvu0f5od924etobk7) |

---

## Referências

- [LOGIN_GOOGLE_PASSO_A_PASSO.md](LOGIN_GOOGLE_PASSO_A_PASSO.md) — Fluxo geral
- [CONFIG_GOOGLE_OAUTH.md](../setup/CONFIG_GOOGLE_OAUTH.md) — Configuração OAuth detalhada
- [EAS Build](https://docs.expo.dev/build/introduction/) — Documentação oficial
