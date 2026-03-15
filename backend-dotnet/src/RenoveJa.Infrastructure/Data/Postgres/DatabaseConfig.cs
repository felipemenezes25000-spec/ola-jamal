namespace RenoveJa.Infrastructure.Data.Postgres;

/// <summary>
/// Configuracao de conexao com o banco de dados PostgreSQL (AWS RDS).
/// O namespace "Supabase" e mantido temporariamente para compatibilidade com DI.
/// </summary>
public class DatabaseConfig
{
    /// <summary>
    /// URL base do Supabase (legado â€” nao usado em producao).
    /// Mantido apenas para compatibilidade com codigo legado.
    /// </summary>
    public string Url { get; set; } = string.Empty;

    /// <summary>
    /// Chave de servico (legado â€” nao usado em producao).
    /// Mantido apenas para compatibilidade com codigo legado.
    /// </summary>
    public string ServiceKey { get; set; } = string.Empty;

    /// <summary>
    /// Connection string do PostgreSQL (AWS RDS).
    /// Configurada via env var Supabase__DatabaseUrl (legado) ou ConnectionStrings__DefaultConnection.
    /// </summary>
    public string? DatabaseUrl { get; set; }
}