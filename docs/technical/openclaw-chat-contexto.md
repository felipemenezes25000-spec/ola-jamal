# Contexto do Chat – OpenClaw (resumo)

## Configuração e uso
- **Gateway**: reinício para aplicar mudanças (modelo Codex)
- **Limites e performance**: aumento de limites e otimização para deixar o OpenClaw mais rápido; depois revertido a pedido

## WhatsApp
- Plugin habilitado
- Config em `openclaw.json` (`dmPolicy: pairing`, `groupPolicy: open`)
- Login via QR code concluído
- Status: conectado

## Remoção do WhatsApp
- Bloco `channels.whatsapp` removido de `openclaw.json`
- Plugin desabilitado
- Credenciais e pasta `credentials/whatsapp` excluídas
- Cache limpo (delivery-queue, browser, logs) e gateway reiniciado
- Plugin WhatsApp desabilitado novamente para eliminar avisos do doctor

## Estado atual
- **Gateway**: rodando
- **WhatsApp**: desabilitado e desconectado
- **Modelo**: OpenRouter + Gemini 3 Pro (fallback: OpenAI Codex 5.3)
- **Config**: sem canais de chat configurados

## Problema de contexto
- Muito contexto carregado no chat
- Objetivo: reduzir para gastar menos tokens

## Gateway e reinícios
- Porta: `18790`
- URL chat: `http://127.0.0.1:18790/chat?session=agent%3Amain%3Amain`
- Dashboard: `openclaw dashboard` (URL com token)
- Erro temporário: "Service is loaded but not running" – gateway estava rodando na porta
- Reinício com `--force` quando necessário

## API Keys
- **OpenAI** (Codex 5.3): várias chaves testadas; erro 401 com chave antiga em cache
- **Solução**: `openclaw secrets reload` + reinício do gateway
- **Modelo principal**: `google/gemini-3-pro-preview` (OpenRouter)
- **Fallback**: `gpt-5.3-codex` (OpenAI)

## Últimas chaves (usadas no chat)
- **OpenRouter** (principal): obter em OpenRouter dashboard
- **OpenAI** (fallback): obter em OpenAI API keys

## Limpeza completa
1. `openclaw gateway stop`
2. `openclaw doctor --fix`
3. Limpar: `delivery-queue/failed`, `browser/.../Cache`, `logs`, transcripts `.jsonl.reset.*`
4. `openclaw sessions cleanup --dry-run`
5. Remover transcripts órfãos e atual
6. Zerar `sessions.json` (novo chat na próxima mensagem)
7. `openclaw secrets reload`
8. `openclaw gateway start`

## Arquivos importantes
- **Config**: `C:\Users\Felipe\.openclaw\openclaw.json`
- **Auth**: `C:\Users\Felipe\.openclaw\auth-profiles.json`
- **Sessões**: `C:\Users\Felipe\.openclaw\agents\main\sessions\`
- **Base**: `C:\Users\Felipe\.openclaw`

## Session context inflado
- `sessions.json` tinha `skillsSnapshot` enorme (~16 skills com descrições completas)
- `injectedWorkspaceFiles`: AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md
- `bootstrapMaxChars`: 20000, `bootstrapTotalMaxChars`: 150000
- `systemPrompt`: ~29k chars (projectContext ~12k, nonProject ~17k)

## Comandos úteis
```powershell
openclaw gateway start
openclaw gateway stop
openclaw gateway --force
openclaw gateway status
openclaw dashboard
openclaw secrets reload
openclaw doctor --fix
openclaw agent --agent main --message "..." --json
openclaw health
```

## Teste de API
- **OpenAI**: `Invoke-RestMethod` em `https://api.openai.com/v1/chat/completions`
- **OpenRouter**: `Invoke-RestMethod` em `https://openrouter.ai/api/v1/chat/completions` com modelo `google/gemini-3-pro-preview`
