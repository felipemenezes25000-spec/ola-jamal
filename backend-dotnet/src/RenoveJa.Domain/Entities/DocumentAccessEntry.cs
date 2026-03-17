namespace RenoveJa.Domain.Entities;

/// <summary>Entrada de log de acesso a documento (auditoria LGPD).</summary>
public class DocumentAccessEntry
{
    public Guid? DocumentId { get; set; }
    public Guid? RequestId { get; set; }
    public Guid? UserId { get; set; }
    public string Action { get; set; } = "";
    public string ActorType { get; set; } = "patient";
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? Metadata { get; set; }
}
