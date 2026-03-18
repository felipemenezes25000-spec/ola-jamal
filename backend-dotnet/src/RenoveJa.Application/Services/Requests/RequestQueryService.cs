using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.Helpers;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Requests;

/// <summary>
/// Serviço de leitura/consulta de solicitações médicas.
/// </summary>
public class RequestQueryService(
    IRequestRepository requestRepository,
    IUserRepository userRepository,
    IConsultationAnamnesisRepository consultationAnamnesisRepository,
    IDocumentTokenService documentTokenService,
    IStorageService storageService,
    IOptions<ApiConfig> apiConfig,
    ILogger<RequestQueryService> logger) : IRequestQueryService
{
    private readonly string _apiBaseUrl = (apiConfig?.Value?.BaseUrl ?? "").Trim();

    public async Task<List<RequestResponseDto>> GetUserRequestsAsync(
        Guid userId,
        string? status = null,
        string? type = null,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("[GetUserRequests] userId={UserId}", userId);

        var user = await userRepository.GetByIdAsync(userId, cancellationToken);
        logger.LogDebug("[GetUserRequests] user from DB: Id={UserId}, Role={Role}, Email={Email}",
            user?.Id, user?.Role.ToString(), user?.Email ?? "(null)");

        List<MedicalRequest> requests;

        if (user?.Role == UserRole.Doctor)
        {
            logger.LogDebug("[GetUserRequests] branch: Doctor - fetching assigned + available (1 query for queue)");

            var doctorRequests = await requestRepository.GetByDoctorIdAsync(userId, cancellationToken);
            var available = await requestRepository.GetAvailableForQueueAsync(cancellationToken);

            logger.LogDebug("[GetUserRequests] doctor: assignedCount={Assigned}, availableInQueue={Available}",
                doctorRequests.Count, available.Count);

            requests = doctorRequests.Concat(available)
                .DistinctBy(r => r.Id)
                .OrderByDescending(r => r.CreatedAt)
                .ToList();

            logger.LogDebug("[GetUserRequests] doctor: totalRequests={Total}", requests.Count);
        }
        else
        {
            logger.LogDebug("[GetUserRequests] branch: Patient (or user not found) - fetching by patient_id");
            requests = await requestRepository.GetByPatientIdAsync(userId, cancellationToken);
            logger.LogDebug("[GetUserRequests] patient: totalRequests={Total}", requests.Count);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statusEnum = EnumHelper.ParseSnakeCase<RequestStatus>(status);
            requests = requests.Where(r => r.Status == statusEnum).ToList();
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            var typeEnum = EnumHelper.ParseSnakeCase<RequestType>(type);
            requests = requests.Where(r => r.RequestType == typeEnum).ToList();
        }

        var consultationIds = requests.Where(r => r.RequestType == RequestType.Consultation).Select(r => r.Id).ToList();
        var anamnesisByRequest = consultationIds.Count > 0
            ? await consultationAnamnesisRepository.GetByRequestIdsAsync(consultationIds, cancellationToken)
            : new Dictionary<Guid, ConsultationAnamnesis>();

        var result = new List<RequestResponseDto>();
        foreach (var r in requests)
        {
            string? ct = null, ca = null, cs = null, ce = null, csoap = null;
            var hasRecording = false;
            if (r.RequestType == RequestType.Consultation && r.DoctorId == userId && anamnesisByRequest.TryGetValue(r.Id, out var a))
            {
                ct = a.TranscriptText; ca = a.AnamnesisJson; cs = a.AiSuggestionsJson; ce = a.EvidenceJson; csoap = a.SoapNotesJson;
                hasRecording = !string.IsNullOrWhiteSpace(a.RecordingFileUrl);
            }
            result.Add(RequestHelpers.MapRequestToDto(r, _apiBaseUrl, documentTokenService, ct, ca, cs, ce, csoap, hasRecording));
        }
        logger.LogDebug("[GetUserRequests] final count after filters: {Count}", result.Count);
        return result;
    }

    public async Task<PagedResponse<RequestResponseDto>> GetUserRequestsPagedAsync(
        Guid userId,
        string? status = null,
        string? type = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        logger.LogDebug("[GetUserRequestsPaged] userId={UserId} page={Page} pageSize={PageSize}", userId, page, pageSize);

        var user = await userRepository.GetByIdAsync(userId, cancellationToken);

        List<RequestResponseDto> items;
        int totalCount;

        if (user?.Role == UserRole.Doctor)
        {
            // PERF: paginação real no banco — evita buscar todos os pedidos + Skip/Take em memória.
            var (domainItems, total) = await requestRepository.GetDoctorQueuePagedAsync(
                userId, status, type, page, pageSize, cancellationToken);
            totalCount = total;

            // Busca anamneses apenas para os pedidos de consulta da página atual
            var consultationIds = domainItems.Where(r => r.RequestType == RequestType.Consultation).Select(r => r.Id).ToList();
            var anamnesisByRequest = consultationIds.Count > 0
                ? await consultationAnamnesisRepository.GetByRequestIdsAsync(consultationIds, cancellationToken)
                : new Dictionary<Guid, ConsultationAnamnesis>();

            items = new List<RequestResponseDto>();
            foreach (var r in domainItems)
            {
                string? ct = null, ca = null, cs = null, ce = null, csoap = null;
                var hasRecording = false;
                if (r.RequestType == RequestType.Consultation && r.DoctorId == userId && anamnesisByRequest.TryGetValue(r.Id, out var a))
                {
                    ct = a.TranscriptText; ca = a.AnamnesisJson; cs = a.AiSuggestionsJson; ce = a.EvidenceJson; csoap = a.SoapNotesJson;
                    hasRecording = !string.IsNullOrWhiteSpace(a.RecordingFileUrl);
                }
                items.Add(RequestHelpers.MapRequestToDto(r, _apiBaseUrl, documentTokenService, ct, ca, cs, ce, csoap, hasRecording));
            }
        }
        else
        {
            // PERF: paginação real no banco para paciente também
            var (rawItems, total) = await requestRepository.GetByPatientIdPagedAsync(
                userId, status, type, page, pageSize, cancellationToken);
            var domainItems = rawItems ?? new List<MedicalRequest>();
            totalCount = total;

            var consultationIds = domainItems.Where(r => r.RequestType == RequestType.Consultation).Select(r => r.Id).ToList();
            var anamnesisByRequest = consultationIds.Count > 0
                ? await consultationAnamnesisRepository.GetByRequestIdsAsync(consultationIds, cancellationToken)
                : new Dictionary<Guid, ConsultationAnamnesis>();

            items = new List<RequestResponseDto>();
            foreach (var r in domainItems)
            {
                string? ct = null, ca = null, cs = null, ce = null, csoap = null;
                var hasRecording = false;
                if (r.RequestType == RequestType.Consultation && anamnesisByRequest.TryGetValue(r.Id, out var a))
                {
                    ct = a.TranscriptText; ca = a.AnamnesisJson; cs = a.AiSuggestionsJson; ce = a.EvidenceJson; csoap = a.SoapNotesJson;
                    hasRecording = !string.IsNullOrWhiteSpace(a.RecordingFileUrl);
                }
                items.Add(RequestHelpers.MapRequestToDto(r, _apiBaseUrl, documentTokenService, ct, ca, cs, ce, csoap, hasRecording));
            }
        }

        logger.LogDebug("[GetUserRequestsPaged] totalCount={Total} itemsReturned={Items}", totalCount, items.Count);
        return new PagedResponse<RequestResponseDto>(items, totalCount, page, pageSize);
    }
    public async Task<RequestResponseDto> GetRequestByIdAsync(
        Guid id,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(id, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        var isPatient = request.PatientId == userId;
        var isAssignedDoctor = request.DoctorId.HasValue && request.DoctorId == userId;
        var isAvailableForDoctor = !request.DoctorId.HasValue || request.DoctorId == Guid.Empty;

        User? user = null;
        if (!isPatient && !isAssignedDoctor && isAvailableForDoctor)
        {
            user = await userRepository.GetByIdAsync(userId, cancellationToken);
        }

        var canAccess = isPatient
            || isAssignedDoctor
            || (isAvailableForDoctor && user?.Role == UserRole.Doctor);

        if (!canAccess)
            throw new KeyNotFoundException("Request not found");

        string? ct = null, ca = null, cs = null, ce = null, csoap = null;
        var hasRecording = false;
        if (isAssignedDoctor)
        {
            var consultationData = await GetConsultationAnamnesisIfAnyAsync(request.Id, request.RequestType, cancellationToken);
            ct = consultationData.Transcript;
            ca = consultationData.AnamnesisJson;
            cs = consultationData.SuggestionsJson;
            ce = consultationData.EvidenceJson;
            csoap = consultationData.SoapNotesJson;
            hasRecording = consultationData.HasRecording;
        }
        return RequestHelpers.MapRequestToDto(request, _apiBaseUrl, documentTokenService, ct, ca, cs, ce, csoap, hasRecording);
    }

    public async Task<List<RequestResponseDto>> GetPatientRequestsAsync(
        Guid doctorId,
        Guid patientId,
        CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(doctorId, cancellationToken);
        if (user?.Role != UserRole.Doctor)
            throw new UnauthorizedAccessException("Apenas médicos podem acessar o prontuário do paciente.");

        var requests = await requestRepository.GetByPatientIdAsync(patientId, cancellationToken);
        // FIX B33: Only show requests assigned to the requesting doctor — do not expose unassigned requests
        requests = requests
            .Where(r => r.DoctorId == doctorId)
            .OrderByDescending(r => r.CreatedAt)
            .ToList();

        var consultationIds = requests.Where(r => r.RequestType == RequestType.Consultation).Select(r => r.Id).ToList();
        var anamnesisByRequest = consultationIds.Count > 0
            ? await consultationAnamnesisRepository.GetByRequestIdsAsync(consultationIds, cancellationToken)
            : new Dictionary<Guid, ConsultationAnamnesis>();

        var dtos = new List<RequestResponseDto>();
        foreach (var r in requests)
        {
            string? ct = null, ca = null, cs = null, ce = null, csoap = null;
            var hasRecording = false;
            if (r.RequestType == RequestType.Consultation && anamnesisByRequest.TryGetValue(r.Id, out var a))
            {
                ct = a.TranscriptText; ca = a.AnamnesisJson; cs = a.AiSuggestionsJson; ce = a.EvidenceJson; csoap = a.SoapNotesJson;
                hasRecording = !string.IsNullOrWhiteSpace(a.RecordingFileUrl);
            }
            dtos.Add(RequestHelpers.MapRequestToDto(r, _apiBaseUrl, documentTokenService, ct, ca, cs, ce, csoap, hasRecording));
        }
        return dtos;
    }

    public async Task<PatientProfileForDoctorDto?> GetPatientProfileForDoctorAsync(
        Guid doctorId,
        Guid patientId,
        CancellationToken cancellationToken = default)
    {
        var doctor = await userRepository.GetByIdAsync(doctorId, cancellationToken);
        if (doctor?.Role != UserRole.Doctor)
            return null;

        var requests = await requestRepository.GetByPatientIdAsync(patientId, cancellationToken);
        // FIX B33: Only allow access if doctor has assigned requests for this patient
        var hasAccess = requests.Any(r => r.DoctorId == doctorId);
        if (!hasAccess)
            return null;

        var user = await userRepository.GetByIdAsync(patientId, cancellationToken);
        if (user == null || user.Role != UserRole.Patient)
            return null;

        var cpfMasked = RequestHelpers.MaskCpf(user.Cpf);

        // Gerar presigned URL para avatar (bucket S3 privado)
        var avatarUrl = await ResolveAvatarUrlAsync(user.AvatarUrl);

        return new PatientProfileForDoctorDto(
            user.Name,
            user.Email.Value,
            user.Phone?.Value,
            user.BirthDate,
            cpfMasked,
            user.Gender,
            user.Street,
            user.Number,
            user.Neighborhood,
            user.Complement,
            user.City,
            user.State,
            user.PostalCode,
            avatarUrl
        );
    }

    public async Task<(int PendingCount, int InReviewCount, int CompletedCount, decimal TotalEarnings)> GetDoctorStatsAsync(
        Guid doctorId, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByIdAsync(doctorId, cancellationToken);
        if (user?.Role != UserRole.Doctor)
            throw new UnauthorizedAccessException("Apenas médicos podem acessar as estatísticas.");
        return await requestRepository.GetDoctorStatsAsync(doctorId, cancellationToken);
    }

    private async Task<(string? Transcript, string? AnamnesisJson, string? SuggestionsJson, string? EvidenceJson, string? SoapNotesJson, bool HasRecording)> GetConsultationAnamnesisIfAnyAsync(
        Guid requestId,
        RequestType requestType,
        CancellationToken cancellationToken)
    {
        if (requestType != RequestType.Consultation) return (null, null, null, null, null, false);
        var a = await consultationAnamnesisRepository.GetByRequestIdAsync(requestId, cancellationToken);
        if (a == null) return (null, null, null, null, null, false);
        var hasRecording = !string.IsNullOrWhiteSpace(a.RecordingFileUrl);
        return (a.TranscriptText, a.AnamnesisJson, a.AiSuggestionsJson, a.EvidenceJson, a.SoapNotesJson, hasRecording);
    }

    /// <summary>
    /// Converte URL direta do S3 em presigned URL (1h) para buckets privados.
    /// </summary>
    private async Task<string?> ResolveAvatarUrlAsync(string? rawUrl)
    {
        if (string.IsNullOrWhiteSpace(rawUrl)) return null;
        if (!rawUrl.Contains(".amazonaws.com")) return rawUrl;
        try
        {
            var path = storageService.ExtractPathFromStorageUrl(rawUrl);
            if (path != null)
            {
                var signed = await storageService.CreateSignedUrlAsync(path, 3600);
                if (signed != null) return signed;
            }
        }
        catch { /* fallback to original URL */ }
        return rawUrl;
    }
}
