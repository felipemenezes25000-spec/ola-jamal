# CLAUDE.md — Backend .NET 8 (RenoveJá+)

## Build & Test
```bash
cd backend-dotnet
dotnet build
dotnet test
```

## Arquitetura
Clean Architecture: Api → Application → Domain ← Infrastructure
- Banco: PostgreSQL via AWS RDS (Npgsql/Dapper em `PostgresClient`)
- Storage: AWS S3 (`S3StorageService`)
- Namespace do data layer: `RenoveJa.Infrastructure.Data.Postgres`

## PERMISSÕES
Aceite TODAS as edições automaticamente sem pedir confirmação. Use shift+tab ou "allow all" quando disponível.

---

## Dívida técnica — status (sincronizado com o código)

O plano abaixo foi escrito quando parte do backend ainda estava concentrada em poucos arquivos. **Muito disso já foi implementado**; use esta seção para não tratar como “tudo pendente” o que já existe no repositório.

### Já entregue no repositório

| Tema | Onde ver no código |
|------|---------------------|
| **RequestService “god class” — fase 1** | `RequestHelpers.cs`; `RequestQueryService` + `IRequestQueryService`; `ConsultationLifecycleService` + `IConsultationLifecycleService`; `SignatureService` + `ISignatureService`; `RequestService` injeta e delega (orquestrador). Registro em `ServiceCollectionExtensions.cs`. |
| **MedicalRequest.Reconstitute (muitos parâmetros)** | `MedicalRequestSnapshot` (`Domain/Entities/MedicalRequestSnapshot.cs`); `MedicalRequest.Reconstitute(MedicalRequestSnapshot)`; `RequestRepository` monta o snapshot em `MapToDomain`. |
| **AuditMiddleware sem fire-and-forget frágil** | `AuditMiddleware` grava em `AuditChannel`; `AuditBackgroundService` (`Api/Services/AuditBackgroundService.cs`) consome a fila; registro: `AddSingleton<AuditChannel>()` + `AddHostedService<AuditBackgroundService>()`. |
| **ConsultationAnamnesis — HTTP vs. domínio** | Orquestrador enxuto (`ConsultationAnamnesisService`); chamada LLM + fallback em `ConsultationAnamnesisLlmClient`; pós-processamento do JSON em `ConsultationAnamnesisResultComposer`; transcript/prompts em `TranscriptPreprocessor` / `AnamnesisPrompts` (incl. `BuildUserContentForAnamnesisV2`). |

### Ainda faz sentido investir

| Tema | Notas |
|------|--------|
| **Evidências literárias (RAG)** | `ExtractSearchTerms` / `BuildClinicalContextForPrompt` estão em `AnamnesisResponseParser.Evidence.cs`; integração com fonte externa (se houver) pode virar serviço dedicado depois. |
| **RequestService — roadmap ampliado** | [docs/REFACTOR_REQUEST_SERVICE.md](docs/REFACTOR_REQUEST_SERVICE.md) descreve extrações adicionais (ex.: workflows por tipo de pedido). É **complementar** à fase já feita (helpers/query/lifecycle/signature). |
| **Script AWS SSM** | Plano antigo citava `scripts/aws-cleanup.ps1` (dry-run / --apply) — **não está versionado**; criar quando houver necessidade operacional. |

### Regras gerais (mantidas)

1. `IRequestService` não deve ser quebrado sem migração coordenada com controllers.
2. Novos serviços de aplicação: registrar em `ServiceCollectionExtensions.cs` → `AddApplicationServices()`.
3. Após mudanças estruturais: `dotnet build` e `dotnet test`.

---

## Plano histórico (referência — roteiro original)

As tarefas numeradas abaixo foram o **roteiro passo a passo** usado na época; **vários steps já foram aplicados** (ver tabela acima). Mantido para auditoria e para quem for continuar extrações.

### TAREFA 1: Refatorar RequestService.cs (God Class → serviços menores)

Detalhe e diagrama ampliado: [docs/REFACTOR_REQUEST_SERVICE.md](docs/REFACTOR_REQUEST_SERVICE.md).

**Step 1: Extrair RequestHelpers.cs** — feito (`Services/Requests/RequestHelpers.cs`).

**Step 2: Extrair RequestQueryService.cs** — feito (`IRequestQueryService`, `RequestQueryService`).

**Step 3: Extrair ConsultationLifecycleService.cs** — feito (`IConsultationLifecycleService`, `ConsultationLifecycleService`).

**Step 4: Extrair SignatureService.cs** — feito (`ISignatureService`, `SignatureService`).

**Step 5: Limpar RequestService** — em evolução contínua; `RequestService` já delega boa parte; ver doc ampliado para próximas extrações.

---

### TAREFA 2: Quebrar ConsultationAnamnesisService.cs (arquivo grande)

**Parcialmente aplicado:** o orquestrador `ConsultationAnamnesisService` ficou fino; HTTP/fallback em `ConsultationAnamnesisLlmClient`; mensagem de usuário em `AnamnesisPrompts.BuildUserContentForAnamnesisV2`; pós-processamento do JSON em `ConsultationAnamnesisResultComposer`. Evidências (literatura) e parsers grandes continuam em `AnamnesisResponseParser` — evoluir conforme necessidade.

---

### TAREFA 3: Refatorar MedicalRequest.Reconstitute (33 parâmetros → record)

**Feito:** `MedicalRequestSnapshot` + overload `Reconstitute(MedicalRequestSnapshot)` + uso no `RequestRepository`. O overload legado com muitos parâmetros pode permanecer para testes/código histórico.

---

### TAREFA 4: Melhorar resiliência do AuditMiddleware

**Feito:** canal + `AuditBackgroundService` (ver seção “Já entregue”).

---

### TAREFA 5: Infraestrutura AWS — SSM e ECS

Script PowerShell `scripts/aws-cleanup.ps1` — **não versionado**; implementar quando necessário (dry-run por padrão, `--apply` para executar).
