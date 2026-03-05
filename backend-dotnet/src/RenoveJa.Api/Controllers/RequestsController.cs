using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por solicitações médicas (receita, exame, consulta) e fluxo de aprovação.
/// </summary>
[ApiController]
[Route("api/requests")]
[Authorize]
public class RequestsController(
    IRequestService requestService,
    IStorageService storageService,
    IPrescriptionPdfService pdfService,
    IAuditEventService auditEventService,
    IClinicalSummaryService clinicalSummaryService,
    IConsultationEncounterService consultationEncounterService,
    ILogger<RequestsController> logger) : ControllerBase
{
    private static readonly string[] AllowedImageContentTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB total para todas as imagens
    private const int MaxPrescriptionImages = 5;

    /// <summary>
    /// Cria uma solicitação de receita (tipo + imagens; medicamentos opcional).
    /// prescriptionType obrigatório: simples (R$ 50), controlado (R$ 80) ou azul (R$ 100).
    /// JSON: body com prescriptionType, opcional medications e prescriptionImages.
    /// Multipart: prescriptionType, images (arquivos). Fotos são salvas no Supabase Storage.
    /// </summary>
    [HttpPost("prescription")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB total (multipart)
    [Consumes("application/json", "multipart/form-data")]
    public async Task<IActionResult> CreatePrescription(CancellationToken cancellationToken)
    {
        try
        {
            var userId = GetUserId();
            CreatePrescriptionRequestDto request;

            if (Request.HasFormContentType)
            {
                if (Request.Form.Files.Count == 0)
                    return BadRequest(new
                    {
                        error =
                            "Para envio com imagens use multipart/form-data com campo 'images' (um ou mais arquivos)."
                    });

                if (Request.Form.Files.Count > MaxPrescriptionImages)
                    return BadRequest(new
                    {
                        error =
                            $"Máximo de {MaxPrescriptionImages} imagens permitidas. Você enviou {Request.Form.Files.Count}."
                    });

                var totalSize = Request.Form.Files.Sum(f => f.Length);
                if (totalSize > MaxFileSizeBytes)
                    return BadRequest(new
                    {
                        error =
                            $"Tamanho total das imagens excede 10 MB (limite: 10 MB). Total enviado: {totalSize / (1024 * 1024):N1} MB."
                    });

                var form = Request.Form;
                var prescriptionType = form["prescriptionType"].ToString();
                if (string.IsNullOrWhiteSpace(prescriptionType))
                    return BadRequest(new
                        { error = "Campo 'prescriptionType' é obrigatório (simples, controlado ou azul)." });

                var imageUrls = new List<string>();
                foreach (var file in Request.Form.Files)
                {
                    if (file.Length == 0) continue;
                    if (file.Length > 5 * 1024 * 1024)
                        return BadRequest(new { error = $"Arquivo {file.FileName} excede 5 MB." });
                    var contentType = file.ContentType ?? "image/jpeg";
                    if (!AllowedImageContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
                        return BadRequest(new
                        {
                            error =
                                $"Tipo não permitido: {contentType}. Use: {string.Join(", ", AllowedImageContentTypes)}"
                        });

                    await using var stream = file.OpenReadStream();
                    var url = await storageService.UploadPrescriptionImageAsync(stream, file.FileName, contentType,
                        userId, cancellationToken);
                    imageUrls.Add(url);
                }

                if (imageUrls.Count == 0)
                    return BadRequest(new { error = "Envie pelo menos uma imagem da receita no campo 'images'." });

                request = new CreatePrescriptionRequestDto(prescriptionType, new List<string>(), imageUrls);
            }
            else
            {
                CreatePrescriptionRequestDto? bodyRequest;
                try
                {
                    var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
                    bodyRequest =
                        await Request.ReadFromJsonAsync<CreatePrescriptionRequestDto>(jsonOptions, cancellationToken);
                }
                catch
                {
                    return BadRequest(new
                    {
                        error =
                            "Body inválido. Use JSON com prescriptionType (simples, controlado ou azul) e opcional medications, prescriptionImages."
                    });
                }

                if (bodyRequest == null)
                    return BadRequest(new
                    {
                        error =
                            "Envie o body em JSON. Ex.: { \"prescriptionType\": \"simples\", \"medications\": [], \"prescriptionImages\": [] }"
                    });

                var imgCount = bodyRequest.PrescriptionImages?.Count ?? 0;
                if (imgCount > MaxPrescriptionImages)
                    return BadRequest(new
                    {
                        error = $"Máximo de {MaxPrescriptionImages} imagens permitidas. Você enviou {imgCount}."
                    });

                request = bodyRequest;
            }

            var result = await requestService.CreatePrescriptionAsync(request, userId, cancellationToken);
            logger.LogInformation("Requests CreatePrescription: userId={UserId}, requestId={RequestId}, type={Type}",
                userId, result.Request.Id, request.PrescriptionType);
            return result.Payment != null
                ? Ok(new { request = result.Request, payment = result.Payment })
                : Ok(new { request = result.Request });
        }
        catch (Exception)
        {
            throw;
        }
    }

    /// <summary>
    /// Cria uma solicitação de exame. Pagamento gerado na aprovação.
    /// Suporta JSON (examType, exams, symptoms) ou multipart (examType, exams, symptoms, images).
    /// Pode anexar imagens do pedido antigo e/ou escrever o que deseja; a IA analisa e resume.
    /// </summary>
    [HttpPost("exam")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB total (multipart), máx. 5 imagens
    [Consumes("application/json", "multipart/form-data")]
    public async Task<IActionResult> CreateExam(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        CreateExamRequestDto request;

        if (Request.HasFormContentType)
        {
            var form = Request.Form;
            var examType = form["examType"].ToString()?.Trim() ?? "geral";
            var examsText = form["exams"].ToString()?.Trim() ?? "";
            var exams = string.IsNullOrWhiteSpace(examsText)
                ? new List<string>()
                : examsText.Split(new[] { '\n', ',', ';' }, StringSplitOptions.RemoveEmptyEntries).Select(s => s.Trim()).Where(s => s.Length > 0).ToList();
            var symptoms = form["symptoms"].ToString()?.Trim();

            var imageUrls = new List<string>();
            if (Request.Form.Files.Count > 0)
            {
                if (Request.Form.Files.Count > MaxPrescriptionImages)
                    return BadRequest(new { error = $"Máximo de {MaxPrescriptionImages} imagens permitidas. Você enviou {Request.Form.Files.Count}." });

                var totalSize = Request.Form.Files.Sum(f => f.Length);
                if (totalSize > MaxFileSizeBytes)
                    return BadRequest(new { error = $"Tamanho total das imagens excede 10 MB (limite: 10 MB). Total enviado: {totalSize / (1024 * 1024):N1} MB." });

                foreach (var file in Request.Form.Files)
                {
                    if (file.Length == 0) continue;
                    if (file.Length > 5 * 1024 * 1024)
                        return BadRequest(new { error = $"Arquivo {file.FileName} excede 5 MB." });
                    var contentType = file.ContentType ?? "image/jpeg";
                    if (!AllowedImageContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
                        return BadRequest(new { error = $"Tipo não permitido: {contentType}. Use: {string.Join(", ", AllowedImageContentTypes)}" });
                    await using var stream = file.OpenReadStream();
                    var url = await storageService.UploadPrescriptionImageAsync(stream, file.FileName, contentType, userId, cancellationToken);
                    imageUrls.Add(url);
                }
            }

            if (exams.Count == 0 && imageUrls.Count == 0 && string.IsNullOrWhiteSpace(symptoms))
                return BadRequest(new { error = "Informe pelo menos um exame, imagens do pedido ou sintomas/indicação." });

            request = new CreateExamRequestDto(examType, exams, symptoms, imageUrls.Count > 0 ? imageUrls : null);
        }
        else
        {
            CreateExamRequestDto? bodyRequest;
            try
            {
                var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
                bodyRequest = await Request.ReadFromJsonAsync<CreateExamRequestDto>(jsonOptions, cancellationToken);
            }
            catch
            {
                return BadRequest(new { error = "Body inválido. Use JSON com examType, exams, symptoms e opcional examImages." });
            }
            if (bodyRequest == null)
                return BadRequest(new { error = "Envie o body em JSON. Ex.: { \"examType\": \"laboratorial\", \"exams\": [\"Hemograma\"], \"symptoms\": \"Controle\" }" });

            var examImgCount = bodyRequest.ExamImages?.Count ?? 0;
            if (examImgCount > MaxPrescriptionImages)
                return BadRequest(new { error = $"Máximo de {MaxPrescriptionImages} imagens permitidas. Você enviou {examImgCount}." });

            request = bodyRequest;
        }

        var result = await requestService.CreateExamAsync(request, userId, cancellationToken);
        return result.Payment != null ? Ok(new { request = result.Request, payment = result.Payment }) : Ok(new { request = result.Request });
    }

    /// <summary>
    /// Cria uma solicitação de consulta.
    /// </summary>
    [HttpPost("consultation")]
    public async Task<IActionResult> CreateConsultation(
        [FromBody] CreateConsultationRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var result = await requestService.CreateConsultationAsync(request, userId, cancellationToken);
        return result.Payment != null ? Ok(new { request = result.Request, payment = result.Payment }) : Ok(new { request = result.Request });
    }

    /// <summary>
    /// Lista solicitações do usuário com paginação, com filtros opcionais por status e tipo.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetRequests(
        [FromQuery] string? status,
        [FromQuery] string? type,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        if (page < 1) page = 1;
        var userId = GetUserId();
        logger.LogInformation("[GetRequests] GET /api/requests userId={UserId} (from token), page={Page}, pageSize={PageSize}", userId, page, pageSize);
        var requests = await requestService.GetUserRequestsPagedAsync(userId, status, type, page, pageSize, cancellationToken);
        logger.LogInformation("[GetRequests] returning TotalCount={TotalCount}", requests.TotalCount);
        return Ok(requests);
    }

    /// <summary>
    /// Estatísticas do médico (contagens e ganhos). Somente role doctor.
    /// </summary>
    [HttpGet("stats")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var (pendingCount, inReviewCount, completedCount, totalEarnings) = await requestService.GetDoctorStatsAsync(doctorId, cancellationToken);
        return Ok(new { pendingCount, inReviewCount, completedCount, totalEarnings });
    }

    /// <summary>
    /// Médico obtém histórico de solicitações do paciente (prontuário).
    /// </summary>
    [HttpGet("by-patient/{patientId}")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> GetPatientRequests(
        Guid patientId,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var requests = await requestService.GetPatientRequestsAsync(doctorId, patientId, cancellationToken);
        _ = auditEventService.LogReadAsync(doctorId, "PatientRequests", patientId, "api", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken: cancellationToken);
        return Ok(requests);
    }

    /// <summary>
    /// Médico obtém perfil do paciente (dados cadastrais) para identificação. Somente quando tem acesso ao prontuário.
    /// </summary>
    [HttpGet("by-patient/{patientId}/profile")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> GetPatientProfile(
        Guid patientId,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var profile = await requestService.GetPatientProfileForDoctorAsync(doctorId, patientId, cancellationToken);
        if (profile == null)
            return NotFound(new { error = "Paciente não encontrado ou sem acesso." });
        _ = auditEventService.LogReadAsync(doctorId, "PatientProfile", patientId, "api", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken: cancellationToken);
        return Ok(profile);
    }

    /// <summary>
    /// Médico obtém resumo narrativo completo do prontuário (IA). Consolida consultas, receitas e exames em um texto único.
    /// </summary>
    [HttpGet("by-patient/{patientId}/summary")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> GetPatientClinicalSummary(
        Guid patientId,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var requests = await requestService.GetPatientRequestsAsync(doctorId, patientId, cancellationToken);
        var profile = await requestService.GetPatientProfileForDoctorAsync(doctorId, patientId, cancellationToken);

        if (requests.Count == 0)
            return Ok(new { summary = (string?)null, fallback = (string?)null });

        var patientName = profile?.Name ?? requests[0].PatientName ?? "Paciente";

        var allergies = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in requests.Where(x => x.RequestType == "consultation" && !string.IsNullOrWhiteSpace(x.ConsultationAnamnesis)))
        {
            try
            {
                var doc = JsonDocument.Parse(r.ConsultationAnamnesis!);
                if (doc.RootElement.TryGetProperty("alergias", out var a))
                {
                    if (a.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in a.EnumerateArray())
                        {
                            var v = item.GetString()?.Trim();
                            if (!string.IsNullOrEmpty(v)) allergies.Add(v);
                        }
                    }
                    else if (a.ValueKind == JsonValueKind.String)
                    {
                        var v = a.GetString()?.Trim();
                        if (!string.IsNullOrEmpty(v)) allergies.Add(v);
                    }
                }
            }
            catch { /* ignore */ }
        }

        var consultations = requests
            .Where(r => r.RequestType == "consultation")
            .OrderBy(r => r.CreatedAt)
            .Select(r =>
            {
                string? anamSnippet = null;
                if (!string.IsNullOrWhiteSpace(r.ConsultationAnamnesis))
                {
                    try
                    {
                        var doc = JsonDocument.Parse(r.ConsultationAnamnesis!);
                        var parts = new List<string>();
                        foreach (var key in new[] { "queixa_principal", "historia_doenca_atual", "medicamentos_em_uso" })
                        {
                            if (doc.RootElement.TryGetProperty(key, out var p) && p.ValueKind == JsonValueKind.String)
                            {
                                var v = p.GetString()?.Trim();
                                if (!string.IsNullOrEmpty(v)) parts.Add(v);
                            }
                        }
                        if (parts.Count > 0) anamSnippet = string.Join("; ", parts);
                    }
                    catch { /* ignore */ }
                }
                var cid = ExtractCid(r.ConsultationAnamnesis);
                return new ClinicalSummaryConsultation(
                    r.CreatedAt,
                    r.Symptoms,
                    cid,
                    r.DoctorConductNotes ?? r.AiConductSuggestion,
                    anamSnippet);
            })
            .ToList();

        var prescriptions = requests
            .Where(r => r.RequestType == "prescription")
            .OrderBy(r => r.CreatedAt)
            .Select(r => new ClinicalSummaryPrescription(
                r.CreatedAt,
                r.PrescriptionType ?? "simples",
                r.Medications ?? new List<string>(),
                r.Notes))
            .ToList();

        var exams = requests
            .Where(r => r.RequestType == "exam")
            .OrderBy(r => r.CreatedAt)
            .Select(r => new ClinicalSummaryExam(
                r.CreatedAt,
                r.ExamType,
                r.Exams ?? new List<string>(),
                r.Symptoms,
                r.Notes))
            .ToList();

        var input = new ClinicalSummaryInput(
            patientName,
            profile?.BirthDate,
            profile?.Gender,
            allergies.ToList(),
            consultations,
            prescriptions,
            exams);

        var structured = await clinicalSummaryService.GenerateStructuredAsync(input, cancellationToken);
        string? narrative = structured?.NarrativeSummary;
        string? fallback = null;

        if (string.IsNullOrWhiteSpace(narrative))
        {
            narrative = await clinicalSummaryService.GenerateAsync(input, cancellationToken);
            if (string.IsNullOrWhiteSpace(narrative))
            {
                fallback = BuildFallbackSummary(patientName, profile?.BirthDate, allergies, consultations, prescriptions, exams);
                narrative = fallback;
            }
        }

        var structuredDto = structured != null ? new
        {
            problemList = structured.ProblemList,
            activeMedications = structured.ActiveMedications,
            narrativeSummary = narrative,
            carePlan = structured.CarePlan,
            alerts = structured.Alerts
        } : (object?)null;

        _ = auditEventService.LogReadAsync(doctorId, "PatientClinicalSummary", patientId, "api", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken: cancellationToken);

        return Ok(new { summary = narrative, fallback, structured = structuredDto });
    }

    private static string BuildFallbackSummary(
        string patientName,
        DateTime? birthDate,
        HashSet<string> allergies,
        List<ClinicalSummaryConsultation> consultations,
        List<ClinicalSummaryPrescription> prescriptions,
        List<ClinicalSummaryExam> exams)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"Resumo do prontuário — {patientName}");
        if (birthDate.HasValue)
        {
            var age = DateTime.Today.Year - birthDate.Value.Year;
            if (DateTime.Today < birthDate.Value.AddYears(age)) age--;
            sb.AppendLine($"Idade: {age} anos");
        }
        if (allergies.Count > 0)
            sb.AppendLine($"Alergias: {string.Join(", ", allergies)}");
        sb.AppendLine();

        if (consultations.Count > 0)
        {
            sb.AppendLine("Consultas:");
            foreach (var c in consultations)
            {
                sb.AppendLine($"• {c.Date:dd/MM/yyyy}: {c.Symptoms ?? "—"}");
                if (!string.IsNullOrWhiteSpace(c.Cid)) sb.AppendLine($"  CID: {c.Cid}");
                if (!string.IsNullOrWhiteSpace(c.Conduct)) sb.AppendLine($"  Conduta: {c.Conduct}");
            }
            sb.AppendLine();
        }

        if (prescriptions.Count > 0)
        {
            sb.AppendLine("Receitas:");
            foreach (var p in prescriptions)
                sb.AppendLine($"• {p.Date:dd/MM/yyyy} ({p.Type}): {string.Join(", ", p.Medications)}");
            sb.AppendLine();
        }

        if (exams.Count > 0)
        {
            sb.AppendLine("Exames:");
            foreach (var e in exams)
                sb.AppendLine($"• {e.Date:dd/MM/yyyy}: {string.Join(", ", e.Exams)}");
        }

        return sb.ToString().Trim();
    }

    private static string? ExtractCid(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            foreach (var key in new[] { "cid_sugerido", "cid", "cidPrincipal" })
            {
                if (root.TryGetProperty(key, out var p) && p.ValueKind == JsonValueKind.String)
                {
                    var v = p.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(v)) return v;
                }
            }
        }
        catch { /* ignore */ }
        return null;
    }

    /// <summary>
    /// Obtém uma solicitação pelo ID. Somente o paciente ou o médico da solicitação podem acessar.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetRequest(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.GetRequestByIdAsync(id, userId, cancellationToken);
        _ = auditEventService.LogReadAsync(userId, "Request", id, "api", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken: cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Atualiza o status de uma solicitação (médico).
    /// </summary>
    [HttpPut("{id}/status")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        [FromBody] UpdateRequestStatusDto dto,
        CancellationToken cancellationToken)
    {
        var request = await requestService.UpdateStatusAsync(id, dto, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Aprova a renovação. Somente médicos (role doctor). Body vazio.
    /// O valor vem da tabela product_prices. O paciente inicia o pagamento via POST /api/payments.
    /// Para rejeitar: POST /api/requests/{id}/reject com { "rejectionReason": "motivo" }.
    /// </summary>
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Approve(
        Guid id,
        [FromBody] ApproveRequestDto? dto,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var request = await requestService.ApproveAsync(id, dto ?? new ApproveRequestDto(), doctorId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Rejeita uma solicitação com motivo (médico).
    /// </summary>
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Reject(
        Guid id,
        [FromBody] RejectRequestDto dto,
        CancellationToken cancellationToken)
    {
        var request = await requestService.RejectAsync(id, dto, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Atribui a solicitação à fila (próximo médico disponível).
    /// </summary>
    [HttpPost("{id}/assign-queue")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> AssignQueue(
        Guid id,
        CancellationToken cancellationToken)
    {
        var request = await requestService.AssignToQueueAsync(id, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Aceita a consulta e cria sala de vídeo (médico).
    /// </summary>
    [HttpPost("{id}/accept-consultation")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> AcceptConsultation(
        Guid id,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var result = await requestService.AcceptConsultationAsync(id, doctorId, cancellationToken);
        return Ok(new AcceptConsultationResponseDto(result.Request, result.VideoRoom));
    }

    /// <summary>
    /// Médico inicia a consulta (status Paid → InConsultation). O timer só começa quando médico e paciente reportam chamada conectada.
    /// </summary>
    [HttpPost("{id}/start-consultation")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> StartConsultation(
        Guid id,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var request = await requestService.StartConsultationAsync(id, doctorId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Médico ou paciente reporta que está com a chamada de vídeo conectada (WebRTC). Quando ambos tiverem reportado, o timer começa.
    /// </summary>
    [HttpPost("{id}/report-call-connected")]
    [Authorize]
    public async Task<IActionResult> ReportCallConnected(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.ReportCallConnectedAsync(id, userId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Médico encerra a consulta: persiste notas clínicas, deleta sala Daily e notifica paciente.
    /// </summary>
    [HttpPost("{id}/finish-consultation")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> FinishConsultation(
        Guid id,
        [FromBody] FinishConsultationDto? dto,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var request = await requestService.FinishConsultationAsync(id, doctorId, dto, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Médico salva nota clínica editada no prontuário (writeback do resumo da consulta).
    /// </summary>
    [HttpPost("{id}/save-consultation-summary")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> SaveConsultationSummary(
        Guid id,
        [FromBody] SaveConsultationSummaryDto dto,
        CancellationToken cancellationToken)
    {
        try
        {
            var doctorId = GetUserId();
            await consultationEncounterService.UpdateEncounterClinicalNotesAsync(
                id, doctorId, dto.Anamnesis, dto.Plan, cancellationToken);
            return Ok(new { saved = true });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("não encontrado"))
        {
            return NotFound(new { error = "Prontuário desta consulta não encontrado. A consulta pode não ter sido iniciada com vídeo conectado." });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    /// <summary>
    /// Valida conformidade da receita (campos obrigatórios por tipo). Médico ou paciente.
    /// Retorna 200 com valid: true ou 400 com valid: false, missingFields e messages.
    /// </summary>
    [HttpPost("{id}/validate-prescription")]
    public async Task<IActionResult> ValidatePrescription(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var (isValid, missingFields, messages) = await requestService.ValidatePrescriptionAsync(id, userId, cancellationToken);
        if (isValid)
            return Ok(new { valid = true });
        return BadRequest(new { valid = false, missingFields, messages });
    }

    /// <summary>
    /// Assina digitalmente a solicitação (médico).
    /// </summary>
    [HttpPost("{id}/sign")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> Sign(
        Guid id,
        [FromBody] SignRequestDto dto,
        CancellationToken cancellationToken)
    {
        var request = await requestService.SignAsync(id, dto, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Reanalisa a receita com novas imagens (ex.: mais legíveis). Somente o paciente.
    /// Se a IA tiver dificuldade de leitura, use este endpoint após enviar foto mais nítida.
    /// </summary>
    [HttpPost("{id}/reanalyze-prescription")]
    public async Task<IActionResult> ReanalyzePrescription(
        Guid id,
        [FromBody] ReanalyzePrescriptionDto dto,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.ReanalyzePrescriptionAsync(id, dto, userId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Reanalisa o pedido de exame com novas imagens e/ou texto. Somente o paciente.
    /// </summary>
    [HttpPost("{id}/reanalyze-exam")]
    public async Task<IActionResult> ReanalyzeExam(
        Guid id,
        [FromBody] ReanalyzeExamDto dto,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.ReanalyzeExamAsync(id, dto, userId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Médico reexecuta a análise de IA com as imagens já existentes da receita ou exame.
    /// </summary>
    [HttpPost("{id}/reanalyze-as-doctor")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> ReanalyzeAsDoctor(
        Guid id,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var request = await requestService.ReanalyzeAsDoctorAsync(id, doctorId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Gera o PDF de receita de uma solicitação aprovada. Somente médicos.
    /// </summary>
    [HttpPost("{id}/generate-pdf")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> GeneratePdf(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.GetRequestByIdAsync(id, userId, cancellationToken);

        if (request.RequestType != "prescription")
            return BadRequest(new { error = "Apenas solicitações de receita podem gerar PDF." });

        var kindStr = (request.PrescriptionKind ?? "simple").Replace("_", "");
        var kind = Enum.TryParse<RenoveJa.Domain.Enums.PrescriptionKind>(kindStr, true, out var pk)
            ? pk
            : (RenoveJa.Domain.Enums.PrescriptionKind?)null;
        var pdfData = new PrescriptionPdfData(
            request.Id,
            request.PatientName ?? "Paciente",
            null,
            request.DoctorName ?? "Médico",
            "CRM",
            "SP",
            "Clínica Geral",
            request.Medications ?? new List<string>(),
            request.PrescriptionType ?? "simples",
            DateTime.UtcNow,
            PrescriptionKind: kind);

        var result = await pdfService.GenerateAndUploadAsync(pdfData, cancellationToken);

        if (!result.Success)
            return BadRequest(new { error = result.ErrorMessage ?? "Erro ao gerar PDF." });

        return Ok(new { success = true, pdfUrl = result.PdfUrl, message = "PDF gerado com sucesso." });
    }

    /// <summary>
    /// Pré-visualização do PDF da receita (base64). Médico ou paciente.
    /// </summary>
    [HttpGet("{id}/preview-pdf")]
    public async Task<IActionResult> PreviewPdf(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var bytes = await requestService.GetPrescriptionPdfPreviewAsync(id, userId, cancellationToken);
        if (bytes == null || bytes.Length == 0)
            return BadRequest(new { error = "Não foi possível gerar o preview. Verifique se há medicamentos informados ou extraídos pela IA." });
        return File(bytes, "application/pdf", $"preview-receita-{id}.pdf");
    }

    /// <summary>
    /// Pré-visualização do PDF de pedido de exame. Médico ou paciente.
    /// </summary>
    [HttpGet("{id}/preview-exam-pdf")]
    public async Task<IActionResult> PreviewExamPdf(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var bytes = await requestService.GetExamPdfPreviewAsync(id, userId, cancellationToken);
        if (bytes == null || bytes.Length == 0)
            return BadRequest(new { error = "Não foi possível gerar o preview. Verifique se a solicitação é do tipo exame e se você tem acesso." });
        return File(bytes, "application/pdf", $"preview-pedido-exame-{id}.pdf");
    }

    /// <summary>
    /// Baixa/visualiza o PDF assinado. Paciente ou médico atribuído.
    /// Aceita Bearer ou ?token= (temporário para links abertos em navegador).
    /// URL usa domínio próprio (renovejasaude.com.br) quando Api:BaseUrl configurado.
    /// </summary>
    [HttpGet("{id}/document")]
    [AllowAnonymous]
    public async Task<IActionResult> GetDocument(Guid id, [FromQuery] string? token, CancellationToken cancellationToken)
    {
        byte[]? bytes;
        if (!string.IsNullOrWhiteSpace(token))
        {
            bytes = await requestService.GetSignedDocumentByTokenAsync(id, token, cancellationToken);
        }
        else
        {
            Guid userId;
            try
            {
                userId = GetUserId();
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { error = "Token de autenticação inválido ou ausente." });
            }

            var req = await requestService.GetRequestByIdAsync(id, userId, cancellationToken);
            var isOwner = req.PatientId == userId
                          || (req.DoctorId.HasValue && req.DoctorId.Value == userId);
            if (!isOwner)
                return StatusCode(403, new { error = "Você não tem permissão para acessar este documento." });

            bytes = await requestService.GetSignedDocumentAsync(id, userId, cancellationToken);
        }

        if (bytes == null || bytes.Length == 0)
            return NotFound(new { error = "Documento assinado não disponível ou você não tem permissão para acessá-lo." });
        _ = auditEventService.LogReadAsync(null, "SignedDocument", id, "api", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken: cancellationToken);
        return File(bytes, "application/pdf", $"documento-{id}.pdf");
    }

    /// <summary>
    /// Proxy para imagens de receita. Bucket prescription-images é privado; este endpoint serve as imagens com autenticação.
    /// Aceita Bearer ou ?token= (para Image component que não envia headers).
    /// </summary>
    [HttpGet("{id}/prescription-image/{index:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPrescriptionImage(Guid id, int index, [FromQuery] string? token, CancellationToken cancellationToken)
    {
        Guid? userId = null;
        try { userId = GetUserId(); } catch { /* AllowAnonymous */ }
        var bytes = await requestService.GetRequestImageAsync(id, token, userId, "prescription", index, cancellationToken);
        if (bytes == null || bytes.Length == 0)
            return NotFound(new { error = "Imagem não encontrada ou sem permissão." });
        return File(bytes, "image/jpeg", $"receita-{id}-{index}.jpg");
    }

    /// <summary>
    /// Proxy para imagens de exame. Bucket prescription-images é privado; este endpoint serve as imagens com autenticação.
    /// Aceita Bearer ou ?token= (para Image component que não envia headers).
    /// </summary>
    [HttpGet("{id}/exam-image/{index:int}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetExamImage(Guid id, int index, [FromQuery] string? token, CancellationToken cancellationToken)
    {
        Guid? userId = null;
        try { userId = GetUserId(); } catch { /* AllowAnonymous */ }
        var bytes = await requestService.GetRequestImageAsync(id, token, userId, "exam", index, cancellationToken);
        if (bytes == null || bytes.Length == 0)
            return NotFound(new { error = "Imagem não encontrada ou sem permissão." });
        return File(bytes, "image/jpeg", $"exame-{id}-{index}.jpg");
    }

    /// <summary>
    /// Paciente marca o documento como entregue (Signed → Delivered) ao baixar/abrir o PDF.
    /// </summary>
    [HttpPost("{id}/mark-delivered")]
    public async Task<IActionResult> MarkDelivered(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.MarkDeliveredAsync(id, userId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Paciente cancela o pedido (apenas antes do pagamento).
    /// </summary>
    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestService.CancelAsync(id, userId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Médico atualiza medicamentos e/ou notas da receita antes da assinatura.
    /// </summary>
    [HttpPatch("{id}/prescription-content")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdatePrescriptionContent(
        Guid id,
        [FromBody] UpdatePrescriptionContentDto dto,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var request = await requestService.UpdatePrescriptionContentAsync(id, dto.Medications, dto.Notes, doctorId, cancellationToken, dto.PrescriptionKind);
        return Ok(request);
    }

    /// <summary>
    /// Médico atualiza exames e/ou notas do pedido antes da assinatura.
    /// </summary>
    [HttpPatch("{id}/exam-content")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdateExamContent(
        Guid id,
        [FromBody] UpdateExamContentDto dto,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var request = await requestService.UpdateExamContentAsync(id, dto.Exams, dto.Notes, doctorId, cancellationToken);
        return Ok(request);
    }

    /// <summary>
    /// Encerramento automático da consulta pelo app quando o timer de minutos contratados expirar.
    /// Pode ser chamado pelo paciente ou médico. Credita minutos não usados ao banco de horas.
    /// </summary>
    [HttpPost("{id}/auto-finish-consultation")]
    public async Task<IActionResult> AutoFinishConsultation(Guid id, CancellationToken cancellationToken)
    {
        try
        {
            var userId = GetUserId();
            var request = await requestService.AutoFinishConsultationAsync(id, userId, cancellationToken);
            return Ok(request);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Retorna o saldo do banco de horas do paciente para o tipo de consulta especificado.
    /// GET /api/requests/time-bank?consultationType=psicologo
    /// </summary>
    [HttpGet("time-bank")]
    public async Task<IActionResult> GetTimeBankBalance([FromQuery] string consultationType = "medico_clinico", CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        var (balanceSeconds, balanceMinutes, type) = await requestService.GetTimeBankBalanceAsync(userId, consultationType, cancellationToken);
        return Ok(new { balanceSeconds, balanceMinutes, consultationType = type });
    }

    [HttpPut("{id}/conduct")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdateConduct(
        Guid id,
        [FromBody] UpdateConductDto dto,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var result = await requestService.UpdateConductAsync(id, dto, doctorId, cancellationToken);
        return Ok(result);
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
