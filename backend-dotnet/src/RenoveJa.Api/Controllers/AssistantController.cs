using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.DTOs.Assistant;
using RenoveJa.Application.Interfaces;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoints da Dra. RenoveJa para navegacao do fluxo e qualidade do envio.
/// </summary>
[ApiController]
[Route("api/assistant")]
[Authorize]
public class AssistantController(
    IAssistantNavigatorService assistantNavigatorService,
    IHttpClientFactory httpClientFactory,
    IOptions<OpenAIConfig> openAiConfig,
    ILogger<AssistantController> logger) : ControllerBase
{
    /// <summary>
    /// Retorna o proximo passo recomendado para o pedido atual.
    /// Pode receber requestId (preferencial) ou status/requestType.
    /// </summary>
    [HttpPost("next-action")]
    public async Task<IActionResult> NextAction(
        [FromBody] AssistantNextActionRequestDto request,
        CancellationToken cancellationToken)
    {
        if (request == null)
            return BadRequest(new { error = "Body obrigatório." });

        if (!request.RequestId.HasValue && string.IsNullOrWhiteSpace(request.Status))
            return BadRequest(new { error = "Informe requestId ou status." });

        var userId = GetUserId();
        var result = await assistantNavigatorService.GetNextActionAsync(request, userId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Avalia completude do pedido antes do envio e identifica sinais de urgencia no relato.
    /// </summary>
    [HttpPost("complete")]
    public IActionResult Complete([FromBody] AssistantCompleteRequestDto request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Flow))
            return BadRequest(new { error = "Campo 'flow' é obrigatório (prescription, exam, consultation)." });
        var flow = request.Flow.Trim().ToLowerInvariant();
        if (flow is not ("prescription" or "exam" or "consultation"))
            return BadRequest(new { error = "Flow inválido. Use: prescription, exam, consultation." });

        var result = assistantNavigatorService.EvaluateCompleteness(request);
        return Ok(result);
    }

    /// <summary>
    /// Sugere exames com base nos sintomas do paciente usando IA (GPT-4o-mini).
    /// Retorna lista de exames sugeridos com justificativa curta.
    /// </summary>
    [HttpPost("suggest-exams")]
    public async Task<IActionResult> SuggestExams(
        [FromBody] SuggestExamsRequestDto request,
        CancellationToken cancellationToken)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Symptoms))
            return BadRequest(new { error = "Informe os sintomas para receber sugestões." });

        if (request.Symptoms.Trim().Length < 10)
            return BadRequest(new { error = "Descreva os sintomas com mais detalhes (mínimo 10 caracteres)." });

        var apiKey = openAiConfig.Value.ApiKey;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            logger.LogWarning("[SuggestExams] OpenAI API key não configurada.");
            return Ok(new { suggestions = Array.Empty<object>(), message = "Serviço de sugestão indisponível." });
        }

        try
        {
            var examTypeLabel = (request.ExamType?.ToLowerInvariant()) switch
            {
                "imagem" => "exames de imagem (raio-X, USG, tomografia, ressonância)",
                _ => "exames laboratoriais (sangue, urina, etc.)"
            };

            var systemPrompt = $@"Você é um assistente médico especializado em sugerir exames complementares.
O paciente descreveu seus sintomas e precisa de {examTypeLabel}.

Regras:
- Sugira entre 3 e 6 exames relevantes para a queixa
- Para cada exame, dê uma justificativa curta (1 frase)
- Use nomes comuns dos exames (ex: ""Hemograma completo"", ""TSH"", ""Raio-X de tórax PA e perfil"")
- Ordene por relevância (mais importante primeiro)
- NÃO faça diagnóstico — apenas sugira exames investigativos
- Responda APENAS com JSON válido no formato: [{{""exam"":""Nome"",""reason"":""Justificativa""}}]";

            var payload = new
            {
                model = "gpt-4o-mini",
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = $"Sintomas do paciente: {request.Symptoms.Trim()}" },
                },
                max_tokens = 500,
                temperature = 0.3,
            };

            var client = httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
            client.Timeout = TimeSpan.FromSeconds(15);

            var json = JsonSerializer.Serialize(payload);
            var response = await client.PostAsync(
                "https://api.openai.com/v1/chat/completions",
                new StringContent(json, Encoding.UTF8, "application/json"),
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("[SuggestExams] OpenAI erro: {Status}", response.StatusCode);
                return Ok(new { suggestions = Array.Empty<object>(), message = "Não foi possível gerar sugestões no momento." });
            }

            var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(responseJson);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString()?.Trim() ?? "[]";

            // Extrair JSON do conteúdo (pode vir com markdown ```json ... ```)
            if (content.Contains("```"))
            {
                var start = content.IndexOf('[');
                var end = content.LastIndexOf(']');
                if (start >= 0 && end > start)
                    content = content[start..(end + 1)];
            }

            var suggestions = JsonSerializer.Deserialize<JsonElement>(content);
            return Ok(new { suggestions });
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[SuggestExams] Erro ao gerar sugestões");
            return Ok(new { suggestions = Array.Empty<object>(), message = "Erro ao gerar sugestões." });
        }
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}

public record SuggestExamsRequestDto(string? Symptoms, string? ExamType);
