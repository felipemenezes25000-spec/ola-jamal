using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Exceptions;
using RenoveJa.Domain.ValueObjects;

namespace RenoveJa.Domain.Entities;

/// <summary>
/// Agregado: Solicitação Médica (Prescrição, Exame, Consulta).
/// Raiz do agregado — todas as alterações de estado passam por esta entidade.
/// </summary>
public class MedicalRequest : AggregateRoot
{
    public Guid PatientId { get; private set; }
    public string? PatientName { get; private set; }
    public Guid? DoctorId { get; private set; }
    public string? DoctorName { get; private set; }
    public RequestType RequestType { get; private set; }
    public RequestStatus Status { get; private set; }
    
    // Prescription fields
    public PrescriptionType? PrescriptionType { get; private set; }
    public List<string> Medications { get; private set; }
    public List<string> PrescriptionImages { get; private set; }
    
    // Exam fields
    public string? ExamType { get; private set; }
    public List<string> Exams { get; private set; }
    
    // Consultation/General fields
    public string? Symptoms { get; private set; }
    public Money? Price { get; private set; }
    public string? Notes { get; private set; }
    public string? RejectionReason { get; private set; }
    
    // Digital signature
    public DateTime? SignedAt { get; private set; }
    public string? SignedDocumentUrl { get; private set; }
    public string? SignatureId { get; private set; }
    
    public DateTime UpdatedAt { get; private set; }

    private MedicalRequest() : base()
    {
        Medications = new List<string>();
        PrescriptionImages = new List<string>();
        Exams = new List<string>();
    }

    private MedicalRequest(
        Guid id,
        Guid patientId,
        string? patientName,
        RequestType requestType,
        RequestStatus status,
        DateTime? createdAt = null,
        DateTime? updatedAt = null)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        PatientId = patientId;
        PatientName = patientName;
        RequestType = requestType;
        Status = status;
        UpdatedAt = updatedAt ?? DateTime.UtcNow;
        
        Medications = new List<string>();
        PrescriptionImages = new List<string>();
        Exams = new List<string>();
    }

    public static MedicalRequest CreatePrescription(
        Guid patientId,
        string patientName,
        PrescriptionType prescriptionType,
        List<string> medications,
        List<string>? prescriptionImages = null)
    {
        if (patientId == Guid.Empty)
            throw new DomainException("Patient ID is required");

        if (medications == null || medications.Count == 0)
            throw new DomainException("At least one medication is required");

        var request = new MedicalRequest(
            Guid.NewGuid(),
            patientId,
            patientName,
            Enums.RequestType.Prescription,
            RequestStatus.Submitted);

        request.PrescriptionType = prescriptionType;
        request.Medications = medications;
        request.PrescriptionImages = prescriptionImages ?? new List<string>();

        return request;
    }

    public static MedicalRequest CreateExam(
        Guid patientId,
        string patientName,
        string examType,
        List<string> exams,
        string? symptoms = null)
    {
        if (patientId == Guid.Empty)
            throw new DomainException("Patient ID is required");

        if (exams == null || exams.Count == 0)
            throw new DomainException("At least one exam is required");

        var request = new MedicalRequest(
            Guid.NewGuid(),
            patientId,
            patientName,
            Enums.RequestType.Exam,
            RequestStatus.Submitted);

        request.ExamType = examType;
        request.Exams = exams;
        request.Symptoms = symptoms;

        return request;
    }

    public static MedicalRequest CreateConsultation(
        Guid patientId,
        string patientName,
        string symptoms)
    {
        if (patientId == Guid.Empty)
            throw new DomainException("Patient ID is required");

        if (string.IsNullOrWhiteSpace(symptoms))
            throw new DomainException("Symptoms are required for consultation");

        var request = new MedicalRequest(
            Guid.NewGuid(),
            patientId,
            patientName,
            Enums.RequestType.Consultation,
            RequestStatus.SearchingDoctor);

        request.Symptoms = symptoms;

        return request;
    }

    public static MedicalRequest Reconstitute(
        Guid id,
        Guid patientId,
        string? patientName,
        Guid? doctorId,
        string? doctorName,
        string requestType,
        string status,
        string? prescriptionType,
        List<string>? medications,
        List<string>? prescriptionImages,
        string? examType,
        List<string>? exams,
        string? symptoms,
        decimal? price,
        string? notes,
        string? rejectionReason,
        DateTime? signedAt,
        string? signedDocumentUrl,
        string? signatureId,
        DateTime createdAt,
        DateTime updatedAt)
    {
        var request = new MedicalRequest(
            id,
            patientId,
            patientName,
            Enum.Parse<RequestType>(requestType, true),
            Enum.Parse<RequestStatus>(status, true),
            createdAt,
            updatedAt);

        request.DoctorId = doctorId;
        request.DoctorName = doctorName;
        
        if (!string.IsNullOrWhiteSpace(prescriptionType))
            request.PrescriptionType = Enum.Parse<PrescriptionType>(prescriptionType, true);
        
        request.Medications = medications ?? new List<string>();
        request.PrescriptionImages = prescriptionImages ?? new List<string>();
        request.ExamType = examType;
        request.Exams = exams ?? new List<string>();
        request.Symptoms = symptoms;
        
        if (price.HasValue)
            request.Price = Money.Create(price.Value);
        
        request.Notes = notes;
        request.RejectionReason = rejectionReason;
        request.SignedAt = signedAt;
        request.SignedDocumentUrl = signedDocumentUrl;
        request.SignatureId = signatureId;

        return request;
    }

    public void AssignDoctor(Guid doctorId, string doctorName)
    {
        if (doctorId == Guid.Empty)
            throw new DomainException("Doctor ID is required");

        DoctorId = doctorId;
        DoctorName = doctorName;
        Status = RequestStatus.InReview;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Approve(decimal price, string? notes = null)
    {
        if (price <= 0)
            throw new DomainException("Price must be greater than zero");

        Price = Money.Create(price);
        Notes = notes;
        Status = RequestStatus.ApprovedPendingPayment;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reject(string rejectionReason)
    {
        if (string.IsNullOrWhiteSpace(rejectionReason))
            throw new DomainException("Rejection reason is required");

        RejectionReason = rejectionReason;
        Status = RequestStatus.Rejected;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkAsPaid()
    {
        if (Status != RequestStatus.ApprovedPendingPayment && 
            Status != RequestStatus.PendingPayment)
            throw new DomainException("Request must be in pending payment status");

        Status = RequestStatus.Paid;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Sign(string signedDocumentUrl, string signatureId)
    {
        if (Status != RequestStatus.Paid)
            throw new DomainException("Request must be paid before signing");

        if (string.IsNullOrWhiteSpace(signedDocumentUrl))
            throw new DomainException("Signed document URL is required");

        SignedDocumentUrl = signedDocumentUrl;
        SignatureId = signatureId;
        SignedAt = DateTime.UtcNow;
        Status = RequestStatus.Signed;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deliver()
    {
        if (Status != RequestStatus.Signed)
            throw new DomainException("Request must be signed before delivery");

        Status = RequestStatus.Delivered;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateStatus(RequestStatus newStatus)
    {
        Status = newStatus;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        Status = RequestStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkConsultationReady()
    {
        if (RequestType != Enums.RequestType.Consultation)
            throw new DomainException("Only consultation requests can be marked as ready");

        Status = RequestStatus.ConsultationReady;
        UpdatedAt = DateTime.UtcNow;
    }

    public void StartConsultation()
    {
        if (RequestType != Enums.RequestType.Consultation)
            throw new DomainException("Only consultation requests can be started");

        Status = RequestStatus.InConsultation;
        UpdatedAt = DateTime.UtcNow;
    }

    public void FinishConsultation()
    {
        if (RequestType != Enums.RequestType.Consultation)
            throw new DomainException("Only consultation requests can be finished");

        Status = RequestStatus.ConsultationFinished;
        UpdatedAt = DateTime.UtcNow;
    }
}
