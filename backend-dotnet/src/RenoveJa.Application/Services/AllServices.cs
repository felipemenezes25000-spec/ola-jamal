using RenoveJa.Application.DTOs.Chat;
using RenoveJa.Application.DTOs.Notifications;
using RenoveJa.Application.DTOs.Video;
using RenoveJa.Application.DTOs.Doctors;
using RenoveJa.Application.DTOs.Auth;
using RenoveJa.Domain.Entities;
using RenoveJa.Domain.Enums;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Application.Services.Chat
{
public interface IChatService
{
    Task<MessageResponseDto> SendMessageAsync(Guid requestId, SendMessageRequestDto dto, Guid senderId, CancellationToken cancellationToken = default);
    Task<List<MessageResponseDto>> GetMessagesAsync(Guid requestId, CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);
    Task MarkAsReadAsync(Guid requestId, Guid userId, CancellationToken cancellationToken = default);
}

public class ChatService : IChatService
{
    private readonly IChatRepository _chatRepository;
    private readonly IUserRepository _userRepository;
    private readonly IRequestRepository _requestRepository;

    public ChatService(
        IChatRepository chatRepository,
        IUserRepository userRepository,
        IRequestRepository requestRepository)
    {
        _chatRepository = chatRepository;
        _userRepository = userRepository;
        _requestRepository = requestRepository;
    }

    public async Task<MessageResponseDto> SendMessageAsync(
        Guid requestId,
        SendMessageRequestDto dto,
        Guid senderId,
        CancellationToken cancellationToken = default)
    {
        var request = await _requestRepository.GetByIdAsync(requestId, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        var sender = await _userRepository.GetByIdAsync(senderId, cancellationToken);
        if (sender == null)
            throw new InvalidOperationException("Sender not found");

        var senderType = sender.Role == UserRole.Doctor ? SenderType.Doctor : SenderType.Patient;

        var message = ChatMessage.Create(requestId, senderId, sender.Name, senderType, dto.Message);
        message = await _chatRepository.CreateAsync(message, cancellationToken);

        return MapToDto(message);
    }

    public async Task<List<MessageResponseDto>> GetMessagesAsync(
        Guid requestId,
        CancellationToken cancellationToken = default)
    {
        var messages = await _chatRepository.GetByRequestIdAsync(requestId, cancellationToken);
        return messages.Select(MapToDto).ToList();
    }

    public async Task<int> GetUnreadCountAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await _chatRepository.GetUnreadCountAsync(userId, cancellationToken);
    }

    public async Task MarkAsReadAsync(
        Guid requestId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        await _chatRepository.MarkAsReadAsync(requestId, userId, cancellationToken);
    }

    private static MessageResponseDto MapToDto(ChatMessage message)
    {
        return new MessageResponseDto(
            message.Id,
            message.RequestId,
            message.SenderId,
            message.SenderName,
            message.SenderType.ToString().ToLowerInvariant(),
            message.Message,
            message.Read,
            message.CreatedAt);
    }
}
}

namespace RenoveJa.Application.Services.Notifications
{
public interface INotificationService
{
    Task<List<NotificationResponseDto>> GetUserNotificationsAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<NotificationResponseDto> MarkAsReadAsync(Guid id, CancellationToken cancellationToken = default);
    Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default);
}

public class NotificationService : INotificationService
{
    private readonly INotificationRepository _notificationRepository;

    public NotificationService(INotificationRepository notificationRepository)
    {
        _notificationRepository = notificationRepository;
    }

    public async Task<List<NotificationResponseDto>> GetUserNotificationsAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var notifications = await _notificationRepository.GetByUserIdAsync(userId, cancellationToken);
        return notifications.Select(MapToDto).ToList();
    }

    public async Task<NotificationResponseDto> MarkAsReadAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var notification = await _notificationRepository.GetByIdAsync(id, cancellationToken);
        if (notification == null)
            throw new KeyNotFoundException("Notification not found");

        notification.MarkAsRead();
        notification = await _notificationRepository.UpdateAsync(notification, cancellationToken);

        return MapToDto(notification);
    }

    public async Task MarkAllAsReadAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        await _notificationRepository.MarkAllAsReadAsync(userId, cancellationToken);
    }

    private static NotificationResponseDto MapToDto(Notification notification)
    {
        return new NotificationResponseDto(
            notification.Id,
            notification.UserId,
            notification.Title,
            notification.Message,
            notification.NotificationType.ToString().ToLowerInvariant(),
            notification.Read,
            notification.Data,
            notification.CreatedAt);
    }
}
}

namespace RenoveJa.Application.Services.Video
{
public interface IVideoService
{
    Task<VideoRoomResponseDto> CreateRoomAsync(CreateVideoRoomRequestDto dto, CancellationToken cancellationToken = default);
    Task<VideoRoomResponseDto> GetRoomAsync(Guid id, CancellationToken cancellationToken = default);
}

public class VideoService : IVideoService
{
    private readonly IVideoRoomRepository _videoRoomRepository;
    private readonly IRequestRepository _requestRepository;

    public VideoService(
        IVideoRoomRepository videoRoomRepository,
        IRequestRepository requestRepository)
    {
        _videoRoomRepository = videoRoomRepository;
        _requestRepository = requestRepository;
    }

    public async Task<VideoRoomResponseDto> CreateRoomAsync(
        CreateVideoRoomRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var request = await _requestRepository.GetByIdAsync(dto.RequestId, cancellationToken);
        if (request == null)
            throw new KeyNotFoundException("Request not found");

        var roomName = $"consultation-{request.Id}";
        var videoRoom = VideoRoom.Create(request.Id, roomName);
        
        // In real implementation, this would call external video service (Jitsi/Whereby)
        videoRoom.SetRoomUrl($"https://meet.renoveja.com/{roomName}");
        
        videoRoom = await _videoRoomRepository.CreateAsync(videoRoom, cancellationToken);

        return MapToDto(videoRoom);
    }

    public async Task<VideoRoomResponseDto> GetRoomAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var videoRoom = await _videoRoomRepository.GetByIdAsync(id, cancellationToken);
        if (videoRoom == null)
            throw new KeyNotFoundException("Video room not found");

        return MapToDto(videoRoom);
    }

    private static VideoRoomResponseDto MapToDto(VideoRoom room)
    {
        return new VideoRoomResponseDto(
            room.Id,
            room.RequestId,
            room.RoomName,
            room.RoomUrl,
            room.Status.ToString().ToLowerInvariant(),
            room.StartedAt,
            room.EndedAt,
            room.DurationSeconds,
            room.CreatedAt);
    }
}
}

namespace RenoveJa.Application.Services.Doctors
{
public interface IDoctorService
{
    Task<List<DoctorListResponseDto>> GetDoctorsAsync(string? specialty, bool? available, CancellationToken cancellationToken = default);
    Task<DoctorListResponseDto> GetDoctorByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<DoctorListResponseDto>> GetQueueAsync(string? specialty, CancellationToken cancellationToken = default);
    Task<DoctorProfileDto> UpdateAvailabilityAsync(Guid id, UpdateDoctorAvailabilityDto dto, CancellationToken cancellationToken = default);
}

public class DoctorService : IDoctorService
{
    private readonly IDoctorRepository _doctorRepository;
    private readonly IUserRepository _userRepository;

    public DoctorService(
        IDoctorRepository doctorRepository,
        IUserRepository userRepository)
    {
        _doctorRepository = doctorRepository;
        _userRepository = userRepository;
    }

    public async Task<List<DoctorListResponseDto>> GetDoctorsAsync(
        string? specialty,
        bool? available,
        CancellationToken cancellationToken = default)
    {
        List<DoctorProfile> profiles;

        if (available == true)
        {
            profiles = await _doctorRepository.GetAvailableAsync(specialty, cancellationToken);
        }
        else if (!string.IsNullOrWhiteSpace(specialty))
        {
            profiles = await _doctorRepository.GetBySpecialtyAsync(specialty, cancellationToken);
        }
        else
        {
            profiles = await _doctorRepository.GetAllAsync(cancellationToken);
        }

        var result = new List<DoctorListResponseDto>();
        
        foreach (var profile in profiles)
        {
            var user = await _userRepository.GetByIdAsync(profile.UserId, cancellationToken);
            if (user != null)
            {
                result.Add(new DoctorListResponseDto(
                    profile.Id,
                    user.Name,
                    user.Email,
                    user.Phone?.Value,
                    user.AvatarUrl,
                    profile.Crm,
                    profile.CrmState,
                    profile.Specialty,
                    profile.Bio,
                    profile.Rating,
                    profile.TotalConsultations,
                    profile.Available));
            }
        }

        return result;
    }

    public async Task<DoctorListResponseDto> GetDoctorByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var profile = await _doctorRepository.GetByIdAsync(id, cancellationToken);
        if (profile == null)
            throw new KeyNotFoundException("Doctor not found");

        var user = await _userRepository.GetByIdAsync(profile.UserId, cancellationToken);
        if (user == null)
            throw new InvalidOperationException("Doctor user not found");

        return new DoctorListResponseDto(
            profile.Id,
            user.Name,
            user.Email,
            user.Phone?.Value,
            user.AvatarUrl,
            profile.Crm,
            profile.CrmState,
            profile.Specialty,
            profile.Bio,
            profile.Rating,
            profile.TotalConsultations,
            profile.Available);
    }

    public async Task<List<DoctorListResponseDto>> GetQueueAsync(
        string? specialty,
        CancellationToken cancellationToken = default)
    {
        return await GetDoctorsAsync(specialty, true, cancellationToken);
    }

    public async Task<DoctorProfileDto> UpdateAvailabilityAsync(
        Guid id,
        UpdateDoctorAvailabilityDto dto,
        CancellationToken cancellationToken = default)
    {
        var profile = await _doctorRepository.GetByIdAsync(id, cancellationToken);
        if (profile == null)
            throw new KeyNotFoundException("Doctor not found");

        profile.SetAvailability(dto.Available);
        profile = await _doctorRepository.UpdateAsync(profile, cancellationToken);

        return new DoctorProfileDto(
            profile.Id,
            profile.UserId,
            profile.Crm,
            profile.CrmState,
            profile.Specialty,
            profile.Bio,
            profile.Rating,
            profile.TotalConsultations,
            profile.Available,
            profile.CreatedAt);
    }
}
}
