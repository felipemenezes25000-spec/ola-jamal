using RenoveJa.Domain.Enums;
using RenoveJa.Domain.ValueObjects;
using RenoveJa.Domain.Exceptions;

namespace RenoveJa.Domain.Entities;

/// <summary>
/// Agregado: Usuário (Paciente/Médico).
/// Raiz do agregado de identidade — alterações de perfil e autenticação passam por esta entidade.
/// </summary>
public class User : AggregateRoot
{
    public string Name { get; private set; }
    public Email Email { get; private set; }
    public string PasswordHash { get; private set; }
    public Phone? Phone { get; private set; }
    public string? Cpf { get; private set; }
    public DateTime? BirthDate { get; private set; }
    public string? AvatarUrl { get; private set; }
    public UserRole Role { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private User() : base() { }

    private User(
        Guid id,
        string name,
        Email email,
        string passwordHash,
        UserRole role,
        Phone? phone = null,
        string? cpf = null,
        DateTime? birthDate = null,
        string? avatarUrl = null,
        DateTime? createdAt = null,
        DateTime? updatedAt = null) 
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        Name = name;
        Email = email;
        PasswordHash = passwordHash;
        Role = role;
        Phone = phone;
        Cpf = cpf;
        BirthDate = birthDate;
        AvatarUrl = avatarUrl;
        UpdatedAt = updatedAt ?? DateTime.UtcNow;
    }

    public static User CreatePatient(
        string name,
        string email,
        string passwordHash,
        string? phone = null,
        string? cpf = null,
        DateTime? birthDate = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Name is required");

        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new DomainException("Password hash is required");

        var emailVo = Email.Create(email);
        var phoneVo = phone != null ? Phone.Create(phone) : null;

        return new User(
            Guid.NewGuid(),
            name,
            emailVo,
            passwordHash,
            UserRole.Patient,
            phoneVo,
            cpf,
            birthDate);
    }

    public static User CreateDoctor(
        string name,
        string email,
        string passwordHash,
        string phone,
        string? cpf = null,
        DateTime? birthDate = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Name is required");

        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new DomainException("Password hash is required");

        var emailVo = Email.Create(email);
        var phoneVo = Phone.Create(phone);

        return new User(
            Guid.NewGuid(),
            name,
            emailVo,
            passwordHash,
            UserRole.Doctor,
            phoneVo,
            cpf,
            birthDate);
    }

    public static User Reconstitute(
        Guid id,
        string name,
        string email,
        string passwordHash,
        string role,
        string? phone,
        string? cpf,
        DateTime? birthDate,
        string? avatarUrl,
        DateTime createdAt,
        DateTime updatedAt)
    {
        var emailVo = Email.Create(email);
        var phoneVo = phone != null ? Phone.Create(phone) : null;
        var roleEnum = Enum.Parse<UserRole>(role, true);

        return new User(
            id,
            name,
            emailVo,
            passwordHash,
            roleEnum,
            phoneVo,
            cpf,
            birthDate,
            avatarUrl,
            createdAt,
            updatedAt);
    }

    public void UpdateProfile(
        string? name = null,
        string? phone = null,
        string? cpf = null,
        DateTime? birthDate = null,
        string? avatarUrl = null)
    {
        if (!string.IsNullOrWhiteSpace(name))
            Name = name;

        if (!string.IsNullOrWhiteSpace(phone))
            Phone = Phone.Create(phone);

        if (!string.IsNullOrWhiteSpace(cpf))
            Cpf = cpf;

        if (birthDate.HasValue)
            BirthDate = birthDate;

        if (!string.IsNullOrWhiteSpace(avatarUrl))
            AvatarUrl = avatarUrl;

        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdatePassword(string newPasswordHash)
    {
        if (string.IsNullOrWhiteSpace(newPasswordHash))
            throw new DomainException("Password hash cannot be empty");

        PasswordHash = newPasswordHash;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool IsDoctor() => Role == UserRole.Doctor;
    public bool IsPatient() => Role == UserRole.Patient;
}
