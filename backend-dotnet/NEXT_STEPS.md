# PRÓXIMOS PASSOS - RENOVEJA BACKEND .NET

## 🎯 Sumário Executivo

O backend .NET foi **estruturado e implementado parcialmente** seguindo Clean Architecture + DDD. As camadas fundamentais estão completas:

✅ **Domain Layer:** 100% completa (entidades, VOs, interfaces)  
✅ **Infrastructure Core:** Supabase Client + Repositórios principais  
✅ **Application Core:** AuthService completo  
✅ **API Core:** Authentication, Middleware, HealthController, AuthController  

⏳ **Restante:** Services, Controllers e Integrações Externas

---

## 🚀 PARA EXECUTAR O PROJETO ATUAL

### 1. Instalar .NET 8 SDK

```bash
# Windows (via Chocolatey)
choco install dotnet-sdk

# macOS (via Homebrew)
brew install dotnet

# Linux (Ubuntu/Debian)
wget https://dot.net/v1/dotnet-install.sh
chmod +x dotnet-install.sh
./dotnet-install.sh --channel 8.0
```

### 2. Configurar Variáveis de Ambiente

Edite `src/RenoveJa.Api/appsettings.Development.json`:

```json
{
  "Supabase": {
    "Url": "https://ifgxgppxsawauaceudec.supabase.co",
    "ServiceKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmZ3hncHB4c2F3YXVhY2V1ZGVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTk3NDQ1NywiZXhwIjoyMDg1NTUwNDU3fQ.5wG2YRH9F69OnLGpHTVy9vokaG2BIuBayuw2ANHvDuk"
  }
}
```

### 3. Restaurar Pacotes

```bash
cd backend-dotnet
dotnet restore
```

### 4. Compilar

```bash
dotnet build
```

### 5. Executar

```bash
cd src/RenoveJa.Api
dotnet run
```

Acesse:
- **API:** http://localhost:5000
- **Swagger:** http://localhost:5000/swagger

---

## 📋 IMPLEMENTAÇÃO DOS SERVICES RESTANTES

### RequestService (ALTA PRIORIDADE)

**Arquivo:** `src/RenoveJa.Application/Services/Requests/RequestService.cs`

**Métodos a Implementar:**
```csharp
public interface IRequestService
{
    Task<(RequestResponseDto Request, PaymentResponseDto Payment)> CreatePrescriptionAsync(...);
    Task<(RequestResponseDto Request, PaymentResponseDto Payment)> CreateExamAsync(...);
    Task<(RequestResponseDto Request, PaymentResponseDto Payment)> CreateConsultationAsync(...);
    Task<List<RequestResponseDto>> GetUserRequestsAsync(Guid userId, ...);
    Task<RequestResponseDto> GetRequestByIdAsync(Guid id);
    Task<RequestResponseDto> UpdateStatusAsync(Guid id, UpdateRequestStatusDto dto);
    Task<RequestResponseDto> ApproveAsync(Guid id, ApproveRequestDto dto);
    Task<RequestResponseDto> RejectAsync(Guid id, RejectRequestDto dto);
    Task<RequestResponseDto> AssignToQueueAsync(Guid id);
    Task<(RequestResponseDto Request, VideoRoomResponseDto VideoRoom)> AcceptConsultationAsync(Guid id);
    Task<RequestResponseDto> SignAsync(Guid id, SignRequestDto dto);
}
```

**Dependências:**
- IRequestRepository
- IPaymentRepository
- IUserRepository
- IDoctorRepository

### PaymentService (ALTA PRIORIDADE)

**Arquivo:** `src/RenoveJa.Application/Services/Payments/PaymentService.cs`

**Métodos a Implementar:**
```csharp
public interface IPaymentService
{
    Task<PaymentResponseDto> CreatePaymentAsync(CreatePaymentRequestDto dto, Guid userId);
    Task<PaymentResponseDto> GetPaymentAsync(Guid id);
    Task<PaymentResponseDto> ConfirmPaymentAsync(Guid id); // Dev/Test only
    Task ProcessWebhookAsync(MercadoPagoWebhookDto webhook);
}
```

**Dependências:**
- IPaymentRepository
- IRequestRepository
- IMercadoPagoService (a implementar)

### ChatService (MÉDIA PRIORIDADE)

**Arquivo:** `src/RenoveJa.Application/Services/Chat/ChatService.cs`

```csharp
public interface IChatService
{
    Task<MessageResponseDto> SendMessageAsync(Guid requestId, SendMessageRequestDto dto, Guid senderId);
    Task<List<MessageResponseDto>> GetMessagesAsync(Guid requestId);
    Task<int> GetUnreadCountAsync(Guid userId);
    Task MarkAsReadAsync(Guid requestId, Guid userId);
}
```

### NotificationService (MÉDIA PRIORIDADE)

**Arquivo:** `src/RenoveJa.Application/Services/Notifications/NotificationService.cs`

```csharp
public interface INotificationService
{
    Task<List<NotificationResponseDto>> GetUserNotificationsAsync(Guid userId);
    Task<NotificationResponseDto> MarkAsReadAsync(Guid id);
    Task MarkAllAsReadAsync(Guid userId);
    Task CreateNotificationAsync(Guid userId, string title, string message, NotificationType type);
}
```

### VideoService (MÉDIA PRIORIDADE)

**Arquivo:** `src/RenoveJa.Application/Services/Video/VideoService.cs`

```csharp
public interface IVideoService
{
    Task<VideoRoomResponseDto> CreateRoomAsync(CreateVideoRoomRequestDto dto);
    Task<VideoRoomResponseDto> GetRoomAsync(Guid id);
    Task<VideoRoomResponseDto> StartRoomAsync(Guid id);
    Task<VideoRoomResponseDto> EndRoomAsync(Guid id);
}
```

### DoctorService (MÉDIA PRIORIDADE)

**Arquivo:** `src/RenoveJa.Application/Services/Doctors/DoctorService.cs`

```csharp
public interface IDoctorService
{
    Task<List<DoctorListResponseDto>> GetDoctorsAsync(string? specialty, bool? available);
    Task<DoctorListResponseDto> GetDoctorByIdAsync(Guid id);
    Task<List<DoctorListResponseDto>> GetQueueAsync(string? specialty);
    Task<DoctorProfileDto> UpdateAvailabilityAsync(Guid id, UpdateDoctorAvailabilityDto dto);
}
```

---

## 📋 IMPLEMENTAÇÃO DOS CONTROLLERS RESTANTES

### RequestsController

**Arquivo:** `src/RenoveJa.Api/Controllers/RequestsController.cs`

**Endpoints:**
```csharp
[ApiController]
[Route("api/requests")]
[Authorize]
public class RequestsController : ControllerBase
{
    [HttpPost("prescription")]
    public async Task<ActionResult> CreatePrescription(...);
    
    [HttpPost("exam")]
    public async Task<ActionResult> CreateExam(...);
    
    [HttpPost("consultation")]
    public async Task<ActionResult> CreateConsultation(...);
    
    [HttpGet]
    public async Task<ActionResult> GetRequests(...);
    
    [HttpGet("{id}")]
    public async Task<ActionResult> GetRequest(Guid id);
    
    [HttpPut("{id}/status")]
    [Authorize(Roles = "doctor")]
    public async Task<ActionResult> UpdateStatus(Guid id, ...);
    
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "doctor")]
    public async Task<ActionResult> Approve(Guid id, ...);
    
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "doctor")]
    public async Task<ActionResult> Reject(Guid id, ...);
    
    [HttpPost("{id}/assign-queue")]
    public async Task<ActionResult> AssignQueue(Guid id);
    
    [HttpPost("{id}/accept-consultation")]
    [Authorize(Roles = "doctor")]
    public async Task<ActionResult> AcceptConsultation(Guid id);
    
    [HttpPost("{id}/sign")]
    [Authorize(Roles = "doctor")]
    public async Task<ActionResult> Sign(Guid id, ...);
}
```

### PaymentsController

**Arquivo:** `src/RenoveJa.Api/Controllers/PaymentsController.cs`

**Endpoints:**
```csharp
[ApiController]
[Route("api/payments")]
public class PaymentsController : ControllerBase
{
    [HttpPost]
    [Authorize]
    public async Task<ActionResult> CreatePayment(...);
    
    [HttpGet("{id}")]
    [Authorize]
    public async Task<ActionResult> GetPayment(Guid id);
    
    [HttpPost("{id}/confirm")]
    public async Task<ActionResult> ConfirmPayment(Guid id);
    
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<ActionResult> Webhook(...);
}
```

---

## 📋 IMPLEMENTAÇÃO DAS INTEGRAÇÕES EXTERNAS

### MercadoPagoService

**Arquivo:** `src/RenoveJa.Infrastructure/ExternalServices/MercadoPago/MercadoPagoService.cs`

**Dependências:**
```bash
dotnet add package MercadoPagoSDK --version 2.3.3
```

**Interface:**
```csharp
public interface IMercadoPagoService
{
    Task<(string QrCode, string QrCodeBase64, string CopyPaste, string ExternalId)> CreatePixPaymentAsync(
        decimal amount,
        string description);
    Task<string> GetPaymentStatusAsync(string externalId);
}
```

### PdfGeneratorService

**Arquivo:** `src/RenoveJa.Infrastructure/ExternalServices/PdfGenerator/PdfGeneratorService.cs`

**Dependências:**
```bash
dotnet add package QuestPDF --version 2024.1.3
```

**Interface:**
```csharp
public interface IPdfGeneratorService
{
    Task<byte[]> GeneratePrescriptionPdfAsync(MedicalRequest request, User doctor);
    Task<byte[]> GenerateExamPdfAsync(MedicalRequest request, User doctor);
    Task<string> UploadPdfAsync(byte[] pdfBytes, string filename);
}
```

### PushNotificationService

**Arquivo:** `src/RenoveJa.Infrastructure/ExternalServices/PushNotification/PushNotificationService.cs`

**Interface:**
```csharp
public interface IPushNotificationService
{
    Task SendNotificationAsync(Guid userId, string title, string message, Dictionary<string, object>? data = null);
    Task SendBulkNotificationsAsync(List<Guid> userIds, string title, string message);
}
```

---

## 📋 IMPLEMENTAÇÃO DOS VALIDATORS

### Exemplo: RegisterRequestValidator

**Arquivo:** `src/RenoveJa.Application/Validators/RegisterRequestValidator.cs`

```csharp
using FluentValidation;
using RenoveJa.Application.DTOs.Auth;

public class RegisterRequestValidator : AbstractValidator<RegisterRequestDto>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required")
            .MaximumLength(200).WithMessage("Name cannot exceed 200 characters");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters");

        RuleFor(x => x.Phone)
            .Matches(@"^\+?[\d\s\-\(\)]+$")
            .When(x => !string.IsNullOrEmpty(x.Phone))
            .WithMessage("Invalid phone format");

        RuleFor(x => x.Cpf)
            .Matches(@"^\d{11}$")
            .When(x => !string.IsNullOrEmpty(x.Cpf))
            .WithMessage("CPF must have 11 digits");
    }
}
```

**Registrar no Program.cs:**
```csharp
builder.Services.AddValidatorsFromAssemblyContaining<RegisterRequestValidator>();
```

**Usar no Controller:**
```csharp
[HttpPost("register")]
public async Task<ActionResult<AuthResponseDto>> Register(
    [FromBody] RegisterRequestDto request,
    IValidator<RegisterRequestDto> validator,
    CancellationToken cancellationToken)
{
    var validationResult = await validator.ValidateAsync(request, cancellationToken);
    if (!validationResult.IsValid)
        return BadRequest(validationResult.Errors);

    var response = await _authService.RegisterAsync(request, cancellationToken);
    return Ok(response);
}
```

---

## 📋 IMPLEMENTAÇÃO DOS TESTES UNITÁRIOS

### Exemplo: AuthServiceTests

**Arquivo:** `tests/RenoveJa.UnitTests/Application/AuthServiceTests.cs`

```csharp
using Xunit;
using Moq;
using FluentAssertions;
using RenoveJa.Application.Services.Auth;
using RenoveJa.Domain.Interfaces;
using RenoveJa.Domain.Entities;

public class AuthServiceTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IDoctorRepository> _doctorRepositoryMock;
    private readonly Mock<IAuthTokenRepository> _tokenRepositoryMock;
    private readonly AuthService _authService;

    public AuthServiceTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _doctorRepositoryMock = new Mock<IDoctorRepository>();
        _tokenRepositoryMock = new Mock<IAuthTokenRepository>();
        
        _authService = new AuthService(
            _userRepositoryMock.Object,
            _doctorRepositoryMock.Object,
            _tokenRepositoryMock.Object);
    }

    [Fact]
    public async Task RegisterAsync_ShouldCreateUserAndToken()
    {
        // Arrange
        var request = new RegisterRequestDto(
            "John Doe",
            "john@example.com",
            "password123");

        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync(false);
        
        _userRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<User>(), default))
            .ReturnsAsync((User user, CancellationToken _) => user);

        _tokenRepositoryMock.Setup(x => x.CreateAsync(It.IsAny<AuthToken>(), default))
            .ReturnsAsync((AuthToken token, CancellationToken _) => token);

        // Act
        var response = await _authService.RegisterAsync(request);

        // Assert
        response.Should().NotBeNull();
        response.User.Should().NotBeNull();
        response.User.Email.Should().Be("john@example.com");
        response.Token.Should().NotBeNullOrEmpty();
        
        _userRepositoryMock.Verify(x => x.CreateAsync(It.IsAny<User>(), default), Times.Once);
        _tokenRepositoryMock.Verify(x => x.CreateAsync(It.IsAny<AuthToken>(), default), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_ShouldThrow_WhenEmailAlreadyExists()
    {
        // Arrange
        var request = new RegisterRequestDto(
            "John Doe",
            "john@example.com",
            "password123");

        _userRepositoryMock.Setup(x => x.ExistsByEmailAsync(It.IsAny<string>(), default))
            .ReturnsAsync(true);

        // Act
        Func<Task> act = async () => await _authService.RegisterAsync(request);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Email already registered");
    }
}
```

---

## 🔧 COMANDOS ÚTEIS

### Build
```bash
dotnet build
dotnet build --configuration Release
```

### Testes
```bash
dotnet test
dotnet test --logger "console;verbosity=detailed"
dotnet test --collect:"XPlat Code Coverage"
```

### Executar
```bash
dotnet run --project src/RenoveJa.Api
dotnet watch run --project src/RenoveJa.Api  # Hot reload
```

### Adicionar Pacotes
```bash
dotnet add package <PackageName> --version <Version>
```

### Migrations (Futuro, se usar EF Core)
```bash
dotnet ef migrations add InitialCreate
dotnet ef database update
```

---

## 📚 DOCUMENTAÇÃO ADICIONAL

- **INVENTORY.md:** Inventário completo de endpoints
- **DECISIONS.md:** Decisões arquiteturais detalhadas
- **STATUS.md:** Checklist de implementação
- **README.md:** Documentação geral do projeto

---

## ✅ CHECKLIST DE CONCLUSÃO DO BACKEND

### Fase 1: Core Functionality (1-2 semanas)
- [ ] RequestService completo
- [ ] PaymentService completo
- [ ] RequestsController completo
- [ ] PaymentsController completo
- [ ] Validators implementados
- [ ] Testes unitários core (>70% cobertura)

### Fase 2: Supporting Features (1 semana)
- [ ] ChatService + ChatController
- [ ] NotificationService + NotificationController
- [ ] VideoService + VideoController
- [ ] DoctorService + DoctorsController

### Fase 3: Integrações (1 semana)
- [ ] MercadoPagoService
- [ ] PdfGeneratorService
- [ ] PushNotificationService
- [ ] VideoServiceProvider

### Fase 4: Qualidade (1 semana)
- [ ] Logging estruturado (Serilog)
- [ ] Testes de integração
- [ ] Performance testing
- [ ] Security audit

### Fase 5: Deploy (3-5 dias)
- [ ] Docker
- [ ] CI/CD pipeline
- [ ] Environment configs
- [ ] Monitoring (Application Insights ou similar)

---

## 🎯 CONCLUSÃO

O backend .NET está **estruturado e funcional** para as operações críticas de autenticação. A arquitetura DDD + Clean Architecture está corretamente implementada e pronta para ser estendida.

**Estimativa de Conclusão Total:** 4-6 semanas (1 desenvolvedor full-time)

**Próximo Passo Crítico:** Implementar RequestService e PaymentService.

---

**Boa sorte com a implementação! 🚀**
