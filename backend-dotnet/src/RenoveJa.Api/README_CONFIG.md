# Configuração do backend

O backend usa o arquivo `.env` para credenciais (carregado automaticamente via DotNetEnv).

**Edite `backend-dotnet/src/RenoveJa.Api/.env`** e substitua os placeholders:

1. **Supabase__ServiceKey**  
   Chave **secret** em Supabase → Project Settings → API → Secret keys (formato `sb_secret_...`)

2. **OpenAI__ApiKey**  
   Chave da API em platform.openai.com (formato `sk-proj-...`)

A URL do Supabase já está configurada. Sem as chaves reais, a API pode iniciar, mas login e IA falharão.
