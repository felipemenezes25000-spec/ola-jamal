using System.Collections.Concurrent;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Notifications;
namespace RenoveJa.Application.Services.Notifications;

/// <summary>
/// Batching de "nova solicitação": agrupa pedidos em 2 min e envia "X novas solicitações".
/// </summary>
public class NewRequestBatchService : BackgroundService, INewRequestBatchService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<NewRequestBatchService> _logger;
    private readonly ConcurrentDictionary<Guid, BatchEntry> _batches = new();
    private static readonly TimeSpan BatchWindow = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan FlushInterval = TimeSpan.FromSeconds(45);

    private sealed class BatchEntry
    {
        public int Count;
        public DateTime FirstAt;
        public string TipoSolicitacao = "solicitação";
    }

    public NewRequestBatchService(IServiceScopeFactory scopeFactory, ILogger<NewRequestBatchService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public void AddToBatch(Guid doctorId, string tipoSolicitacao)
    {
        _batches.AddOrUpdate(doctorId,
            _ => new BatchEntry { Count = 1, FirstAt = DateTime.UtcNow, TipoSolicitacao = tipoSolicitacao },
            (_, e) =>
            {
                Interlocked.Increment(ref e.Count);
                return e;
            });
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await FlushReadyBatchesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao flushar batches de nova solicitação");
            }

            await Task.Delay(FlushInterval, stoppingToken);
        }
    }

    private async Task FlushReadyBatchesAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var toFlush = new List<(Guid DoctorId, int Count, string TipoSolicitacao)>();

        foreach (var kv in _batches.ToArray())
        {
            var age = now - kv.Value.FirstAt;
            if (age >= BatchWindow)
            {
                if (_batches.TryRemove(kv.Key, out var entry))
                    toFlush.Add((kv.Key, entry.Count, entry.TipoSolicitacao));
            }
        }

        if (toFlush.Count == 0) return;

        using var scope = _scopeFactory.CreateScope();
        var dispatcher = scope.ServiceProvider.GetRequiredService<IPushNotificationDispatcher>();

        foreach (var (doctorId, count, tipoSolicitacao) in toFlush)
        {
            try
            {
                var req = PushNotificationRules.NewRequestAvailable(doctorId, tipoSolicitacao, null, count);
                await dispatcher.SendAsync(req, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Falha ao enviar batch push para médico {DoctorId}", doctorId);
            }
        }
    }
}
