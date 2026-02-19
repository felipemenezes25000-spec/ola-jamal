using System.Linq;
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
    /// <summary>Sexo: M, F, Outro, Não informado. Obrigatório para receita antimicrobiana.</summary>
    public string? Gender { get; private set; }
    /// <summary>Endereço completo (legado). Use Street/Number/Neighborhood/Complement quando disponível.</summary>
    public string? Address { get; private set; }
    /// <summary>Rua (logradouro).</summary>
    public string? Street { get; private set; }
    /// <summary>Número.</summary>
    public string? Number { get; private set; }
    /// <summary>Bairro.</summary>
    public string? Neighborhood { get; private set; }
    /// <summary>Complemento.</summary>
    public string? Complement { get; private set; }
    /// <summary>Cidade.</summary>
    public string? City { get; private set; }
    /// <summary>UF (2 caracteres).</summary>
    public string? State { get; private set; }
    /// <summary>CEP.</summary>
    public string? PostalCode { get; private set; }
    public string? AvatarUrl { get; private set; }
    public UserRole Role { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    /// <summary>Indica se o cadastro foi concluído (phone, CPF etc.). Usuários criados via Google iniciam com false.</summary>
    public bool ProfileComplete { get; private set; }

    private User() : base()
    {
        Name = null!;
        Email = null!;
        PasswordHash = null!;
        Role = default; // Enum
    }

    private User(
        Guid id,
        string name,
        Email email,
        string passwordHash,
        UserRole role,
        Phone? phone = null,
        string? cpf = null,
        DateTime? birthDate = null,
        string? gender = null,
        string? address = null,
        string? street = null,
        string? number = null,
        string? neighborhood = null,
        string? complement = null,
        string? city = null,
        string? state = null,
        string? postalCode = null,
        string? avatarUrl = null,
        DateTime? createdAt = null,
        DateTime? updatedAt = null,
        bool profileComplete = true)
        : base(id, createdAt ?? DateTime.UtcNow)
    {
        Name = name;
        Email = email;
        PasswordHash = passwordHash;
        Role = role;
        Phone = phone;
        Cpf = cpf;
        BirthDate = birthDate;
        Gender = gender;
        Address = address;
        Street = street;
        Number = number;
        Neighborhood = neighborhood;
        Complement = complement;
        City = city;
        State = state;
        PostalCode = postalCode;
        AvatarUrl = avatarUrl;
        UpdatedAt = updatedAt ?? DateTime.UtcNow;
        ProfileComplete = profileComplete;
    }

    /// <summary>
    /// Valida nome, e-mail, telefone e CPF e retorna os value objects normalizados.
    /// Reutilizado em CreatePatient e CreateDoctor para garantir as mesmas regras para todos os tipos de usuário.
    /// </summary>
    private static (Email email, Phone phone, string cpf) ValidateAndCreateCommonValues(
        string name,
        string email,
        string phone,
        string cpf)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Name is required");

        ValidateNameHasAtLeastTwoWords(name);

        var normalizedEmail = Email.Create(email);
        var normalizedPhone = Phone.Create(phone);
        var cpfNormalized = NormalizeAndValidateCpf(cpf);

        return (normalizedEmail, normalizedPhone, cpfNormalized);
    }

    private static void ValidateNameHasAtLeastTwoWords(string name)
    {
        if (name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).Length < 2)
            throw new DomainException("Name must contain at least two words");
    }

    private static string NormalizeAndValidateCpf(string cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf))
            throw new DomainException("CPF is required");

        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        if (digits.Length != 11)
            throw new DomainException("CPF must contain only numbers (11 digits)");

        return digits;
    }

    public static User CreatePatient(
        string name,
        string email,
        string passwordHash,
        string cpf,
        string phone,
        DateTime? birthDate = null,
        string? street = null,
        string? number = null,
        string? neighborhood = null,
        string? complement = null,
        string? city = null,
        string? state = null,
        string? postalCode = null)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new DomainException("Password hash is required");

        var (normalizedEmail, normalizedPhone, cpfNormalized) = ValidateAndCreateCommonValues(name, email, phone, cpf);

        return new User(
            Guid.NewGuid(),
            name,
            normalizedEmail,
            passwordHash,
            UserRole.Patient,
            normalizedPhone,
            cpfNormalized,
            birthDate,
            gender: null,
            address: null,
            street,
            number,
            neighborhood,
            complement,
            city,
            state,
            postalCode,
            avatarUrl: null,
            createdAt: null,
            updatedAt: null,
            profileComplete: true);
    }

    /// <summary>Cria médico com perfil incompleto até cadastrar certificado digital.</summary>
    public static User CreateDoctor(
        string name,
        string email,
        string passwordHash,
        string phone,
        string cpf,
        DateTime? birthDate = null)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new DomainException("Password hash is required");

        var (emailVo, phoneVo, cpfNormalized) = ValidateAndCreateCommonValues(name, email, phone, cpf);

        return new User(
            Guid.NewGuid(),
            name,
            emailVo,
            passwordHash,
            UserRole.Doctor,
            phoneVo,
            cpfNormalized,
            birthDate,
            gender: null,
            address: null,
            street: null,
            number: null,
            neighborhood: null,
            complement: null,
            city: null,
            state: null,
            postalCode: null,
            avatarUrl: null,
            createdAt: null,
            updatedAt: null,
            profileComplete: false);
    }

    /// <summary>
    /// Cria um usuário (paciente ou médico) a partir de login com Google. Cadastro fica incompleto até completar perfil.
    /// </summary>
    public static User CreateFromGoogleIdentity(string name, string email, string passwordHash, UserRole role = UserRole.Patient)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Name is required");
        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new DomainException("Password hash is required");

        var emailVo = Email.Create(email);

        return new User(
            Guid.NewGuid(),
            name.Trim(),
            emailVo,
            passwordHash,
            role,
            phone: null,
            cpf: null,
            birthDate: null,
            gender: null,
            address: null,
            street: null,
            number: null,
            neighborhood: null,
            complement: null,
            city: null,
            state: null,
            postalCode: null,
            avatarUrl: null,
            createdAt: null,
            updatedAt: null,
            profileComplete: false);
    }

    /// <summary>
    /// Conclui o cadastro com phone, CPF e data de nascimento (usado após login com Google – paciente).
    /// </summary>
    public void CompleteProfile(string phone, string cpf, DateTime? birthDate = null, string? street = null, string? number = null, string? neighborhood = null, string? complement = null, string? city = null, string? state = null, string? postalCode = null)
    {
        SetContactInfo(phone, cpf, birthDate, gender: null, street, number, neighborhood, complement, city, state, postalCode);
        ProfileComplete = true;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Preenche apenas phone, CPF e birth date (sem marcar perfil completo). Usado no fluxo do médico antes de criar DoctorProfile.
    /// </summary>
    public void SetContactInfo(string phone, string cpf, DateTime? birthDate = null, string? gender = null, string? street = null, string? number = null, string? neighborhood = null, string? complement = null, string? city = null, string? state = null, string? postalCode = null)
    {
        var phoneVo = Phone.Create(phone);
        var cpfNormalized = NormalizeAndValidateCpf(cpf);
        Phone = phoneVo;
        Cpf = cpfNormalized;
        if (birthDate.HasValue)
            BirthDate = birthDate;
        if (gender != null)
            Gender = gender;
        if (street != null)
            Street = street;
        if (number != null)
            Number = number;
        if (neighborhood != null)
            Neighborhood = neighborhood;
        if (complement != null)
            Complement = complement;
        if (city != null)
            City = city;
        if (state != null)
            State = state;
        if (postalCode != null)
            PostalCode = postalCode;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Marca o cadastro como concluído (ex.: após criar DoctorProfile no fluxo Google).
    /// </summary>
    public void MarkProfileComplete()
    {
        ProfileComplete = true;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Marca o cadastro como incompleto (rollback quando falha criação do DoctorProfile).
    /// </summary>
    public void MarkProfileIncomplete()
    {
        ProfileComplete = false;
        UpdatedAt = DateTime.UtcNow;
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
        DateTime updatedAt,
        bool profileComplete = true,
        string? gender = null,
        string? address = null,
        string? street = null,
        string? number = null,
        string? neighborhood = null,
        string? complement = null,
        string? city = null,
        string? state = null,
        string? postalCode = null)
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
            gender,
            address,
            street,
            number,
            neighborhood,
            complement,
            city,
            state,
            postalCode,
            avatarUrl,
            createdAt,
            updatedAt,
            profileComplete);
    }

    public void UpdateProfile(
        string? name = null,
        string? phone = null,
        string? cpf = null,
        DateTime? birthDate = null,
        string? gender = null,
        string? street = null,
        string? number = null,
        string? neighborhood = null,
        string? complement = null,
        string? city = null,
        string? state = null,
        string? postalCode = null,
        string? avatarUrl = null)
    {
        if (!string.IsNullOrWhiteSpace(name))
            Name = name;

        if (!string.IsNullOrWhiteSpace(phone))
            Phone = Phone.Create(phone);

        if (!string.IsNullOrWhiteSpace(cpf))
            Cpf = NormalizeAndValidateCpf(cpf!);

        if (birthDate.HasValue)
            BirthDate = birthDate;

        if (gender != null)
            Gender = gender;

        if (street != null)
            Street = street;

        if (number != null)
            Number = number;

        if (neighborhood != null)
            Neighborhood = neighborhood;

        if (complement != null)
            Complement = complement;

        if (city != null)
            City = city;

        if (state != null)
            State = state;

        if (postalCode != null)
            PostalCode = postalCode;

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
