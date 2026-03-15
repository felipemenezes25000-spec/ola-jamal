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

## TAREFAS — Execute na ordem, compile (`dotnet build`) entre cada tarefa

### TAREFA 1: Refatorar RequestService.cs (God Class → serviços menores)

O plano completo está em `docs/REFACTOR_REQUEST_SERVICE.md`.

**Step 1: Extrair RequestHelpers.cs**
Criar `src/RenoveJa.Application/Services/Requests/RequestHelpers.cs` com TODOS os métodos `private static` e campos estáticos do RequestService. Torná-los `internal static`. Incluir:
- ParsePrescriptionType, ParsePrescriptionKind, PrescriptionTypeToDisplay, PrescriptionTypeToRejectionLabel
- GenerateAutoObservation, FormatPatientAddress, PatientNamesMatch, GetSignificantNameWords, RemoveAccents
- GenerateAccessCode, ComputeSha256, GetInitials, GetLast4, MaskCpf
- ExtractIcd10FromAnamnesis, BuildTranscriptTxtContent, GetBrazilNow
- MapVideoRoomToDto, MapRequestToDto (ajustar para receber apiBaseUrl e documentTokenService como parâmetros)
- ToProxyImageUrls (idem)
- ParseMedicationsFromAiJson
- NameConjunctions (HashSet), CancellableStatuses (HashSet)

DEPOIS: remover as definições do RequestService e trocar chamadas para `RequestHelpers.Method()`. Compilar.

**Step 2: Extrair RequestQueryService.cs**
Interface: `IRequestQueryService` em `src/RenoveJa.Application/Interfaces/`
Implementação: `src/RenoveJa.Application/Services/Requests/RequestQueryService.cs`
Métodos:
- GetUserRequestsAsync, GetUserRequestsPagedAsync, GetRequestByIdAsync
- GetPatientRequestsAsync, GetPatientProfileForDoctorAsync, GetDoctorStatsAsync
- GetConsultationAnamnesisIfAnyAsync (privado)

Dependências: requestRepository, userRepository, doctorRepository, consultationAnamnesisRepository, apiConfig, documentTokenService, logger

No RequestService, injetar `IRequestQueryService` e delegar. Registrar em `ServiceCollectionExtensions.cs`. Compilar.

**Step 3: Extrair ConsultationLifecycleService.cs**
Interface: `IConsultationLifecycleService`
Métodos: AcceptConsultationAsync, StartConsultationAsync, ReportCallConnectedAsync, FinishConsultationAsync, AutoFinishConsultationAsync, GetTranscriptDownloadUrlAsync, GetTimeBankBalanceAsync

No RequestService, injetar e delegar. Registrar no DI. Compilar.

**Step 4: Extrair SignatureService.cs**
Interface: `ISignatureService`
Métodos: SignAsync, GetSignedDocumentAsync, GetSignedDocumentByTokenAsync, GetRequestImageAsync, MarkDeliveredAsync, ValidatePrescriptionAsync, GetPrescriptionPdfPreviewAsync, GetExamPdfPreviewAsync

No RequestService, injetar e delegar. Registrar no DI. Compilar.

**Step 5: Limpar RequestService**
O RequestService fica como orquestrador fino com apenas:
- Create*Async (prescription, exam, consultation)
- ApproveAsync, RejectAsync (delegam ao RequestApprovalService)
- AssignToQueueAsync, UpdateStatusAsync, CancelAsync
- UpdateConductAsync, UpdatePrescriptionContentAsync, UpdateExamContentAsync
- Reanalyze*Async
Remover dependências não mais usadas do construtor. Compilar.

---

### TAREFA 2: Quebrar ConsultationAnamnesisService.cs (69KB)

O arquivo `src/RenoveJa.Infrastructure/ConsultationAnamnesis/ConsultationAnamnesisService.cs` tem 69KB.
Analisar e separar em classes menores com responsabilidades claras:
- Separar lógica de transcrição (Whisper) de geração de anamnese (GPT/Gemini)
- Separar lógica de busca de evidências
- Separar prompts/templates de IA em classe dedicada
Compilar após cada extração.

---

### TAREFA 3: Refatorar MedicalRequest.Reconstitute (33 parâmetros → record)

Criar um `MedicalRequestSnapshot` record em `src/RenoveJa.Domain/Entities/` com todas as propriedades.
Substituir o método Reconstitute de 33 parâmetros posicionais por um que aceita o record.
Atualizar o RequestRepository (MapToDomain) para usar o novo record.
Compilar.

---

### TAREFA 4: Melhorar resiliência do AuditMiddleware

Em `src/RenoveJa.Api/Middleware/AuditMiddleware.cs`:
- Substituir `Task.Run(async () => ...)` por `System.Threading.Channels.Channel<T>` com background consumer
- Criar `AuditBackgroundService` (IHostedService) que consome do Channel e persiste no banco com retry
- Registrar no DI em ServiceCollectionExtensions
Compilar.

---

### TAREFA 5: Infraestrutura AWS — SSM e ECS

Gerar um script PowerShell `scripts/aws-cleanup.ps1` que:
1. Copia o valor de `/renoveja/prod/Supabase__DatabaseUrl` para `/renoveja/prod/Database__ConnectionString` no SSM
2. Atualiza a ECS Task Definition para usar o novo nome do parâmetro
3. NÃO deleta o parâmetro antigo (mantém para rollback)

O script deve ser seguro (dry-run por padrão, --apply para executar).

---

### REGRAS GERAIS
1. `IRequestService` NÃO muda a interface — backward compatible
2. Controllers continuam usando `IRequestService`
3. Novos serviços são registrados em `ServiceCollectionExtensions.cs` → `AddApplicationServices()`
4. Rodar `dotnet build` após CADA step/tarefa
5. Se o build falhar, corrigir antes de avançar
6. Fazer commits incrementais com mensagens descritivas após cada tarefa
