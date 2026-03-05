# Deepgram — Transcrição não funciona

## Checklist rápido

1. **API Key configurada?**
   - Local: `DEEPGRAM_API_KEY` no `.env` ou `Deepgram__ApiKey`
   - Render: `DEEPGRAM_API_KEY` ou `Deepgram__ApiKey` nas variáveis de ambiente
   - appsettings: `Deepgram:ApiKey`

2. **Log no backend**
   - `[Deepgram] DEEPGRAM_API_KEY não configurada` → chave ausente
   - `[Deepgram] API erro: StatusCode=401` → chave inválida ou expirada
   - `[Deepgram] Nenhuma fala detectada` → áudio sem voz ou muito curto
   - `[Deepgram] Resposta sem texto útil` → Deepgram retornou vazio

3. **Modelo**
   - Padrão: `nova-2` (estável). Se falhar, tente `nova-3` ou `base`.
   - `DEEPGRAM_MODEL=nova-2` ou `Deepgram__Model=nova-2`

4. **Formato do áudio**
   - Aceitos: m4a, webm, mp3, wav
   - Chunks muito pequenos (< 500 bytes) são ignorados no frontend

## Teste isolado

1. Backend em Development: `ASPNETCORE_ENVIRONMENT=Development`
2. App → Perfil médico → "Testar transcrição IA"
3. Grava 8s falando claramente
4. Verifique os logs do backend

## Gerar chave Deepgram

1. Acesse [deepgram.com](https://deepgram.com)
2. Crie conta / faça login
3. Dashboard → API Keys → Create Key
4. Copie a chave e configure no backend
