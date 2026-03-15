using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

public class PatientRepository(PostgresClient supabase) : IPatientRepository
{
    private const string TableName = "patients";

    public async Task<Patient?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<PatientModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<Patient?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<PatientModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<Patient> CreateAsync(Patient patient, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(patient);
        var created = await supabase.InsertAsync<PatientModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<Patient> UpdateAsync(Patient patient, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(patient);
        var updated = await supabase.UpdateAsync<PatientModel>(
            TableName,
            $"id=eq.{patient.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    private static Patient MapToDomain(PatientModel model)
    {
        return Patient.Reconstitute(
            model.Id,
            model.UserId,
            model.Name,
            model.Cpf,
            model.BirthDate,
            model.Sex,
            model.SocialName,
            model.Phone,
            model.Email,
            model.AddressLine1,
            model.City,
            model.State,
            model.ZipCode,
            model.CreatedAt,
            allergies: null,
            conditions: null,
            medications: null,
            events: null,
            consentRecordIds: null);
    }

    private static PatientModel MapToModel(Patient patient)
    {
        return new PatientModel
        {
            Id = patient.Id,
            UserId = patient.UserId,
            Name = patient.Name,
            Cpf = patient.Cpf,
            BirthDate = patient.BirthDate,
            Sex = patient.Sex,
            SocialName = patient.SocialName,
            Phone = patient.Phone,
            Email = patient.Email,
            AddressLine1 = patient.AddressLine1,
            City = patient.City,
            State = patient.State,
            ZipCode = patient.ZipCode,
            CreatedAt = patient.CreatedAt
        };
    }
}
