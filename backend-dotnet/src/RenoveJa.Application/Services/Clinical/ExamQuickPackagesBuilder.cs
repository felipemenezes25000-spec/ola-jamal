using RenoveJa.Application.DTOs.Requests;

namespace RenoveJa.Application.Services.Clinical;

/// <summary>
/// Monta pacotes rápidos de exames para pós-consulta conforme idade (data de nascimento) e sexo cadastrados.
/// </summary>
public static class ExamQuickPackagesBuilder
{
    public static IReadOnlyList<ExamQuickPackageDto> Build(DateTime? birthDate, string? gender)
    {
        var age = CalculateAgeYears(birthDate);
        var female = IsFemale(gender);
        var male = IsMale(gender);

        var list = new List<ExamQuickPackageDto>();

        list.Add(BuildCheckup(age, female, male));

        if (age is null or >= 16)
            list.Add(BuildIst());
        else if (age >= 13)
            list.Add(BuildIstAdolescent());

        if (female && age is >= 12 and <= 55)
            list.Add(BuildPrenatal());

        list.Add(BuildCardiovascular(age));
        list.Add(BuildRenal());
        list.Add(BuildHepatico());
        list.Add(BuildTireoide());

        return list;
    }

    private static int? CalculateAgeYears(DateTime? birthDate)
    {
        if (!birthDate.HasValue) return null;
        var today = DateTime.Today;
        var bd = birthDate.Value.Date;
        var age = today.Year - bd.Year;
        if (bd > today.AddYears(-age)) age--;
        return age < 0 ? null : age;
    }

    private static bool IsFemale(string? g)
    {
        if (string.IsNullOrWhiteSpace(g)) return false;
        return g.Trim().ToUpperInvariant() switch
        {
            "F" or "FEMININO" or "FEMALE" or "MULHER" => true,
            _ => false,
        };
    }

    private static bool IsMale(string? g)
    {
        if (string.IsNullOrWhiteSpace(g)) return false;
        return g.Trim().ToUpperInvariant() switch
        {
            "M" or "MASCULINO" or "MALE" or "HOMEM" => true,
            _ => false,
        };
    }

    private static ExamQuickPackageDto BuildCheckup(int? age, bool female, bool male)
    {
        if (age is < 18)
        {
            var exams = new List<string>
            {
                "Hemograma completo", "Glicemia de jejum", "Colesterol total e frações (HDL, LDL)",
                "TGO (AST)", "TGP (ALT)", "Creatinina", "Ureia", "TSH", "Urina tipo I (EAS)",
                "Ferro sérico", "Ferritina", "Vitamina D (25-OH)", "Parasitológico de fezes",
            };
            return new ExamQuickPackageDto(
                "checkup_pediatric",
                "Check-up (criança/adolescente)",
                exams,
                "Rastreamento laboratorial pediátrico — ajustar conforme faixa etária e história clínica.");
        }

        var adult = new List<string>
        {
            "Hemograma completo", "Glicemia de jejum", "Hemoglobina glicada (HbA1c)",
            "Colesterol total e frações (HDL, LDL, VLDL)", "Triglicerídeos",
            "TGO (AST)", "TGP (ALT)", "Gama GT (GGT)", "Bilirrubinas (total, direta, indireta)",
            "Ureia", "Creatinina", "Ácido úrico",
            "TSH", "T4 livre", "Vitamina D (25-OH)", "Vitamina B12",
            "Ferro sérico", "Ferritina", "PCR (proteína C reativa)", "VHS",
            "Sódio, potássio, cálcio", "Urina tipo I (EAS)", "Parasitológico de fezes",
        };

        if (age >= 65)
            adult.Add("TFG estimada (CKD-EPI)");

        if (male && age >= 45)
            adult.Add("PSA total e livre (rastreamento prostático — conforme orientação)");

        if (female && age is >= 40 and <= 74)
            adult.Add("Rastreamento de mama: mamografia bilateral ou USG das mamas (conforme protocolo)");

        if (female && age is >= 25 and <= 64)
            adult.Add("Citologia oncótica cervical (Papanicolau), se intervalo indicado");

        var name = age >= 65 ? "Check-up completo (faixa 60+)" : "Check-up completo";
        var key = age >= 65 ? "checkup_senior" : "checkup";
        var just = age >= 65
            ? "Check-up preventivo com ênfase em função renal estimada e vigilância típica da faixa etária."
            : "Check-up laboratorial de rotina preventiva, ajustado ao perfil do paciente.";

        return new ExamQuickPackageDto(key, name, adult, just);
    }

    private static ExamQuickPackageDto BuildIst() =>
        new(
            "ist",
            "IST / Sorologias",
            new[]
            {
                "VDRL (sífilis)", "Anti-HIV 1 e 2", "HBsAg (hepatite B)",
                "Anti-HCV (hepatite C)", "Anti-HBs (imunidade hepatite B)",
                "Toxoplasmose IgG/IgM", "CMV IgG/IgM", "Rubéola IgG/IgM",
            },
            "Rastreamento de ISTs e sorologias — indicar conforme contexto clínico.");

    private static ExamQuickPackageDto BuildIstAdolescent() =>
        new(
            "ist_youth",
            "IST / Sorologias (inicial)",
            new[] { "VDRL", "Anti-HIV", "HBsAg", "Anti-HCV", "Orientação e consentimento conforme protocolo" },
            "Rastreamento inicial — ampliar conforme exposição e faixa etária.");

    private static ExamQuickPackageDto BuildPrenatal() =>
        new(
            "prenatal",
            "Pré-natal",
            new[]
            {
                "Hemograma completo", "Tipagem sanguínea (ABO/Rh)", "Coombs indireto",
                "Glicemia de jejum", "TOTG 75g", "VDRL", "Anti-HIV", "HBsAg", "Anti-HCV",
                "Toxoplasmose IgG/IgM", "Rubéola IgG/IgM", "CMV IgG/IgM",
                "TSH", "T4 livre", "Urina tipo I", "Urocultura", "Parasitológico de fezes",
            },
            "Rotina pré-natal — adequar às gestações e protocolos assistenciais vigentes.");

    private static ExamQuickPackageDto BuildCardiovascular(int? age)
    {
        var exams = new List<string>
        {
            "Perfil lipídico completo", "Glicemia de jejum", "HbA1c",
            "PCR ultrassensível", "Homocisteína", "Lipoproteína(a)",
            "CPK total", "Troponina (se indicado)", "BNP ou NT-proBNP (se indicado)",
            "Ácido úrico", "Sódio e potássio",
        };
        if (age is >= 40)
            exams.Add("ECG de repouso");
        return new ExamQuickPackageDto(
            "cardiovascular",
            "Risco cardiovascular",
            exams,
            "Avaliação de risco cardiovascular; marcar exames conforme sintomas.");
    }

    private static ExamQuickPackageDto BuildRenal() =>
        new(
            "renal",
            "Função renal",
            new[]
            {
                "Creatinina", "Ureia", "Ácido úrico", "Sódio", "Potássio",
                "Cálcio", "Fósforo", "TFG estimada", "Urina tipo I",
                "Microalbuminúria", "Proteinúria 24h (se indicado)",
            },
            "Avaliação da função renal e eletrólitos.");

    private static ExamQuickPackageDto BuildHepatico() =>
        new(
            "hepatico",
            "Perfil hepático",
            new[]
            {
                "TGO (AST)", "TGP (ALT)", "Gama GT (GGT)", "Fosfatase alcalina",
                "Bilirrubinas (total, direta, indireta)", "Albumina",
                "Proteínas totais e frações", "TAP/INR", "LDH",
            },
            "Perfil hepático completo — função e integridade do fígado.");

    private static ExamQuickPackageDto BuildTireoide() =>
        new(
            "tireoide",
            "Tireoide",
            new[] { "TSH", "T4 livre", "T3 total", "Anti-TPO", "Anti-tireoglobulina" },
            "Avaliação tireoidiana e autoanticorpos.");
}
