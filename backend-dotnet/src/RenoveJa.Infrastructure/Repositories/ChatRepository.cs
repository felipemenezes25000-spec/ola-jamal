using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de mensagens de chat via Supabase.
/// </summary>
public class ChatRepository(SupabaseClient supabase) : IChatRepository
{
    private const string TableName = "chat_messages";

    /// <summary>
    /// Obtém uma mensagem pelo ID.
    /// </summary>
    public async Task<ChatMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<ChatMessageModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<ChatMessage>> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<ChatMessageModel>(
            TableName,
            filter: $"request_id=eq.{requestId}&order=created_at.asc",
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var messages = await supabase.GetAllAsync<ChatMessageModel>(
            TableName,
            filter: "read=eq.false",
            cancellationToken: cancellationToken);

        return messages.Count;
    }

    public async Task<ChatMessage> CreateAsync(ChatMessage message, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(message);
        var created = await supabase.InsertAsync<ChatMessageModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task MarkAsReadAsync(Guid requestId, Guid userId, CancellationToken cancellationToken = default)
    {
        await supabase.UpdateAsync<ChatMessageModel>(
            TableName,
            $"request_id=eq.{requestId}",
            new { read = true },
            cancellationToken);
    }

    private static ChatMessage MapToDomain(ChatMessageModel model)
    {
        return ChatMessage.Reconstitute(
            model.Id,
            model.RequestId,
            model.SenderId,
            model.SenderName,
            model.SenderType,
            model.Message,
            model.Read,
            model.CreatedAt);
    }

    private static ChatMessageModel MapToModel(ChatMessage message)
    {
        return new ChatMessageModel
        {
            Id = message.Id,
            RequestId = message.RequestId,
            SenderId = message.SenderId,
            SenderName = message.SenderName,
            SenderType = message.SenderType.ToString().ToLowerInvariant(),
            Message = message.Message,
            Read = message.Read,
            CreatedAt = message.CreatedAt
        };
    }
}
