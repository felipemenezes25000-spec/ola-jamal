# Variáveis de Ambiente e Diagnóstico de Problemas

Este documento descreve as variáveis de ambiente necessárias para o backend e as causas prováveis dos problemas reportados.

---

## 1. Variáveis de Ambiente Necessárias

### Backend (.NET)

| Variável (PowerShell) | appsettings.json equivalente | Uso | Obrigatória para |
|----------------------|------------------------------|-----|------------------|
| `Supabase__Url` | `Supabase:Url` | URL do projeto Supabase (ex: `https://xxx.supabase.co`) | DB, Storage, Auth |
| `Supabase__ServiceKey` | `Supabase:ServiceKey` | Chave **secret** (formato `sb_secret_...` ou JWT `eyJ...`). **Não** usar `sb_publishable_` ou `sb_anon_` | DB, Storage, Auth |
| `OpenAI__ApiKey` | `OpenAI:ApiKey` | Chave da API OpenAI (formato `sk-proj-...`) | Análise de receitas e exames por IA |
| `Verification__BaseUrl` | `Verification:BaseUrl` | URL base para verificação (QR Code, ITI). Ex: `https://sua-api.com/api/verify` | Integração validar.iti.gov.br |
| `ASPNETCORE_ENVIRONMENT` | - | `Development` para mais logs e CORS aberto | Ambiente |

### Formato da Supabase:ServiceKey

O backend valida a chave em `SupabaseClient.EnsureServiceRoleKey()`:

- **Válido**: `sb_secret_...` (formato novo) ou JWT começando com `eyJ` (service_role legado)
- **Inválido**: vazio, `SUA_SERVICE_KEY_SUPABASE`, `sb_publishable_...`, `sb_anon_...`

Onde obter: Supabase → Project Settings → API → Secret keys → `service_role` (ou "secret").

### Formato da OpenAI:ApiKey

- **Válido**: chave real da OpenAI (ex: `sk-proj-...` ou `sk-...`)
- **Inválido**: vazio, `sk-proj-SUA_CHAVE_OPENAI`, chave expirada

Onde obter: [platform.openai.com](https://platform.openai.com) → API keys → Create new secret key.

---

## 2. Configuração Recomendada

### Opção A: `appsettings.Development.json` (recomendado para desenvolvimento local)

1. Copie o arquivo de exemplo (PowerShell, dentro da pasta `RenoveJa.Api`):
   ```powershell
   Copy-Item appsettings.Development.json.example appsettings.Development.json
   ```

2. Edite `appsettings.Development.json` e substitua os placeholders pelas chaves reais.

**Importante**: O `appsettings.Development.json` não existe no projeto atualmente (e está no `.gitignore`). Sem ele, o `appsettings.json` com placeholders é usado, o que causa os erros descritos abaixo.

### Opção B: Variáveis de ambiente (não commitar chaves)

```powershell
# Windows PowerShell - antes de rodar dotnet run
$env:Supabase__Url = "https://SEU_PROJETO.supabase.co"
$env:Supabase__ServiceKey = "sb_secret_SUA_CHAVE"
$env:OpenAI__ApiKey = "sk-proj-SUA_CHAVE_OPENAI"
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run
```

---

## 3. Diagnóstico dos Problemas Reportados

### Problema 1: Expo salva dados no banco, mas IA não funciona

**Possíveis causas:**

| Causa | Verificação | Solução |
|-------|-------------|---------|
| `OpenAI:ApiKey` ausente ou placeholder | Log: `IA receita: OpenAI:ApiKey não configurada` | Definir `OpenAI__ApiKey` ou em `appsettings.Development.json` |
| `OpenAI:ApiKey` inválida ou expirada | Log: `OpenAI API error: StatusCode=401` | Gerar nova chave em platform.openai.com |
| Imagens não chegando à IA | Log: `IA: URL #N retornou vazio, usando URL direta` ou falha ao baixar | Verificar bucket Supabase e permissões; URLs devem ser acessíveis pelo backend |
| Rate limit OpenAI (429) | Log: `OpenAI API error: StatusCode=429` | Aguardar ou verificar limites na conta OpenAI |

**Resumo:** Se o Expo salva dados, o **Supabase** está configurado. O problema é quase sempre a **OpenAI:ApiKey** ausente ou inválida.

---

### Problema 2: Swagger retorna 400 e não salva dados

**Possíveis causas:**

| Causa | Verificação | Solução |
|-------|-------------|---------|
| `Supabase:ServiceKey` com formato inválido | Log: `Supabase:ServiceKey deve ser uma chave 'secret' (formato sb_secret_...)` | Usar chave real em formato `sb_secret_...` ou JWT `eyJ...` |
| Swagger envia `Authorization: Bearer` em todas as requisições | Se você clicou em **Authorize** e colocou um token, Swagger envia em **todos** os endpoints, incluindo login | Ao testar login, **limpar** o token: Authorize → Logout ou deixar vazio |
| Placeholder no appsettings.json | `appsettings.json` tem `"ServiceKey": "SUA_SERVICE_KEY_SUPABASE"` | Criar `appsettings.Development.json` com chave real ou usar variáveis de ambiente |
| Ausência de `appsettings.Development.json` | O arquivo não existe no projeto | Criar o arquivo com as chaves reais (nunca commitar) |

**Resumo:** O Swagger dispara o middleware de autenticação quando envia `Authorization`. Se a `Supabase:ServiceKey` estiver inválida, o `SupabaseClient` lança exceção ao ser instanciado e a API retorna 400.

---

## 4. Fluxo Resumido

```
Expo (celular)                    Backend
     |                               |
     |-- POST /api/requests/prescription (multipart) -->
     |                               |
     |                    [Auth: token válido ou ausente]
     |                    [Storage: upload imagens Supabase]
     |                    [DB: SupabaseClient/repositories]
     |                    [IA: OpenAiReadingService → OpenAI API]
     |                               |
     |<-- 200 + dados -------------|
```

- **Supabase** (Url + ServiceKey): necessário para Auth, Storage e DB.
- **OpenAI** (ApiKey): necessário apenas para análise de receitas/exames por IA.

---

## 5. Checklist de Verificação

- [ ] `appsettings.Development.json` existe e contém `Supabase:Url`, `Supabase:ServiceKey` e `OpenAI:ApiKey` reais
- [ ] `Supabase:ServiceKey` começa com `sb_secret_` ou `eyJ`
- [ ] `OpenAI:ApiKey` é uma chave real (não placeholder)
- [ ] `ASPNETCORE_ENVIRONMENT=Development` ao rodar o backend
- [ ] No Swagger: ao testar login, **não** ter token em Authorize
- [ ] Frontend `.env` com `EXPO_PUBLIC_API_URL` apontando para o IP correto (ex: `http://192.168.15.69:5000`)

---

## 6. Arquivos de Configuração Atuais

| Arquivo | Status | Conteúdo |
|---------|--------|----------|
| `appsettings.json` | Existe | Placeholders: `SUA_SERVICE_KEY_SUPABASE`, `sk-proj-SUA_CHAVE_OPENAI` |
| `appsettings.Development.json` | **Não existe** | Deveria conter chaves reais para dev |
| Frontend `.env` | Existe | `EXPO_PUBLIC_API_URL=http://192.168.15.69:5000` |
