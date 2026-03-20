using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Interfaces;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.ConsultationAnamnesis;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Monitor ao vivo de consultas: transcript vs anamnese com relatório de grounding.
/// Permite verificar se o CID e diagnóstico diferencial estão fundamentados na transcrição.
/// </summary>
[ApiController]
[Route("api/consultation")]
[Authorize(Roles = "doctor")]
public class ConsultationMonitorController(
    IRequestRepository requestRepository,
    IConsultationSessionStore sessionStore,
    ILogger<ConsultationMonitorController> logger) : ControllerBase
{
    /// <summary>
    /// Retorna o estado atual da consulta ao vivo: transcript, anamnese, e relatório de grounding.
    /// Endpoint de polling — chamar a cada 5-10 segundos durante a consulta.
    /// </summary>
    [HttpGet("{requestId:guid}/monitor")]
    public async Task<IActionResult> GetLiveMonitor(Guid requestId, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
            return NotFound(new { message = "Request not found" });

        if (request.DoctorId != userId)
            return Forbid();

        var transcript = sessionStore.GetTranscript(requestId);
        var (anamnesisJson, suggestionsJson) = sessionStore.GetAnamnesisState(requestId);

        var grounding = CidGroundingValidator.Validate(transcript, anamnesisJson);

        // Parse anamnese para extrair campos-chave
        object? anamnesisPreview = null;
        if (!string.IsNullOrWhiteSpace(anamnesisJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(anamnesisJson);
                var root = doc.RootElement;
                anamnesisPreview = new
                {
                    cidSugerido = root.TryGetProperty("cid_sugerido", out var cid) ? cid.GetString() : null,
                    confiancaCid = root.TryGetProperty("confianca_cid", out var conf) ? conf.GetString() : null,
                    raciocinioClinco = root.TryGetProperty("raciocinio_clinico", out var rac) ? rac.GetString() : null,
                    denominadorComum = root.TryGetProperty("denominador_comum", out var den) ? den.GetString() : null,
                    queixaPrincipal = GetNestedString(root, "anamnesis", "queixa_principal"),
                    sintomasCount = GetNestedArrayLength(root, "anamnesis", "sintomas"),
                    diagnosticoDiferencialCount = GetArrayLength(root, "diagnostico_diferencial"),
                };
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "[Monitor] Falha ao parsear anamnese. RequestId={RequestId}", requestId);
            }
        }

        List<string>? suggestions = null;
        if (!string.IsNullOrWhiteSpace(suggestionsJson))
        {
            try { suggestions = JsonSerializer.Deserialize<List<string>>(suggestionsJson); }
            catch { /* ignore */ }
        }

        return Ok(new
        {
            requestId,
            status = request.Status.ToString(),
            timestamp = DateTime.UtcNow,
            transcript = new
            {
                text = transcript,
                length = transcript.Length,
                hasContent = transcript.Length > 0
            },
            anamnesis = new
            {
                hasAnamnesis = !string.IsNullOrWhiteSpace(anamnesisJson),
                preview = anamnesisPreview,
                suggestionsCount = suggestions?.Count ?? 0
            },
            grounding = new
            {
                grounding.IsGrounded,
                grounding.Score,
                grounding.CidSugerido,
                grounding.ConfiancaCid,
                grounding.Issues,
                symptomAnalysis = new
                {
                    transcriptKeywords = grounding.TranscriptSymptoms,
                    anamnesisSymptoms = grounding.AnamnesisSymptoms,
                    matched = grounding.MatchedSymptoms,
                    ungrounded = grounding.UngroundedSymptoms,
                    matchRate = grounding.AnamnesisSymptoms.Length > 0
                        ? $"{(double)grounding.MatchedSymptoms.Length / grounding.AnamnesisSymptoms.Length * 100:F0}%"
                        : "N/A"
                },
                diagnosticoDiferencial = grounding.DiagnosticoDiferencialReport
            }
        });
    }

    /// <summary>
    /// Versão SSE (Server-Sent Events) do monitor — stream contínuo de atualizações.
    /// Conectar via EventSource no browser e receber updates a cada 5 segundos.
    /// </summary>
    [HttpGet("{requestId:guid}/monitor/stream")]
    public async Task GetLiveMonitorStream(Guid requestId, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var request = await requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
        {
            Response.StatusCode = 404;
            return;
        }
        if (request.DoctorId != userId)
        {
            Response.StatusCode = 403;
            return;
        }

        Response.Headers["Content-Type"] = "text/event-stream";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["Connection"] = "keep-alive";

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = false };
        var lastAnamnesisHash = "";

        while (!cancellationToken.IsCancellationRequested)
        {
            var transcript = sessionStore.GetTranscript(requestId);
            var (anamnesisJson, _) = sessionStore.GetAnamnesisState(requestId);

            var currentHash = (anamnesisJson ?? "").GetHashCode().ToString();
            var hasChanged = currentHash != lastAnamnesisHash;
            lastAnamnesisHash = currentHash;

            var grounding = CidGroundingValidator.Validate(transcript, anamnesisJson);

            var payload = new
            {
                timestamp = DateTime.UtcNow,
                transcriptLength = transcript.Length,
                hasAnamnesis = !string.IsNullOrWhiteSpace(anamnesisJson),
                anamnesisChanged = hasChanged,
                grounding = new
                {
                    grounding.IsGrounded,
                    grounding.Score,
                    grounding.CidSugerido,
                    grounding.ConfiancaCid,
                    issueCount = grounding.Issues.Length,
                    issues = grounding.Issues,
                    matchedSymptoms = grounding.MatchedSymptoms.Length,
                    ungroundedSymptoms = grounding.UngroundedSymptoms.Length,
                    diagnosticoDiferencial = grounding.DiagnosticoDiferencialReport
                }
            };

            var json = JsonSerializer.Serialize(payload, jsonOptions);
            await Response.WriteAsync($"data: {json}\n\n", cancellationToken);
            await Response.Body.FlushAsync(cancellationToken);

            await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
        }
    }

    private static string? GetNestedString(JsonElement root, string parent, string child)
    {
        if (root.TryGetProperty(parent, out var p) && p.ValueKind == JsonValueKind.Object
            && p.TryGetProperty(child, out var c))
            return c.GetString();
        return null;
    }

    private static int GetNestedArrayLength(JsonElement root, string parent, string child)
    {
        if (root.TryGetProperty(parent, out var p) && p.ValueKind == JsonValueKind.Object
            && p.TryGetProperty(child, out var c) && c.ValueKind == JsonValueKind.Array)
            return c.GetArrayLength();
        return 0;
    }

    private static int GetArrayLength(JsonElement root, string prop)
    {
        if (root.TryGetProperty(prop, out var el) && el.ValueKind == JsonValueKind.Array)
            return el.GetArrayLength();
        return 0;
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}
