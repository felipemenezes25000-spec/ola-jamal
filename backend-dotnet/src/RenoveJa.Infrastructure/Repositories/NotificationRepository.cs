using System.Text.Json;
using Dapper;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// RepositÃ³rio de notificaÃ§Ãµes via db.
/// </summary>
public class NotificationRepository(PostgresClient db) : INotificationRepository
{
    private const string TableName = "notifications";

    /// <summary>
    /// ObtÃ©m uma notificaÃ§Ã£o pelo ID.
    /// </summary>
    public async Task<Notification?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await db.GetSingleAsync<NotificationModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<Notification>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await db.GetAllAsync<NotificationModel>(
            TableName,
            filter: $"user_id=eq.{userId}&order=created_at.desc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<Notification> CreateAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(notification);
        var created = await db.InsertAsync<NotificationModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<Notification> UpdateAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(notification);
        var updated = await db.UpdateAsync<NotificationModel>(
            TableName,
            $"id=eq.{notification.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    public async Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await db.CountAsync(
            TableName,
            $"user_id=eq.{userId}&read=eq.false",
            cancellationToken);
    }

    public async Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await db.UpdateAsync<NotificationModel>(
            TableName,
            $"user_id=eq.{userId}",
            new { read = true },
            cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> ExistsWithDataSinceAsync(string type, string requestId, DateTime since, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT COUNT(*) FROM public.notifications
            WHERE data->>'type' = @Type
              AND data->>'requestId' = @RequestId
              AND created_at >= @Since
            LIMIT 1
            """;
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var count = await conn.ExecuteScalarAsync<int>(
            new CommandDefinition(sql, new { Type = type, RequestId = requestId, Since = since }, cancellationToken: cancellationToken));
        return count > 0;
    }

    private static Notification MapToDomain(NotificationModel model)
    {
        return Notification.Reconstitute(
            model.Id,
            model.UserId,
            model.Title,
            model.Message,
            model.NotificationType,
            model.Read,
            JsonToDict(model.Data),
            model.CreatedAt);
    }

    private static NotificationModel MapToModel(Notification notification)
    {
        return new NotificationModel
        {
            Id = notification.Id,
            UserId = notification.UserId,
            Title = notification.Title,
            Message = notification.Message,
            NotificationType = notification.NotificationType.ToString().ToLowerInvariant(),
            Read = notification.Read,
            Data = DictToJson(notification.Data),
            CreatedAt = notification.CreatedAt
        };
    }
    private static string? DictToJson(Dictionary<string, object?>? dict) => dict == null || dict.Count == 0 ? null : JsonSerializer.Serialize(dict);
    private static Dictionary<string, object?>? JsonToDict(string? json) { if (string.IsNullOrWhiteSpace(json) || json == "null") return null; try { return JsonSerializer.Deserialize<Dictionary<string, object?>>(json); } catch { return null; } }
}
