using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Infrastructure.CrmValidation;

/// <summary>
/// Configuração da API InfoSimples para validação de CRM.
/// </summary>
public class InfoSimplesConfig
{
    public const string SectionName = "InfoSimples";
    public string ApiToken { get; set; } = string.Empty;
}

/// <summary>
/// Implementação da validação de CRM via API InfoSimples (CFM).
/// API: GET https://api.infosimples.com/api/v2/consultas/cfm/crm
/// </summary>
public class InfoSimplesCrmService : ICrmValidationService
{
    private const string ApiBaseUrl = "https://api.infosimples.com/api/v2/consultas/cfm/crm";
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly InfoSimplesConfig _config;
    private readonly ILogger<InfoSimplesCrmService> _logger;

    public InfoSimplesCrmService(
        IHttpClientFactory httpClientFactory,
        IOptions<InfoSimplesConfig> config,
        ILogger<InfoSimplesCrmService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config.Value;
        _logger = logger;
    }

    public async Task<CrmValidationResult> ValidateCrmAsync(
        string crm,
        string uf,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_config.ApiToken) || _config.ApiToken.Contains("YOUR_"))
            {
                return new CrmValidationResult(
                    false, null, crm, uf, null, null,
                    "InfoSimples API token não configurado.");
            }

            var client = _httpClientFactory.CreateClient();
            var url = $"{ApiBaseUrl}?crm={Uri.EscapeDataString(crm)}&uf={Uri.EscapeDataString(uf.ToUpperInvariant())}&token={Uri.EscapeDataString(_config.ApiToken)}";

            var response = await client.GetAsync(url, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("InfoSimples API retornou {StatusCode}: {Body}", response.StatusCode, errorBody);
                return new CrmValidationResult(
                    false, null, crm, uf, null, null,
                    $"Erro na consulta ao CFM: {response.StatusCode}");
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            // InfoSimples retorna { "code": 200, "data": [...] } quando OK
            var code = root.TryGetProperty("code", out var codeProp) ? codeProp.GetInt32() : 0;

            if (code != 200)
            {
                var errorMessages = new List<string>();
                if (root.TryGetProperty("errors", out var errors) && errors.ValueKind == JsonValueKind.Array)
                {
                    foreach (var err in errors.EnumerateArray())
                    {
                        errorMessages.Add(err.GetString() ?? "Erro desconhecido");
                    }
                }
                return new CrmValidationResult(
                    false, null, crm, uf, null, null,
                    errorMessages.Count > 0 ? string.Join("; ", errorMessages) : "CRM não encontrado.");
            }

            // Parse data array
            if (!root.TryGetProperty("data", out var dataArray) || dataArray.ValueKind != JsonValueKind.Array || dataArray.GetArrayLength() == 0)
            {
                return new CrmValidationResult(
                    false, null, crm, uf, null, null,
                    "Nenhum registro encontrado para este CRM/UF.");
            }

            var record = dataArray[0];
            var doctorName = GetStringProp(record, "nome") ?? GetStringProp(record, "medico");
            var specialty = GetStringProp(record, "especialidade");
            var situation = GetStringProp(record, "situacao") ?? GetStringProp(record, "situacao_cadastral");
            var crmNumber = GetStringProp(record, "crm") ?? crm;
            var state = GetStringProp(record, "uf") ?? uf;

            // Situação "Regular" indica CRM ativo
            var isValid = !string.IsNullOrWhiteSpace(situation) &&
                         situation.Contains("Regular", StringComparison.OrdinalIgnoreCase);

            _logger.LogInformation("CRM {Crm}/{Uf} validado: {DoctorName}, Situação: {Situation}", 
                crm, uf, doctorName, situation);

            return new CrmValidationResult(
                isValid,
                doctorName,
                crmNumber,
                state,
                specialty,
                situation,
                isValid ? null : $"CRM com situação: {situation ?? "Não encontrada"}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao validar CRM {Crm}/{Uf} via InfoSimples", crm, uf);
            return new CrmValidationResult(
                false, null, crm, uf, null, null,
                $"Erro ao consultar CRM: {ex.Message}");
        }
    }

    private static string? GetStringProp(JsonElement element, string property)
    {
        return element.TryGetProperty(property, out var prop) && prop.ValueKind == JsonValueKind.String
            ? prop.GetString()
            : null;
    }
}
