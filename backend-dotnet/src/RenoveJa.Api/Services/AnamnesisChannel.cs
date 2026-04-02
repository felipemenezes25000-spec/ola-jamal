using System.Threading.Channels;

namespace RenoveJa.Api.Services;

/// <summary>
/// Work item queued by the controller for background anamnesis processing.
/// </summary>
public sealed record AnamnesisWorkItem(
    string FullText,
    string? PreviousAnamnesisJson,
    Guid RequestId,
    string GroupName,
    string? ConsultationType = null);

/// <summary>
/// Bounded channel that decouples anamnesis AI work from the HTTP request lifetime.
/// Registered as Singleton — same pattern as <see cref="AuditChannel"/>.
/// </summary>
public sealed class AnamnesisChannel
{
    private readonly Channel<AnamnesisWorkItem> _channel;

    public AnamnesisChannel()
    {
        var options = new BoundedChannelOptions(500)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleReader = true,
            SingleWriter = false
        };
        _channel = Channel.CreateBounded<AnamnesisWorkItem>(options);
    }

    public ChannelWriter<AnamnesisWorkItem> Writer => _channel.Writer;
    public ChannelReader<AnamnesisWorkItem> Reader => _channel.Reader;
}
