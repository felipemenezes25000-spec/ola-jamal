using RenoveJa.Application.DTOs.Chat;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Chat;

/// <summary>
/// Serviço de chat entre paciente e médico por solicitação.
/// </summary>
public interface IChatService
{
    Task<MessageResponseDto> SendMessageAsync(Guid requestId, SendMessageRequestDto dto, Guid senderId, CancellationToken cancellationToken = default);
    Task<List<MessageResponseDto>> GetMessagesAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);
    Task MarkAsReadAsync(Guid requestId, Guid userId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Implementação do serviço de chat (envio, listagem, não lidas, marcar como lido).
/// </summary>
public class ChatService(
    IChatRepository chatRepository,
    IUserRepository userRepository,
    IRequestRepository requestRepository) : IChatService
{
    /// <summary>
    /// Envia uma mensagem em um pedido.
    /// </summary>
    public async Task<MessageResponseDto> SendMessageAsync(
        Guid requestId,
        SendMessageRequestDto dto,
        Guid senderId,
        CancellationToken cancellationToken = default)
    {
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        var sender = await userRepository.GetByIdAsync(senderId, cancellationToken);
        if (sender == null)
            throw new InvalidOperationException("Sender not found");

        var senderType = sender.Role == UserRole.Doctor ? SenderType.Doctor : SenderType.Patient;

        var message = ChatMessage.Create(requestId, senderId, sender.Name, senderType, dto.Message);
        message = await chatRepository.CreateAsync(message, cancellationToken);

        return MapToDto(message);
    }

    /// <summary>
    /// Lista mensagens de um pedido.
    /// </summary>
    public async Task<List<MessageResponseDto>> GetMessagesAsync(
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        var messages = await chatRepository.GetByRequestIdAsync(requestId, cancellationToken);
        return messages.Select(MapToDto).ToList();
    }

    /// <summary>
    /// Retorna a quantidade de mensagens não lidas do usuário.
    /// </summary>
    public async Task<int> GetUnreadCountAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await chatRepository.GetUnreadCountAsync(userId, cancellationToken);
    }

    /// <summary>
    /// Marca as mensagens de um pedido como lidas para o usuário.
    /// </summary>
    public async Task MarkAsReadAsync(
        Guid requestId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        await chatRepository.MarkAsReadAsync(requestId, userId, cancellationToken);
    }

    private static MessageResponseDto MapToDto(ChatMessage message)
    {
        return new MessageResponseDto(
            message.Id,
            message.RequestId,
            message.SenderId,
            message.SenderName,
            message.SenderType.ToString().ToLowerInvariant(),
            message.Message,
            message.Read,
            message.CreatedAt);
    }
}
