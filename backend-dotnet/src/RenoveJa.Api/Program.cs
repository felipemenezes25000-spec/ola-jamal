using DotNetEnv;
using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Assistant;
using RenoveJa.Application.Services.Auth;
using RenoveJa.Application.Services.Clinical;
using RenoveJa.Infrastructure.AiReading;
using RenoveJa.Application.Services.Audit;
using RenoveJa.Application.Services.Requests;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Application.Services.Video;
using RenoveJa.Application.Services.Doctors;
using RenoveJa.Application.Services.Verification;
using RenoveJa.Application.Validators;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Application.Configuration;
using RenoveJa.Infrastructure.Data.Postgres;
using RenoveJa.Infrastructure.Repositories;
using RenoveJa.Infrastructure.Certificates;
using RenoveJa.Infrastructure.Pdf;
using RenoveJa.Infrastructure.CrmValidation;
using RenoveJa.Infrastructure.Auth;
using RenoveJa.Infrastructure.Video;
using RenoveJa.Api.Extensions;
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
using System.Net.Http;
using System.Threading.RateLimiting;
using Serilog;
using Microsoft.AspNetCore.Rewrite;
using Microsoft.AspNetCore.HttpOverrides;
// Carrega .env da pasta do projeto e configura variaveis de ambiente
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

// Dicionário preenchido ao ler .env; usado para DatabaseConfig (evita depender de Environment)
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
        // ASPNETCORE_ENVIRONMENT: não sobrescrever se já definido (ex: launch profile TestAnamnesis)
        if (string.Equals(key, "ASPNETCORE_ENVIRONMENT", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
            continue;
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

// AllowedHosts: em dev aceita localhost, ngrok e IP da LAN ("*"). Em Production, só aceita "*" se .env tiver AllowedHosts=* (ex.: ngrok local).
if (!builder.Environment.IsProduction())
    builder.Configuration["AllowedHosts"] = "*";
else if (string.Equals(Environment.GetEnvironmentVariable("AllowedHosts"), "*", StringComparison.OrdinalIgnoreCase))
    builder.Configuration["AllowedHosts"] = "*";

// Escutar em todas as interfaces (0.0.0.0) para acesso via IP na rede (ex: 192.168.15.69:5000)
// Se ASPNETCORE_URLS já estiver definido (ex: em produção), não sobrescreve.
// Em plataformas como AWS ECS, a variável PORT é injetada (ex.: 8080) e precisa ser respeitada.
var urlsEnv = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
if (string.IsNullOrWhiteSpace(urlsEnv))
{
    var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

builder.Host.UseSerilog();

// Add services to the container
builder.Services.AddControllers(options =>
{
    options.Filters.Add<RenoveJa.Api.Authorization.DoctorApprovalFilter>();
    options.Filters.Add<RenoveJa.Api.Filters.UnauthorizedExceptionFilter>();
})
    .AddJsonOptions(o =>
    {
        // Serializar enums como strings em vez de inteiros para compatibilidade com frontend.
        // Necessário para EncounterType, DocumentType, etc. em DTOs do FHIR-Lite.
        o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter(
            System.Text.Json.JsonNamingPolicy.CamelCase));
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

// Configuracao centralizada (Google, OpenAI, Daily, etc.)
builder.Services.AddRenoveJaConfiguration(builder.Configuration, _envVars);

// In-memory cache
builder.Services.AddMemoryCache();

// PostgresClient usa Npgsql direto (sem HTTP)
builder.Services.AddSingleton<PostgresClient>();
builder.Services.AddHttpClient<IDailyVideoService, DailyVideoService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddSingleton<RecordingStartChannel>();
builder.Services.AddSingleton<IStartConsultationRecording, StartConsultationRecordingService>();
builder.Services.AddHostedService<BackgroundRecordingStarter>();
builder.Services.AddScoped<IRecordingSyncService, RecordingSyncService>();
builder.Services.AddHostedService<RecordingSyncBackgroundService>();
builder.Services.AddHostedService<OrphanedRoomCleanupService>();
builder.Services.AddHostedService<RenoveJa.Infrastructure.ClinicalEvidence.EvidenceCacheStartupCleaner>();
builder.Services.AddScoped<RenoveJa.Infrastructure.Storage.S3MigrationService>();
// HttpContextAccessor for CurrentUserService
builder.Services.AddHttpContextAccessor();

// Registros modularizados via extension methods
builder.Services.AddRepositories();
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices();

builder.Services.AddHttpClient();

// ForwardedHeaders: respeita X-Forwarded-For e X-Forwarded-Proto quando atrás de proxy (AWS ALB/ECS)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Configure Authentication
builder.Services.AddAuthentication("Bearer")
    .AddScheme<AuthenticationSchemeOptions, BearerAuthenticationHandler>("Bearer", null);

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Patient", policy => policy.RequireRole("patient"));
    options.AddPolicy("Doctor", policy => policy.RequireRole("doctor"));
    options.AddPolicy("Admin", policy => policy.RequireRole("admin"));
});

builder.Services.AddSignalR(options =>
{
    // Prevent zombie connections from accumulating during ECS deploys/restarts.
    // Default is 30s keep-alive / 90s timeout; tighten for mobile clients on unreliable networks.
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
    options.HandshakeTimeout = TimeSpan.FromSeconds(10);
});

// Add CORS - configurado por ambiente
builder.Services.AddCors(options =>
{
    // Origens permitidas (fallback quando Cors:AllowedOrigins não está definido) — só prod: renovejasaude + iti
    var defaultOrigins = new[]
    {
        "https://renovejasaude.com.br",
        "https://www.renovejasaude.com.br",
        "https://admin.renovejasaude.com.br",
        "https://app.renovejasaude.com.br",
        "https://medico.renovejasaude.com.br",
        "https://validar.iti.gov.br",
        "https://h-validar.iti.gov.br",
        "https://www.validar.iti.gov.br"
    };

    // Produção: só origens explícitas do config + iti.gov.br (validador). Lovable só em Development.
    static bool IsAllowedOrigin(string? origin, IReadOnlyCollection<string> explicitOrigins)
    {
        if (string.IsNullOrEmpty(origin)) return false;
        try
        {
            var uri = new Uri(origin);
            var host = uri.Host;
            if (explicitOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;
            if (host.Equals("validar.iti.gov.br", StringComparison.OrdinalIgnoreCase) || host.Equals("h-validar.iti.gov.br", StringComparison.OrdinalIgnoreCase)
                || host.EndsWith(".iti.gov.br", StringComparison.OrdinalIgnoreCase))
                return true;
            return false;
        }
        catch { return false; }
    }

    // Une origens do appsettings/ECS/SSM com a lista padrão do código. Assim, se Cors:AllowedOrigins
    // na AWS tiver só parte dos hosts (ex.: site + admin), medico/app continuam permitidos.
    static string[] MergeCorsOrigins(string[] defaults, string[]? fromConfig)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var o in defaults)
            if (!string.IsNullOrWhiteSpace(o)) set.Add(o.Trim());
        if (fromConfig != null)
            foreach (var o in fromConfig)
                if (!string.IsNullOrWhiteSpace(o)) set.Add(o.Trim());
        return [.. set];
    }

    // Policy restritiva para produção (default)
    options.AddDefaultPolicy(policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
        var origins = MergeCorsOrigins(defaultOrigins, allowedOrigins);

        policy.SetIsOriginAllowed(origin => IsAllowedOrigin(origin, origins))
              .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
              .AllowAnyHeader()
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
                // Lovable removido: não é mais utilizado
                return false;
            }
            catch { return false; }
        }

        policy.SetIsOriginAllowed(IsDevOrigin)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });

    // Policy permissiva para endpoints de verificação — AllowAnyOrigin para garantir que o ITI funcione
    // (validar.iti.gov.br pode usar subdomínios ou iframes; sem credentials, seguro para GET público)
    options.AddPolicy("VerifyCors", policy =>
    {
        policy.AllowAnyOrigin()
              .WithMethods("GET", "POST", "OPTIONS")
              .AllowAnyHeader();
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

    // Limiter para autenticação: 5 tentativas por minuto (proteção contra brute force)
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 2
            }));

    // Limiter para refresh token: mais generoso que login (chamado automaticamente pelo app)
    options.AddPolicy("auth-refresh", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 15,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 5
            }));

    // Limiter para verificação pública: 5 req/min por IP (anti-fraude endurecido)
    options.AddPolicy("verify", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 2
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

    // NM-6: Limiter for admin operations: 30 req/min (separate from login "auth" bucket)
    options.AddPolicy("admin", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 5
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

    // Exportação de dados do paciente: 1 req/h por usuário
    options.AddPolicy("export", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? httpContext.Connection.RemoteIpAddress?.ToString()
                ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 1,
                Window = TimeSpan.FromHours(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

var app = builder.Build();

{
    var googleClientId = app.Configuration.GetSection("Google")["ClientId"];
    if (string.IsNullOrWhiteSpace(googleClientId))
    {
        var logger = app.Services.GetRequiredService<ILogger<Program>>();
        logger.LogWarning("Google:ClientId não configurado. Login com Google não funcionará. Defina a env var Google__ClientId.");
    }
}

app.UseForwardedHeaders();

// Executar database migrations na inicialização
try
{
    await RenoveJa.Infrastructure.Data.Postgres.MigrationRunner.RunAsync(app.Services);
    Log.Information("Database migrations executadas com sucesso");
}
catch (Exception ex)
{
    Log.Warning(ex, "Falha ao executar database migrations (pode ser normal se DatabaseUrl não estiver configurada)");
}

// CORS primeiro: preflight OPTIONS precisa receber 200 com headers antes de qualquer outro middleware
if (app.Environment.IsDevelopment())
    app.UseCors("Development");
else
    app.UseCors();

// HSTS e HTTPS redirect removidos: ALB termina TLS e encaminha HTTP para o container.
// UseHttpsRedirection() causava health check 400 em produção (ECS/ALB).

app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["X-Frame-Options"] = "DENY";
    ctx.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    // Permite camera e microfone para o portal do médico (Daily.co videochamada)
    ctx.Response.Headers["Permissions-Policy"] = "camera=(self), microphone=(self), geolocation=()";
    ctx.Response.Headers["X-XSS-Protection"] = "0";
    ctx.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://*.daily.co; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' https://*.daily.co wss://*.daily.co https://api.openai.com; " +
        "frame-src 'self' https://*.daily.co; " +
        "media-src 'self' blob:; " +
        "object-src 'none'; " +
        "base-uri 'self'";
    if (!app.Environment.IsDevelopment())
    {
        ctx.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    }
    await next();
});

// Remove trailing slash internamente (sem redirect) para evitar 405 em webhooks.
var rewriteOptions = new RewriteOptions()
    .AddRewrite(@"^(.+)/$", "$1", skipRemainingRules: true);
app.UseRewriter(rewriteOptions);

// SerilogRequestLogging removido: ApiRequestLoggingMiddleware já registra requisições de forma objetiva (erros e lentidão).

// Permite re-leitura do body em webhooks (ex.: Mercado Pago)
app.Use(async (context, next) =>
{
    context.Request.EnableBuffering();
    await next();
});

// Swagger habilitado apenas em Development ou quando SWAGGER_ENABLED=true (ex.: staging)
// Em Production sem flag, Swagger fica desabilitado para não expor a API publicamente
var swaggerEnabled = app.Environment.IsDevelopment()
    || string.Equals(Environment.GetEnvironmentVariable("SWAGGER_ENABLED"), "true", StringComparison.OrdinalIgnoreCase);
if (swaggerEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

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
