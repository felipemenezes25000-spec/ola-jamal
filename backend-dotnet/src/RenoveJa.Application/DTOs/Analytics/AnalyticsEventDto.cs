namespace RenoveJa.Application.DTOs.Analytics;

public sealed class AnalyticsEventDto
{
    public string EventName { get; set; } = default!;
    public Dictionary<string, string>? Properties { get; set; }
    public DateTimeOffset Timestamp { get; set; }
    public string? SessionId { get; set; }
    public string? DevicePlatform { get; set; }
    public string? DeviceVersion { get; set; }
}

public sealed class AnalyticsBatchDto
{
    public List<AnalyticsEventDto> Events { get; set; } = new();
}

public sealed class HealthMetricsDto
{
    public DateTimeOffset ServerTime { get; set; }
    public long UptimeSeconds { get; set; }
    public string Status { get; set; } = "healthy";
}
