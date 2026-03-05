# Transcrição na consulta — Diagnóstico e logs

## O que verificar ANTES de testar no app

### 1. Logs do backend (terminal onde a API está rodando)

Ao iniciar a consulta e o paciente falar, procure por:

| Log | Significado |
|-----|-------------|
| `[Transcribe] Chunk recebido: RequestId=..., Size=..., Stream=...` | Chunk de áudio chegou ao backend |
| `[Transcribe] Chunk de áudio ausente ou vazio` | Frontend enviou arquivo vazio |
| `[Transcribe] Transcrição retornou vazio` | Deepgram não detectou fala ou retornou vazio |
| `[Transcribe] Transcrição OK: RequestId=..., TextLength=...` | Transcrição funcionou |
| `[Deepgram] DEEPGRAM_API_KEY não configurada` | **Chave Deepgram ausente** — transcrição não funciona |
| `[Deepgram] API erro: StatusCode=401` | Chave Deepgram inválida ou expirada |
| `[Deepgram] API erro: StatusCode=4xx/5xx` | Erro na API Deepgram |
| `[Deepgram] Nenhuma fala detectada no áudio` | Áudio sem voz ou muito curto |
| `BadRequest("Consultation must be in progress to transcribe")` | Status da consulta não é `in_consultation` |
| `BadRequest("Audio file is required")` | Arquivo não chegou corretamente |

### 2. Variáveis de ambiente

- **DEEPGRAM_API_KEY** ou **Deepgram__ApiKey** deve estar configurada no `.env` ou nas variáveis do Render
- Sem a chave, o backend loga `[Deepgram] DEEPGRAM_API_KEY não configurada` e retorna transcrição vazia

### 3. Fluxo esperado

1. **Médico** entra na chamada → vê botão "Iniciar Consulta"
2. **Médico** clica em "Iniciar Consulta" → chama `startConsultation` → status vira `in_consultation`
3. **Paciente** recebe atualização (RequestUpdated via SignalR ou polling) → `canStartRecording` = true
4. **Paciente** com `callState === 'joined'` → inicia gravação automaticamente
5. A cada **10 segundos** o paciente envia um chunk de áudio para o backend
6. Backend transcreve via Deepgram → envia TranscriptUpdate via SignalR para o médico

---

## Pontos de falha comuns

### A) Gravação nunca inicia (paciente)

- **Médico não apertou "Iniciar Consulta"** — o status fica `paid` e a gravação não começa
- **Paciente entrou antes do médico** — `consultationStartedAt` e `requestStatus` ainda não atualizados
- **RequestUpdated não chega** — SignalR de requests pode estar desconectado; o paciente faz polling a cada 2s como fallback

### B) Chunks não chegam ao backend

- **Arquivo < 500 bytes** — ignorado no frontend (silêncio ou fala muito curta)
- **Primeiro chunk demora 10 segundos** — o paciente precisa falar por ~10s antes do primeiro envio
- **Erro de rede** — dispositivo físico precisa de `EXPO_PUBLIC_API_URL` com IP da LAN (não localhost)

### C) Backend recebe mas não transcreve

- **DEEPGRAM_API_KEY ausente** — verifique `.env` e variáveis do Render
- **Formato de áudio** — m4a (mobile) e webm (web) são suportados; Deepgram pode falhar com alguns codecs

### D) Transcrição OK mas médico não vê

- **SignalR do hub de vídeo** — médico precisa estar conectado ao hub `video` para receber TranscriptUpdate
- **Médico não abriu o painel** — a transcrição aparece no painel lateral (deslize para abrir)

---

## Logs no app (React Native / Metro)

Com `__DEV__` ativo, procure no console:

| Log | Significado |
|-----|-------------|
| `[AudioRecorder] Started recording, chunk interval: 10000` | Gravação iniciou |
| `[AudioRecorder] Chunk ignorado: arquivo muito pequeno` | Chunk < 500 bytes descartado |
| `[AudioRecorder] Chunk send failed: ...` | Erro ao enviar para API |
| `[Patient] Transcrição: falha ao iniciar gravação` | Permissão de microfone ou erro ao criar gravação |

---

## Teste isolado (sem consulta)

1. Backend em **Development**: `ASPNETCORE_ENVIRONMENT=Development`
2. App → Perfil médico → "Testar transcrição IA"
3. Grava ~8–10 segundos falando claramente
4. Verifique os logs do backend

Se o teste isolado funcionar mas a consulta não, o problema está no fluxo (gravação não inicia, status, SignalR, etc.).
