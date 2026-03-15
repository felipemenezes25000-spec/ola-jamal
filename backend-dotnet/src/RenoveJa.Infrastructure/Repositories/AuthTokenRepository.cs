using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de tokens de autenticação via PostgreSQL (Npgsql/Dapper).
/// </summary>
public class AuthTokenRepository(PostgresClient supabase) : IAuthTokenRepository
{
    private const string TableName = "auth_tokens";

    public async Task<AuthToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        // Com Npgsql/Dapper (SQL direto), NÃO precisamos de URL encoding.
        // O PostgRestFilterParser usa parâmetros SQL (@p0) que tratam caracteres especiais.
        var model = await supabase.GetSingleAsync<AuthTokenModel>(
            TableName,
            filter: $"token=eq.{token}",
            cancellationToken: cancellationToken);
        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<AuthToken>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<AuthTokenModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            cancellationToken: cancellationToken);
        return models.Select(MapToDomain).ToList();
    }

    public async Task<AuthToken> CreateAsync(AuthToken authToken, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(authToken);
        var created = await supabase.InsertAsync<AuthTokenModel>(
            TableName,
            model,
            cancellationToken);
        return MapToDomain(created);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await supabase.DeleteAsync(TableName, $"id=eq.{id}", cancellationToken);
    }

    public async Task DeleteByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        await supabase.DeleteAsync(TableName, $"token=eq.{token}", cancellationToken);
    }

    public async Task DeleteByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await supabase.DeleteAsync(TableName, $"user_id=eq.{userId}", cancellationToken);
    }

    public async Task DeleteExpiredTokensAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await supabase.DeleteAsync(TableName, $"expires_at=lt.{now:O}", cancellationToken);
    }

    private static AuthToken MapToDomain(AuthTokenModel model)
    {
        return AuthToken.Reconstitute(
            model.Id, model.UserId, model.Token,
            model.ExpiresAt, model.CreatedAt);
    }

    private static AuthTokenModel MapToModel(AuthToken token)
    {
        return new AuthTokenModel
        {
            Id = token.Id,
            UserId = token.UserId,
            Token = token.Token,
            ExpiresAt = token.ExpiresAt,
            CreatedAt = token.CreatedAt
        };
    }
}
