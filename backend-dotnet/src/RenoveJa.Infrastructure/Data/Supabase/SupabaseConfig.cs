namespace RenoveJa.Infrastructure.Data.Supabase;

/// <summary>
/// Configuração de URL e chave de serviço do Supabase.
/// </summary>
public class SupabaseConfig
{
    /// <summary>URL base do projeto Supabase.</summary>
    public string Url { get; set; } = string.Empty;

    /// <summary>
    /// Chave de serviço (service_role) para acesso à API.
    /// Obrigatório: use a chave "service_role" (secret) em Project Settings → API no Supabase.
    /// Não use a chave "anon" ou "publishable" — isso causa 401 em operações como INSERT/UPDATE.
    /// </summary>
    public string ServiceKey { get; set; } = string.Empty;

    /// <summary>
    /// Connection string do Postgres (opcional). Se definida, a API executa migrations na inicialização (ex.: tabela password_reset_tokens).
    /// Obtenha em: Dashboard → Project Settings → Database → Connection string (URI). Substitua [YOUR-PASSWORD] pela senha do banco.
    /// </summary>
    public string? DatabaseUrl { get; set; }
}
