using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

public interface IDoctorRepository
{
    Task<DoctorProfile?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<DoctorProfile?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<List<DoctorProfile>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<List<DoctorProfile>> GetBySpecialtyAsync(string specialty, CancellationToken cancellationToken = default);
    Task<List<DoctorProfile>> GetAvailableAsync(string? specialty = null, CancellationToken cancellationToken = default);
    Task<(List<DoctorProfile> Items, int TotalCount)> GetPagedAsync(string? specialty, bool? available, int offset, int limit, CancellationToken cancellationToken = default);
    Task<DoctorProfile> CreateAsync(DoctorProfile doctorProfile, CancellationToken cancellationToken = default);
    Task<DoctorProfile> UpdateAsync(DoctorProfile doctorProfile, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
