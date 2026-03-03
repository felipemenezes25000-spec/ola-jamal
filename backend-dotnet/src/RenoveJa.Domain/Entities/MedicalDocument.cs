using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;
using RenoveJa.Domain.ValueObjects;

namespace RenoveJa.Domain.Entities;

/// <summary>
/// Agregado base para documentos médicos (receita, pedido de exame, atestado/relatório).
/// Após assinado, o conteúdo clínico fica imutável.
/// </summary>
public abstract class MedicalDocument : AggregateRoot
{
    public Guid PatientId { get; protected set; }
    public Guid PractitionerId { get; protected set; }
    public Guid? EncounterId { get; protected set; }

    public DocumentType DocumentType { get; protected set; }
    public DocumentStatus Status { get; protected set; } = DocumentStatus.Draft;

    public Guid? PreviousDocumentId { get; protected set; }

    public SignatureInfo? Signature { get; protected set; }

    public DateTime? SignedAt => Signature?.SignedAt;

    protected MedicalDocument() : base()
    {
        PatientId = Guid.Empty;
        PractitionerId = Guid.Empty;
    }

    protected MedicalDocument(
        Guid id,
        Guid patientId,
        Guid practitionerId,
        Guid? encounterId,
        DocumentType documentType,
        DocumentStatus status,
        Guid? previousDocumentId,
        SignatureInfo? signature,
        DateTime? createdAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        PatientId = patientId;
        PractitionerId = practitionerId;
        EncounterId = encounterId;
        DocumentType = documentType;
        Status = status;
        PreviousDocumentId = previousDocumentId;
        Signature = signature;
    }

    protected void EnsureCanMutateContent()
    {
        if (Status == DocumentStatus.Signed)
            throw new DomainException("Signed documents cannot be modified. Create an addendum/superseding document instead.");
    }

    public void MarkAsCancelled(string? reason = null)
    {
        if (Status == DocumentStatus.Signed)
            throw new DomainException("Signed documents cannot be cancelled; use superseded/addendum strategy.");

        Status = DocumentStatus.Cancelled;
        OnCancelled(reason);
    }

    public void MarkAsSuperseded(Guid newDocumentId)
    {
        if (newDocumentId == Guid.Empty)
            throw new DomainException("New document id is required");

        Status = DocumentStatus.Superseded;
        OnSuperseded(newDocumentId);
    }

    public void ApplySignature(SignatureInfo signature)
    {
        if (Status == DocumentStatus.Signed)
            return;

        Signature = signature ?? throw new ArgumentNullException(nameof(signature));
        Status = DocumentStatus.Signed;
        OnSigned();
    }

    protected virtual void OnSigned() { }
    protected virtual void OnCancelled(string? reason) { }
    protected virtual void OnSuperseded(Guid newDocumentId) { }
}

public sealed class Prescription : MedicalDocument
{
    private readonly List<PrescriptionItem> _items = [];
    public IReadOnlyCollection<PrescriptionItem> Items => _items.AsReadOnly();

    public string? GeneralInstructions { get; private set; }

    private Prescription() : base() { }

    private Prescription(
        Guid id,
        Guid patientId,
        Guid practitionerId,
        Guid? encounterId,
        string? generalInstructions,
        IEnumerable<PrescriptionItem>? items,
        Guid? previousDocumentId,
        SignatureInfo? signature,
        DocumentStatus status,
        DateTime? createdAt = null)
        : base(
            id,
            patientId,
            practitionerId,
            encounterId,
            DocumentType.Prescription,
            status,
            previousDocumentId,
            signature,
            createdAt)
    {
        GeneralInstructions = generalInstructions;
        if (items != null)
            _items.AddRange(items);
    }

    public static Prescription Create(
        Guid patientId,
        Guid practitionerId,
        Guid? encounterId,
        string? generalInstructions = null)
    {
        if (patientId == Guid.Empty)
            throw new DomainException("PatientId is required");
        if (practitionerId == Guid.Empty)
            throw new DomainException("PractitionerId is required");

        return new Prescription(
            Guid.NewGuid(),
            patientId,
            practitionerId,
            encounterId,
            generalInstructions,
            items: null,
            previousDocumentId: null,
            signature: null,
            status: DocumentStatus.Draft);
    }

    public PrescriptionItem AddItem(
        string drug,
        string? concentration,
        string? form,
        string? posology,
        string? duration,
        int? quantity,
        string? notes)
    {
        EnsureCanMutateContent();

        var item = new PrescriptionItem(
            Guid.NewGuid(),
            Id,
            drug,
            concentration,
            form,
            posology,
            duration,
            quantity,
            notes,
            DateTime.UtcNow);
        _items.Add(item);
        return item;
    }

    public void SetGeneralInstructions(string? instructions)
    {
        EnsureCanMutateContent();
        GeneralInstructions = instructions;
    }

    public static Prescription Reconstitute(
        Guid id,
        Guid patientId,
        Guid practitionerId,
        Guid? encounterId,
        string? generalInstructions,
        IEnumerable<PrescriptionItem> items,
        Guid? previousDocumentId,
        SignatureInfo? signature,
        DocumentStatus status,
        DateTime createdAt)
    {
        return new Prescription(
            id,
            patientId,
            practitionerId,
            encounterId,
            generalInstructions,
            items,
            previousDocumentId,
            signature,
            status,
            createdAt);
    }
}

public sealed class PrescriptionItem : Entity
{
    public Guid MedicalDocumentId { get; private set; }
    public string Drug { get; private set; }
    public string? Concentration { get; private set; }
    public string? Form { get; private set; }
    public string? Posology { get; private set; }
    public string? Duration { get; private set; }
    public int? Quantity { get; private set; }
    public string? Notes { get; private set; }

    private PrescriptionItem() : base()
    {
        Drug = null!;
        MedicalDocumentId = Guid.Empty;
    }

    internal PrescriptionItem(
        Guid id,
        Guid medicalDocumentId,
        string drug,
        string? concentration,
        string? form,
        string? posology,
        string? duration,
        int? quantity,
        string? notes,
        DateTime createdAt)
        : base(id, createdAt)
    {
        if (string.IsNullOrWhiteSpace(drug))
            throw new DomainException("Drug is required");

        MedicalDocumentId = medicalDocumentId;
        Drug = drug.Trim();
        Concentration = concentration;
        Form = form;
        Posology = posology;
        Duration = duration;
        Quantity = quantity;
        Notes = notes;
    }

    /// <summary>Reconstrói a partir de dados persistidos (usado pela infra).</summary>
    public static PrescriptionItem FromStorage(
        Guid id,
        Guid medicalDocumentId,
        string drug,
        string? concentration,
        string? form,
        string? posology,
        string? duration,
        int? quantity,
        string? notes,
        DateTime createdAt)
    {
        return new PrescriptionItem(id, medicalDocumentId, drug, concentration, form, posology, duration, quantity, notes, createdAt);
    }
}

public sealed class ExamOrder : MedicalDocument
{
    private readonly List<ExamItem> _items = [];
    public IReadOnlyCollection<ExamItem> Items => _items.AsReadOnly();

    public string? ClinicalJustification { get; private set; }
    public string? Priority { get; private set; } // rotina/urgencia

    private ExamOrder() : base() { }

    private ExamOrder(
        Guid id,
        Guid patientId,
        Guid practitionerId,
        Guid? encounterId,
        string? clinicalJustification,
        string? priority,
        IEnumerable<ExamItem>? items,
        Guid? previousDocumentId,
        SignatureInfo? signature,
        DocumentStatus status,
        DateTime? createdAt = null)
        : base(
            id,
            patientId,
            practitionerId,
            encounterId,
            DocumentType.ExamOrder,
            status,
            previousDocumentId,
            signature,
            createdAt)
    {
        ClinicalJustification = clinicalJustification;
        Priority = priority;
        if (items != null)
            _items.AddRange(items);
    }

    public static ExamOrder Create(
        Guid patientId,
        Guid practitionerId,
        Guid? encounterId,
        string? clinicalJustification = null,
        string? priority = null)
    {
        if (patientId == Guid.Empty)
            throw new DomainException("PatientId is required");
        if (practitionerId == Guid.Empty)
            throw new DomainException("PractitionerId is required");

        return new ExamOrder(
            Guid.NewGuid(),
            patientId,
            practitionerId,
            encounterId,
            clinicalJustification,
            priority,
            items: null,
            previousDocumentId: null,
            signature: null,
            status: DocumentStatus.Draft);
    }

    public ExamItem AddItem(string type, string? code, string description)
    {
        EnsureCanMutateContent();

        if (string.IsNullOrWhiteSpace(description))
            throw new DomainException("Exam description is required");

        var item = new ExamItem(
            Guid.NewGuid(),
            Id,
            type,
            code,
            description,
            DateTime.UtcNow);
        _items.Add(item);
        return item;
    }

    public void SetClinicalJustification(string? justification)
    {
        EnsureCanMutateContent();
        ClinicalJustification = justification;
    }

    public void SetPriority(string? priority)
    {
        EnsureCanMutateContent();
        Priority = priority;
    }

    public static ExamOrder Reconstitute(
        Guid id,
        Guid patientId,
        Guid practitionerId,
        Guid? encounterId,
        string? clinicalJustification,
        string? priority,
        IEnumerable<ExamItem> items,
        Guid? previousDocumentId,
        SignatureInfo? signature,
        DocumentStatus status,
        DateTime createdAt)
    {
        return new ExamOrder(
            id,
            patientId,
            practitionerId,
            encounterId,
            clinicalJustification,
            priority,
            items,
            previousDocumentId,
            signature,
            status,
            createdAt);
    }
}

public sealed class ExamItem : Entity
{
    public Guid MedicalDocumentId { get; private set; }
    public string Type { get; private set; }
    public string? Code { get; private set; }
    public string Description { get; private set; }

    private ExamItem() : base()
    {
        Type = null!;
        Description = null!;
        MedicalDocumentId = Guid.Empty;
    }

    internal ExamItem(
        Guid id,
        Guid medicalDocumentId,
        string type,
        string? code,
        string description,
        DateTime createdAt)
        : base(id, createdAt)
    {
        MedicalDocumentId = medicalDocumentId;
        Type = string.IsNullOrWhiteSpace(type) ? "exam" : type.Trim();
        Code = code;
        Description = description.Trim();
    }

    /// <summary>Reconstrói a partir de dados persistidos (usado pela infra).</summary>
    public static ExamItem FromStorage(
        Guid id,
        Guid medicalDocumentId,
        string type,
        string? code,
        string description,
        DateTime createdAt)
    {
        return new ExamItem(id, medicalDocumentId, type, code, description, createdAt);
    }
}

public sealed class MedicalReport : MedicalDocument
{
    public string Body { get; private set; }
    public string? Icd10Code { get; private set; }
    public int? LeaveDays { get; private set; }

    private MedicalReport() : base()
    {
        Body = null!;
    }

    private MedicalReport(
        Guid id,
        Guid patientId,
        Guid practitionerId,
        Guid? encounterId,
        string body,
        string? icd10Code,
        int? leaveDays,
        Guid? previousDocumentId,
        SignatureInfo? signature,
        DocumentStatus status,
        DateTime? createdAt = null)
        : base(
            id,
            patientId,
            practitionerId,
            encounterId,
            DocumentType.MedicalReport,
            status,
            previousDocumentId,
            signature,
            createdAt)
    {
        Body = body;
        Icd10Code = icd10Code;
        LeaveDays = leaveDays;
    }

    public static MedicalReport Create(
        Guid patientId,
        Guid practitionerId,
        Guid? encounterId,
        string body,
        string? icd10Code = null,
        int? leaveDays = null)
    {
        if (patientId == Guid.Empty)
            throw new DomainException("PatientId is required");
        if (practitionerId == Guid.Empty)
            throw new DomainException("PractitionerId is required");
        if (string.IsNullOrWhiteSpace(body))
            throw new DomainException("Report body is required");

        return new MedicalReport(
            Guid.NewGuid(),
            patientId,
            practitionerId,
            encounterId,
            body.Trim(),
            icd10Code,
            leaveDays,
            previousDocumentId: null,
            signature: null,
            status: DocumentStatus.Draft);
    }

    public void UpdateContent(string body, string? icd10Code, int? leaveDays)
    {
        EnsureCanMutateContent();

        if (string.IsNullOrWhiteSpace(body))
            throw new DomainException("Report body is required");

        Body = body.Trim();
        Icd10Code = icd10Code;
        LeaveDays = leaveDays;
    }

    public static MedicalReport Reconstitute(
        Guid id,
        Guid patientId,
        Guid practitionerId,
        Guid? encounterId,
        string body,
        string? icd10Code,
        int? leaveDays,
        Guid? previousDocumentId,
        SignatureInfo? signature,
        DocumentStatus status,
        DateTime createdAt)
    {
        return new MedicalReport(
            id,
            patientId,
            practitionerId,
            encounterId,
            body,
            icd10Code,
            leaveDays,
            previousDocumentId,
            signature,
            status,
            createdAt);
    }
}

