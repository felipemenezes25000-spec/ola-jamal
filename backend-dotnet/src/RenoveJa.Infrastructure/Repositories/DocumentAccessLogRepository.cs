using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Postgres;
using System.Text.Json.Serialization;

namespace RenoveJa.Infrastructure.Repositories;

public class DocumentAccessLogRepository(PostgresClient db) : IDocumentAccessLogRepository
{
    private const string TableName = "document_access_log";

    public async Task LogAccessAsync(DocumentAccessEntry entry, CancellationToken ct = default)
    {
        var model = new AccessLogModel
        {
            Id = Guid.NewGuid(),
            DocumentId = entry.DocumentId,
            RequestId = entry.RequestId,
            UserId = entry.UserId,
            Action = entry.Action,
            ActorType = entry.ActorType,
            IpAddress = entry.IpAddress,
            UserAgent = entry.UserAgent,
            Metadata = entry.Metadata,
            CreatedAt = DateTime.UtcNow,
        };
        await db.InsertAsync<AccessLogModel>(TableName, model, ct);
    }

    public async Task<List<DocumentAccessEntry>> GetByDocumentIdAsync(Guid documentId, int limit = 50, CancellationToken ct = default)
    {
        var filter = $"document_id=eq.{documentId}&order=created_at.desc&limit={limit}";
        var models = await db.GetAllAsync<AccessLogModel>(TableName, filter: filter, cancellationToken: ct);
        return models.Select(MapToEntry).ToList();
    }

    public async Task<List<DocumentAccessEntry>> GetByRequestIdAsync(Guid requestId, int limit = 50, CancellationToken ct = default)
    {
        var filter = $"request_id=eq.{requestId}&order=created_at.desc&limit={limit}";
        var models = await db.GetAllAsync<AccessLogModel>(TableName, filter: filter, cancellationToken: ct);
        return models.Select(MapToEntry).ToList();
    }

    public async Task<int> GetDispenseCountAsync(Guid documentId, CancellationToken ct = default)
    {
        var filter = $"document_id=eq.{documentId}&action=eq.dispensed";
        var models = await db.GetAllAsync<AccessLogModel>(TableName, filter: filter, cancellationToken: ct);
        return models.Count;
    }

    public async Task<int> GetDownloadCountAsync(Guid documentId, CancellationToken ct = default)
    {
        var filter = $"document_id=eq.{documentId}&action=eq.download";
        var models = await db.GetAllAsync<AccessLogModel>(TableName, filter: filter, cancellationToken: ct);
        return models.Count;
    }

    private static DocumentAccessEntry MapToEntry(AccessLogModel m) => new()
    {
        DocumentId = m.DocumentId,
        RequestId = m.RequestId,
        UserId = m.UserId,
        Action = m.Action,
        ActorType = m.ActorType,
        IpAddress = m.IpAddress,
        UserAgent = m.UserAgent,
        Metadata = m.Metadata,
    };

    private class AccessLogModel
    {
        public Guid Id { get; set; }
        [JsonPropertyName("document_id")]
        public Guid? DocumentId { get; set; }
        [JsonPropertyName("request_id")]
        public Guid? RequestId { get; set; }
        [JsonPropertyName("user_id")]
        public Guid? UserId { get; set; }
        public string Action { get; set; } = "";
        [JsonPropertyName("actor_type")]
        public string ActorType { get; set; } = "patient";
        [JsonPropertyName("ip_address")]
        public string? IpAddress { get; set; }
        [JsonPropertyName("user_agent")]
        public string? UserAgent { get; set; }
        public string? Metadata { get; set; }
        [JsonPropertyName("created_at")]
        public DateTime CreatedAt { get; set; }
    }
}
