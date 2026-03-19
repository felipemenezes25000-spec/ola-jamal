# Plano de Refatoração — RequestService (2.900 linhas → 5-6 serviços)

## Status: PARCIAL — fase 1 entregue (`RequestHelpers`, `RequestQueryService`, `ConsultationLifecycleService`, `SignatureService`). As seções 1–6 abaixo (**PrescriptionWorkflowService**, **ExamWorkflowService**, etc.) são **ainda não implementadas** — roadmap para reduzir `RequestService` além da fase 1. Ver [../CLAUDE.md](../CLAUDE.md) para o quadro atualizado.

## Problema
`RequestService.cs` tem ~2.900 linhas e 61 dependências injetadas no construtor.
É uma God Class que concentra 7 responsabilidades distintas.

## Plano de Separação

### 1. `PrescriptionWorkflowService` (novo)
**Métodos a extrair:**
- `CreatePrescriptionAsync`
- `UpdatePrescriptionContentAsync`
- `ValidatePrescriptionAsync`
- `GetPrescriptionPdfPreviewAsync`
- `ReanalyzePrescriptionAsync`
- `RunPrescriptionAiAndUpdateAsync` (privado)
- `EnforcePrescriptionCooldownAsync` (privado)
- `BuildControlledDuplicateWarningAsync` (privado)

**Dependências:** requestRepository, userRepository, productPriceRepository, aiReadingService, aiPrescriptionGenerator, prescriptionPdfService, storageService, pushDispatcher, requestEventsPublisher, newRequestBatchService, logger

### 2. `ExamWorkflowService` (novo)
**Métodos a extrair:**
- `CreateExamAsync`
- `UpdateExamContentAsync`
- `GetExamPdfPreviewAsync`
- `ReanalyzeExamAsync`
- `RunExamAiAndUpdateAsync` (privado)
- `EnforceExamCooldownAsync` (privado)

**Dependências:** requestRepository, userRepository, productPriceRepository, aiReadingService, prescriptionPdfService, storageService, pushDispatcher, requestEventsPublisher, newRequestBatchService, logger

### 3. `ConsultationWorkflowService` (novo)
**Métodos a extrair:**
- `CreateConsultationAsync`
- `AcceptConsultationAsync`
- `StartConsultationAsync`
- `ReportCallConnectedAsync`
- `FinishConsultationAsync`
- `AutoFinishConsultationAsync`
- `GetTranscriptDownloadUrlAsync`
- `GetTimeBankBalanceAsync`

**Dependências:** requestRepository, userRepository, doctorRepository, videoRoomRepository, consultationAnamnesisRepository, consultationSessionStore, consultationTimeBankRepository, consultationEncounterService, storageService, pushDispatcher, requestEventsPublisher, logger

### 4. `SignatureService` (novo)
**Métodos a extrair:**
- `SignAsync`
- `GetSignedDocumentAsync`
- `GetSignedDocumentByTokenAsync`
- `GetRequestImageAsync`
- `MarkDeliveredAsync`

**Dependências:** requestRepository, digitalCertificateService, prescriptionPdfService, prescriptionVerifyRepository, storageService, documentTokenService, httpClientFactory, apiConfig, signedRequestClinicalSync, pushDispatcher, requestEventsPublisher, logger

### 5. `RequestQueryService` (novo)
**Métodos a extrair:**
- `GetUserRequestsAsync`
- `GetUserRequestsPagedAsync`
- `GetRequestByIdAsync`
- `GetPatientRequestsAsync`
- `GetPatientProfileForDoctorAsync`
- `GetDoctorStatsAsync`

**Dependências:** requestRepository, userRepository, doctorRepository, consultationAnamnesisRepository, logger

### 6. `RequestService` (mantido — orquestrador fino)
**Métodos que ficam:**
- `ApproveAsync` (delega ao RequestApprovalService)
- `RejectAsync` (delega ao RequestApprovalService)
- `AssignToQueueAsync`
- `UpdateStatusAsync`
- `CancelAsync`
- `ReanalyzeAsDoctorAsync`
- `UpdateConductAsync`

**Dependências reduzidas:** requestRepository, userRepository, doctorRepository, requestApprovalService, aiReadingService, aiConductSuggestionService, pushDispatcher, requestEventsPublisher, logger

### 7. `RequestHelpers` (static class)
**Métodos utilitários estáticos a extrair:**
- `ParsePrescriptionType`, `ParsePrescriptionKind`
- `GenerateAutoObservation`
- `FormatPatientAddress`
- `PrescriptionTypeToDisplay`, `PrescriptionTypeToRejectionLabel`
- `PatientNamesMatch`, `GetSignificantNameWords`, `RemoveAccents`
- `GenerateAccessCode`, `ComputeSha256`
- `GetInitials`, `GetLast4`
- `MaskCpf`
- `ExtractIcd10FromAnamnesis`
- `BuildTranscriptTxtContent`
- `GetBrazilNow`
- `MapRequestToDto`

## Interface
`IRequestService` será mantida como está (backward compatible).
Os novos serviços terão suas próprias interfaces.
`RequestService` delegará aos novos serviços internamente.

## Estratégia de Migração
1. Criar os novos serviços com os métodos extraídos
2. `RequestService` passa a delegar para os novos serviços
3. Controllers continuam usando `IRequestService` (zero mudança nos controllers)
4. Gradualmente, controllers podem usar os novos serviços diretamente
5. Quando nenhum controller usar `IRequestService` diretamente, removê-lo

## Riscos
- Métodos privados compartilhados entre responsabilidades (ex: `MapRequestToDto`, `NotifyAvailableDoctorsOfNewRequestAsync`)
- Transações implícitas que cruzam serviços
- Testes unitários existentes que mocam `IRequestService`

## Estimativa
- ~4-6 horas de trabalho
- ~15 arquivos novos + ~10 arquivos modificados
