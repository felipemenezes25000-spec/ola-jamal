using DotNetEnv;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Auth;
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
using RenoveJa.Infrastructure.Video;
using RenoveJa.Infrastructure.Auth;
using RenoveJa.Api.Middleware;
using RenoveJa.Api.Authentication;
using RenoveJa.Api.Swagger;
using Microsoft.AspNetCore.Authentication;
using Microsoft.OpenApi.Models;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Threading.RateLimiting;
using Serilog;

// Carrega .env da pasta do projeto (sobrescreve env vars; permite centralizar credenciais)
Env.TraversePath().Load();

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("logs/log-.txt", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 30)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

// Escutar em todas as interfaces (0.0.0.0) para acesso via IP na rede (ex: 192.168.15.69:5000)
// Se ASPNETCORE_URLS já estiver definido (ex: em produção), não sobrescreve
var urlsEnv = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
if (string.IsNullOrWhiteSpace(urlsEnv))
{
    builder.WebHost.UseUrls("http://0.0.0.0:5000");
}

builder.Host.UseSerilog();

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
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
});

// Add FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();

// Configure Supabase
builder.Services.Configure<SupabaseConfig>(
    builder.Configuration.GetSection("Supabase"));

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

// Configure Daily.co (teleconsulta)
builder.Services.Configure<DailyCoConfig>(
    builder.Configuration.GetSection(DailyCoConfig.SectionName));

// Configure Certificate Encryption
builder.Services.Configure<CertificateEncryptionConfig>(
    builder.Configuration.GetSection(CertificateEncryptionConfig.SectionName));

// Configure Verification (URL base do QR Code para validar.iti.gov.br)
builder.Services.Configure<VerificationConfig>(
    builder.Configuration.GetSection(VerificationConfig.SectionName));

// In-memory cache
builder.Services.AddMemoryCache();

builder.Services.AddHttpClient<SupabaseClient>();
builder.Services.AddHttpClient(SupabaseStorageService.HttpClientName);

// HttpContextAccessor for CurrentUserService
builder.Services.AddHttpContextAccessor();

// Register Repositories
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IDoctorRepository, DoctorRepository>();
builder.Services.AddScoped<IRequestRepository, RequestRepository>();
builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();
builder.Services.AddScoped<IAuthTokenRepository, AuthTokenRepository>();
builder.Services.AddScoped<IPasswordResetTokenRepository, PasswordResetTokenRepository>();
builder.Services.AddScoped<IEmailService, RenoveJa.Infrastructure.Email.SmtpEmailService>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<IVideoRoomRepository, VideoRoomRepository>();
builder.Services.AddScoped<IPushTokenRepository, PushTokenRepository>();
builder.Services.AddScoped<IProductPriceRepository, ProductPriceRepository>();
builder.Services.AddScoped<ICertificateRepository, CertificateRepository>();
builder.Services.AddScoped<IAuditLogRepository, AuditLogRepository>();

// Register Application Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IRequestService, RequestService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IVideoService, VideoService>();
builder.Services.AddScoped<IDoctorService, DoctorService>();
builder.Services.AddScoped<IAuditService, AuditService>();

// Register Infrastructure Services
builder.Services.AddScoped<IStorageService, SupabaseStorageService>();
builder.Services.AddScoped<IMercadoPagoService, MercadoPagoService>();
builder.Services.AddScoped<IDigitalCertificateService, DigitalCertificateService>();
builder.Services.AddScoped<IPrescriptionPdfService, PrescriptionPdfService>();
builder.Services.AddScoped<ICrmValidationService, InfoSimplesCrmService>();
builder.Services.AddScoped<IDailyVideoService, DailyVideoService>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IPushNotificationSender, RenoveJa.Infrastructure.Notifications.ExpoPushService>();

builder.Services.AddHttpClient();
builder.Services.AddScoped<IAiReadingService, RenoveJa.Infrastructure.AiReading.OpenAiReadingService>();

// Configure Authentication
builder.Services.AddAuthentication("Bearer")
    .AddScheme<AuthenticationSchemeOptions, BearerAuthenticationHandler>("Bearer", null);

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Patient", policy => policy.RequireRole("patient"));
    options.AddPolicy("Doctor", policy => policy.RequireRole("doctor"));
});

// Add CORS - configurado por ambiente
builder.Services.AddCors(options =>
{
    // Policy restritiva para produção (default)
    options.AddDefaultPolicy(policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
        if (allowedOrigins != null && allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
        else
        {
            policy.WithOrigins(
                    "https://renovejasaude.com.br",
                    "https://www.renovejasaude.com.br",
                    "https://app.renovejasaude.com.br"
                )
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials();
        }
    });

    // Policy aberta para desenvolvimento
    options.AddPolicy("Development", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Rate limiting básico
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;

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

app.UseSerilogRequestLogging();

// Permite re-leitura do body em webhooks (ex.: Mercado Pago)
app.Use(async (context, next) =>
{
    context.Request.EnableBuffering();
    await next();
});

// Executa migrations no Postgres (ex.: password_reset_tokens) se Supabase:DatabaseUrl estiver configurada
try
{
    SupabaseMigrationRunner.RunAsync(app.Services).GetAwaiter().GetResult();
}
catch (Exception ex)
{
    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    logger.LogWarning(ex, "Supabase migration skipped or failed (configure Supabase:DatabaseUrl to run migrations).");
}

// Configure the HTTP request pipeline
app.UseSwagger();
app.UseSwaggerUI();

// Use CORS: Development policy in Development, default (restrictive) in Production
if (app.Environment.IsDevelopment())
    app.UseCors("Development");
else
    app.UseCors();

app.UseRateLimiter();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<ApiRequestLoggingMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.UseMiddleware<AuditMiddleware>();

app.MapControllers();

app.Run();
