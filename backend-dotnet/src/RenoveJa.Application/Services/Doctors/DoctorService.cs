using RenoveJa.Application.DTOs;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Application.DTOs.Doctors;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Doctors;

/// <summary>
/// Serviço de listagem e gestão de médicos.
/// </summary>
public interface IDoctorService
{
    Task<List<DoctorListResponseDto>> GetDoctorsAsync(string? specialty, bool? available, CancellationToken cancellationToken = default);
    Task<PagedResponse<DoctorListResponseDto>> GetDoctorsPagedAsync(string? specialty, bool? available, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<DoctorListResponseDto> GetDoctorByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<DoctorListResponseDto>> GetQueueAsync(string? specialty, CancellationToken cancellationToken = default);
    Task<DoctorProfileDto> UpdateAvailabilityAsync(Guid id, UpdateDoctorAvailabilityDto dto, CancellationToken cancellationToken = default);
    Task<DoctorProfileDto?> GetProfileByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<DoctorProfileDto> UpdateProfileByUserIdAsync(Guid userId, UpdateDoctorProfileDto dto, CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementação do serviço de médicos (listar, obter por ID, fila, disponibilidade).
/// </summary>
public class DoctorService(
    IDoctorRepository doctorRepository,
    IUserRepository userRepository) : IDoctorService
{
    /// <summary>
    /// Lista médicos, opcionalmente por especialidade e disponibilidade.
    /// Usa batch query para evitar N+1.
    /// </summary>
    public async Task<List<DoctorListResponseDto>> GetDoctorsAsync(
        string? specialty,
        bool? available,
        CancellationToken cancellationToken = default)
    {
        List<DoctorProfile> profiles;

        if (available == true)
        {
            profiles = await doctorRepository.GetAvailableAsync(specialty, cancellationToken);
        }
        else if (!string.IsNullOrWhiteSpace(specialty))
        {
            profiles = await doctorRepository.GetBySpecialtyAsync(specialty, cancellationToken);
        }
        else
        {
            profiles = await doctorRepository.GetAllAsync(cancellationToken);
        }

        if (profiles.Count == 0)
            return new List<DoctorListResponseDto>();

        // Batch: buscar todos os users de uma vez (fix N+1)
        var userIds = profiles.Select(p => p.UserId).Distinct();
        var users = await userRepository.GetByIdsAsync(userIds, cancellationToken);
        var userMap = users.ToDictionary(u => u.Id);

        var result = new List<DoctorListResponseDto>();

        foreach (var profile in profiles)
        {
            if (userMap.TryGetValue(profile.UserId, out var user))
            {
                result.Add(new DoctorListResponseDto(
                    profile.Id,
                    user.Name,
                    user.Email,
                    user.Phone?.Value,
                    user.AvatarUrl,
                    profile.Crm,
                    profile.CrmState,
                    profile.Specialty,
                    profile.Bio,
                    profile.Rating,
                    profile.TotalConsultations,
                    profile.Available));
            }
        }

        return result;
    }

    /// <summary>
    /// Lista médicos com paginação na query (Supabase), opcionalmente por especialidade e disponibilidade.
    /// </summary>
    public async Task<PagedResponse<DoctorListResponseDto>> GetDoctorsPagedAsync(
        string? specialty,
        bool? available,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var offset = (page - 1) * pageSize;
        var (profiles, totalCount) = await doctorRepository.GetPagedAsync(specialty, available, offset, pageSize, cancellationToken);

        if (profiles.Count == 0)
            return new PagedResponse<DoctorListResponseDto>(new List<DoctorListResponseDto>(), totalCount, page, pageSize);

        var userIds = profiles.Select(p => p.UserId).Distinct();
        var users = await userRepository.GetByIdsAsync(userIds, cancellationToken);
        var userMap = users.ToDictionary(u => u.Id);

        var items = new List<DoctorListResponseDto>();
        foreach (var profile in profiles)
        {
            if (userMap.TryGetValue(profile.UserId, out var user))
            {
                items.Add(new DoctorListResponseDto(
                    profile.Id,
                    user.Name,
                    user.Email,
                    user.Phone?.Value,
                    user.AvatarUrl,
                    profile.Crm,
                    profile.CrmState,
                    profile.Specialty,
                    profile.Bio,
                    profile.Rating,
                    profile.TotalConsultations,
                    profile.Available));
            }
        }

        return new PagedResponse<DoctorListResponseDto>(items, totalCount, page, pageSize);
    }

    /// <summary>
    /// Obtém um médico pelo ID do perfil.
    /// </summary>
    public async Task<DoctorListResponseDto> GetDoctorByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var profile = await doctorRepository.GetByIdAsync(id, cancellationToken);
        if (profile == null)
            throw new KeyNotFoundException("Doctor not found");

        var user = await userRepository.GetByIdAsync(profile.UserId, cancellationToken);
        if (user == null)
            throw new InvalidOperationException("Doctor user not found");

        return new DoctorListResponseDto(
            profile.Id,
            user.Name,
            user.Email,
            user.Phone?.Value,
            user.AvatarUrl,
            profile.Crm,
            profile.CrmState,
            profile.Specialty,
            profile.Bio,
            profile.Rating,
            profile.TotalConsultations,
            profile.Available);
    }

    /// <summary>
    /// Retorna a fila de médicos disponíveis (por especialidade opcional).
    /// </summary>
    public async Task<List<DoctorListResponseDto>> GetQueueAsync(
        string? specialty,
        CancellationToken cancellationToken = default)
    {
        return await GetDoctorsAsync(specialty, true, cancellationToken);
    }

    /// <summary>
    /// Atualiza a disponibilidade de um médico.
    /// </summary>
    public async Task<DoctorProfileDto> UpdateAvailabilityAsync(
        Guid id,
        UpdateDoctorAvailabilityDto dto,
        CancellationToken cancellationToken = default)
    {
        var profile = await doctorRepository.GetByIdAsync(id, cancellationToken);
        if (profile == null)
            throw new KeyNotFoundException("Doctor not found");

        profile.SetAvailability(dto.Available);
        profile = await doctorRepository.UpdateAsync(profile, cancellationToken);

        return new DoctorProfileDto(
            profile.Id,
            profile.UserId,
            profile.Crm,
            profile.CrmState,
            profile.Specialty,
            profile.Bio,
            profile.Rating,
            profile.TotalConsultations,
            profile.Available,
            profile.CreatedAt,
            profile.ProfessionalAddress,
            profile.ProfessionalPhone);
    }

    /// <summary>
    /// Obtém o perfil do médico pelo user_id (para o médico logado).
    /// </summary>
    public async Task<DoctorProfileDto?> GetProfileByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var profile = await doctorRepository.GetByUserIdAsync(userId, cancellationToken);
        if (profile == null)
            return null;

        return new DoctorProfileDto(
            profile.Id,
            profile.UserId,
            profile.Crm,
            profile.CrmState,
            profile.Specialty,
            profile.Bio,
            profile.Rating,
            profile.TotalConsultations,
            profile.Available,
            profile.CreatedAt,
            profile.ProfessionalAddress,
            profile.ProfessionalPhone);
    }

    /// <summary>
    /// Atualiza endereço e telefone profissional do médico (por user_id). Obrigatório para assinar receitas.
    /// </summary>
    public async Task<DoctorProfileDto> UpdateProfileByUserIdAsync(
        Guid userId,
        UpdateDoctorProfileDto dto,
        CancellationToken cancellationToken = default)
    {
        var profile = await doctorRepository.GetByUserIdAsync(userId, cancellationToken);
        if (profile == null)
            throw new KeyNotFoundException("Perfil de médico não encontrado para este usuário.");

        profile.UpdateProfile(professionalAddress: dto.ProfessionalAddress, professionalPhone: dto.ProfessionalPhone);
        profile = await doctorRepository.UpdateAsync(profile, cancellationToken);

        return new DoctorProfileDto(
            profile.Id,
            profile.UserId,
            profile.Crm,
            profile.CrmState,
            profile.Specialty,
            profile.Bio,
            profile.Rating,
            profile.TotalConsultations,
            profile.Available,
            profile.CreatedAt,
            profile.ProfessionalAddress,
            profile.ProfessionalPhone);
    }
}
