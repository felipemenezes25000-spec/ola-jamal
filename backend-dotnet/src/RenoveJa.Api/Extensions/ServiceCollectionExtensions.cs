using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Amazon.S3;
using RenoveJa.Application.Configuration;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Assistant;
using RenoveJa.Application.Services.Auth;
using RenoveJa.Application.Services.Audit;
using RenoveJa.Application.Services;
using RenoveJa.Application.Services.Clinical;
using RenoveJa.Application.Services.Doctors;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Application.Services.Requests;
using RenoveJa.Application.Services.Video;
using RenoveJa.Application.Services.Verification;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Infrastructure.AiReading;
using RenoveJa.Infrastructure.Auth;
using RenoveJa.Infrastructure.Certificates;
using RenoveJa.Infrastructure.CrmValidation;
using RenoveJa.Infrastructure.Data.Postgres;
using RenoveJa.Infrastructure.Pdf;
using RenoveJa.Infrastructure.Repositories;
using RenoveJa.Infrastructure.Storage;
using RenoveJa.Infrastructure.Video;
using RenoveJa.Infrastructure.Ledi;
using RenoveJa.Infrastructure.Rnds;
using RenoveJa.Api.Services;
using StackExchange.Redis;

namespace RenoveJa.Api.Extensions;

/// <summary>
/// Extension methods para modularizar o registro de servi�os no DI.
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

    /// <summary>Registra todos os reposit�rios.</summary>
    public static IServiceCollection AddRepositories(this IServiceCollection services)
    {
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IDoctorRepository, DoctorRepository>();
        services.AddScoped<IRequestRepository, RequestRepository>();
        services.AddScoped<IAuthTokenRepository, AuthTokenRepository>();
        services.AddScoped<IPasswordResetTokenRepository, PasswordResetTokenRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<IVideoRoomRepository, VideoRoomRepository>();
        services.AddScoped<IConsultationAnamnesisRepository, ConsultationAnamnesisRepository>();
        services.AddScoped<IPushTokenRepository, PushTokenRepository>();
        services.AddScoped<IUserPushPreferencesRepository, UserPushPreferencesRepository>();
        services.AddScoped<ICertificateRepository, CertificateRepository>();
        services.AddScoped<IAuditLogRepository, AuditLogRepository>();
        services.AddScoped<IConsultationTimeBankRepository, ConsultationTimeBankRepository>();
        services.AddScoped<IPatientRepository, PatientRepository>();
        services.AddScoped<IEncounterRepository, EncounterRepository>();
        services.AddScoped<IMedicalDocumentRepository, MedicalDocumentRepository>();
        services.AddScoped<IConsentRepository, ConsentRepository>();
        services.AddScoped<IAuditEventRepository, AuditEventRepository>();
        services.AddScoped<IAiSuggestionRepository, AiSuggestionRepository>();
        services.AddScoped<IAiInteractionLogRepository, AiInteractionLogRepository>();
        services.AddScoped<IDoctorPatientNotesRepository, DoctorPatientNotesRepository>();
        services.AddScoped<IOutboxEventRepository, OutboxEventRepository>();
        return services;
    }

    /// <summary>Registra os servi�os de aplica��o.</summary>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAssistantNavigatorService, AssistantNavigatorService>();
        services.AddScoped<IDocumentTokenService, RenoveJa.Application.Services.DocumentTokenService>();
        services.AddScoped<IRequestEventsPublisher, RequestEventsPublisher>();
        services.AddScoped<IRequestApprovalService, RequestApprovalService>();
        services.AddScoped<IRequestQueryService, RequestQueryService>();
        services.AddScoped<IConsultationLifecycleService, ConsultationLifecycleService>();
        services.AddScoped<ISignatureService, SignatureService>();
        services.AddScoped<IRequestService, RequestService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IVideoService, VideoService>();
        services.AddScoped<IDoctorService, DoctorService>();
        services.AddScoped<IAuditService, AuditService>();
        services.AddScoped<ILediExportService, LediExportService>();
        services.AddScoped<IRndsService, RndsService>();
        services.AddScoped<IAuditEventService, AuditEventService>();
        services.AddScoped<IClinicalRecordService, ClinicalRecordService>();
        services.AddScoped<IPostConsultationService, PostConsultationService>();
        services.AddScoped<IDocumentSecurityService, DocumentSecurityService>();
        services.AddScoped<IDocumentAccessLogRepository, DocumentAccessLogRepository>();
        services.AddScoped<IBatchSignatureService, BatchSignatureService>();
        services.AddScoped<DuplicateDocumentGuard>();
        services.AddScoped<IConsultationEncounterService, ConsultationEncounterService>();
        services.AddScoped<ISignedRequestClinicalSyncService, SignedRequestClinicalSyncService>();
        services.AddScoped<IVerificationService, RenoveJa.Application.Services.Verification.VerificationService>();
        return services;
    }

    /// <summary>Registra os servi�os de infraestrutura.</summary>
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services)
    {
        // Storage: AWS S3 sempre (todos os ambientes).
        // Buckets configur�veis via env vars; defaults apontam para os buckets de produ��o.
        // Em dev local, configure AWS credentials via `aws configure` ou env vars
        // (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION).
        services.AddDefaultAWSOptions(new Amazon.Extensions.NETCore.Setup.AWSOptions
        {
            Region = Amazon.RegionEndpoint.SAEast1
        });
        services.AddAWSService<IAmazonS3>();
        services.Configure<S3StorageConfig>(options =>
        {
            options.Region = Environment.GetEnvironmentVariable("AWS_S3_REGION") ?? "sa-east-1";
            options.PrescriptionsBucket = Environment.GetEnvironmentVariable("AWS_S3_PRESCRIPTIONS_BUCKET") ?? "renoveja-prescriptions";
            options.CertificatesBucket = Environment.GetEnvironmentVariable("AWS_S3_CERTIFICATES_BUCKET") ?? "renoveja-certificates";
            options.AvatarsBucket = Environment.GetEnvironmentVariable("AWS_S3_AVATARS_BUCKET") ?? "renoveja-avatars";
            options.TranscriptsBucket = Environment.GetEnvironmentVariable("AWS_S3_TRANSCRIPTS_BUCKET") ?? "renoveja-transcripts";
            options.PublicBaseUrl = Environment.GetEnvironmentVariable("AWS_S3_PUBLIC_BASE_URL") ?? "";
        });
        services.AddScoped<IStorageService, S3StorageService>();

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
        services.AddScoped<IPrescriptionVerificationLogRepository, RenoveJa.Infrastructure.Repositories.PrescriptionVerificationLogRepository>();
        // Redis (ElastiCache) — usado pelo ConsultationSessionStore para persistir sessões cross-deploy
        services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var cfg = sp.GetRequiredService<IConfiguration>();
            var redisConnectionString = Environment.GetEnvironmentVariable("Redis__ConnectionString")
                ?? cfg["Redis:ConnectionString"]
                ?? "localhost:6379";
            var redisConfig = ConfigurationOptions.Parse(redisConnectionString);
            redisConfig.AbortOnConnectFail = false; // Allow startup even if Redis is temporarily unavailable
            return ConnectionMultiplexer.Connect(redisConfig);
        });
        services.AddSingleton<IConsultationSessionStore, RenoveJa.Infrastructure.ConsultationAnamnesis.ConsultationSessionStore>();
        services.AddScoped<ITranscriptionService, RenoveJa.Infrastructure.Transcription.WhisperTranscriptionService>();

        services.AddScoped<IRxNormService, RenoveJa.Infrastructure.RxNorm.RxNormService>();

        services.AddScoped<RenoveJa.Infrastructure.ConsultationAnamnesis.ConsultationAnamnesisLlmClient>();
        services.AddScoped<IConsultationAnamnesisService, RenoveJa.Infrastructure.ConsultationAnamnesis.ConsultationAnamnesisService>();
        services.AddScoped<ISoapNotesService, RenoveJa.Infrastructure.SoapNotes.SoapNotesService>();

        services.AddSingleton<RenoveJa.Application.Services.Notifications.NewRequestBatchService>();
        services.AddSingleton<INewRequestBatchService>(sp => sp.GetRequiredService<RenoveJa.Application.Services.Notifications.NewRequestBatchService>());
        services.AddHostedService(sp => sp.GetRequiredService<RenoveJa.Application.Services.Notifications.NewRequestBatchService>());
        services.AddHostedService<RenoveJa.Application.Services.Notifications.StaleRequestReminderService>();
        services.AddHostedService<RenoveJa.Application.Services.Notifications.RenewalReminderService>();
        services.AddHostedService<RenoveJa.Application.Services.Notifications.ConsultationReminderService>();
        services.AddHostedService<RenoveJa.Application.Services.Notifications.CertificateExpiryReminderService>();
        services.AddSingleton<RenoveJa.Infrastructure.Notifications.ExpoPushReceiptChecker>();
        services.AddHostedService(sp => sp.GetRequiredService<RenoveJa.Infrastructure.Notifications.ExpoPushReceiptChecker>());

        // Audit: bounded channel + background consumer (replaces fire-and-forget Task.Run)
        services.AddSingleton<AuditChannel>();
        services.AddHostedService<AuditBackgroundService>();

        return services;
    }

    /// <summary>Configura opcoes de Google, MercadoPago, OpenAI, Daily, etc.</summary>
    public static IServiceCollection AddRenoveJaConfiguration(
        this IServiceCollection services,
        IConfiguration config,
        IReadOnlyDictionary<string, string> envVars)
    {
        services.Configure<DatabaseConfig>(options =>
        {
            options.DatabaseUrl = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                ?? config.GetConnectionString("DefaultConnection");
        });

        services.Configure<GoogleAuthConfig>(config.GetSection("Google"));

        services.Configure<OpenAIConfig>(config.GetSection(OpenAIConfig.SectionName));
        services.PostConfigure<OpenAIConfig>(options =>
        {
            options.GeminiApiKey = EnvOrConfig(envVars, config, "Gemini__ApiKey", "Gemini:ApiKey");
            options.GeminiApiBaseUrl = EnvOrConfig(envVars, config, "Gemini__ApiBaseUrl", "Gemini:ApiBaseUrl");
            if (string.Equals(Environment.GetEnvironmentVariable("FORCE_OPENAI_PROVIDER"), "1", StringComparison.OrdinalIgnoreCase))
                options.GeminiApiKey = "";
            if (string.Equals(Environment.GetEnvironmentVariable("FORCE_GEMINI_ONLY"), "1", StringComparison.OrdinalIgnoreCase))
                options.ApiKey = "";
        });
        services.Configure<SmtpConfig>(config.GetSection(SmtpConfig.SectionName));
        services.Configure<InfoSimplesConfig>(config.GetSection(InfoSimplesConfig.SectionName));
        services.Configure<CertificateEncryptionConfig>(config.GetSection(CertificateEncryptionConfig.SectionName));
        services.Configure<VerificationConfig>(config.GetSection(VerificationConfig.SectionName));
        services.Configure<LediConfig>(config.GetSection("Ledi"));
        services.Configure<RndsConfig>(config.GetSection("Rnds"));

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
            // Secret para validação de webhooks do Daily.co (configurar no Dashboard Daily: Developers → Webhooks)
            options.WebhookSecret = (envVars.GetValueOrDefault("DAILY_WEBHOOK_SECRET") ?? Environment.GetEnvironmentVariable("DAILY_WEBHOOK_SECRET") ?? "").Trim();
        });

        return services;
    }
}
