using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Infrastructure.Notifications;

/// <summary>
/// Background service que verifica receipts do Expo Push API e
/// desativa tokens com DeviceNotRegistered.
/// </summary>
public class ExpoPushReceiptChecker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<ExpoPushReceiptChecker> _logger;
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(30);
    private const string ReceiptsUrl = "https://exp.host/--/api/v2/push/getReceipts";
    private const int MaxBatchSize = 300;

    private readonly ConcurrentQueue<TicketEntry> _pendingTickets = new();

    public record TicketEntry(string TicketId, string Token, Guid UserId);

    public ExpoPushReceiptChecker(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpFactory,
        ILogger<ExpoPushReceiptChecker> logger)
    {
        _scopeFactory = scopeFactory;
        _httpFactory = httpFactory;
        _logger = logger;
    }

    /// <summary>Chamado pelo ExpoPushService apos envio bem-sucedido.</summary>
    public void EnqueueTicket(string ticketId, string token, Guid userId)
    {
        _pendingTickets.Enqueue(new TicketEntry(ticketId, token, userId));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckReceiptsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falha ao verificar push receipts");
            }

            await Task.Delay(CheckInterval, stoppingToken);
        }
    }

    private async Task CheckReceiptsAsync(CancellationToken ct)
    {
        var entries = new List<TicketEntry>();
        while (_pendingTickets.TryDequeue(out var entry) && entries.Count < MaxBatchSize)
            entries.Add(entry);

        if (entries.Count == 0) return;

        var ticketIds = entries.Select(e => e.TicketId).ToList();
        var ticketMap = entries.ToDictionary(e => e.TicketId);

        try
        {
            var client = _httpFactory.CreateClient();
            var response = await client.PostAsJsonAsync(ReceiptsUrl, new { ids = ticketIds }, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("data", out var data)) return;

            var tokensToDeactivate = new List<(string Token, Guid UserId)>();

            foreach (var prop in data.EnumerateObject())
            {
                var status = prop.Value.TryGetProperty("status", out var s) ? s.GetString() : null;
                if (status != "error") continue;

                var detailsError = prop.Value.TryGetProperty("details", out var d)
                    && d.TryGetProperty("error", out var e)
                    ? e.GetString() : null;

                if (detailsError == "DeviceNotRegistered" && ticketMap.TryGetValue(prop.Name, out var ticketEntry))
                {
                    _logger.LogWarning(
                        "Token DeviceNotRegistered: userId={UserId}, token={TokenPreview}",
                        ticketEntry.UserId,
                        ticketEntry.Token.Length > 40 ? ticketEntry.Token[..40] + "..." : ticketEntry.Token);
                    tokensToDeactivate.Add((ticketEntry.Token, ticketEntry.UserId));
                }
                else if (detailsError != null)
                {
                    _logger.LogWarning("Push receipt error: {TicketId} -> {Error}", prop.Name, detailsError);
                }
            }

            if (tokensToDeactivate.Count > 0)
            {
                using var scope = _scopeFactory.CreateScope();
                var tokenRepo = scope.ServiceProvider.GetRequiredService<IPushTokenRepository>();

                foreach (var (token, userId) in tokensToDeactivate)
                {
                    try
                    {
                        await tokenRepo.DeactivateByTokenAsync(token, userId, ct);
                        _logger.LogInformation("Token desativado: userId={UserId}", userId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Falha ao desativar token para userId={UserId}", userId);
                    }
                }
            }

            _logger.LogInformation(
                "Push receipts verificados: {Total} tickets, {Deactivated} tokens desativados",
                ticketIds.Count, tokensToDeactivate.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao consultar Expo receipts API");
            foreach (var e in entries)
                _pendingTickets.Enqueue(e);
        }
    }
}
