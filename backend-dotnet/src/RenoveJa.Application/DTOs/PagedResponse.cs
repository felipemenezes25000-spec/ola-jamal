namespace RenoveJa.Application.DTOs;

/// <summary>
/// Resposta paginada genérica para endpoints de listagem.
/// </summary>
public record PagedResponse<T>(
    List<T> Items,
    int TotalCount,
    int Page,
    int PageSize);
