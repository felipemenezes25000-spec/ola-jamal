namespace RenoveJa.Domain.Entities;

/// <summary>
/// Preferências de push por categoria e timezone para quiet hours.
/// </summary>
public class UserPushPreferences
{
    public Guid UserId { get; private set; }
    public bool RequestsEnabled { get; private set; }
    public bool PaymentsEnabled { get; private set; }
    public bool ConsultationsEnabled { get; private set; }
    public bool RemindersEnabled { get; private set; }
    public string Timezone { get; private set; }

    private UserPushPreferences() => Timezone = "America/Sao_Paulo";

    private UserPushPreferences(Guid userId, bool requests, bool payments, bool consultations, bool reminders, string timezone)
    {
        UserId = userId;
        RequestsEnabled = requests;
        PaymentsEnabled = payments;
        ConsultationsEnabled = consultations;
        RemindersEnabled = reminders;
        Timezone = timezone ?? "America/Sao_Paulo";
    }

    public static UserPushPreferences CreateDefault(Guid userId) =>
        new(userId, true, true, true, true, "America/Sao_Paulo");

    public static UserPushPreferences Reconstitute(Guid userId, bool requests, bool payments, bool consultations, bool reminders, string timezone) =>
        new(userId, requests, payments, consultations, reminders, timezone);
}
