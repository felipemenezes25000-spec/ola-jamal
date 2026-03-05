# Push Notifications — RenoveJá

## Status: Implementado

Push está implementado com **Expo Push Notifications**. O backend envia via API da Expo (`exp.host`).

## Requisitos mínimos (Firebase Android)

1. **Conta Expo** — `npx expo login` + `projectId` em `app.config.js` ✅ (já configurado)
2. **Projeto Firebase** — ✅ projeto "Renove Ja" já existe com app Android `com.renoveja.app`
   - Baixar `google-services.json`: [Firebase Console → Configurações → app Android](https://console.firebase.google.com/project/renove-ja/settings/general/android:com.renoveja.app)
   - Colocar em `frontend-mobile/google-services.json`
   - Ou executar: `.\scripts\copiar-google-services.ps1` (após baixar o arquivo)

## Por que pode não funcionar

### 1. **Expo Go**
Push **não funciona no Expo Go** (removido no SDK 53+). Use um **development build**:
```bash
npx expo run:android
# ou
npx expo run:ios
```

### 2. **Token não registrado**
O app registra o token ao fazer login. Se o usuário negar permissão ou o registro falhar, não há token no backend e o push não é enviado.

### 3. **Dispositivo físico**
Push só funciona em dispositivo físico, não em emulador (ou com configuração extra no emulador).

### 4. **projectId**
O `projectId` do EAS está em `app.config.js` → `extra.eas.projectId`. Necessário para `getExpoPushTokenAsync`.

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

## Testar

1. Faça build: `npx expo run:android` ou `eas build`
2. Instale no dispositivo físico
3. Faça login
4. Aceite permissão de notificações
5. Dispare um evento (ex.: pagamento aprovado via webhook MP)
