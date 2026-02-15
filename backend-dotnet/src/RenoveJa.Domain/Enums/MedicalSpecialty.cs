namespace RenoveJa.Domain.Enums;

/// <summary>
/// Especialidades médicas disponíveis no sistema.
/// </summary>
public enum MedicalSpecialty
{
    ClinicoGeral,
    Cardiologia,
    Dermatologia,
    Endocrinologia,
    Ginecologia,
    Neurologia,
    Ortopedia,
    Pediatria,
    Psiquiatria,
    Urologia
}

/// <summary>
/// Nomes exibidos das especialidades (para API e validação no cadastro).
/// </summary>
public static class MedicalSpecialtyDisplay
{
    private static readonly IReadOnlyDictionary<MedicalSpecialty, string> DisplayNames = new Dictionary<MedicalSpecialty, string>
    {
        { MedicalSpecialty.ClinicoGeral, "Clínico Geral" },
        { MedicalSpecialty.Cardiologia, "Cardiologia" },
        { MedicalSpecialty.Dermatologia, "Dermatologia" },
        { MedicalSpecialty.Endocrinologia, "Endocrinologia" },
        { MedicalSpecialty.Ginecologia, "Ginecologia" },
        { MedicalSpecialty.Neurologia, "Neurologia" },
        { MedicalSpecialty.Ortopedia, "Ortopedia" },
        { MedicalSpecialty.Pediatria, "Pediatria" },
        { MedicalSpecialty.Psiquiatria, "Psiquiatria" },
        { MedicalSpecialty.Urologia, "Urologia" }
    };

    /// <summary>Retorna o nome de exibição da especialidade.</summary>
    public static string ToDisplayString(this MedicalSpecialty specialty) => DisplayNames[specialty];

    /// <summary>Lista de especialidades disponíveis (nomes para a API).</summary>
    public static IReadOnlyList<string> GetAllDisplayNames() =>
        Enum.GetValues<MedicalSpecialty>().Select(s => DisplayNames[s]).ToList();

    /// <summary>Indica se o texto é uma especialidade válida.</summary>
    public static bool IsValid(string? value) =>
        !string.IsNullOrWhiteSpace(value) && DisplayNames.Values.Contains(value.Trim());
}
