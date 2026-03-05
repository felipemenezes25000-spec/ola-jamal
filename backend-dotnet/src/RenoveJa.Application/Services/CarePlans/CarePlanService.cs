using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.DTOs.CarePlans;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.CarePlans;

public class CarePlanService(
    IAiSuggestionRepository aiSuggestionRepository,
    ICarePlanRepository carePlanRepository,
    ICarePlanTaskRepository carePlanTaskRepository,
    IOutboxEventRepository outboxEventRepository,
    IRequestRepository requestRepository,
    INotificationRepository notificationRepository,
    IPushNotificationSender pushNotificationSender,
    IStorageService storageService,
    ILogger<CarePlanService> logger) : ICarePlanService
{
    public async Task<AiSuggestionResponseDto> CreateAiSuggestionAsync(
        Guid consultationId,
        CreateAiSuggestionRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var payloadHash = ComputeHash(request.PayloadJson);
        var existing = await aiSuggestionRepository.GetByIdempotencyAsync(
            consultationId,
            request.DoctorId,
            payloadHash,
            cancellationToken);
        if (existing != null)
            return MapAiSuggestion(existing);

        var suggestion = AiSuggestion.Create(
            consultationId,
            request.PatientId,
            request.DoctorId,
            request.Model,
            request.PayloadJson,
            payloadHash,
            request.CorrelationId);

        var created = await aiSuggestionRepository.CreateAsync(suggestion, cancellationToken);
        return MapAiSuggestion(created);
    }

    public async Task<List<AiSuggestionResponseDto>> GetAiSuggestionsAsync(
        Guid consultationId,
        IReadOnlyCollection<string>? statuses,
        Guid requesterUserId,
        CancellationToken cancellationToken = default)
    {
        var medicalRequest = await requestRepository.GetByIdAsync(consultationId, cancellationToken)
            ?? throw new KeyNotFoundException("Consulta não encontrada");

        if (medicalRequest.PatientId != requesterUserId && medicalRequest.DoctorId != requesterUserId)
            throw new UnauthorizedAccessException("Sem acesso a esta consulta");

        var suggestions = await aiSuggestionRepository.GetByConsultationAsync(consultationId, statuses, cancellationToken);
        return suggestions.Select(MapAiSuggestion).ToList();
    }

    public async Task<CarePlanResponseDto> CreateCarePlanFromSuggestionAsync(
        Guid consultationId,
        Guid doctorId,
        CreateCarePlanFromSuggestionRequestDto request,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "Creating care plan from suggestion: consultation={ConsultationId}, doctor={DoctorId}, suggestion={SuggestionId}",
            consultationId, doctorId, request.AiSuggestionId);

        if (request.ResponsibleDoctorId != doctorId)
            throw new UnauthorizedAccessException("Somente o médico autenticado pode ser responsável");
        if (request.AcceptedExams == null || request.AcceptedExams.Count == 0)
            throw new InvalidOperationException("É necessário aprovar ao menos um exame");

        var medicalRequest = await requestRepository.GetByIdAsync(consultationId, cancellationToken)
            ?? throw new KeyNotFoundException("Consulta não encontrada");
        if (medicalRequest.DoctorId != doctorId)
            throw new UnauthorizedAccessException("Apenas o médico da consulta pode criar care plan");

        var suggestion = await aiSuggestionRepository.GetByIdAsync(request.AiSuggestionId, cancellationToken)
            ?? throw new KeyNotFoundException("Sugestão IA não encontrada");

        if (suggestion.ConsultationId != consultationId)
            throw new InvalidOperationException("Sugestão não pertence a esta consulta");
        if (suggestion.Status is AiSuggestionStatus.Approved or AiSuggestionStatus.Rejected or AiSuggestionStatus.Superseded)
            throw new InvalidOperationException("Sugestão já foi finalizada");

        var activePlan = await carePlanRepository.GetActiveByConsultationIdAsync(consultationId, cancellationToken);
        if (activePlan != null)
        {
            // Mitigação de duplicidade: retorna plano existente em vez de criar novo.
            return await BuildCarePlanResponseAsync(activePlan, cancellationToken);
        }

        var payloadHash = ComputeHash(JsonSerializer.Serialize(new
        {
            request.AiSuggestionId,
            request.ResponsibleDoctorId,
            request.AcceptedExams,
            request.InPersonRecommendation
        }));
        var createIdempotencyKey = $"careplan:create:{consultationId}:{doctorId}:{payloadHash}";
        if (await outboxEventRepository.ExistsByIdempotencyKeyAsync(createIdempotencyKey, cancellationToken))
        {
            var existingPlan = await carePlanRepository.GetActiveByConsultationIdAsync(consultationId, cancellationToken);
            if (existingPlan != null)
                return await BuildCarePlanResponseAsync(existingPlan, cancellationToken);
            throw new InvalidOperationException("Conflito de idempotência ao criar care plan");
        }

        var carePlan = CarePlan.Create(
            consultationId,
            medicalRequest.PatientId,
            doctorId,
            suggestion.Id,
            request.CorrelationId);

        carePlan = await carePlanRepository.CreateAsync(carePlan, cancellationToken);
        await outboxEventRepository.CreatePendingAsync(
            "care_plan",
            carePlan.Id,
            "CarePlanCreated",
            JsonSerializer.Serialize(new { carePlanId = carePlan.Id, consultationId, patientId = carePlan.PatientId }),
            createIdempotencyKey,
            cancellationToken);

        if (request.CreateTasks)
        {
            var examTaskPayload = JsonSerializer.Serialize(new
            {
                exams = request.AcceptedExams.Select(x => new
                {
                    name = x.Name,
                    priority = x.Priority,
                    instructions = x.Instructions,
                    notes = x.Notes
                })
            });

            await carePlanTaskRepository.CreateAsync(
                CarePlanTask.Create(
                    carePlan.Id,
                    doctorId,
                    CarePlanTaskType.ExamOrder,
                    "Solicitar exames aprovados",
                    "Exames aprovados pelo médico durante a consulta.",
                    examTaskPayload),
                cancellationToken);

            await carePlanTaskRepository.CreateAsync(
                CarePlanTask.Create(
                    carePlan.Id,
                    doctorId,
                    CarePlanTaskType.UploadResult,
                    "Enviar resultados dos exames",
                    "Após realizar os exames, envie os arquivos nesta tarefa.",
                    examTaskPayload),
                cancellationToken);

            if (request.InPersonRecommendation?.Confirmed == true)
            {
                var inPersonPayload = JsonSerializer.Serialize(request.InPersonRecommendation);
                await carePlanTaskRepository.CreateAsync(
                    CarePlanTask.Create(
                        carePlan.Id,
                        doctorId,
                        CarePlanTaskType.InPersonGuidance,
                        "Atendimento presencial recomendado",
                        request.InPersonRecommendation.Message ?? "Siga a recomendação médica presencial.",
                        inPersonPayload),
                    cancellationToken);
            }
        }

        suggestion.MarkApproved();
        await aiSuggestionRepository.UpdateAsync(suggestion, cancellationToken);

        var pushIdempotencyKey = $"push:careplan_created:{carePlan.Id}";
        if (!await outboxEventRepository.ExistsByIdempotencyKeyAsync(pushIdempotencyKey, cancellationToken))
        {
            var outboxId = await outboxEventRepository.CreatePendingAsync(
                "care_plan",
                carePlan.Id,
                "PatientNotifiedCarePlan",
                JsonSerializer.Serialize(new { carePlanId = carePlan.Id, patientId = carePlan.PatientId }),
                pushIdempotencyKey,
                cancellationToken);

            var deepLink = $"renoveja://care-plans/{carePlan.Id}";
            await notificationRepository.CreateAsync(
                Notification.Create(
                    carePlan.PatientId,
                    "Plano da consulta disponível",
                    "Seu médico criou um plano com próximos passos. Toque para abrir.",
                    NotificationType.Info,
                    new Dictionary<string, object?>
                    {
                        ["carePlanId"] = carePlan.Id.ToString(),
                        ["deepLink"] = deepLink
                    }),
                cancellationToken);

            await pushNotificationSender.SendAsync(
                carePlan.PatientId,
                "Plano da consulta disponível",
                "Seu médico criou um plano com próximos passos.",
                new Dictionary<string, object?> { ["carePlanId"] = carePlan.Id.ToString(), ["deepLink"] = deepLink },
                cancellationToken);

            await outboxEventRepository.MarkProcessedAsync(outboxId, cancellationToken);
        }

        carePlan.MarkWaitingPatient();
        carePlan = await carePlanRepository.UpdateAsync(carePlan, cancellationToken);

        return await BuildCarePlanResponseAsync(carePlan, cancellationToken);
    }

    public async Task<CarePlanResponseDto> GetCarePlanByIdAsync(
        Guid carePlanId,
        Guid requesterUserId,
        CancellationToken cancellationToken = default)
    {
        var carePlan = await carePlanRepository.GetByIdAsync(carePlanId, cancellationToken)
            ?? throw new KeyNotFoundException("Care plan não encontrado");

        if (carePlan.PatientId != requesterUserId && carePlan.ResponsibleDoctorId != requesterUserId)
            throw new UnauthorizedAccessException("Sem acesso a este care plan");

        return await BuildCarePlanResponseAsync(carePlan, cancellationToken);
    }

    public async Task<CarePlanResponseDto> ExecuteTaskActionAsync(
        Guid carePlanId,
        Guid taskId,
        Guid requesterUserId,
        string role,
        CarePlanTaskActionRequestDto request,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "Care plan task action: carePlan={CarePlanId}, task={TaskId}, user={UserId}, action={Action}",
            carePlanId, taskId, requesterUserId, request.Action);

        var carePlan = await carePlanRepository.GetByIdAsync(carePlanId, cancellationToken)
            ?? throw new KeyNotFoundException("Care plan não encontrado");
        var task = await carePlanTaskRepository.GetByIdAsync(taskId, cancellationToken)
            ?? throw new KeyNotFoundException("Tarefa não encontrada");

        if (task.CarePlanId != carePlanId)
            throw new InvalidOperationException("Task não pertence ao care plan");

        var normalizedAction = (request.Action ?? string.Empty).Trim().ToLowerInvariant();
        var isPatient = string.Equals(role, "patient", StringComparison.OrdinalIgnoreCase);
        var isDoctor = string.Equals(role, "doctor", StringComparison.OrdinalIgnoreCase);

        if (normalizedAction is "start" or "complete" or "submit_results" or "add_file")
        {
            if (!isPatient || carePlan.PatientId != requesterUserId)
                throw new UnauthorizedAccessException("Apenas o paciente dono pode executar esta ação");
        }

        if (normalizedAction == "start")
        {
            task.Start();
            carePlan.MarkWaitingResults();
        }
        else if (normalizedAction == "complete")
        {
            task.CompleteByPatient();
            carePlan.MarkWaitingResults();
        }
        else if (normalizedAction == "submit_results")
        {
            task.Submit();
            carePlan.MarkReadyForReview();

            var reviewPushKey = $"push:careplan_ready_for_review:{carePlan.Id}";
            if (!await outboxEventRepository.ExistsByIdempotencyKeyAsync(reviewPushKey, cancellationToken))
            {
                var outboxId = await outboxEventRepository.CreatePendingAsync(
                    "care_plan",
                    carePlan.Id,
                    "CarePlanReadyForDoctorReview",
                    JsonSerializer.Serialize(new { carePlanId = carePlan.Id, doctorId = carePlan.ResponsibleDoctorId }),
                    reviewPushKey,
                    cancellationToken);

                await notificationRepository.CreateAsync(
                    Notification.Create(
                        carePlan.ResponsibleDoctorId,
                        "Resultados enviados pelo paciente",
                        "Um plano de cuidados está pronto para revisão médica.",
                        NotificationType.Info,
                        new Dictionary<string, object?> { ["carePlanId"] = carePlan.Id.ToString() }),
                    cancellationToken);

                await pushNotificationSender.SendAsync(
                    carePlan.ResponsibleDoctorId,
                    "Resultados enviados pelo paciente",
                    "Um plano de cuidados está pronto para revisão.",
                    new Dictionary<string, object?> { ["carePlanId"] = carePlan.Id.ToString() },
                    cancellationToken);

                await outboxEventRepository.MarkProcessedAsync(outboxId, cancellationToken);
            }
        }
        else if (normalizedAction == "add_file")
        {
            if (string.IsNullOrWhiteSpace(request.ExistingFileUrl) || string.IsNullOrWhiteSpace(request.ExistingStoragePath))
                throw new InvalidOperationException("Para add_file informe ExistingFileUrl e ExistingStoragePath");

            await carePlanTaskRepository.CreateFileAsync(
                CarePlanTaskFile.Create(
                    taskId,
                    request.ExistingStoragePath,
                    request.ExistingFileUrl,
                    request.ExistingFileContentType ?? "application/octet-stream",
                    requesterUserId),
                cancellationToken);

            task.Start();
            carePlan.MarkWaitingResults();
        }
        else
        {
            throw new InvalidOperationException("Ação inválida");
        }

        await carePlanTaskRepository.UpdateAsync(task, cancellationToken);
        await carePlanRepository.UpdateAsync(carePlan, cancellationToken);

        return await BuildCarePlanResponseAsync(carePlan, cancellationToken);
    }

    public async Task<CarePlanTaskFileResponseDto> UploadTaskFileAsync(
        Guid carePlanId,
        Guid taskId,
        Guid requesterUserId,
        string fileName,
        string contentType,
        byte[] fileBytes,
        CancellationToken cancellationToken = default)
    {
        var carePlan = await carePlanRepository.GetByIdAsync(carePlanId, cancellationToken)
            ?? throw new KeyNotFoundException("Care plan não encontrado");
        if (carePlan.PatientId != requesterUserId)
            throw new UnauthorizedAccessException("Apenas o paciente dono pode enviar arquivos");

        var task = await carePlanTaskRepository.GetByIdAsync(taskId, cancellationToken)
            ?? throw new KeyNotFoundException("Tarefa não encontrada");
        if (task.CarePlanId != carePlanId)
            throw new InvalidOperationException("Task não pertence ao care plan");

        var ext = Path.GetExtension(fileName);
        var path = $"careplans/{carePlanId}/tasks/{taskId}/{Guid.NewGuid():N}{ext}";
        var upload = await storageService.UploadAsync(path, fileBytes, contentType, cancellationToken);
        if (!upload.Success || string.IsNullOrWhiteSpace(upload.Url))
            throw new InvalidOperationException(upload.ErrorMessage ?? "Falha no upload do arquivo");

        var file = await carePlanTaskRepository.CreateFileAsync(
            CarePlanTaskFile.Create(
                taskId,
                path,
                upload.Url!,
                contentType,
                requesterUserId),
            cancellationToken);

        task.Start();
        await carePlanTaskRepository.UpdateAsync(task, cancellationToken);

        return new CarePlanTaskFileResponseDto(
            file.Id,
            file.TaskId,
            file.FileUrl,
            file.ContentType,
            file.CreatedAt);
    }

    public async Task<CarePlanResponseDto> ReviewAndOptionallyCloseAsync(
        Guid carePlanId,
        Guid doctorId,
        ReviewCarePlanRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var carePlan = await carePlanRepository.GetByIdAsync(carePlanId, cancellationToken)
            ?? throw new KeyNotFoundException("Care plan não encontrado");
        if (carePlan.ResponsibleDoctorId != doctorId)
            throw new UnauthorizedAccessException("Apenas o médico responsável pode revisar");

        var tasks = await carePlanTaskRepository.GetByCarePlanIdAsync(carePlanId, cancellationToken);
        var decisionByTask = request.TaskDecisions.ToDictionary(x => x.TaskId, x => x, EqualityComparer<Guid>.Default);
        foreach (var task in tasks)
        {
            if (decisionByTask.TryGetValue(task.Id, out var decision))
            {
                var normalized = (decision.Decision ?? string.Empty).Trim().ToLowerInvariant();
                if (normalized == "reviewed")
                    task.MarkReviewed();
                else if (normalized == "rejected")
                    task.MarkRejected();
                else if (normalized == "closed")
                    task.Close();

                await carePlanTaskRepository.UpdateAsync(task, cancellationToken);
            }
        }

        if (request.ClosePlan)
        {
            carePlan.Close();
            await carePlanRepository.UpdateAsync(carePlan, cancellationToken);

            var pushKey = $"push:careplan_closed:{carePlan.Id}";
            if (!await outboxEventRepository.ExistsByIdempotencyKeyAsync(pushKey, cancellationToken))
            {
                var outboxId = await outboxEventRepository.CreatePendingAsync(
                    "care_plan",
                    carePlan.Id,
                    "CarePlanClosed",
                    JsonSerializer.Serialize(new { carePlanId = carePlan.Id, patientId = carePlan.PatientId }),
                    pushKey,
                    cancellationToken);

                await notificationRepository.CreateAsync(
                    Notification.Create(
                        carePlan.PatientId,
                        "Plano de cuidados encerrado",
                        "Seu médico revisou os resultados e encerrou o plano.",
                        NotificationType.Success,
                        new Dictionary<string, object?> { ["carePlanId"] = carePlan.Id.ToString() }),
                    cancellationToken);

                await pushNotificationSender.SendAsync(
                    carePlan.PatientId,
                    "Plano de cuidados encerrado",
                    "Seu médico revisou os resultados e encerrou o plano.",
                    new Dictionary<string, object?> { ["carePlanId"] = carePlan.Id.ToString() },
                    cancellationToken);

                await outboxEventRepository.MarkProcessedAsync(outboxId, cancellationToken);
            }
        }

        return await BuildCarePlanResponseAsync(carePlan, cancellationToken);
    }

    private async Task<CarePlanResponseDto> BuildCarePlanResponseAsync(CarePlan carePlan, CancellationToken cancellationToken)
    {
        var tasks = await carePlanTaskRepository.GetByCarePlanIdAsync(carePlan.Id, cancellationToken);
        var taskDtos = new List<CarePlanTaskResponseDto>(tasks.Count);
        foreach (var task in tasks)
        {
            var files = await carePlanTaskRepository.GetFilesByTaskIdAsync(task.Id, cancellationToken);
            taskDtos.Add(new CarePlanTaskResponseDto(
                task.Id,
                task.CarePlanId,
                task.Type.ToString().ToSnakeCaseLower(),
                task.State.ToString().ToSnakeCaseLower(),
                task.Title,
                task.Description,
                task.PayloadJson,
                task.DueAt,
                task.CreatedAt,
                task.UpdatedAt,
                files.Select(f => new CarePlanTaskFileResponseDto(
                    f.Id,
                    f.TaskId,
                    f.FileUrl,
                    f.ContentType,
                    f.CreatedAt)).ToList()));
        }

        return new CarePlanResponseDto(
            carePlan.Id,
            carePlan.ConsultationId,
            carePlan.PatientId,
            carePlan.ResponsibleDoctorId,
            carePlan.Status.ToString().ToSnakeCaseLower(),
            carePlan.CreatedFromAiSuggestionId,
            carePlan.CreatedAt,
            carePlan.UpdatedAt,
            carePlan.ClosedAt,
            taskDtos);
    }

    private static string ComputeHash(string content)
    {
        using var sha = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(content?.Trim() ?? string.Empty);
        return Convert.ToHexString(sha.ComputeHash(bytes)).ToLowerInvariant();
    }

    private static AiSuggestionResponseDto MapAiSuggestion(AiSuggestion s)
    {
        return new AiSuggestionResponseDto(
            s.Id,
            s.ConsultationId,
            s.PatientId,
            s.DoctorId,
            s.Status.ToString().ToSnakeCaseLower(),
            s.Model,
            s.PayloadJson,
            s.CreatedAt,
            s.UpdatedAt);
    }
}

internal static class CarePlanStringCaseExtensions
{
    public static string ToSnakeCaseLower(this string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return input;
        return string.Concat(input.Select((x, i) =>
            i > 0 && char.IsUpper(x) ? "_" + x : x.ToString())).ToLowerInvariant();
    }
}
