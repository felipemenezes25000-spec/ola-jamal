using FluentValidation;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Application.DTOs.Requests;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.DTOs.Chat;

namespace RenoveJa.Application.Validators;

public class RegisterRequestValidator : AbstractValidator<RegisterRequestDto>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(200).WithMessage("Name cannot exceed 200 characters");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters");

        RuleFor(x => x.Phone)
            .Matches(@"^\+?[\d\s\-\(\)]+$")
            .When(x => !string.IsNullOrEmpty(x.Phone))
            .WithMessage("Invalid phone format");

        RuleFor(x => x.Cpf)
            .Matches(@"^\d{11}$")
            .When(x => !string.IsNullOrEmpty(x.Cpf))
            .WithMessage("CPF must have 11 digits");
    }
}

public class RegisterDoctorRequestValidator : AbstractValidator<RegisterDoctorRequestDto>
{
    public RegisterDoctorRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(200).WithMessage("Name cannot exceed 200 characters");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters");

        RuleFor(x => x.Phone)
            .NotEmpty().WithMessage("Phone is required")
            .Matches(@"^\+?[\d\s\-\(\)]+$").WithMessage("Invalid phone format");

        RuleFor(x => x.Crm)
            .NotEmpty().WithMessage("CRM is required")
            .MaximumLength(50).WithMessage("CRM cannot exceed 50 characters");

        RuleFor(x => x.CrmState)
            .NotEmpty().WithMessage("CRM State is required")
            .Length(2).WithMessage("CRM State must be 2 characters");

        RuleFor(x => x.Specialty)
            .NotEmpty().WithMessage("Specialty is required");
    }
}

public class LoginRequestValidator : AbstractValidator<LoginRequestDto>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required");
    }
}

public class CreatePrescriptionRequestValidator : AbstractValidator<CreatePrescriptionRequestDto>
{
    public CreatePrescriptionRequestValidator()
    {
        RuleFor(x => x.PrescriptionType)
            .NotEmpty().WithMessage("Prescription type is required")
            .Must(x => new[] { "simple", "controlled", "blue" }.Contains(x?.ToLower()))
            .WithMessage("Invalid prescription type");

        RuleFor(x => x.Medications)
            .NotEmpty().WithMessage("At least one medication is required")
            .Must(x => x != null && x.Count > 0).WithMessage("Medications list cannot be empty");
    }
}

public class CreateExamRequestValidator : AbstractValidator<CreateExamRequestDto>
{
    public CreateExamRequestValidator()
    {
        RuleFor(x => x.ExamType)
            .NotEmpty().WithMessage("Exam type is required");

        RuleFor(x => x.Exams)
            .NotEmpty().WithMessage("At least one exam is required")
            .Must(x => x != null && x.Count > 0).WithMessage("Exams list cannot be empty");
    }
}

public class CreateConsultationRequestValidator : AbstractValidator<CreateConsultationRequestDto>
{
    public CreateConsultationRequestValidator()
    {
        RuleFor(x => x.Symptoms)
            .NotEmpty().WithMessage("Symptoms are required for consultation")
            .MinimumLength(10).WithMessage("Please provide more details about your symptoms");
    }
}

public class ApproveRequestValidator : AbstractValidator<ApproveRequestDto>
{
    public ApproveRequestValidator()
    {
        RuleFor(x => x.Price)
            .GreaterThan(0).WithMessage("Price must be greater than zero");
    }
}

public class RejectRequestValidator : AbstractValidator<RejectRequestDto>
{
    public RejectRequestValidator()
    {
        RuleFor(x => x.RejectionReason)
            .NotEmpty().WithMessage("Rejection reason is required")
            .MinimumLength(10).WithMessage("Please provide a detailed rejection reason");
    }
}

public class CreatePaymentRequestValidator : AbstractValidator<CreatePaymentRequestDto>
{
    public CreatePaymentRequestValidator()
    {
        RuleFor(x => x.RequestId)
            .NotEmpty().WithMessage("Request ID is required");

        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than zero");
    }
}

public class SendMessageRequestValidator : AbstractValidator<SendMessageRequestDto>
{
    public SendMessageRequestValidator()
    {
        RuleFor(x => x.Message)
            .NotEmpty().WithMessage("Message cannot be empty")
            .MaximumLength(1000).WithMessage("Message cannot exceed 1000 characters");
    }
}
