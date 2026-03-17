using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Video;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por dados clínicos do paciente: prontuário, perfil,
/// resumos, documentos, imagens de receita/exame, gravações e transcrições.
/// Extraído de RequestsController para manter responsabilidade única.
/// </summary>
[ApiController]
[Route("api/requests")]
[Authorize]
#pragma warning disable CS9113 // logger reserved for future logging
public class ClinicalRecordsController(
    IRequestService requestService,
    IClinicalSummaryService clinicalSummaryService,
    IDoctorPatientNotesRepository doctorPatientNotesRepository,
    IAuditEventService auditEventService,
    IAuditService auditService,
    IDocumentTokenService documentTokenService,
    IRequestRepository requestRepository,
    IDailyVideoService dailyVideoService,
    IOptions<DailyConfig> dailyConfig,
    ILogger<ClinicalRecordsController> logger) : ControllerBase
#pragma warning restore CS9113
{
    // ───────────────────── Helpers ─────────────────────

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }

    private static readonly HashSet<string> ValidNoteTypes = ["progress_note", "clinical_impression", "addendum", "observation"];

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

    // ───────────────────── Endpoints ─────────────────────

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
        {
            var emptyNotes = await doctorPatientNotesRepository.GetNotesAsync(doctorId, patientId, cancellationToken);
            var emptyDoctorNotes = emptyNotes.Select(n => new DoctorNoteDto(n.Id, n.NoteType, n.Content, n.RequestId, n.CreatedAt, n.UpdatedAt)).ToList();
            return Ok(new { summary = (string?)null, fallback = (string?)null, doctorNotes = emptyDoctorNotes });
        }

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
            alerts = structured.Alerts
        } : (object?)null;

        var notes = await doctorPatientNotesRepository.GetNotesAsync(doctorId, patientId, cancellationToken);
        var doctorNotes = notes.Select(n => new DoctorNoteDto(n.Id, n.NoteType, n.Content, n.RequestId, n.CreatedAt, n.UpdatedAt)).ToList();

        _ = auditEventService.LogReadAsync(doctorId, "PatientClinicalSummary", patientId, "api", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken: cancellationToken);

        return Ok(new { summary = narrative, fallback, structured = structuredDto, doctorNotes });
    }

    /// <summary>
    /// Médico adiciona nota clínica ao prontuário do paciente.
    /// Tipos: progress_note (evolução), clinical_impression (impressão diagnóstica), addendum (complemento), observation (observação livre).
    /// </summary>
    [HttpPost("by-patient/{patientId}/doctor-notes")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> AddDoctorPatientNote(
        Guid patientId,
        [FromBody] CreateDoctorNoteDto dto,
        CancellationToken cancellationToken)
    {
        var doctorId = GetUserId();
        var requests = await requestService.GetPatientRequestsAsync(doctorId, patientId, cancellationToken);
        if (requests.Count == 0)
            return NotFound(new { error = "Paciente não encontrado ou sem acesso ao prontuário." });

        var noteType = (dto.NoteType ?? "progress_note").Trim().ToLowerInvariant();
        if (!ValidNoteTypes.Contains(noteType))
            return BadRequest(new { error = $"Tipo inválido. Use: {string.Join(", ", ValidNoteTypes)}" });

        var content = (dto.Content ?? "").Trim();
        if (string.IsNullOrEmpty(content))
            return BadRequest(new { error = "Conteúdo da nota é obrigatório." });

        Guid? requestId = dto.RequestId;
        if (requestId.HasValue && !requests.Any(r => r.Id == requestId.Value))
            return BadRequest(new { error = "RequestId não pertence ao prontuário do paciente." });

        var entity = await doctorPatientNotesRepository.AddNoteAsync(doctorId, patientId, noteType, content, requestId, cancellationToken);
        var note = new DoctorNoteDto(entity.Id, entity.NoteType, entity.Content, entity.RequestId, entity.CreatedAt, entity.UpdatedAt);

        var newValues = new Dictionary<string, object?>
        {
            ["note_type"] = entity.NoteType,
            ["content"] = entity.Content,
            ["request_id"] = entity.RequestId,
            ["patient_id"] = patientId,
            ["created_at"] = entity.CreatedAt
        };
        _ = auditService.LogModificationAsync(doctorId, "Create", "DoctorPatientNote", entity.Id, oldValues: null, newValues: newValues, cancellationToken: cancellationToken);
        _ = auditEventService.LogReadAsync(doctorId, "DoctorPatientNote", patientId, "api", HttpContext.Connection.RemoteIpAddress?.ToString(), HttpContext.Request.Headers.UserAgent.ToString(), cancellationToken: cancellationToken);
        return Ok(note);
    }

    /// <summary>
    /// Gera um token temporário (5 min) para download do PDF assinado.
    /// Evita expor o JWT completo na query string da URL de download.
    /// </summary>
    [HttpPost("{id}/document-token")]
    public async Task<IActionResult> CreateDocumentToken(Guid id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var req = await requestService.GetRequestByIdAsync(id, userId, cancellationToken);
        var isOwner = req.PatientId == userId || (req.DoctorId.HasValue && req.DoctorId.Value == userId);
        if (!isOwner)
            return StatusCode(403, new { error = "Você não tem permissão para acessar este documento." });

        var token = documentTokenService.GenerateDocumentToken(id, validMinutes: 5);
        if (string.IsNullOrEmpty(token))
            return StatusCode(500, new { error = "Não foi possível gerar token de download. Verifique configuração do servidor." });

        return Ok(new { token });
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

        if (userId == null && string.IsNullOrWhiteSpace(token))
            return Unauthorized(new { error = "Autenticação necessária para acessar imagens." });

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

        if (userId == null && string.IsNullOrWhiteSpace(token))
            return Unauthorized(new { error = "Autenticação necessária para acessar imagens." });

        var bytes = await requestService.GetRequestImageAsync(id, token, userId, "exam", index, cancellationToken);
        if (bytes == null || bytes.Length == 0)
            return NotFound(new { error = "Imagem não encontrada ou sem permissão." });
        return File(bytes, "image/jpeg", $"exame-{id}-{index}.jpg");
    }

    /// <summary>
    /// Lista gravações da consulta (Daily). Paciente, médico da consulta ou admin.
    /// room_name = consult-{requestId:N} permite identificar qual gravação pertence a qual request.
    /// </summary>
    [HttpGet("{id}/recordings")]
    public async Task<IActionResult> GetRecordings(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            return NotFound();

        var isPatient = request.PatientId == userId;
        var isDoctor = request.DoctorId.HasValue && request.DoctorId.Value == userId;
        var isAdmin = User.IsInRole("admin");

        if (!isPatient && !isDoctor && !isAdmin)
            return Forbid();

        var roomName = dailyConfig.Value.GetRoomName(id);
        var recordings = await dailyVideoService.ListRecordingsByRoomAsync(roomName, cancellationToken);

        return Ok(new { requestId = id, roomName, recordings });
    }

    /// <summary>
    /// Retorna signed URL para download do .txt da transcrição (bucket privado).
    /// Médico ou paciente da consulta. expiresIn: segundos (padrão 3600).
    /// </summary>
    [HttpGet("{id}/transcript-download-url")]
    public async Task<IActionResult> GetTranscriptDownloadUrl(
        Guid id,
        [FromQuery] int expiresIn = 3600,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        var url = await requestService.GetTranscriptDownloadUrlAsync(id, userId, Math.Clamp(expiresIn, 60, 86400), cancellationToken);
        if (url == null)
            return NotFound(new { error = "Transcrição não encontrada ou sem permissão." });
        return Ok(new { signedUrl = url, expiresIn });
    }

    /// <summary>
    /// Retorna signed URL para reprodução da gravação de vídeo da consulta (bucket privado).
    /// Médico ou paciente da consulta. expiresIn: segundos (padrão 3600).
    /// </summary>
    [HttpGet("{id}/recording-download-url")]
    public async Task<IActionResult> GetRecordingDownloadUrl(
        Guid id,
        [FromQuery] int expiresIn = 3600,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        var url = await requestService.GetRecordingDownloadUrlAsync(id, userId, Math.Clamp(expiresIn, 60, 86400), cancellationToken);
        if (url == null)
            return NotFound(new { error = "Gravação não encontrada ou sem permissão." });
        return Ok(new { signedUrl = url, expiresIn });
    }
}
