using RenoveJa.Domain.Entities;

namespace RenoveJa.Domain.Interfaces;

/// <summary>
/// Repositório de mensagens de chat.
/// </summary>
public interface IChatRepository
{
    Task<ChatMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<ChatMessage>> GetByRequestIdAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<ChatMessage> CreateAsync(ChatMessage message, CancellationToken cancellationToken = default);
    Task MarkAsReadAsync(Guid requestId, Guid userId, CancellationToken cancellationToken = default);
}
