# Teste de Transcrição (Deepgram)

## Scripts disponíveis

| Script | Uso |
|--------|-----|
| `test-deepgram-direct.ps1` | **Testa Deepgram direto** (sem backend). Valida chave e modelo. |
| `run-transcription-test.ps1` | Teste completo: gera áudio, inicia backend, chama `/transcribe-test`. |
| `test-transcription.ps1` | Envia arquivo para backend (requer backend rodando). |

## Teste rápido (Deepgram direto)

```powershell
cd backend-dotnet\scripts
.\test-deepgram-direct.ps1
```

- Lê `DEEPGRAM_API_KEY` do `.env` em `RenoveJa.Api` ou do ambiente
- Gera áudio em português se não houver arquivo
- Chama a API do Deepgram e exibe a transcrição

Com arquivo próprio:
```powershell
.\test-deepgram-direct.ps1 -AudioFile "C:\meu-audio.wav"
```

Com chave explícita:
```powershell
.\test-deepgram-direct.ps1 -ApiKey "sua-chave-deepgram"
```

---

## Teste via Backend

### Pré-requisitos

- **Deepgram:ApiKey** configurada em `appsettings.Development.json` ou `.env`
- **ASPNETCORE_ENVIRONMENT=Development** no `.env` (o endpoint de teste só existe em Development)

## Formas de executar

### Opção A: Duplo clique nos .bat (mais fácil)

| Arquivo | Uso |
|---------|-----|
| `run-transcription-test.bat` | Backend já rodando — só executa o teste |
| `run-transcription-test-full.bat` | Inicia o backend e executa o teste |

### Opção B: PowerShell

```powershell
cd c:\Users\anabe\Downloads\renovejatac\backend-dotnet\scripts
.\run-transcription-test.ps1 -SkipBackendStart
```

Ou com caminho completo (funciona de qualquer pasta):

```powershell
& "c:\Users\anabe\Downloads\renovejatac\backend-dotnet\scripts\run-transcription-test.ps1" -SkipBackendStart
```

### Opção C: Teste manual

1. **Inicie o backend:**
   ```powershell
   cd backend-dotnet\src\RenoveJa.Api
   $env:ASPNETCORE_ENVIRONMENT = "Development"
   dotnet run
   ```

2. **Em outro terminal, execute o teste:**
   ```powershell
   cd backend-dotnet\scripts
   .\run-transcription-test.ps1 -SkipBackendStart
   ```

## Logs para diagnóstico

O backend emite logs detalhados. Procure por:

- `[TranscribeTest]` — endpoint de teste
- `[Deepgram]` — serviço de transcrição
- `[Transcribe]` — endpoint usado durante a consulta

**Se aparecer:** `[Deepgram] DEEPGRAM_API_KEY não configurada`
→ Configure `Deepgram__ApiKey` em variáveis de ambiente ou `appsettings.Development.json`

**Se aparecer:** `[Deepgram] API erro: StatusCode=401`
→ Chave inválida ou expirada. Gere nova em deepgram.com

**Se aparecer:** `[Deepgram] Resposta sem texto útil`
→ Áudio sem fala detectável ou formato não suportado

## Arquivo de áudio gerado

O script gera `test-transcription-audio.wav` na pasta `scripts`. Você pode reutilizá-lo ou substituir por outro arquivo com fala em português.
