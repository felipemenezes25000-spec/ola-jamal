# Transcrição na consulta — Diagnóstico e logs

## Fluxo principal: Daily.co (transcrição nativa)

**Consulta em vídeo (mobile e web)**: transcrição é feita pelo **Daily.co** (Deepgram)
no cliente. O app envia texto via `POST /api/consultation/transcribe-text`.
**Não usa Whisper** em consulta ativa.

- **transcribe-text**: recebe texto já transcrito (Daily.co) — fluxo principal
- **transcribe**: recebe áudio e usa Whisper — legado/fallback (useAudioRecorder)
- **transcribe-test**: teste isolado — usa Whisper

### 1. Logs do backend (transcribe-text — Daily.co)

| Log | Significado |
| --- | --- |
| `[TranscribeText] INICIO RequestId=...` | Texto Daily.co chegou ao backend |
| `[TranscribeText] Texto ausente ou vazio` | Frontend enviou texto vazio |
| `BadRequest("Consultation must be in progress")` | Status != in_consultation |

### 2. Logs do backend (transcribe — Whisper, legado)

| Log | Significado |
| --- | --- |
| `[Transcribe] Chunk recebido: RequestId=...` | Chunk de áudio chegou |
| `[Transcribe] TRANSCRICAO_NAO_OCORRE: Whisper vazio` | Sem fala detectada |
| `[Whisper] OpenAI:ApiKey não configurada` | Chave OpenAI ausente |

### 3. Variáveis de ambiente

- **Daily.co**: transcrição usa sala Daily; não depende de OpenAI
- **OpenAI__ApiKey**: para `transcribe` e `transcribe-test`; anamnese usa Gemini

### 4. Fluxo esperado (Daily.co)

1. **Médico** entra na chamada → vê botão "Iniciar Consulta"
2. **Médico** clica em "Iniciar Consulta" → chama `startConsultation`
3. **App** com `callState === 'joined'` → `useDailyTranscription` inicia transcrição
4. Chunks via `transcribe-text` → backend acumula e propaga TranscriptUpdate

---

## Pontos de falha comuns

### A) Transcrição Daily.co nunca inicia

- **Médico não apertou "Iniciar Consulta"** — status fica `paid`; não permite iniciar
- **Paciente entrou antes do médico** — `consultationStartedAt` ainda não atualizado
- **DAILY_API_KEY ausente** — sala Daily não é criada; verifique `.env`

### B) Chunks de texto não chegam ao backend

- **Erro de rede** — use `EXPO_PUBLIC_API_URL` com IP da LAN (não localhost)
- **Daily.co transcription não iniciou** — verifique log Transcrição iniciada

### C) Transcrição OK mas médico não vê

- **SignalR do hub de vídeo** — médico conectado ao hub `video` para TranscriptUpdate
- **Médico não abriu o painel** — transcrição no painel lateral (deslize para abrir)

### D) transcribe / transcribe-test (Whisper)

- **OpenAI__ApiKey ausente** — necessária para Whisper; não afeta Daily.co
- **Formato de áudio** — m4a (mobile) e webm (web); Whisper pode falhar

---

## Logs no app (React Native / Metro)

Com `__DEV__` ativo, procure no console:

| Log | Significado |
| --- | --- |
| `[DailyTranscription] Transcrição iniciada` | Daily.co transcription OK |
| `[DailyTranscription] Erro ao enviar:` | Falha ao enviar chunk |
| `[DailyTranscription] stop failed:` | Erro ao parar transcrição |

---

## Teste isolado

**App (Perfil médico → "Testar transcrição IA")**: usa Daily.co + transcrição
nativa Daily.co — não usa Whisper.

**Script PowerShell** (`run-transcription-test.ps1`): envia áudio para
`transcribe-test`
— usa Whisper (OpenAI). Requer `OpenAI__ApiKey`.

Se o teste do app funcionar mas a consulta não, o problema está no fluxo
(status, SignalR, etc.).
