using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por criação e listagem de solicitações médicas (CRUD).
/// Endpoints de aprovação/rejeição → RequestApprovalController.
/// Endpoints de consulta (vídeo) → ConsultationWorkflowController.
/// Endpoints de receita/exame (PDF, assinatura) → PrescriptionExamController.
/// Endpoints de prontuário/documentos → ClinicalRecordsController.
/// </summary>
[ApiController]
[Route("api/requests")]
[Authorize]
public class RequestsController(
    IRequestService requestService,
    IStorageService storageService,
    IAuditEventService auditEventService,
    IRequestRepository requestRepository,
    ILogger<RequestsController> logger) : ControllerBase
{
    private static readonly string[] AllowedImageContentTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MB total para todas as imagens
    private const int MaxPrescriptionImages = 5;

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }

    private async Task<Guid?> ResolveRequestIdAsync(string id, CancellationToken cancellationToken)
    {
        if (Guid.TryParse(id, out var guid))
            return guid;
        var req = await requestRepository.GetByShortCodeAsync(id, cancellationToken);
        return req?.Id;
    }

    // ── Create endpoints ──────────────────────────────────────────

    /// <summary>
    /// Cria uma solicitação de receita (tipo + imagens; medicamentos opcional).
    /// prescriptionType obrigatório: simples ou controlado (receita azul ainda não liberada).
    /// JSON: body com prescriptionType, opcional medications e prescriptionImages.
    /// Multipart: prescriptionType, images (arquivos). Fotos sao salvas no S3 Storage.
    /// </summary>
    [HttpPost("prescription")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB total (multipart)
    [Consumes("application/json", "multipart/form-data")]
    public async Task<IActionResult> CreatePrescription(CancellationToken cancellationToken)
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
                        { error = "Campo 'prescriptionType' é obrigatório (simples ou controlado)." });

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
                            "Body inválido. Use JSON com prescriptionType (simples ou controlado) e opcional medications, prescriptionImages."
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

            var typeLower = request.PrescriptionType?.Trim().ToLowerInvariant();
            if (typeLower == "azul" || typeLower == "blue")
                return BadRequest(new { error = "Receita azul ainda não está liberada. Use simples ou controlado." });

            var result = await requestService.CreatePrescriptionAsync(request, userId, cancellationToken);
            logger.LogInformation("Requests CreatePrescription: userId={UserId}, requestId={RequestId}, type={Type}",
                userId, result.Id, request.PrescriptionType);
        return Ok(new { request = result });
    }

    /// <summary>
    /// Cria uma solicitação de exame.
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
                    var url = await storageService.UploadExamImageAsync(stream, file.FileName, contentType, userId, cancellationToken);
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
        return Ok(new { request = result });
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
        return Ok(new { request = result });
    }

    // ── Read endpoints ────────────────────────────────────────────

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
        pageSize = Math.Clamp(pageSize, 1, 100); // NH-3: cap at 100 to prevent DoS
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
    /// Obtém uma solicitação pelo ID ou short_code. Aceita UUID completo ou código curto (12 hex).
    /// Somente o paciente ou o médico da solicitação podem acessar.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetRequest(
        string id,
        CancellationToken cancellationToken)
    {
        var resolvedId = await ResolveRequestIdAsync(id, cancellationToken);
        if (resolvedId == null)
            return NotFound();

        var userId = GetUserId();
        var request = await requestService.GetRequestByIdAsync(resolvedId.Value, userId, cancellationToken);
        _ = auditEventService.LogReadAsync(userId, "Request", resolvedId.Value, "api", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken: CancellationToken.None)
            .ContinueWith(t =>
            {
                if (t.IsFaulted)
                    logger.LogWarning(t.Exception, "Audit log failed for Request read by UserId={UserId}, RequestId={RequestId}", userId, resolvedId.Value);
            }, TaskContinuationOptions.OnlyOnFaulted);
        return Ok(request);
    }
}
