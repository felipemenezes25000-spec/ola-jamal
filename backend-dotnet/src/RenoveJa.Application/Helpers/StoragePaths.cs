namespace RenoveJa.Application.Helpers;

/// <summary>
/// Centraliza a construção de paths S3 no padrão audit-ready:
/// pacientes/{patientId}/...
///
/// Regras:
/// - GUIDs sempre em formato N (32 hex, sem hífens)
/// - Nomes descritivos em português
/// - Estrutura: pacientes/{patientId}/{tipo}/{requestId}/{subtipo}/{arquivo}
/// </summary>
public static class StoragePaths
{
    // ── Receitas e Exames (bucket: prescriptions) ──

    /// <summary>PDF assinado de receita médica.</summary>
    public static string ReceitaAssinada(Guid patientId, Guid requestId)
        => $"pacientes/{patientId:N}/pedidos/{requestId:N}/receita/assinado/receita-{requestId:N}.pdf";

    /// <summary>PDF gerado (pré-assinatura) de receita.</summary>
    public static string ReceitaGerada(Guid patientId, Guid requestId)
        => $"pacientes/{patientId:N}/pedidos/{requestId:N}/receita/gerado/receita-{requestId:N}.pdf";

    /// <summary>PDF assinado de pedido de exame.</summary>
    public static string ExameAssinado(Guid patientId, Guid requestId)
        => $"pacientes/{patientId:N}/pedidos/{requestId:N}/exame/assinado/pedido-exame-{requestId:N}.pdf";

    /// <summary>PDF assinado de atestado médico.</summary>
    public static string AtestadoAssinado(Guid patientId, Guid requestId)
        => $"pacientes/{patientId:N}/pedidos/{requestId:N}/atestado/assinado/atestado-{requestId:N}.pdf";

    /// <summary>Imagem anexada a um pedido (receita ou exame).</summary>
    public static string PedidoAnexo(Guid patientId, string kind, string ext)
        => $"pacientes/{patientId:N}/pedidos/{kind}/anexos/{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}{ext}";

    /// <summary>Arquivo de plano de cuidado.</summary>
    public static string PlanoCuidado(Guid patientId, Guid carePlanId, Guid fileId, string ext)
        => $"pacientes/{patientId:N}/planos-de-cuidado/{carePlanId:N}/arquivos/{fileId:N}{ext}";

    // ── Consultas (bucket: transcripts) ──

    /// <summary>Transcrição de texto da consulta.</summary>
    public static string Transcricao(Guid patientId, Guid requestId)
        => $"pacientes/{patientId:N}/consultas/{requestId:N}/transcricao/transcricao-{requestId:N}.txt";

    /// <summary>Gravação de vídeo MP4 da consulta.</summary>
    public static string Gravacao(Guid patientId, Guid requestId, string recordingId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(recordingId);
        var sanitized = SanitizeFileName(recordingId);
        return $"pacientes/{patientId:N}/consultas/{requestId:N}/gravacao/consulta-{requestId:N}-{sanitized}.mp4";
    }

    private static string SanitizeFileName(string input)
        => new string(input.Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_').ToArray());

    /// <summary>SOAP notes JSON da consulta.</summary>
    public static string SoapNotes(Guid patientId, Guid requestId)
        => $"pacientes/{patientId:N}/consultas/{requestId:N}/notas-soap/soap-notes-{requestId:N}.json";

    /// <summary>Chunk de gravação (upload em partes).</summary>
    public static string GravacaoChunk(Guid patientId, Guid requestId, string ext)
    {
        var sanitizedExt = SanitizeFileName(ext.TrimStart('.'));
        return $"pacientes/{patientId:N}/consultas/{requestId:N}/gravacao-chunks/{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}.{sanitizedExt}";
    }

    // ── Usuários (bucket: avatars) ──

    /// <summary>Avatar do usuário.</summary>
    public static string Avatar(Guid userId, string fileName)
        => $"pacientes/{userId:N}/avatar/{fileName}";

    // ── Certificados (bucket: certificates) ──

    /// <summary>Certificado digital ICP-Brasil do médico (PFX criptografado).</summary>
    public static string CertificadoDigital(Guid doctorProfileId)
        => $"pacientes/{doctorProfileId:N}/certificados/{Guid.NewGuid():N}.pfx.enc";

    // ── Helpers ──

    /// <summary>
    /// Prefixos reconhecidos pelo novo padrão (pacientes/) e pelo legado.
    /// Usado pelo S3StorageService.GetBucket e CleanPath.
    /// </summary>
    public static readonly string[] AllPrefixes =
    {
        // Novo padrão
        "pacientes/",
        // Padrão intermediário
        "pedidos/", "consultas/", "usuarios/", "planos-de-cuidado/", "documentos/",
        // Legado
        "certificates/", "prescription-images/", "avatars/",
        "transcripts/", "recordings/", "receitas/", "signed/", "careplans/"
    };
}
