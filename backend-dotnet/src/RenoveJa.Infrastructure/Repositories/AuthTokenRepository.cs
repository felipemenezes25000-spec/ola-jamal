using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de tokens de autenticação via PostgreSQL (Npgsql/Dapper).
/// </summary>
public class AuthTokenRepository(PostgresClient db) : IAuthTokenRepository
{
    private const string TableName = "auth_tokens";

    public async Task<AuthToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        // Com Npgsql/Dapper (SQL direto), NÃO precisamos de URL encoding.
        // O PostgRestFilterParser usa parâmetros SQL (@p0) que tratam caracteres especiais.
        var model = await db.GetSingleAsync<AuthTokenModel>(
            TableName,
            filter: $"token=eq.{token}",
            cancellationToken: cancellationToken);
        return model != null ? MapToDomain(model) : null;
    }

    public async Task<AuthToken?> GetByRefreshTokenAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var model = await db.GetSingleAsync<AuthTokenModel>(
            TableName,
            filter: $"refresh_token=eq.{refreshToken}",
            cancellationToken: cancellationToken);
        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<AuthToken>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var models = await db.GetAllAsync<AuthTokenModel>(
            TableName,
            filter: $"user_id=eq.{userId}",
            orderBy: "created_at.desc",
            cancellationToken: cancellationToken);
        return models.Select(MapToDomain).ToList();
    }

    public async Task<AuthToken> CreateAsync(AuthToken authToken, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(authToken);
        var created = await db.InsertAsync<AuthTokenModel>(
            TableName,
            model,
            cancellationToken);
        return MapToDomain(created);
    }

    public async Task<AuthToken> UpdateAsync(AuthToken authToken, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(authToken);
        var updated = await db.UpdateAsync<AuthTokenModel>(
            TableName,
            $"id=eq.{authToken.Id}",
            model,
            cancellationToken);
        return MapToDomain(updated);
    }

    public async Task<AuthToken?> TryRotateAsync(AuthToken authToken, string previousRefreshToken, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(authToken);
        // Optimistic concurrency: só atualiza se o refresh_token antigo ainda bater
        var updated = await db.UpdateAsync<AuthTokenModel>(
            TableName,
            $"id=eq.{authToken.Id}&refresh_token=eq.{previousRefreshToken}",
            model,
            cancellationToken);
        return updated != null ? MapToDomain(updated) : null;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await db.DeleteAsync(TableName, $"id=eq.{id}", cancellationToken);
    }

    public async Task DeleteByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        await db.DeleteAsync(TableName, $"token=eq.{token}", cancellationToken);
    }

    public async Task DeleteByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await db.DeleteAsync(TableName, $"user_id=eq.{userId}", cancellationToken);
    }

    public async Task DeleteExpiredTokensAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await db.DeleteAsync(TableName, $"expires_at=lt.{now:O}", cancellationToken);
    }

    private static AuthToken MapToDomain(AuthTokenModel model)
    {
        return AuthToken.Reconstitute(
            model.Id, model.UserId, model.Token,
            model.ExpiresAt, model.CreatedAt,
            model.RefreshToken, model.RefreshTokenExpiresAt);
    }

    private static AuthTokenModel MapToModel(AuthToken token)
    {
        return new AuthTokenModel
        {
            Id = token.Id,
            UserId = token.UserId,
            Token = token.Token,
            ExpiresAt = token.ExpiresAt,
            CreatedAt = token.CreatedAt,
            RefreshToken = token.RefreshToken,
            RefreshTokenExpiresAt = token.RefreshTokenExpiresAt
        };
    }
}
