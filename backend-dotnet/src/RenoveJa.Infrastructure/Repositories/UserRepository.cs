using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly SupabaseClient _supabase;
    private const string TableName = "users";

    public UserRepository(SupabaseClient supabase)
    {
        _supabase = supabase;
    }

    public async Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<UserModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var model = await _supabase.GetSingleAsync<UserModel>(
            TableName,
            filter: $"email=eq.{email}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<User>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var models = await _supabase.GetAllAsync<UserModel>(
            TableName,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<User> CreateAsync(User user, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(user);
        var created = await _supabase.InsertAsync<UserModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<User> UpdateAsync(User user, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(user);
        var updated = await _supabase.UpdateAsync<UserModel>(
            TableName,
            $"id=eq.{user.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await _supabase.DeleteAsync(
            TableName,
            $"id=eq.{id}",
            cancellationToken);
    }

    public async Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var user = await GetByEmailAsync(email, cancellationToken);
        return user != null;
    }

    private static User MapToDomain(UserModel model)
    {
        return User.Reconstitute(
            model.Id,
            model.Name,
            model.Email,
            model.PasswordHash,
            model.Role,
            model.Phone,
            model.Cpf,
            model.BirthDate,
            model.AvatarUrl,
            model.CreatedAt,
            model.UpdatedAt);
    }

    private static UserModel MapToModel(User user)
    {
        return new UserModel
        {
            Id = user.Id,
            Name = user.Name,
            Email = user.Email,
            PasswordHash = user.PasswordHash,
            Phone = user.Phone?.Value,
            Cpf = user.Cpf,
            BirthDate = user.BirthDate,
            AvatarUrl = user.AvatarUrl,
            Role = user.Role.ToString().ToLowerInvariant(),
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt
        };
    }
}
