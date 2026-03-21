using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

/// <summary>
/// Agregado de prontuário clínico mínimo do paciente.
/// Focado em histórico longitudinal (alergias, condições, medicações contínuas, eventos relevantes)
/// e ligação com consentimentos LGPD.
/// </summary>
public class Patient : AggregateRoot
{
    public Guid UserId { get; private set; }

    public string Name { get; private set; }
    public string? SocialName { get; private set; }
    public string Cpf { get; private set; }
    public DateTime? BirthDate { get; private set; }
    public string? Sex { get; private set; }

    public string? Phone { get; private set; }
    public string? Email { get; private set; }

    public string? AddressLine1 { get; private set; }
    public string? City { get; private set; }
    public string? State { get; private set; }
    public string? ZipCode { get; private set; }

    private readonly List<PatientAllergy> _allergies = [];
    private readonly List<PatientCondition> _conditions = [];
    private readonly List<PatientMedication> _medications = [];
    private readonly List<PatientClinicalEvent> _events = [];
    private readonly List<Guid> _consentRecordIds = [];

    public IReadOnlyCollection<PatientAllergy> Allergies => _allergies.AsReadOnly();
    public IReadOnlyCollection<PatientCondition> Conditions => _conditions.AsReadOnly();
    public IReadOnlyCollection<PatientMedication> Medications => _medications.AsReadOnly();
    public IReadOnlyCollection<PatientClinicalEvent> Events => _events.AsReadOnly();
    public IReadOnlyCollection<Guid> ConsentRecordIds => _consentRecordIds.AsReadOnly();

    private Patient() : base()
    {
        Name = null!;
        Cpf = null!;
    }

    private Patient(
        Guid id,
        Guid userId,
        string name,
        string cpf,
        DateTime? birthDate,
        string? sex,
        string? socialName,
        string? phone,
        string? email,
        string? addressLine1,
        string? city,
        string? state,
        string? zipCode,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        UserId = userId;
        Name = name;
        Cpf = cpf;
        BirthDate = birthDate;
        Sex = sex;
        SocialName = socialName;
        Phone = phone;
        Email = email;
        AddressLine1 = addressLine1;
        City = city;
        State = state;
        ZipCode = zipCode;
    }

    public static Patient CreateFromUser(
        Guid userId,
        string name,
        string? cpf,
        DateTime? birthDate,
        string? sex,
        string? socialName,
        string? phone,
        string? email,
        string? addressLine1,
        string? city,
        string? state,
        string? zipCode)
    {
        if (userId == Guid.Empty)
            throw new DomainException("UserId is required");

        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Patient name is required");

        // CPF may be absent for users who registered via OAuth and have not yet completed
        // their profile. We store an empty string so the patients row can be created and the
        // encounter can proceed. A proper CPF can be captured later when the user fills in
        // their profile. Full CPF validation is enforced at the prescription-signing step.
        var normalizedCpf = NormalizeAndValidateCpf(cpf, required: false);

        return new Patient(
            Guid.NewGuid(),
            userId,
            name.Trim(),
            normalizedCpf,
            birthDate,
            sex,
            socialName,
            phone,
            email,
            addressLine1,
            city,
            state,
            zipCode);
    }

    /// <summary>
    /// Normalizes a CPF string to digits only.
    /// When <paramref name="required"/> is true an empty/null CPF throws <see cref="DomainException"/>.
    /// When false an empty/null CPF is accepted and stored as an empty string.
    /// </summary>
    private static string NormalizeAndValidateCpf(string? cpf, bool required = true)
    {
        if (string.IsNullOrWhiteSpace(cpf))
        {
            if (required)
                throw new DomainException("CPF is required");
            return string.Empty;
        }

        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        if (digits.Length != 11)
            throw new DomainException("CPF must contain 11 digits");

        return digits;
    }

    public void UpdateDemographics(
        string? name = null,
        string? socialName = null,
        DateTime? birthDate = null,
        string? sex = null)
    {
        if (!string.IsNullOrWhiteSpace(name))
            Name = name.Trim();

        if (socialName != null)
            SocialName = string.IsNullOrWhiteSpace(socialName) ? null : socialName.Trim();

        if (birthDate.HasValue)
            BirthDate = birthDate;

        if (sex != null)
            Sex = sex;
    }

    public void UpdateContact(
        string? phone = null,
        string? email = null,
        string? addressLine1 = null,
        string? city = null,
        string? state = null,
        string? zipCode = null)
    {
        if (phone != null)
            Phone = phone;
        if (email != null)
            Email = email;
        if (addressLine1 != null)
            AddressLine1 = addressLine1;
        if (city != null)
            City = city;
        if (state != null)
            State = state;
        if (zipCode != null)
            ZipCode = zipCode;
    }

    public PatientAllergy AddAllergy(string type, string description, string? severity, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(type))
            throw new DomainException("Allergy type is required");

        var allergy = new PatientAllergy(Guid.NewGuid(), Id, type.Trim(), description, severity, isActive, DateTime.UtcNow);
        _allergies.Add(allergy);
        return allergy;
    }

    public PatientCondition AddCondition(string? icd10Code, string description, DateTime? startDate, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new DomainException("Condition description is required");

        var condition = new PatientCondition(Guid.NewGuid(), Id, icd10Code, description.Trim(), startDate, null, isActive, DateTime.UtcNow);
        _conditions.Add(condition);
        return condition;
    }

    public PatientMedication AddMedication(string drug, string? dose, string? form, string? posology, DateTime? startDate, bool isActive)
    {
        if (string.IsNullOrWhiteSpace(drug))
            throw new DomainException("Medication drug is required");

        var medication = new PatientMedication(Guid.NewGuid(), Id, drug.Trim(), dose, form, posology, startDate, null, isActive, DateTime.UtcNow);
        _medications.Add(medication);
        return medication;
    }

    public PatientClinicalEvent AddClinicalEvent(string description, DateTime? occurredAt)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new DomainException("Clinical event description is required");

        var evt = new PatientClinicalEvent(Guid.NewGuid(), Id, description.Trim(), occurredAt ?? DateTime.UtcNow, DateTime.UtcNow);
        _events.Add(evt);
        return evt;
    }

    public void LinkConsentRecord(Guid consentRecordId)
    {
        if (consentRecordId == Guid.Empty)
            throw new DomainException("ConsentRecordId is required");

        if (!_consentRecordIds.Contains(consentRecordId))
            _consentRecordIds.Add(consentRecordId);
    }

    public static Patient Reconstitute(
        Guid id,
        Guid userId,
        string name,
        string cpf,
        DateTime? birthDate,
        string? sex,
        string? socialName,
        string? phone,
        string? email,
        string? addressLine1,
        string? city,
        string? state,
        string? zipCode,
        DateTime createdAt,
        IEnumerable<PatientAllergy>? allergies = null,
        IEnumerable<PatientCondition>? conditions = null,
        IEnumerable<PatientMedication>? medications = null,
        IEnumerable<PatientClinicalEvent>? events = null,
        IEnumerable<Guid>? consentRecordIds = null)
    {
        var patient = new Patient(
            id,
            userId,
            name,
            cpf,
            birthDate,
            sex,
            socialName,
            phone,
            email,
            addressLine1,
            city,
            state,
            zipCode,
            createdAt);

        if (allergies != null)
            patient._allergies.AddRange(allergies);
        if (conditions != null)
            patient._conditions.AddRange(conditions);
        if (medications != null)
            patient._medications.AddRange(medications);
        if (events != null)
            patient._events.AddRange(events);
        if (consentRecordIds != null)
            patient._consentRecordIds.AddRange(consentRecordIds);

        return patient;
    }
}

public class PatientAllergy : Entity
{
    public Guid PatientId { get; private set; }
    public string Type { get; private set; }
    public string? Description { get; private set; }
    public string? Severity { get; private set; }
    public bool IsActive { get; private set; }

    private PatientAllergy() : base()
    {
        Type = null!;
        PatientId = Guid.Empty;
    }

    internal PatientAllergy(
        Guid id,
        Guid patientId,
        string type,
        string? description,
        string? severity,
        bool isActive,
        DateTime createdAt)
        : base(id, createdAt)
    {
        PatientId = patientId;
        Type = type;
        Description = description;
        Severity = severity;
        IsActive = isActive;
    }

    public void SetActive(bool isActive) => IsActive = isActive;
}

public class PatientCondition : Entity
{
    public Guid PatientId { get; private set; }
    public string? Icd10Code { get; private set; }
    public string Description { get; private set; }
    public DateTime? StartDate { get; private set; }
    public DateTime? EndDate { get; private set; }
    public bool IsActive { get; private set; }

    private PatientCondition() : base()
    {
        PatientId = Guid.Empty;
        Description = null!;
    }

    internal PatientCondition(
        Guid id,
        Guid patientId,
        string? icd10Code,
        string description,
        DateTime? startDate,
        DateTime? endDate,
        bool isActive,
        DateTime createdAt)
        : base(id, createdAt)
    {
        PatientId = patientId;
        Icd10Code = icd10Code;
        Description = description;
        StartDate = startDate;
        EndDate = endDate;
        IsActive = isActive;
    }

    public void Close(DateTime? endDate = null)
    {
        EndDate = endDate ?? DateTime.UtcNow;
        IsActive = false;
    }

    public void Reactivate()
    {
        IsActive = true;
        EndDate = null;
    }
}

public class PatientMedication : Entity
{
    public Guid PatientId { get; private set; }
    public string Drug { get; private set; }
    public string? Dose { get; private set; }
    public string? Form { get; private set; }
    public string? Posology { get; private set; }
    public DateTime? StartDate { get; private set; }
    public DateTime? EndDate { get; private set; }
    public bool IsActive { get; private set; }

    private PatientMedication() : base()
    {
        PatientId = Guid.Empty;
        Drug = null!;
    }

    internal PatientMedication(
        Guid id,
        Guid patientId,
        string drug,
        string? dose,
        string? form,
        string? posology,
        DateTime? startDate,
        DateTime? endDate,
        bool isActive,
        DateTime createdAt)
        : base(id, createdAt)
    {
        PatientId = patientId;
        Drug = drug;
        Dose = dose;
        Form = form;
        Posology = posology;
        StartDate = startDate;
        EndDate = endDate;
        IsActive = isActive;
    }

    public void Stop(DateTime? endDate = null)
    {
        EndDate = endDate ?? DateTime.UtcNow;
        IsActive = false;
    }
}

public class PatientClinicalEvent : Entity
{
    public Guid PatientId { get; private set; }
    public string Description { get; private set; }
    public DateTime OccurredAt { get; private set; }

    private PatientClinicalEvent() : base()
    {
        PatientId = Guid.Empty;
        Description = null!;
    }

    internal PatientClinicalEvent(
        Guid id,
        Guid patientId,
        string description,
        DateTime occurredAt,
        DateTime createdAt)
        : base(id, createdAt)
    {
        PatientId = patientId;
        Description = description;
        OccurredAt = occurredAt;
    }
}

