using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

public class PasswordResetTokenRepository(SupabaseClient supabase) : IPasswordResetTokenRepository
{
    private const string TableName = "password_reset_tokens";

    public async Task<PasswordResetToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        // Busca no backend: traz tokens recentes e filtra em memória (banco só persiste dados, lógica no backend)
        var rawToken = Uri.UnescapeDataString(token.Trim());
        var list = await supabase.GetAllAsync<PasswordResetTokenModel>(
            TableName,
            select: "*",
            filter: null,
            orderBy: "created_at.desc",
            limit: 500,
            cancellationToken: cancellationToken);

        var model = list.FirstOrDefault(m => m.Token == rawToken);
        return model != null ? MapToDomain(model) : null;
    }

    public async Task<PasswordResetToken> CreateAsync(PasswordResetToken entity, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(entity);
        var created = await supabase.InsertAsync<PasswordResetTokenModel>(TableName, model, cancellationToken);
        return MapToDomain(created);
    }

    public async Task UpdateAsync(PasswordResetToken entity, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(entity);
        await supabase.UpdateAsync<PasswordResetTokenModel>(
            TableName,
            $"id=eq.{entity.Id}",
            new { Used = model.Used },
            cancellationToken);
    }

    public async Task InvalidateByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await supabase.UpdateAsync<PasswordResetTokenModel>(
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
