using RenoveJa.Application.Interfaces;
using RenoveJa.Application.Services.Auth;
using RenoveJa.Application.Services.Requests;
using RenoveJa.Application.Services.Payments;
using RenoveJa.Application.Services.Chat;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Application.Services.Video;
using RenoveJa.Application.Services.Doctors;
using RenoveJa.Application.Validators;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Application.Configuration;
using RenoveJa.Infrastructure.Data.Supabase;
using RenoveJa.Infrastructure.Repositories;
using RenoveJa.Api.Middleware;
using RenoveJa.Api.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.OpenApi.Models;
using FluentValidation;
var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
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
});

// Add FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();

// Configure Supabase
builder.Services.Configure<SupabaseConfig>(
    builder.Configuration.GetSection("Supabase"));

// Configure Google Auth (login com Google)
builder.Services.Configure<GoogleAuthConfig>(
    builder.Configuration.GetSection("Google"));

builder.Services.AddHttpClient<SupabaseClient>();

// Register Repositories
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IDoctorRepository, DoctorRepository>();
builder.Services.AddScoped<IRequestRepository, RequestRepository>();
builder.Services.AddScoped<IPaymentRepository, PaymentRepository>();
builder.Services.AddScoped<IAuthTokenRepository, AuthTokenRepository>();
builder.Services.AddScoped<IChatRepository, ChatRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();
builder.Services.AddScoped<IVideoRoomRepository, VideoRoomRepository>();
builder.Services.AddScoped<IPushTokenRepository, PushTokenRepository>();

// Register Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IRequestService, RequestService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IVideoService, VideoService>();
builder.Services.AddScoped<IDoctorService, DoctorService>();

// Configure Authentication
builder.Services.AddAuthentication("Bearer")
    .AddScheme<AuthenticationSchemeOptions, BearerAuthenticationHandler>("Bearer", null);

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Patient", policy => policy.RequireRole("patient"));
    options.AddPolicy("Doctor", policy => policy.RequireRole("doctor"));
});

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
// if (app.Environment.IsDevelopment())
// {
    app.UseSwagger();
    app.UseSwaggerUI();
// }

app.UseCors();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<CorrelationIdMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
