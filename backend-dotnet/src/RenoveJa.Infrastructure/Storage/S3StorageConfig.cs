namespace RenoveJa.Infrastructure.Storage;

/// <summary>
/// Configuração dos buckets S3.
/// Valores vêm de variáveis de ambiente (12-factor):
///   AWS_S3_REGION, AWS_S3_PRESCRIPTIONS_BUCKET, AWS_S3_CERTIFICATES_BUCKET,
///   AWS_S3_AVATARS_BUCKET, AWS_S3_TRANSCRIPTS_BUCKET, AWS_S3_PUBLIC_BASE_URL.
/// </summary>
public sealed class S3StorageConfig
{
    public string Region { get; set; } = "sa-east-1";
    public string PrescriptionsBucket { get; set; } = "renoveja-prescriptions";
    public string CertificatesBucket { get; set; } = "renoveja-certificates";
    public string AvatarsBucket { get; set; } = "renoveja-avatars";
    public string TranscriptsBucket { get; set; } = "renoveja-transcripts";

    /// <summary>URL base do CloudFront (ou S3 público) para montar URLs públicas.</summary>
    public string PublicBaseUrl { get; set; } = "";
}
