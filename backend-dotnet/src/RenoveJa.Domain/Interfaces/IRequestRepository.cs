using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;

namespace RenoveJa.Domain.Interfaces;

public interface IRequestRepository
{
    Task<MedicalRequest?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<MedicalRequest>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<List<MedicalRequest>> GetByPatientIdAsync(Guid patientId, CancellationToken cancellationToken = default);
    Task<List<MedicalRequest>> GetByDoctorIdAsync(Guid doctorId, CancellationToken cancellationToken = default);
    Task<List<MedicalRequest>> GetByStatusAsync(RequestStatus status, CancellationToken cancellationToken = default);
    Task<List<MedicalRequest>> GetByTypeAsync(RequestType type, CancellationToken cancellationToken = default);
    Task<MedicalRequest> CreateAsync(MedicalRequest request, CancellationToken cancellationToken = default);
    Task<MedicalRequest> UpdateAsync(MedicalRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
