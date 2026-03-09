# Suporte ao Expo Go

O app **RenoveJá+** pode rodar no **Expo Go** para desenvolvimento e testes rápidos, com algumas limitações.

---

## O que funciona no Expo Go

| Feature | Status |
|---------|--------|
| Login / autenticação | ✅ |
| Navegação (rotas, tabs) | ✅ |
| Perfil, configurações | ✅ |
| Solicitações de renovação | ✅ |
| Detalhes de pedidos | ✅ |
| Pagamentos (fluxo) | ✅ |
| Upload de documentos | ✅ |
| Notificações in-app (polling) | ✅ |
| Web (expo start --web) | ✅ |

---

## O que NÃO funciona no Expo Go

| Feature | Motivo | Alternativa |
|---------|--------|-------------|
| **Videoconferência** | Daily.co usa WebRTC nativo | Development build (`expo run:android` / `expo run:ios`) |
| **Push notifications** | Removidas do Expo Go no SDK 53+ | Development build ou EAS Build |

Ao acessar a tela de vídeo no Expo Go, o app mostra um aviso explicando que é necessário um build de desenvolvimento.

---

## Como rodar no Expo Go

```powershell
cd frontend-mobile
npm start
```

Depois escaneie o QR code com o app **Expo Go** (Android/iOS).

### Variáveis de ambiente

Para conectar à API, crie `.env` ou defina:

```env
EXPO_PUBLIC_API_URL=http://SEU_IP:5000
```

Em dispositivo físico, use o IP da sua máquina (ex: `192.168.15.69`) em vez de `localhost`.

---

## Para testar videoconferência

Use um **development build** (inclui os módulos nativos do Daily.co):

```powershell
# Android
npx expo run:android

# iOS (requer Mac)
npx expo run:ios
```

Ou gere um build com EAS:

```powershell
eas build --profile development --platform android
```

---

## Detecção de Expo Go

O app usa `lib/expo-go.ts` para detectar se está rodando no Expo Go:

- `Constants.executionEnvironment === ExecutionEnvironment.StoreClient`
- Fallback: `Constants.appOwnership === 'expo'`

Isso permite desabilitar features incompatíveis sem crash.
