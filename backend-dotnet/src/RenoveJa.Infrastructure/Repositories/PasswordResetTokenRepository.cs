using Dapper;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Postgres;

namespace RenoveJa.Infrastructure.Repositories;

public class PasswordResetTokenRepository(PostgresClient db) : IPasswordResetTokenRepository
{
    private const string TableName = "password_reset_tokens";

    public async Task<PasswordResetToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        // FIX B24: Direct parameterized SQL query instead of fetching 500 tokens and filtering in memory
        var rawToken = Uri.UnescapeDataString(token.Trim());
        await using var conn = db.CreateConnectionPublic();
        await conn.OpenAsync(cancellationToken);
        var model = await conn.QueryFirstOrDefaultAsync<PasswordResetTokenModel>(
            "SELECT id AS \"Id\", user_id AS \"UserId\", token AS \"Token\", expires_at AS \"ExpiresAt\", used AS \"Used\", created_at AS \"CreatedAt\" FROM password_reset_tokens WHERE token = @Token LIMIT 1",
            new { Token = rawToken });
        return model != null ? MapToDomain(model) : null;
    }

    public async Task<PasswordResetToken> CreateAsync(PasswordResetToken entity, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(entity);
        var created = await db.InsertAsync<PasswordResetTokenModel>(TableName, model, cancellationToken);
        return MapToDomain(created);
    }

    public async Task UpdateAsync(PasswordResetToken entity, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(entity);
        await db.UpdateAsync<PasswordResetTokenModel>(
            TableName,
            $"id=eq.{entity.Id}",
            new { Used = model.Used },
            cancellationToken);
    }

    public async Task InvalidateByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await db.UpdateAsync<PasswordResetTokenModel>(
            TableName,
            $"user_id=eq.{userId}",
            new { Used = true },
            cancellationToken);
    }

    private static PasswordResetToken MapToDomain(PasswordResetTokenModel model)
    {
        return PasswordResetToken.Reconstitute(
            model.Id,
            model.UserId,
            model.Token,
            model.ExpiresAt,
            model.Used,
            model.CreatedAt);
    }

    private static PasswordResetTokenModel MapToModel(PasswordResetToken entity)
    {
        return new PasswordResetTokenModel
        {
            Id = entity.Id,
            UserId = entity.UserId,
            Token = entity.Token,
            ExpiresAt = entity.ExpiresAt,
            Used = entity.Used,
            CreatedAt = entity.CreatedAt
        };
    }
}
