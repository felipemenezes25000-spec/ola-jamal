# Daily.co — Web vs mobile (como “arrumar” sem um SDK só)

Não é um bug: **são duas superfícies oficiais do Daily** com propósitos diferentes.

| Plataforma | API | Por quê |
|------------|-----|--------|
| **Web (portal médico)** | `DailyIframe.createFrame` + `@daily-co/daily-react` | UI pronta (mute, fullscreen, join), integração rápida com transcrição via `DailyProvider` + `useTranscription`. |
| **Mobile (app)** | `Daily.createCallObject` + `DailyMediaView` | WebView/iframe não é suportado para WebRTC de forma equivalente; o SDK nativo expõe tracks para views nativas e PiP/foreground service no Android. |

## O que já está alinhado entre os dois

- **Mesmo backend:** sala Daily + token (`/api/video/join-token`, criação de room conforme API do projeto).
- **Mesmo contrato de negócio:** entrar na sala, reportar “call connected”, transcrição → backend, SignalR para anamnese.
- **Regras de lifecycle:** um call/iframe por sessão; destroy antes de criar outro; trocar `roomUrl`/`token` dispara `leave()` no mobile.

## Como evoluir sem “fundir” SDK

1. **Documentar DTOs compartilhados** — tipos de evento de transcrição e payloads já espelham o backend; qualquer mudança no fluxo deve atualizar web **e** mobile.
2. **Testes manuais por rota:** médico web + paciente app (e o inverso) no mesmo `requestId`.
3. **Não trocar mobile para iframe** nem web para `createCallObject` puro sem reescrever UI de vídeo — custo alto e perda de UX nativa.

## Mobile — PiP e câmera

Em PiP, o preview local não pode ser **desmontado**: remover `DailyMediaView` do vídeo local pode parar o surface e o **outro participante** deixa de ver sua câmera. O app mantém um view mínimo “keep-alive” enquanto o PiP está ativo.

### Android — segundo plano (paridade com apps de chamada)

- **Foreground service** do Daily com tipos `camera|microphone|phoneCall` e permissões correspondentes (Android 10+).
- **Notificação de “consulta em andamento”** ligada **antes** de `join()` e **reforçada** ao ir para `background`, para o sistema não tratar o app como inativo.
- Ao voltar ao app (`active`), `setLocalVideo(true)` recupera câmera se a OEM tiver pausado o capturador.

Em alguns aparelhos, “otimização de bateria” agressiva ainda pode limitar a câmera; o usuário pode isentar o app em *Configurações → Apps → RenoveJá → Bateria* (comportamento esperado, igual a outros apps VoIP).

### iOS

Vídeo em **plano de fundo total** (sem PiP) é limitado pelo sistema; `UIBackgroundModes` inclui `audio` e `voip` para áudio. Para vídeo contínuo, prefira **PiP** nativo quando disponível.
