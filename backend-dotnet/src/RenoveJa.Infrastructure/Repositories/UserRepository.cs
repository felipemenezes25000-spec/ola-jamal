using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.Data.Models;
using RenoveJa.Infrastructure.Data.Supabase;

namespace RenoveJa.Infrastructure.Repositories;

/// <summary>
/// Repositório de usuários (pacientes e médicos) via Supabase.
/// </summary>
public class UserRepository(SupabaseClient supabase) : IUserRepository
{
    private const string TableName = "users";

    /// <summary>
    /// Obtém um usuário pelo ID.
    /// </summary>
    public async Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<UserModel>(
            TableName,
            filter: $"id=eq.{id}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    /// <summary>
    /// Obtém múltiplos usuários por IDs em uma única query (batch).
    /// </summary>
    public async Task<List<User>> GetByIdsAsync(IEnumerable<Guid> ids, CancellationToken cancellationToken = default)
    {
        var idList = ids.ToList();
        if (idList.Count == 0)
            return new List<User>();

        var filter = $"id=in.({string.Join(",", idList)})";
        var models = await supabase.GetAllAsync<UserModel>(
            TableName,
            filter: filter,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var model = await supabase.GetSingleAsync<UserModel>(
            TableName,
            filter: $"email=eq.{email}",
            cancellationToken: cancellationToken);

        return model != null ? MapToDomain(model) : null;
    }

    public async Task<List<User>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var models = await supabase.GetAllAsync<UserModel>(
            TableName,
            cancellationToken: cancellationToken);

        return models.Select(MapToDomain).ToList();
    }

    public async Task<User> CreateAsync(User user, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(user);
        var created = await supabase.InsertAsync<UserModel>(
            TableName,
            model,
            cancellationToken);

        return MapToDomain(created);
    }

    public async Task<User> UpdateAsync(User user, CancellationToken cancellationToken = default)
    {
        var model = MapToModel(user);
        var updated = await supabase.UpdateAsync<UserModel>(
            TableName,
            $"id=eq.{user.Id}",
            model,
            cancellationToken);

        return MapToDomain(updated);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        await supabase.DeleteAsync(
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
            model.UpdatedAt,
<<<<<<< HEAD
            model.ProfileComplete,
            model.Gender,
            model.Address);
=======
            model.ProfileComplete);
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
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
<<<<<<< HEAD
            Gender = user.Gender,
            Address = user.Address,
=======
>>>>>>> 3f12f1391c26e4f9b258789282b7d52c83e95c55
            AvatarUrl = user.AvatarUrl,
            Role = user.Role.ToString().ToLowerInvariant(),
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            ProfileComplete = user.ProfileComplete
        };
    }
}
