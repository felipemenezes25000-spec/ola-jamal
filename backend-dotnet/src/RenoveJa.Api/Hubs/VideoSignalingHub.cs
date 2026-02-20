using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RenoveJa.Domain.Interfaces;

namespace RenoveJa.Api.Hubs;

/// <summary>
/// SignalR hub for WebRTC signaling: exchange SDP (offer/answer) and ICE candidates
/// between patient and doctor in a consultation room. Room is identified by requestId.
/// </summary>
[Authorize]
public class VideoSignalingHub(IRequestRepository requestRepository, ILogger<VideoSignalingHub> logger) : Hub
{
    public static string GroupName(string requestId) => $"room_{requestId}";

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
    }

    /// <summary>
    /// Join the signaling room for the given request. Validates that the user is the patient or doctor of that request.
    /// </summary>
    public async Task JoinRoom(string requestId)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out var userGuid))
        {
            await Clients.Caller.SendAsync("Error", "Unauthorized");
            return;
        }

        if (!Guid.TryParse(requestId, out var reqId))
        {
            await Clients.Caller.SendAsync("Error", "Invalid requestId");
            return;
        }

        var request = await requestRepository.GetByIdAsync(reqId);
        if (request == null)
        {
            await Clients.Caller.SendAsync("Error", "Request not found");
            return;
        }

        if (request.PatientId != userGuid && request.DoctorId != userGuid)
        {
            await Clients.Caller.SendAsync("Error", "You are not a participant of this consultation");
            return;
        }

        var group = GroupName(requestId);
        await Groups.AddToGroupAsync(Context.ConnectionId, group);
        logger.LogInformation("User {UserId} joined video room {RequestId}", userGuid, requestId);
        await Clients.Caller.SendAsync("Joined", requestId);
    }

    /// <summary>
    /// Send SDP offer to the other peer(s) in the room.
    /// </summary>
    public async Task SendOffer(string requestId, object sdp)
    {
        await SendToOthersInRoom(requestId, "Offer", sdp);
    }

    /// <summary>
    /// Send SDP answer to the other peer(s) in the room.
    /// </summary>
    public async Task SendAnswer(string requestId, object sdp)
    {
        await SendToOthersInRoom(requestId, "Answer", sdp);
    }

    /// <summary>
    /// Send ICE candidate to the other peer(s) in the room.
    /// </summary>
    public async Task SendIceCandidate(string requestId, object candidate)
    {
        await SendToOthersInRoom(requestId, "IceCandidate", candidate);
    }

    private async Task SendToOthersInRoom(string requestId, string method, object payload)
    {
        var group = GroupName(requestId);
        await Clients.OthersInGroup(group).SendAsync(method, payload);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception != null)
            logger.LogWarning(exception, "Video signaling client disconnected");
        await base.OnDisconnectedAsync(exception);
    }
}
