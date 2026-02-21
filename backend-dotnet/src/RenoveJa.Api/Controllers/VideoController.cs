using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.DTOs.Video;
using RenoveJa.Application.Services.Video;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller responsável por salas de vídeo para consultas.
/// </summary>
[ApiController]
[Route("api/video")]
public class VideoController(IVideoService videoService, ILogger<VideoController> logger) : ControllerBase
{
    /// <summary>
    /// Cria uma sala de vídeo para uma solicitação.
    /// </summary>
    [Authorize]
    [HttpPost("rooms")]
    public async Task<IActionResult> CreateRoom(
        [FromBody] CreateVideoRoomRequestDto dto,
        CancellationToken cancellationToken)
    {
        logger.LogInformation("Video CreateRoom: requestId={RequestId}", dto.RequestId);
        var room = await videoService.CreateRoomAsync(dto, cancellationToken);
        logger.LogInformation("Video CreateRoom OK: roomId={RoomId}", room.Id);
        return Ok(room);
    }

    /// <summary>
    /// Obtém uma sala de vídeo pelo ID da solicitação.
    /// </summary>
    [Authorize]
    [HttpGet("rooms/by-request/{requestId}")]
    public async Task<IActionResult> GetRoomByRequest(
        Guid requestId,
        CancellationToken cancellationToken)
    {
        var room = await videoService.GetRoomByRequestIdAsync(requestId, cancellationToken);
        if (room == null)
            return NotFound();
        return Ok(room);
    }

    /// <summary>
    /// Obtém uma sala de vídeo pelo ID.
    /// </summary>
    [Authorize]
    [HttpGet("rooms/{id}")]
    public async Task<IActionResult> GetRoom(
        Guid id,
        CancellationToken cancellationToken)
    {
        var room = await videoService.GetRoomAsync(id, cancellationToken);
        return Ok(room);
    }

    /// <summary>
    /// Página HTML para chamada WebRTC 1:1 (signaling via SignalR). Usada pelo app em WebView.
    /// Query: requestId, access_token, role=doctor|patient.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("call-page")]
    public IActionResult GetCallPage([FromQuery] string? requestId, [FromQuery] string? access_token, [FromQuery] string? role)
    {
        if (string.IsNullOrEmpty(requestId) || string.IsNullOrEmpty(access_token))
            return BadRequest("requestId and access_token are required");

        var html = VideoCallPageHtml.GetHtml(requestId, access_token, role ?? "patient");
        return Content(html, "text/html; charset=utf-8");
    }
}

internal static class VideoCallPageHtml
{
    private const string SignalRVersion = "8.0.0";

    public static string GetHtml(string requestId, string accessToken, string role)
    {
        var isDoctor = string.Equals(role, "doctor", StringComparison.OrdinalIgnoreCase);
        var sb = new StringBuilder();
        sb.Append("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">");
        sb.Append("<title>Consulta</title><style>");
        sb.Append("body{margin:0;background:#0f172a;color:#fff;font-family:system-ui,sans-serif;}");
        sb.Append("#localVideo{position:absolute;bottom:16px;right:16px;width:120px;height:160px;object-fit:cover;border-radius:8px;border:2px solid #0ea5e9;}");
        sb.Append("#remoteVideo{width:100%;height:100vh;object-fit:cover;}");
        sb.Append(".status{padding:8px;text-align:center;background:rgba(0,0,0,.4);}");
        sb.Append("#consultationPanel{position:fixed;top:40px;left:8px;right:8px;max-height:45vh;overflow:auto;background:rgba(15,23,42,.95);border:1px solid #334155;border-radius:8px;padding:12px;font-size:13px;z-index:10;display:none;}");
        sb.Append("#consultationPanel.open{display:block;}");
        sb.Append("#consultationPanel h3{margin:0 0 8px 0;font-size:14px;color:#94a3b8;}");
        sb.Append("#consultationPanel .disclaimer{margin-bottom:8px;color:#64748b;font-size:11px;}");
        sb.Append("#transcriptText,#anamnesisText{white-space:pre-wrap;word-break:break-word;}");
        sb.Append("#suggestionsList{list-style:none;padding:0;margin:0;}");
        sb.Append("#suggestionsList li{padding:4px 0;border-bottom:1px solid #334155;}");
        sb.Append(".patientNotice{position:fixed;bottom:60px;left:8px;right:8px;text-align:center;background:rgba(0,0,0,.6);padding:8px;border-radius:8px;font-size:12px;color:#94a3b8;z-index:5;}");
        sb.Append("</style></head><body>");
        sb.Append("<div class=\"status\" id=\"status\">Conectando...</div>");
        if (isDoctor)
        {
            sb.Append("<div id=\"consultationPanel\"><button type=\"button\" id=\"togglePanel\" aria-label=\"Abrir painel\">Transcrição e anamnese</button>");
            sb.Append("<div id=\"panelContent\" style=\"display:none;\"><p class=\"disclaimer\">Uso de transcrição e IA em conformidade com os Termos e com as normas do CFM. Decisão final sempre do médico.</p>");
            sb.Append("<h3>Transcrição</h3><div id=\"transcriptText\">—</div>");
            sb.Append("<h3>Anamnese</h3><div id=\"anamnesisText\">—</div>");
            sb.Append("<h3>Sugestões da IA</h3><ul id=\"suggestionsList\"></ul></div></div>");
        }
        else
        {
            sb.Append("<div class=\"patientNotice\" id=\"patientNotice\">Esta consulta pode ser transcrita e processada por IA para apoio ao médico e registro no seu prontuário, conforme nossos Termos de Uso e Política de Privacidade.</div>");
        }
        sb.Append("<video id=\"remoteVideo\" autoplay playsinline></video>");
        sb.Append("<video id=\"localVideo\" autoplay playsinline muted></video>");
        sb.Append("<script src=\"https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/").Append(SignalRVersion).Append("/signalr.min.js\"></script>");
        sb.Append("<script>");
        sb.Append("(function(){");
        sb.Append("var requestId='").Append(EscapeJs(requestId)).Append("';");
        sb.Append("var accessToken='").Append(EscapeJs(accessToken)).Append("';");
        sb.Append("var isDoctor=").Append(isDoctor ? "true" : "false").Append(";");
        sb.Append("var statusEl=document.getElementById('status');var localV=document.getElementById('localVideo');var remoteV=document.getElementById('remoteVideo');");
        sb.Append("var baseUrl=window.location.origin;var hubUrl=baseUrl+'/hubs/video?access_token='+encodeURIComponent(accessToken);");
        sb.Append("var pc=null;var localStream=null;");
        sb.Append("function setStatus(s){statusEl.textContent=s;}");
        sb.Append("function setError(s){statusEl.textContent='Erro: '+s;statusEl.style.background='#7f1d1d';if(window.ReactNativeWebView){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:s}));}catch(e){}}}");
        sb.Append("var connection=new signalR.HubConnectionBuilder().withUrl(hubUrl).withAutomaticReconnect().build();");
        sb.Append("connection.on('Error',function(m){setError(m);});");
        sb.Append("connection.on('Joined',function(){setStatus('Sala pronta. Aguardando mídia...');});");
        sb.Append("connection.on('Offer',function(sdp){if(!pc)return;pc.setRemoteDescription(new RTCSessionDescription(sdp)).then(function(){return pc.createAnswer();}).then(function(answer){return pc.setLocalDescription(answer);}).then(function(){connection.invoke('SendAnswer',requestId,pc.localDescription);setStatus('Em chamada');}).catch(function(e){setError(e.message);});});");
        sb.Append("connection.on('Answer',function(sdp){if(!pc)return;pc.setRemoteDescription(new RTCSessionDescription(sdp)).then(function(){setStatus('Em chamada');}).catch(function(e){setError(e.message);});});");
        sb.Append("connection.on('IceCandidate',function(c){if(!pc)return;pc.addIceCandidate(new RTCIceCandidate(c)).catch(function(){});});");
        sb.Append("connection.on('TranscriptUpdate',function(d){var el=document.getElementById('transcriptText');if(el)el.textContent=d.fullText||d.FullText||'—';});");
        sb.Append("connection.on('AnamnesisUpdate',function(d){var j=d.anamnesisJson||d.AnamnesisJson;var el=document.getElementById('anamnesisText');if(el)el.textContent=typeof j==='string'?j:(JSON.stringify(j,null,2)||'—');});");
        sb.Append("connection.on('SuggestionUpdate',function(d){var arr=d.items||d.Items||[];var ul=document.getElementById('suggestionsList');if(ul){ul.innerHTML='';arr.forEach(function(s){var li=document.createElement('li');li.textContent=s;ul.appendChild(li);});}});");
        sb.Append("var config={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};");
        sb.Append("var audioRecorder=null;var audioChunkInterval=10000;");
        sb.Append("function startCall(){pc=new RTCPeerConnection(config);");
        sb.Append("localStream.getTracks().forEach(function(t){pc.addTrack(t,localStream);});");
        sb.Append("pc.ontrack=function(e){if(remoteV.srcObject!==e.streams[0])remoteV.srcObject=e.streams[0];");
        sb.Append("if(isDoctor&&e.streams[0]&&e.streams[0].getAudioTracks().length>0&&!audioRecorder){var aStream=new MediaStream(e.streams[0].getAudioTracks());var opts={audio:true};if(MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))opts.mimeType='audio/webm;codecs=opus';audioRecorder=new MediaRecorder(aStream,opts);audioRecorder.ondataavailable=function(ev){if(ev.data&&ev.data.size>0){var fd=new FormData();fd.append('requestId',requestId);fd.append('file',ev.data,'chunk.webm');fetch(baseUrl+'/api/consultation/transcribe',{method:'POST',headers:{'Authorization':'Bearer '+accessToken},body:fd}).catch(function(){});}};audioRecorder.start(audioChunkInterval);}};");
        sb.Append("pc.onicecandidate=function(e){if(e.candidate)connection.invoke('SendIceCandidate',requestId,e.candidate);};");
        sb.Append("connection.invoke('JoinRoom',requestId).then(function(){");
        sb.Append("if(isDoctor){pc.createOffer().then(function(offer){return pc.setLocalDescription(offer);}).then(function(){connection.invoke('SendOffer',requestId,pc.localDescription);setStatus('Chamada iniciada');}).catch(function(e){setError(e.message);});}");
        sb.Append("else{setStatus('Aguardando médico...');}");
        sb.Append("}).catch(function(e){setError(e.message);});}");
        if (isDoctor)
        {
            sb.Append("var toggleBtn=document.getElementById('togglePanel');var panelContent=document.getElementById('panelContent');var panel=document.getElementById('consultationPanel');if(toggleBtn&&panel){toggleBtn.onclick=function(){var open=panel.classList.toggle('open');if(panelContent)panelContent.style.display=open?'block':'none';toggleBtn.textContent=open?'Ocultar painel':'Transcrição e anamnese';};}");
        }
        sb.Append("connection.start().then(function(){setStatus('Obtendo câmera e microfone...');return navigator.mediaDevices.getUserMedia({video:true,audio:true});}).then(function(stream){localStream=stream;localV.srcObject=stream;setStatus('Entrando na sala...');startCall();}).catch(function(e){setError(e.message);});");
        sb.Append("})();</script></body></html>");
        return sb.ToString();
    }

    private static string EscapeJs(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Replace("\\", "\\\\").Replace("'", "\\'").Replace("\r", "").Replace("\n", "\\n");
    }
}
