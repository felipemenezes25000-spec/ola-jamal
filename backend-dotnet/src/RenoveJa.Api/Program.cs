using DotNetEnv;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Auth;
using RenoveJa.Application.Services.Clinical;
using RenoveJa.Infrastructure.AiReading;
using RenoveJa.Application.Services.Audit;
using RenoveJa.Application.Services.Requests;
using RenoveJa.Application.Services.Payments;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Application.Services.Video;
using RenoveJa.Application.Services.Doctors;
using RenoveJa.Application.Services.Verification;
using RenoveJa.Application.Validators;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Application.Configuration;
using RenoveJa.Infrastructure.Data.Supabase;
using RenoveJa.Infrastructure.Repositories;
using RenoveJa.Infrastructure.Storage;
using RenoveJa.Infrastructure.Payments;
using RenoveJa.Infrastructure.Certificates;
using RenoveJa.Infrastructure.Pdf;
using RenoveJa.Infrastructure.CrmValidation;
using RenoveJa.Infrastructure.Auth;
using RenoveJa.Infrastructure.Video;
using RenoveJa.Api.Middleware;
using RenoveJa.Api.Authentication;
using RenoveJa.Api.Hubs;
using RenoveJa.Api.Services;
using RenoveJa.Api.Swagger;
using Microsoft.AspNetCore.Authentication;
using Microsoft.OpenApi.Models;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Threading.RateLimiting;
using Serilog;
using Microsoft.AspNetCore.Rewrite;

// Carrega .env da pasta do projeto e garante Supabase no Environment (evita 400 por ServiceKey)
static string? FindEnvPath()
{
    var baseDir = AppContext.BaseDirectory;
    var currentDir = Directory.GetCurrentDirectory();
            // Se BaseDirectory contém "RenoveJa.Api", subir até essa pasta e procurar .env
    foreach (var startDir in new[] { baseDir, currentDir })
    {
        if (string.IsNullOrEmpty(startDir)) continue;
        var dir = startDir;
        for (var i = 0; i < 8 && !string.IsNullOrEmpty(dir); i++)
        {
            var envPath = Path.Combine(dir, ".env");
            if (File.Exists(envPath)) return envPath;
            var parent = Path.GetDirectoryName(dir.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
            if (string.IsNullOrEmpty(parent) || parent == dir) break;
            dir = parent;
        }
    }
            // Último recurso: pasta do assembly, procurar "RenoveJa.Api" no caminho
    if (baseDir.Contains("RenoveJa.Api", StringComparison.OrdinalIgnoreCase))
    {
        var idx = baseDir.IndexOf("RenoveJa.Api", StringComparison.OrdinalIgnoreCase);
        var projectDir = baseDir[..(idx + "RenoveJa.Api".Length)];
        var envPath = Path.Combine(projectDir, ".env");
        if (File.Exists(envPath)) return envPath;
    }
    return null;
}

// Dicionário preenchido ao ler .env; usado para SupabaseConfig (evita depender de Environment)
var _envVars = new Dictionary<string, string>();

void ApplyEnvFile(string envPath)
{
    foreach (var line in File.ReadAllLines(envPath))
    {
        var s = line.Trim();
        if (s.Length == 0 || s[0] == '#') continue;
        var eq = s.IndexOf('=');
        if (eq <= 0) continue;
        var key = s[0..eq].Trim();
        var value = s[(eq + 1)..].Trim();
        if (string.IsNullOrEmpty(key)) continue;
        if (value.Length >= 2 && ((value.StartsWith('"') && value.EndsWith('"')) || (value.StartsWith('\'') && value.EndsWith('\''))))
            value = value[1..^1];
        _envVars[key] = value;
        Environment.SetEnvironmentVariable(key, value, EnvironmentVariableTarget.Process);
    }
}

var envPath = FindEnvPath();
if (!string.IsNullOrEmpty(envPath))
{
    Env.Load(envPath);
    ApplyEnvFile(envPath);
}
else
    Env.TraversePath().Load();

const string logTemplate = "[{Timestamp:HH:mm:ss} {Level:u3}] {CorrelationId} {Message:lj}{NewLine}{Exception}";

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: logTemplate)
    .WriteTo.File("logs/log-.txt", rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30, fileSizeLimitBytes: 50_000_000, rollOnFileSizeLimit: true, outputTemplate: logTemplate)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

// AllowedHosts = "*" em não-Production (ngrok, IP da LAN) — em Production usa appsettings.Production.json
if (!builder.Environment.IsProduction())
    builder.Configuration["AllowedHosts"] = "*";

// Escutar em todas as interfaces (0.0.0.0) para acesso via IP na rede (ex: 192.168.15.69:5000)
// Se ASPNETCORE_URLS já estiver definido (ex: em produção), não sobrescreve.
// Em plataformas como Railway, a variável PORT é injetada (ex.: 8080) e precisa ser respeitada.
var urlsEnv = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
if (string.IsNullOrWhiteSpace(urlsEnv))
{
    var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Host.UseSerilog();

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "RenoveJá API",
        Version = "v1",
        Description = "API de telemedicina: receitas, exames, consultas por vídeo, pagamentos PIX/cartão e assinatura digital ICP-Brasil.",
        Contact = new OpenApiContact
        {
            Name = "RenoveJá Saúde",
            Url = new Uri("https://renovejasaude.com.br")
        }
    });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Token do login. Cole o valor do campo 'token' retornado no POST /api/auth/login. O Swagger adiciona 'Bearer ' automaticamente.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer"
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
    options.OperationFilter<PrescriptionUploadOperationFilter>();
    // Ordenar operações por path para facilitar leitura e geração de cliente
    options.OrderActionsBy(a => $"{a.RelativePath}_{a.HttpMethod}");
});

// Add FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();

// Configure Supabase: usar _envVars lido do .env (garante que a ServiceKey venha do arquivo)
builder.Services.Configure<SupabaseConfig>(options =>
{
    var section = builder.Configuration.GetSection("Supabase");
    options.Url = (_envVars.GetValueOrDefault("Supabase__Url") ?? Environment.GetEnvironmentVariable("Supabase__Url") ?? section["Url"])?.Trim() ?? string.Empty;
    options.ServiceKey = (_envVars.GetValueOrDefault("Supabase__ServiceKey") ?? Environment.GetEnvironmentVariable("Supabase__ServiceKey") ?? section["ServiceKey"])?.Trim() ?? string.Empty;
    options.DatabaseUrl = (_envVars.GetValueOrDefault("Supabase__DatabaseUrl") ?? Environment.GetEnvironmentVariable("Supabase__DatabaseUrl") ?? section["DatabaseUrl"])?.Trim();
});

// Configure Google Auth (login com Google)
builder.Services.Configure<GoogleAuthConfig>(
    builder.Configuration.GetSection("Google"));

// Configure Mercado Pago
builder.Services.Configure<MercadoPagoConfig>(
    builder.Configuration.GetSection(MercadoPagoConfig.SectionName));

// Configure OpenAI (GPT-4o) para leitura de receitas e pedidos de exame
builder.Services.Configure<OpenAIConfig>(
    builder.Configuration.GetSection(OpenAIConfig.SectionName));

// Configure SMTP para e-mails (recuperação de senha)
builder.Services.Configure<SmtpConfig>(
    builder.Configuration.GetSection(SmtpConfig.SectionName));

// Configure InfoSimples (CRM validation)
builder.Services.Configure<InfoSimplesConfig>(
    builder.Configuration.GetSection(InfoSimplesConfig.SectionName));

// Configure Certificate Encryption
builder.Services.Configure<CertificateEncryptionConfig>(
    builder.Configuration.GetSection(CertificateEncryptionConfig.SectionName));

// Configure Verification (URL base do QR Code para validar.iti.gov.br)
builder.Services.Configure<VerificationConfig>(
    builder.Configuration.GetSection(VerificationConfig.SectionName));

// Configure Api (URL base e secret para links de documentos — domínio próprio em vez de Supabase)
builder.Services.Configure<ApiConfig>(options =>
{
    options.BaseUrl = (_envVars.GetValueOrDefault("Api__BaseUrl") ?? Environment.GetEnvironmentVariable("Api__BaseUrl") ?? builder.Configuration["Api:BaseUrl"])?.Trim() ?? "";
    options.DocumentTokenSecret = (_envVars.GetValueOrDefault("Api__DocumentTokenSecret") ?? Environment.GetEnvironmentVariable("Api__DocumentTokenSecret") ?? builder.Configuration["Api:DocumentTokenSecret"])?.Trim() ?? "";
});

// Configure Daily.co (videochamada nativa)
builder.Services.Configure<DailyConfig>(options =>
{
    options.ApiKey = (_envVars.GetValueOrDefault("DAILY_API_KEY") ?? Environment.GetEnvironmentVariable("DAILY_API_KEY") ?? "").Trim();
    options.Domain = (_envVars.GetValueOrDefault("DAILY_DOMAIN") ?? Environment.GetEnvironmentVariable("DAILY_DOMAIN") ?? "renove").Trim();
    options.RoomPrefix = (_envVars.GetValueOrDefault("DAILY_ROOM_PREFIX") ?? Environment.GetEnvironmentVariable("DAILY_ROOM_PREFIX") ?? "consult").Trim();
    options.DefaultRoomExpiryMinutes = int.TryParse(
        _envVars.GetValueOrDefault("DAILY_ROOM_EXPIRY_MINUTES") ?? Environment.GetEnvironmentVariable("DAILY_ROOM_EXPIRY_MINUTES"), out var exp) ? exp : 120;
});

// In-memory cache
builder.Services.AddMemoryCache();

builder.Services.AddHttpClient<SupabaseClient>();
builder.Services.AddHttpClient(SupabaseStorageService.HttpClientName);
builder.Services.AddHttpClient<IDailyVideoService, DailyVideoService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});

// HttpContextAccessor for CurrentUserService
builder.Services.AddHttpContextAccessor();

// Register Repositories
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IDoctorRepository, DoctorRepository>();
builder.Services.AddScoped<IRequestRepository, RequestRepository>();
builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();
builder.Services.AddScoped<ISavedCardRepository, SavedCardRepository>();
builder.Services.AddScoped<IAuthTokenRepository, AuthTokenRepository>();
builder.Services.AddScoped<IPasswordResetTokenRepository, PasswordResetTokenRepository>();
builder.Services.AddScoped<IEmailService, RenoveJa.Infrastructure.Email.SmtpEmailService>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<IVideoRoomRepository, VideoRoomRepository>();
builder.Services.AddScoped<IConsultationAnamnesisRepository, ConsultationAnamnesisRepository>();
builder.Services.AddScoped<IPushTokenRepository, PushTokenRepository>();
builder.Services.AddScoped<IProductPriceRepository, ProductPriceRepository>();
builder.Services.AddScoped<ICertificateRepository, CertificateRepository>();
builder.Services.AddScoped<IAuditLogRepository, AuditLogRepository>();
builder.Services.AddScoped<IPaymentAttemptRepository, PaymentAttemptRepository>();
builder.Services.AddScoped<IWebhookEventRepository, WebhookEventRepository>();
builder.Services.AddScoped<IConsultationTimeBankRepository, ConsultationTimeBankRepository>();
builder.Services.AddScoped<IPatientRepository, PatientRepository>();
builder.Services.AddScoped<IEncounterRepository, EncounterRepository>();
builder.Services.AddScoped<IMedicalDocumentRepository, MedicalDocumentRepository>();
builder.Services.AddScoped<IConsentRepository, ConsentRepository>();
builder.Services.AddScoped<IAuditEventRepository, AuditEventRepository>();

// Register Application Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IDocumentTokenService, RenoveJa.Application.Services.DocumentTokenService>();
builder.Services.AddScoped<IRequestEventsPublisher, RequestEventsPublisher>();
builder.Services.AddScoped<IRequestService, RequestService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IVideoService, VideoService>();
builder.Services.AddScoped<IDoctorService, DoctorService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IAuditEventService, AuditEventService>();
builder.Services.AddScoped<IClinicalRecordService, ClinicalRecordService>();
builder.Services.AddScoped<ISignedRequestClinicalSyncService, SignedRequestClinicalSyncService>();
builder.Services.AddScoped<IVerificationService, RenoveJa.Application.Services.Verification.VerificationService>();

// Register Infrastructure Services
builder.Services.AddScoped<IStorageService, SupabaseStorageService>();
builder.Services.AddScoped<IMercadoPagoService, MercadoPagoService>();
builder.Services.AddScoped<IDigitalCertificateService, DigitalCertificateService>();
builder.Services.AddScoped<IPrescriptionPdfService, PrescriptionPdfService>();
builder.Services.AddScoped<ICrmValidationService, InfoSimplesCrmService>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IPushNotificationSender, RenoveJa.Infrastructure.Notifications.ExpoPushService>();

builder.Services.AddHttpClient();
builder.Services.AddScoped<IAiReadingService, RenoveJa.Infrastructure.AiReading.OpenAiReadingService>();
builder.Services.AddScoped<IAiPrescriptionGeneratorService, RenoveJa.Infrastructure.AiReading.OpenAiPrescriptionGeneratorService>();
builder.Services.AddScoped<IAiConductSuggestionService, RenoveJa.Infrastructure.AiReading.OpenAiConductSuggestionService>();
builder.Services.AddScoped<ITriageEnrichmentService, RenoveJa.Infrastructure.AiReading.OpenAiTriageEnrichmentService>();
builder.Services.AddScoped<IPrescriptionVerifyRepository, RenoveJa.Infrastructure.Repositories.PrescriptionVerifyRepository>();
builder.Services.AddSingleton<IConsultationSessionStore, RenoveJa.Infrastructure.ConsultationAnamnesis.ConsultationSessionStore>();
builder.Services.AddScoped<ITranscriptionService, RenoveJa.Infrastructure.Transcription.WhisperTranscriptionService>();
builder.Services.AddScoped<IConsultationAnamnesisService, RenoveJa.Infrastructure.ConsultationAnamnesis.ConsultationAnamnesisService>();

// Configure Authentication
builder.Services.AddAuthentication("Bearer")
    .AddScheme<AuthenticationSchemeOptions, BearerAuthenticationHandler>("Bearer", null);

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Patient", policy => policy.RequireRole("patient"));
    options.AddPolicy("Doctor", policy => policy.RequireRole("doctor"));
});

builder.Services.AddSignalR();

// Add CORS - configurado por ambiente
builder.Services.AddCors(options =>
{
    // Origens permitidas (fallback quando Cors:AllowedOrigins não está definido)
    var defaultOrigins = new[]
    {
        "https://renovejasaude.com.br",
        "https://www.renovejasaude.com.br",
        "https://app.renovejasaude.com.br",
        "https://validar.iti.gov.br",
        "https://lovable.app",
        "https://www.lovable.app"
    };

    // Permite qualquer subdomínio de lovable.app (previews: https://xxx.lovable.app)
    static bool IsAllowedOrigin(string? origin, IReadOnlyCollection<string> explicitOrigins)
    {
        if (string.IsNullOrEmpty(origin)) return false;
        try
        {
            var uri = new Uri(origin);
            var host = uri.Host;
            if (explicitOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;
            if (host.Equals("lovable.app", StringComparison.OrdinalIgnoreCase) || host.EndsWith(".lovable.app", StringComparison.OrdinalIgnoreCase))
                return true;
            return false;
        }
        catch { return false; }
    }

    // Policy restritiva para produção (default)
    options.AddDefaultPolicy(policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
        var origins = (allowedOrigins != null && allowedOrigins.Length > 0) ? allowedOrigins : defaultOrigins;

        policy.SetIsOriginAllowed(origin => IsAllowedOrigin(origin, origins))
              .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
              .WithHeaders("Authorization", "Content-Type", "Accept", "X-Requested-With", "X-Request-Id", "X-Correlation-Id")
              .AllowCredentials();
    });

    // Policy para desenvolvimento: permite localhost, Expo (exp://), ngrok, IP da LAN
    options.AddPolicy("Development", policy =>
    {
        static bool IsDevOrigin(string? origin)
        {
            if (string.IsNullOrEmpty(origin)) return true; // mobile apps muitas vezes não enviam Origin
            try
            {
                var uri = new Uri(origin);
                var host = uri.Host;
                var scheme = uri.Scheme;
                if (host is "localhost" or "127.0.0.1") return true;
                if (scheme == "exp") return true; // Expo Go: exp://192.168.x.x:8081
                if (host.StartsWith("192.168.") || host.StartsWith("10.")) return true; // LAN
                if (host.Contains("ngrok", StringComparison.OrdinalIgnoreCase)) return true;
                return false;
            }
            catch { return false; }
        }

        policy.SetIsOriginAllowed(IsDevOrigin)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Rate limiting básico
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 200,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 20
            }));

    // Limiter global: 100 requests por minuto por IP
    options.AddPolicy("fixed", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 10
            }));

    // Limiter para autenticação: 10 tentativas por minuto
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 2
            }));

    // Limiter para verificação pública: 30 req/min
    options.AddPolicy("verify", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 5
            }));

    // Limiter para forgot-password: 5 req/min
    options.AddPolicy("forgot-password", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 1
            }));

    // Limiter para registro: 10 req/min
    options.AddPolicy("register", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 2
            }));
});

var app = builder.Build();

// Executar migrations do Supabase na inicialização
try
{
    await RenoveJa.Infrastructure.Data.Supabase.SupabaseMigrationRunner.RunAsync(app.Services);
    Log.Information("Supabase migrations executadas com sucesso");
}
catch (Exception ex)
{
    Log.Warning(ex, "Falha ao executar migrations do Supabase (pode ser normal se DatabaseUrl não estiver configurada)");
}

// CORS primeiro: preflight OPTIONS precisa receber 200 com headers antes de qualquer outro middleware
if (app.Environment.IsDevelopment())
    app.UseCors("Development");
else
    app.UseCors();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    ctx.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    ctx.Response.Headers["X-XSS-Protection"] = "0";
    await next();
});

// Remove trailing slash internamente (sem redirect) para evitar 405 em webhooks.
// POST /api/payments/webhook/ -> reescrito para POST /api/payments/webhook
var rewriteOptions = new RewriteOptions()
    .AddRewrite(@"^(.+)/$", "$1", skipRemainingRules: true);
app.UseRewriter(rewriteOptions);

app.UseSerilogRequestLogging();

// Permite re-leitura do body em webhooks (ex.: Mercado Pago)
app.Use(async (context, next) =>
{
    context.Request.EnableBuffering();
    await next();
});

// Swagger habilitado em Development e Production (Render) para debug/testes
app.UseSwagger();
app.UseSwaggerUI();

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseRateLimiter();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<ApiRequestLoggingMiddleware>();

// SignalR: copy access_token from query to Authorization so Bearer auth works for /hubs/*
app.UseMiddleware<SignalRTokenMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.UseMiddleware<AuditMiddleware>();

app.MapControllers();
app.MapHub<VideoSignalingHub>("/hubs/video");
app.MapHub<RequestsHub>("/hubs/requests");

// Log para debug: URL que o app deve usar
var apiBaseUrl = app.Configuration["Api__BaseUrl"]?.Trim();
if (!string.IsNullOrEmpty(apiBaseUrl))
    Log.Information("[Startup] App deve usar: EXPO_PUBLIC_API_URL={ApiBaseUrl}", apiBaseUrl);
else if (app.Environment.IsDevelopment())
{
    try
    {
        var hostName = System.Net.Dns.GetHostName();
        var addresses = System.Net.Dns.GetHostAddresses(hostName);
        var lanIp = addresses.FirstOrDefault(a => a.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)?.ToString();
        if (!string.IsNullOrEmpty(lanIp))
            Log.Information("[Startup] Para dispositivo físico local: EXPO_PUBLIC_API_URL=http://{LanIp}:5000", lanIp);
    }
    catch { /* best effort */ }
}

app.Run();
