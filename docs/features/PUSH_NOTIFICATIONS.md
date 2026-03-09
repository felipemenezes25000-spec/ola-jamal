# Push Notifications — RenoveJá

## Status: Implementado

Push está implementado com **Expo Push Notifications**. O backend envia via API da Expo (`exp.host`).

## Regras da spec

- **Quiet hours (22:00–08:00)**: notificações fora de `BypassQuietHours` usam canal `quiet` (sem heads-up) no horário local do usuário.
- **Preferências por categoria**: Pedidos, Pagamentos, Consultas, Lembretes — cada categoria pode ser desativada. API: `GET/PUT /api/push-tokens/preferences`.
- **Lembretes**: pedido parado em ApprovedPendingPayment > 6h → lembrete ao paciente; InReview > 30 min → lembrete ao médico. Cooldown de 12h entre lembretes.
- **Batching**: múltiplos pedidos em 2 min viram um único push "X novas solicitações" para médicos.

## Requisitos mínimos (Firebase Android)

1. **Conta Expo** — `npx expo login` + `projectId` em `app.config.js` ✅ (já configurado)
2. **Projeto Firebase** — ✅ projeto "Renove Ja" já existe com app Android `com.renoveja.app`
   - Baixar `google-services.json`: [Firebase Console → Configurações → app Android](https://console.firebase.google.com/project/renove-ja/settings/general/android:com.renoveja.app)
   - Colocar em `frontend-mobile/google-services.json`
   - Ou executar: `.\scripts\copiar-google-services.ps1` (após baixar o arquivo)

## Por que pode não funcionar

### 1. **FCM v1 (Android) — CRÍTICO**
Desde julho/2024, o Google desativou a API legada do FCM. **É obrigatório** ter credenciais FCM v1 no EAS:

1. Firebase Console → Project Settings → Service Accounts → Generate New Private Key (JSON)
2. EAS: `eas credentials` → Android → production → FCM v1 → upload do JSON
3. Ou: [expo.dev](https://expo.dev) → seu projeto → Credentials → Android → FCM v1 service account key

Se não configurado, o push **não chega** no Android. Os logs do backend podem mostrar `InvalidCredentials` ou `MismatchSenderId` nos push receipts.

### 2. **Expo Go**
Push **não funciona no Expo Go** (removido no SDK 53+). Use um **development build**:
```bash
npx expo run:android
# ou
npx expo run:ios
```

### 3. **Token não registrado**
O app registra o token ao fazer login. Se o usuário negar permissão ou o registro falhar, não há token no backend e o push não é enviado.

### 4. **Dispositivo físico**
Push só funciona em dispositivo físico, não em emulador (ou com configuração extra no emulador).

### 5. **projectId**
O `projectId` do EAS está em `app.config.js` → `extra.eas.projectId`. Necessário para `getExpoPushTokenAsync`.

### 6. **Diagnóstico via logs**
O backend agora parseia a resposta da Expo e loga erros individuais (ex.: `DeviceNotRegistered`, `InvalidCredentials`). Verifique os logs após enviar um push de teste.

## Fluxo

1. **Login** → `PushNotificationProvider` chama `registerPushToken(token, Platform.OS)` → token salvo no Supabase
2. **Evento** (pagamento, médico na sala, etc.) → backend chama `CreateNotificationAsync` → `pushNotificationSender.SendAsync`
3. **ExpoPushService** busca tokens ativos do usuário → envia para `https://exp.host/--/api/v2/push/send`
4. **Tap na notificação** → app navega para `/request-detail/{id}` (paciente) ou `/doctor-request/{id}` (médico)

## Eventos que disparam push

- Pagamento confirmado (paciente e médico)
- Médico na sala / Consulta pronta
- Chamada conectada
- Documento assinado
- Nova solicitação na fila (médicos)
- Rejeição, cancelamento, etc.

## Checklist de troubleshooting

- [ ] **Android**: FCM v1 credentials enviadas no EAS? (`eas credentials` → FCM v1)
- [ ] **iOS**: APNs key configurada no EAS?
- [ ] App rodando em **development build** (não Expo Go)?
- [ ] Dispositivo **físico** (não emulador)?
- [ ] Usuário aceitou permissão de notificações?
- [ ] Token registrado? (Configurações → "Testar push" não deve retornar "Nenhum token")
- [ ] Logs do backend: algum `InvalidCredentials`, `DeviceNotRegistered` ou `MismatchSenderId`?

## Configurar FCM v1 (passo a passo)

1. **Firebase Console** — [Service Accounts do projeto renove-ja](https://console.firebase.google.com/project/renove-ja/settings/serviceaccounts/adminsdk)
2. Clique em **Generate New Private Key** → salve o JSON
3. **EAS CLI**: `cd frontend-mobile && npx eas credentials --platform android`
4. Selecione: **production** → **Google Service Account** → **FCM v1** → **Upload a new service account key**
5. Informe o caminho do arquivo JSON
6. Ou use o script: `.\scripts\configurar-fcm-v1.ps1`

## Testar

1. Faça build: `npx expo run:android` ou `eas build` (push **não funciona no Expo Go**)
2. Instale no dispositivo físico
3. Faça login
4. Aceite permissão de notificações
5. **Teste rápido**: `POST /api/push-tokens/test` (com Bearer token) ou use o botão "Testar push" nas configurações do app
6. Dispare um evento real (ex.: pagamento aprovado via webhook MP)

### Validação via API

```bash
# Obter token de login (email/senha)
TOKEN="seu_jwt_aqui"

# Enviar push de teste
curl -X POST "https://sua-api.com/api/push-tokens/test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```
