using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Endpoint de transcrição avulsa (speech-to-text) para campos de texto do app.
/// Fluxo: áudio → Deepgram (STT) → GPT-4o (polish clínico) → texto limpo.
/// Usado no campo de sintomas da solicitação de exame/consulta.
/// </summary>
[ApiController]
[Route("api/speech-to-text")]
[Authorize]
public class SpeechToTextController(
    ITranscriptionService transcriptionService,
    IHttpClientFactory httpClientFactory,
    IOptions<OpenAIConfig> openAiConfig,
    ILogger<SpeechToTextController> logger) : ControllerBase
{
    private static readonly string[] AllowedAudioTypes = ["audio/mp4", "audio/m4a", "audio/mpeg", "audio/webm", "audio/wav", "audio/ogg", "audio/aac"];
    private const long MaxAudioSizeBytes = 5 * 1024 * 1024; // 5 MB

    /// <summary>
    /// Transcreve áudio do microfone e opcionalmente polui o texto com IA.
    /// Retorna texto transcrito pronto para inserir no campo de sintomas.
    /// </summary>
    [HttpPost("symptom")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<IActionResult> TranscribeSymptom(
        [FromForm] IFormFile? file,
        [FromForm] string? context,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "Envie um arquivo de áudio no campo 'file'." });

        if (file.Length > MaxAudioSizeBytes)
            return BadRequest(new { error = "Arquivo de áudio excede 5 MB." });

        var contentType = file.ContentType?.ToLowerInvariant() ?? "audio/mp4";
        if (!AllowedAudioTypes.Contains(contentType))
            return BadRequest(new { error = $"Tipo de áudio não suportado: {contentType}." });

        // 1. Deepgram STT
        byte[] audioBytes;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms, cancellationToken);
            audioBytes = ms.ToArray();
        }

        var rawText = await transcriptionService.TranscribeAsync(audioBytes, file.FileName, null, cancellationToken);

        if (string.IsNullOrWhiteSpace(rawText))
        {
            logger.LogWarning("[SpeechToText] Nenhuma fala detectada. FileSize={Size}", audioBytes.Length);
            return Ok(new { transcribed = false, raw = "", polished = "", text = "" });
        }

        logger.LogInformation("[SpeechToText] STT OK. RawLength={Len}", rawText.Length);

        // 2. GPT-4o polish (best-effort, fallback to raw)
        var polished = await PolishSymptomTextAsync(rawText, context, cancellationToken);

        return Ok(new
        {
            transcribed = true,
            raw = rawText,
            polished,
            text = polished ?? rawText,
        });
    }

    /// <summary>
    /// Usa GPT-4o para limpar/organizar o texto transcrito do paciente.
    /// Corrige gramática, remove repetições, organiza cronologicamente.
    /// Retorna null se falhar (caller usa raw como fallback).
    /// </summary>
    private async Task<string?> PolishSymptomTextAsync(string rawText, string? context, CancellationToken ct)
    {
        var apiKey = openAiConfig.Value.ApiKey?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey)
            || apiKey.Contains("YOUR_") || apiKey.Contains("_HERE")
            || apiKey.Contains("SUA_CHAVE") || apiKey.Contains("SUA_KEY")
            || apiKey.Contains("PLACEHOLDER", StringComparison.OrdinalIgnoreCase))
            return null;

        try
        {
            var client = httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);

            var systemPrompt = @"Você é um assistente médico. O paciente gravou um áudio descrevendo seus sintomas para solicitar um exame.
Sua tarefa é limpar e organizar o texto transcrito:
- Corrija erros de transcrição e gramática
- Remova repetições, hesitações ('ãh', 'tipo', 'assim', 'né')
- Organize os sintomas de forma clara e cronológica
- Mantenha a linguagem do paciente (não use termos médicos que ele não usou)
- Seja conciso mas completo — não omita informações relevantes
- Retorne APENAS o texto limpo, sem comentários ou formatação extra
- Se o texto original já está bom, retorne-o praticamente igual";

            var userMessage = string.IsNullOrWhiteSpace(context)
                ? $"Texto transcrito do paciente:\n\n\"{rawText}\""
                : $"Contexto: {context}\n\nTexto transcrito do paciente:\n\n\"{rawText}\"";

            var payload = new
            {
                model = "gpt-4o-mini",
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userMessage },
                },
                max_tokens = 500,
                temperature = 0.3,
            };

            var json = JsonSerializer.Serialize(payload);
            var response = await client.PostAsync(
                "https://api.openai.com/v1/chat/completions",
                new StringContent(json, Encoding.UTF8, "application/json"),
                ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("[SpeechToText] GPT polish failed: {Status}", response.StatusCode);
                return null;
            }

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            using var doc = JsonDocument.Parse(responseJson);
            var content = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            return string.IsNullOrWhiteSpace(content) ? null : content.Trim().Trim('"');
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "[SpeechToText] GPT polish error");
            return null;
        }
    }
}
