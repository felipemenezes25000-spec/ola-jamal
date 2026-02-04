namespace RenoveJa.Application.DTOs.Chat;

public record SendMessageRequestDto(
    string Message
);

public record MessageResponseDto(
    Guid Id,
    Guid RequestId,
    Guid SenderId,
    string? SenderName,
    string SenderType,
    string Message,
    bool Read,
    DateTime CreatedAt
);
