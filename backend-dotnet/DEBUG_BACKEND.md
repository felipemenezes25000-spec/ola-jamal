# Rodar o Backend em Modo Debug

Este guia explica como executar o backend .NET em modo debug para investigar erros e entender melhor o fluxo da aplicação, incluindo a análise de receitas por IA.

---

## 1. Via Terminal (dotnet run)

### Execução normal
```powershell
cd c:\Users\renat\Downloads\testes-main\backend-dotnet\src\RenoveJa.Api
dotnet run
```

### Execução em modo Development (mais logs)
```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run
```

### Logs detalhados no console
O Serilog já está configurado para:
- Console: logs em tempo real
- Arquivo: `logs/log-YYYYMMDD.txt` (rotação diária)

Para mais detalhes (incluindo Debug), ajuste em `appsettings.Development.json`:
```json
"Logging": {
  "LogLevel": {
    "Default": "Debug",
    "Microsoft.AspNetCore": "Information"
  }
}
```

---

## 2. Via Visual Studio (ou Rider)

1. Abra a solução `backend-dotnet` no Visual Studio
2. Defina `RenoveJa.Api` como projeto de inicialização (clique direito → *Set as Startup Project*)
3. Pressione **F5** ou clique em **Start Debugging** (▶)
4. Para definir breakpoints: clique na margem esquerda da linha desejada

### Pontos importantes para breakpoints (análise IA)
- `RequestService.RunPrescriptionAiAndUpdateAsync` – início da análise de receita
- `OpenAiReadingService.AnalyzePrescriptionAsync` – chamada à OpenAI
- `OpenAiReadingService.CallChatAsync` – request/response HTTP
- `OpenAiReadingService.ResolveImageContentsAsync` – download de imagens do storage

---

## 3. Via VS Code (Cursor)

### Criar configuração de debug

1. Crie `.vscode/launch.json` na raiz do projeto (ou edite o existente):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend .NET (Debug)",
      "type": "coreclr",
      "request": "launch",
      "preLaunchTask": "build",
      "program": "${workspaceFolder}/backend-dotnet/src/RenoveJa.Api/bin/Debug/net8.0/RenoveJa.Api.dll",
      "args": [],
      "cwd": "${workspaceFolder}/backend-dotnet/src/RenoveJa.Api",
      "stopAtEntry": false,
      "env": {
        "ASPNETCORE_ENVIRONMENT": "Development"
      },
      "console": "integratedTerminal"
    },
    {
      "name": "Backend .NET (Attach)",
      "type": "coreclr",
      "request": "attach"
    }
  ]
}
```

2. Crie `.vscode/tasks.json` para build automático:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build",
      "command": "dotnet",
      "type": "process",
      "args": [
        "build",
        "${workspaceFolder}/backend-dotnet/src/RenoveJa.Api/RenoveJa.Api.csproj",
        "/property:GenerateFullPaths=true",
        "/consoleloggerparameters:NoSummary"
      ],
      "problemMatcher": "$msCompile",
      "group": "build"
    }
  ]
}
```

3. Instale a extensão **C# Dev Kit** ou **C#** (Microsoft) no VS Code
4. Pressione **F5** ou vá em Run and Debug (Ctrl+Shift+D) e escolha "Backend .NET (Debug)"

---

## 4. Logs da Análise de IA

Com as alterações recentes, os logs incluem:

| Evento | Mensagem de exemplo |
|--------|----------------------|
| Início da análise de receita | `IA receita: iniciando análise para request {RequestId} com {ImageCount} imagem(ns)` |
| API key ausente | `IA receita: OpenAI:ApiKey não configurada` |
| Falha no download de imagem | `IA: falha ao baixar URL #{Index}, usando URL direta` |
| Erro da OpenAI | `OpenAI API error: StatusCode=401, Response=...` |
| Parse JSON falhou | `IA: parse JSON falhou. Raw (primeiros 500 chars): ...` |
| Análise concluída | `IA receita: análise concluída para request {RequestId}` |
| Análise falhou | `IA receita: análise falhou para request {RequestId}. Mensagem: ...` |

### Onde ver os logs
- **Console**: saída direta ao rodar `dotnet run` ou F5
- **Arquivo**: `backend-dotnet/src/RenoveJa.Api/logs/log-YYYYMMDD.txt`
- **Debugger**: inspecione variáveis e stack trace nos breakpoints

---

## 5. Erros Comuns na Análise de IA

| Sintoma | Causa provável | O que fazer |
|---------|----------------|-------------|
| "[Análise por IA indisponível no momento.]" | API key inválida ou expirada | Verifique `OpenAI:ApiKey` em appsettings.json ou variável `OpenAI__ApiKey` |
| 401 Unauthorized | Chave incorreta ou revogada | Gere nova chave em platform.openai.com |
| 429 Rate Limit | Muitas requisições | Aguarde ou aumente limite na OpenAI |
| Imagens retornam vazias | Storage privado inacessível | O serviço tenta usar URL direta; verifique CORS e permissões no Supabase |
| Parse JSON falhou | Resposta da IA fora do formato esperado | Log mostra o JSON recebido; pode ser imagem ilegível ou modelo diferente |

---

## 6. Variáveis de Ambiente (opcional)

Para não deixar chaves no appsettings:

```powershell
# Windows PowerShell
$env:OpenAI__ApiKey = "sk-proj-..."
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run
```

```powershell
# Linux/macOS
export OpenAI__ApiKey="sk-proj-..."
export ASPNETCORE_ENVIRONMENT=Development
dotnet run
```
