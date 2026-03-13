using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Assistant;
using RenoveJa.Application.Services.Auth;
using RenoveJa.Application.Services.Audit;
using RenoveJa.Application.Services.CarePlans;
using RenoveJa.Application.Services.Clinical;
using RenoveJa.Application.Services.Doctors;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Application.Services.Payments;
using RenoveJa.Application.Services.Requests;
using RenoveJa.Application.Services.Video;
using RenoveJa.Application.Services.Verification;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.AiReading;
using RenoveJa.Infrastructure.Auth;
using RenoveJa.Infrastructure.Certificates;
using RenoveJa.Infrastructure.CrmValidation;
using RenoveJa.Infrastructure.Data.Supabase;
using RenoveJa.Infrastructure.Payments;
using RenoveJa.Infrastructure.Pdf;
using RenoveJa.Infrastructure.Repositories;
using RenoveJa.Infrastructure.Storage;
using RenoveJa.Infrastructure.Video;
using RenoveJa.Api.Services;

namespace RenoveJa.Api.Extensions;

/// <summary>
/// Extension methods para modularizar o registro de serviços no DI.
/// </summary>
public static class ServiceCollectionExtensions
{
    private static string EnvOrConfig(
        IReadOnlyDictionary<string, string> envVars,
        IConfiguration config,
        string envKey,
        string configPath)
    {
        var fromEnv = envVars.GetValueOrDefault(envKey) ?? Environment.GetEnvironmentVariable(envKey);
        if (!string.IsNullOrWhiteSpace(fromEnv)) return fromEnv.Trim();
        var fromConfig = config[configPath];
        return fromConfig?.Trim() ?? string.Empty;
    }

    /// <summary>Registra todos os repositórios.</summary>
    public static IServiceCollection AddRepositories(this IServiceCollection services)
    {
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IDoctorRepository, DoctorRepository>();
        services.AddScoped<IRequestRepository, RequestRepository>();
        services.AddScoped<IPaymentRepository, PaymentRepository>();
        services.AddScoped<ISavedCardRepository, SavedCardRepository>();
        services.AddScoped<IAuthTokenRepository, AuthTokenRepository>();
        services.AddScoped<IPasswordResetTokenRepository, PasswordResetTokenRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<IVideoRoomRepository, VideoRoomRepository>();
        services.AddScoped<IConsultationAnamnesisRepository, ConsultationAnamnesisRepository>();
        services.AddScoped<IPushTokenRepository, PushTokenRepository>();
        services.AddScoped<IUserPushPreferencesRepository, UserPushPreferencesRepository>();
        services.AddScoped<IProductPriceRepository, ProductPriceRepository>();
        services.AddScoped<ICertificateRepository, CertificateRepository>();
        services.AddScoped<IAuditLogRepository, AuditLogRepository>();
        services.AddScoped<IPaymentAttemptRepository, PaymentAttemptRepository>();
        services.AddScoped<IWebhookEventRepository, WebhookEventRepository>();
        services.AddScoped<IConsultationTimeBankRepository, ConsultationTimeBankRepository>();
        services.AddScoped<IPatientRepository, PatientRepository>();
        services.AddScoped<IEncounterRepository, EncounterRepository>();
        services.AddScoped<IMedicalDocumentRepository, MedicalDocumentRepository>();
        services.AddScoped<IConsentRepository, ConsentRepository>();
        services.AddScoped<IAuditEventRepository, AuditEventRepository>();
        services.AddScoped<IAiSuggestionRepository, AiSuggestionRepository>();
        services.AddScoped<IAiInteractionLogRepository, AiInteractionLogRepository>();
        services.AddScoped<IDoctorPatientNotesRepository, DoctorPatientNotesRepository>();
        services.AddScoped<ICarePlanRepository, CarePlanRepository>();
        services.AddScoped<ICarePlanTaskRepository, CarePlanTaskRepository>();
        services.AddScoped<IOutboxEventRepository, OutboxEventRepository>();
        return services;
    }

    /// <summary>Registra os serviços de aplicação.</summary>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAssistantNavigatorService, AssistantNavigatorService>();
        services.AddScoped<IDocumentTokenService, RenoveJa.Application.Services.DocumentTokenService>();
        services.AddScoped<IRequestEventsPublisher, RequestEventsPublisher>();
        services.AddScoped<IRequestApprovalService, RequestApprovalService>();
        services.AddScoped<IRequestService, RequestService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<IPaymentWebhookHandler, PaymentWebhookHandler>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IVideoService, VideoService>();
        services.AddScoped<IDoctorService, DoctorService>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<IAuditEventService, AuditEventService>();
        services.AddScoped<IClinicalRecordService, ClinicalRecordService>();
        services.AddScoped<IConsultationEncounterService, ConsultationEncounterService>();
        services.AddScoped<ICarePlanService, CarePlanService>();
        services.AddScoped<ISignedRequestClinicalSyncService, SignedRequestClinicalSyncService>();
        services.AddScoped<IVerificationService, RenoveJa.Application.Services.Verification.VerificationService>();
        return services;
    }

    /// <summary>Registra os serviços de infraestrutura.</summary>
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services)
    {
        services.AddScoped<IStorageService, SupabaseStorageService>();
        services.AddScoped<IMercadoPagoService, MercadoPagoService>();
        services.AddScoped<IDigitalCertificateService, DigitalCertificateService>();
        services.AddScoped<IPrescriptionPdfService, PrescriptionPdfService>();
        services.AddScoped<ICrmValidationService, InfoSimplesCrmService>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IPushNotificationSender, RenoveJa.Infrastructure.Notifications.ExpoPushService>();
        services.AddScoped<IPushNotificationDispatcher, RenoveJa.Application.Services.Notifications.PushNotificationDispatcher>();
        services.AddScoped<IEmailService, RenoveJa.Infrastructure.Email.SmtpEmailService>();

        services.AddScoped<IAiReadingService, OpenAiReadingService>();
        services.AddScoped<IAiPrescriptionGeneratorService, OpenAiPrescriptionGeneratorService>();
        services.AddScoped<IAiConductSuggestionService, OpenAiConductSuggestionService>();
        services.AddScoped<IClinicalSummaryService, OpenAiClinicalSummaryService>();
        services.AddScoped<ITriageEnrichmentService, OpenAiTriageEnrichmentService>();
        services.AddScoped<IPrescriptionVerifyRepository, RenoveJa.Infrastructure.Repositories.PrescriptionVerifyRepository>();
        services.AddSingleton<IConsultationSessionStore, RenoveJa.Infrastructure.ConsultationAnamnesis.ConsultationSessionStore>();
        services.AddScoped<ITranscriptionService, RenoveJa.Infrastructure.Transcription.WhisperTranscriptionService>();
        services.AddScoped<IPubMedService, RenoveJa.Infrastructure.PubMed.PubMedService>();
        services.AddScoped<IRxNormService, RenoveJa.Infrastructure.RxNorm.RxNormService>();
        services.AddScoped<RenoveJa.Infrastructure.Evidence.EuropePmcEvidenceService>();
        services.AddScoped<RenoveJa.Infrastructure.Evidence.SemanticScholarEvidenceService>();
        services.AddScoped<RenoveJa.Infrastructure.Evidence.ClinicalTrialsEvidenceService>();
        services.AddScoped<IEvidenceSearchService, RenoveJa.Infrastructure.Evidence.UnifiedEvidenceSearchService>();
        services.AddScoped<IConsultationAnamnesisService, RenoveJa.Infrastructure.ConsultationAnamnesis.ConsultationAnamnesisService>();

        services.AddSingleton<RenoveJa.Application.Services.Notifications.NewRequestBatchService>();
        services.AddSingleton<INewRequestBatchService>(sp => sp.GetRequiredService<RenoveJa.Application.Services.Notifications.NewRequestBatchService>());
        services.AddHostedService(sp => sp.GetRequiredService<RenoveJa.Application.Services.Notifications.NewRequestBatchService>());
        services.AddHostedService<RenoveJa.Application.Services.Notifications.StaleRequestReminderService>();
        services.AddHostedService<RenoveJa.Application.Services.Notifications.RenewalReminderService>();
        services.AddSingleton<RenoveJa.Infrastructure.Notifications.ExpoPushReceiptChecker>();
        services.AddHostedService(sp => sp.GetRequiredService<RenoveJa.Infrastructure.Notifications.ExpoPushReceiptChecker>());

        return services;
    }

    /// <summary>Configura opções de Supabase, Google, MercadoPago, OpenAI, etc.</summary>
    public static IServiceCollection AddRenoveJaConfiguration(
        this IServiceCollection services,
        IConfiguration config,
        IReadOnlyDictionary<string, string> envVars)
    {
        services.Configure<SupabaseConfig>(options =>
        {
            options.Url = EnvOrConfig(envVars, config, "Supabase__Url", "Supabase:Url");
            options.ServiceKey = EnvOrConfig(envVars, config, "Supabase__ServiceKey", "Supabase:ServiceKey");
            options.DatabaseUrl = EnvOrConfig(envVars, config, "Supabase__DatabaseUrl", "Supabase:DatabaseUrl");
        });

        services.Configure<GoogleAuthConfig>(config.GetSection("Google"));

        services.Configure<MercadoPagoConfig>(config.GetSection(MercadoPagoConfig.SectionName));
        services.Configure<OpenAIConfig>(config.GetSection(OpenAIConfig.SectionName));
        services.PostConfigure<OpenAIConfig>(options =>
        {
            options.GeminiApiKey = EnvOrConfig(envVars, config, "Gemini__ApiKey", "Gemini:ApiKey");
            options.GeminiApiBaseUrl = EnvOrConfig(envVars, config, "Gemini__ApiBaseUrl", "Gemini:ApiBaseUrl");
            // FORCE_OPENAI_PROVIDER=1: força uso de OpenAI (para testar fallback GPT sem Gemini)
            if (string.Equals(Environment.GetEnvironmentVariable("FORCE_OPENAI_PROVIDER"), "1", StringComparison.OrdinalIgnoreCase))
                options.GeminiApiKey = "";
            // FORCE_GEMINI_ONLY=1: desabilita fallback GPT (para testar Gemini puro)
            if (string.Equals(Environment.GetEnvironmentVariable("FORCE_GEMINI_ONLY"), "1", StringComparison.OrdinalIgnoreCase))
                options.ApiKey = "";
        });
        services.Configure<SmtpConfig>(config.GetSection(SmtpConfig.SectionName));
        services.Configure<InfoSimplesConfig>(config.GetSection(InfoSimplesConfig.SectionName));
        services.Configure<CertificateEncryptionConfig>(config.GetSection(CertificateEncryptionConfig.SectionName));
        services.Configure<VerificationConfig>(config.GetSection(VerificationConfig.SectionName));

        services.Configure<ApiConfig>(options =>
        {
            options.BaseUrl = EnvOrConfig(envVars, config, "Api__BaseUrl", "Api:BaseUrl");
            options.DocumentTokenSecret = EnvOrConfig(envVars, config, "Api__DocumentTokenSecret", "Api:DocumentTokenSecret");
        });

        services.Configure<DailyConfig>(options =>
        {
            options.ApiKey = (envVars.GetValueOrDefault("DAILY_API_KEY") ?? Environment.GetEnvironmentVariable("DAILY_API_KEY") ?? "").Trim();
            options.Domain = (envVars.GetValueOrDefault("DAILY_DOMAIN") ?? Environment.GetEnvironmentVariable("DAILY_DOMAIN") ?? "renove").Trim();
            options.RoomPrefix = (envVars.GetValueOrDefault("DAILY_ROOM_PREFIX") ?? Environment.GetEnvironmentVariable("DAILY_ROOM_PREFIX") ?? "consult").Trim();
            options.DefaultRoomExpiryMinutes = int.TryParse(
                envVars.GetValueOrDefault("DAILY_ROOM_EXPIRY_MINUTES") ?? Environment.GetEnvironmentVariable("DAILY_ROOM_EXPIRY_MINUTES"),
                out var exp) ? exp : 120;
        });

        return services;
    }
}
