using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Payments;
using RenoveJa.Application.DTOs.Chat;
using RenoveJa.Application.DTOs.Video;
using RenoveJa.Application.DTOs.Doctors;
using RenoveJa.Application.Services.Payments;
using RenoveJa.Application.Services.Chat;
using RenoveJa.Application.Services.Notifications;
using RenoveJa.Application.Services.Video;
using RenoveJa.Application.Services.Doctors;
using System.Security.Claims;

namespace RenoveJa.Api.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _paymentService;

    public PaymentsController(IPaymentService paymentService)
    {
        _paymentService = paymentService;
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> CreatePayment(
        [FromBody] CreatePaymentRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var payment = await _paymentService.CreatePaymentAsync(request, userId, cancellationToken);
        return Ok(payment);
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetPayment(
        Guid id,
        CancellationToken cancellationToken)
    {
        var payment = await _paymentService.GetPaymentAsync(id, cancellationToken);
        return Ok(payment);
    }

    [HttpPost("{id}/confirm")]
    public async Task<IActionResult> ConfirmPayment(
        Guid id,
        CancellationToken cancellationToken)
    {
        var payment = await _paymentService.ConfirmPaymentAsync(id, cancellationToken);
        return Ok(payment);
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook(
        [FromBody] MercadoPagoWebhookDto webhook,
        CancellationToken cancellationToken)
    {
        await _paymentService.ProcessWebhookAsync(webhook, cancellationToken);
        return Ok();
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}

[ApiController]
[Route("api/chat")]
[Authorize]
public class ChatController : ControllerBase
{
    private readonly IChatService _chatService;

    public ChatController(IChatService chatService)
    {
        _chatService = chatService;
    }

    [HttpPost("{requestId}/messages")]
    public async Task<IActionResult> SendMessage(
        Guid requestId,
        [FromBody] SendMessageRequestDto dto,
        CancellationToken cancellationToken)
    {
        var senderId = GetUserId();
        var message = await _chatService.SendMessageAsync(requestId, dto, senderId, cancellationToken);
        return Ok(message);
    }

    [HttpGet("{requestId}/messages")]
    public async Task<IActionResult> GetMessages(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var messages = await _chatService.GetMessagesAsync(requestId, cancellationToken);
        return Ok(messages);
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount(
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var count = await _chatService.GetUnreadCountAsync(userId, cancellationToken);
        return Ok(new { unread_count = count });
    }

    [HttpPut("{requestId}/mark-read")]
    public async Task<IActionResult> MarkAsRead(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        await _chatService.MarkAsReadAsync(requestId, userId, cancellationToken);
        return Ok(new { message = "Messages marked as read" });
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<IActionResult> GetNotifications(
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var notifications = await _notificationService.GetUserNotificationsAsync(userId, cancellationToken);
        return Ok(notifications);
    }

    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(
        Guid id,
        CancellationToken cancellationToken)
    {
        var notification = await _notificationService.MarkAsReadAsync(id, cancellationToken);
        return Ok(notification);
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead(
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        await _notificationService.MarkAllAsReadAsync(userId, cancellationToken);
        return Ok(new { message = "All notifications marked as read" });
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
            throw new UnauthorizedAccessException("Invalid user ID");
        return userId;
    }
}

[ApiController]
[Route("api/video")]
[Authorize]
public class VideoController : ControllerBase
{
    private readonly IVideoService _videoService;

    public VideoController(IVideoService videoService)
    {
        _videoService = videoService;
    }

    [HttpPost("rooms")]
    public async Task<IActionResult> CreateRoom(
        [FromBody] CreateVideoRoomRequestDto dto,
        CancellationToken cancellationToken)
    {
        var room = await _videoService.CreateRoomAsync(dto, cancellationToken);
        return Ok(room);
    }

    [HttpGet("rooms/{id}")]
    public async Task<IActionResult> GetRoom(
        Guid id,
        CancellationToken cancellationToken)
    {
        var room = await _videoService.GetRoomAsync(id, cancellationToken);
        return Ok(room);
    }
}

[ApiController]
[Route("api/doctors")]
public class DoctorsController : ControllerBase
{
    private readonly IDoctorService _doctorService;

    public DoctorsController(IDoctorService doctorService)
    {
        _doctorService = doctorService;
    }

    [HttpGet]
    public async Task<IActionResult> GetDoctors(
        [FromQuery] string? specialty,
        [FromQuery] bool? available,
        CancellationToken cancellationToken)
    {
        var doctors = await _doctorService.GetDoctorsAsync(specialty, available, cancellationToken);
        return Ok(doctors);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetDoctor(
        Guid id,
        CancellationToken cancellationToken)
    {
        var doctor = await _doctorService.GetDoctorByIdAsync(id, cancellationToken);
        return Ok(doctor);
    }

    [HttpGet("queue")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> GetQueue(
        [FromQuery] string? specialty,
        CancellationToken cancellationToken)
    {
        var doctors = await _doctorService.GetQueueAsync(specialty, cancellationToken);
        return Ok(doctors);
    }

    [HttpPut("{id}/availability")]
    [Authorize(Roles = "doctor")]
    public async Task<IActionResult> UpdateAvailability(
        Guid id,
        [FromBody] UpdateDoctorAvailabilityDto dto,
        CancellationToken cancellationToken)
    {
        var profile = await _doctorService.UpdateAvailabilityAsync(id, dto, cancellationToken);
        return Ok(profile);
    }
}

[ApiController]
[Route("api/specialties")]
public class SpecialtiesController : ControllerBase
{
    [HttpGet]
    public IActionResult GetSpecialties()
    {
        var specialties = new[]
        {
            "Clínico Geral",
            "Cardiologia",
            "Dermatologia",
            "Endocrinologia",
            "Ginecologia",
            "Neurologia",
            "Ortopedia",
            "Pediatria",
            "Psiquiatria",
            "Urologia"
        };

        return Ok(specialties);
    }
}

[ApiController]
[Route("api/integrations")]
public class IntegrationsController : ControllerBase
{
    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        return Ok(new
        {
            mercadopago = new { status = "operational", message = "MercadoPago integration active" },
            pdf_generator = new { status = "operational", message = "PDF generation active" },
            push_notifications = new { status = "operational", message = "Push notifications active" },
            video_service = new { status = "operational", message = "Video service active" }
        });
    }
}
