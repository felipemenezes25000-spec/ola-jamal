namespace RenoveJa.Domain.Entities;

/// <summary>Entrada de log de acesso a documento (auditoria LGPD).</summary>
public class DocumentAccessEntry
{
    public Guid? DocumentId { get; private set; }
    public Guid? RequestId { get; private set; }
    public Guid? UserId { get; private set; }
    public string Action { get; private set; } = "";
    public string ActorType { get; private set; } = "patient";
    public string? IpAddress { get; private set; }
    public string? UserAgent { get; private set; }
    public string? Metadata { get; private set; }

    private DocumentAccessEntry() { }

    public static DocumentAccessEntry Create(
        Guid? documentId,
        Guid? requestId,
        Guid? userId,
        string action,
        string? actorType = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? metadata = null)
    {
        return new DocumentAccessEntry
        {
            DocumentId = documentId,
            RequestId = requestId,
            UserId = userId,
            Action = action ?? "",
            ActorType = actorType ?? "patient",
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Metadata = metadata
        };
    }

    public static DocumentAccessEntry Reconstitute(
        Guid? documentId,
        Guid? requestId,
        Guid? userId,
        string action,
        string actorType,
        string? ipAddress,
        string? userAgent,
        string? metadata)
    {
        return new DocumentAccessEntry
        {
            DocumentId = documentId,
            RequestId = requestId,
            UserId = userId,
            Action = action,
            ActorType = actorType,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Metadata = metadata
        };
    }
}
