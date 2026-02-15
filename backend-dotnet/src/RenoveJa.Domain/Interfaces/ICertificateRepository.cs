using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

public interface ICertificateRepository
{
    Task<DoctorCertificate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<DoctorCertificate?> GetActiveByDoctorIdAsync(Guid doctorProfileId, CancellationToken cancellationToken = default);
    Task<List<DoctorCertificate>> GetByDoctorIdAsync(Guid doctorProfileId, CancellationToken cancellationToken = default);
    Task<DoctorCertificate> CreateAsync(DoctorCertificate certificate, CancellationToken cancellationToken = default);
    Task<DoctorCertificate> UpdateAsync(DoctorCertificate certificate, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
