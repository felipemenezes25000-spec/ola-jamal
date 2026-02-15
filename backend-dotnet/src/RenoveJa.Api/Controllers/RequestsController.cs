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
        catch (Exception e)
        {
            Console.WriteLine(e);
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
        var requests = await requestService.GetUserRequestsPagedAsync(userId, status, type, page, pageSize, cancellationToken);
        return Ok(requests);
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
            DateTime.UtcNow);

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
        var request = await requestService.UpdatePrescriptionContentAsync(id, dto.Medications, dto.Notes, doctorId, cancellationToken);
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

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
