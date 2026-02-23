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
    [Authorize]
    [HttpPost("rooms")]
    public async Task<IActionResult> CreateRoom([FromBody] CreateVideoRoomRequestDto dto, CancellationToken cancellationToken)
    {
        logger.LogInformation("Video CreateRoom: requestId={RequestId}", dto.RequestId);
        var room = await videoService.CreateRoomAsync(dto, cancellationToken);
        logger.LogInformation("Video CreateRoom OK: roomId={RoomId}", room.Id);
        return Ok(room);
    }

    [Authorize]
    [HttpGet("rooms/by-request/{requestId}")]
    public async Task<IActionResult> GetRoomByRequest(Guid requestId, CancellationToken cancellationToken)
    {
        var room = await videoService.GetRoomByRequestIdAsync(requestId, cancellationToken);
        if (room == null) return NotFound();
        return Ok(room);
    }

    [Authorize]
    [HttpGet("rooms/{id}")]
    public async Task<IActionResult> GetRoom(Guid id, CancellationToken cancellationToken)
    {
        var room = await videoService.GetRoomAsync(id, cancellationToken);
        return Ok(room);
    }

    /// <summary>
    /// Página HTML da videochamada WebRTC. Usada pelo app em WebView (iOS e Android).
    /// Query: requestId, access_token, role=doctor|patient.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("call-page")]
    public IActionResult GetCallPage(
        [FromQuery] string? requestId,
        [FromQuery] string? access_token,
        [FromQuery] string? role)
    {
        if (string.IsNullOrEmpty(requestId) || string.IsNullOrEmpty(access_token))
            return BadRequest("requestId and access_token are required");

        var html = VideoCallPageHtml.GetHtml(requestId, access_token, role ?? "patient");
        return Content(html, "text/html; charset=utf-8");
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML da videochamada — WebRTC nativo, SignalR signaling, painel IA 3 abas
// ═══════════════════════════════════════════════════════════════════════════
internal static class VideoCallPageHtml
{
    private const string SignalRVersion = "8.0.0";

    public static string GetHtml(string requestId, string accessToken, string role)
    {
        var isDoctor = string.Equals(role, "doctor", StringComparison.OrdinalIgnoreCase);
        var rid = EscJs(requestId);
        var tok = EscJs(accessToken);

        var sb = new StringBuilder();
        sb.Append("<!DOCTYPE html><html lang='pt-BR'><head>");
        sb.Append("<meta charset='utf-8'>");
        sb.Append("<meta name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no'>");
        sb.Append("<title>Consulta</title>");
        BuildCss(sb, isDoctor);
        sb.Append("</head><body>");

        // Videos
        sb.Append("<video id='remoteVideo' autoplay playsinline></video>");
        sb.Append("<video id='localVideo' autoplay playsinline muted></video>");

        // Status bar
        sb.Append("<div id='statusBar'><span id='statusText'>Conectando...</span></div>");

        if (isDoctor)
            BuildDoctorPanel(sb);
        else
            sb.Append("<div id='patientNotice'>Esta consulta pode ser transcrita e processada por IA para apoio ao m\u00e9dico e registro no prontu\u00e1rio, conforme nossos Termos de Uso.</div>");

        // Scripts
        sb.Append("<script src='https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/")
          .Append(SignalRVersion)
          .Append("/signalr.min.js'></script>");
        sb.Append("<script>");
        BuildScript(sb, rid, tok, isDoctor);
        sb.Append("</script>");

        sb.Append("</body></html>");
        return sb.ToString();
    }

    // ── CSS ──────────────────────────────────────────────────────────────────
    private static void BuildCss(StringBuilder sb, bool isDoctor)
    {
        sb.Append("<style>");
        sb.Append("*{box-sizing:border-box;margin:0;padding:0;}");
        sb.Append("body{background:#0f172a;color:#fff;font-family:system-ui,-apple-system,sans-serif;overflow:hidden;height:100vh;width:100vw;}");
        sb.Append("#remoteVideo{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;}");
        sb.Append("#localVideo{position:fixed;bottom:90px;right:12px;width:110px;height:148px;object-fit:cover;border-radius:10px;border:2px solid #0ea5e9;z-index:10;cursor:pointer;transition:all .2s;}");
        sb.Append("#localVideo.expanded{width:200px;height:268px;}");
        sb.Append("#statusBar{position:fixed;top:0;left:0;right:0;padding:6px 12px;background:rgba(15,23,42,.7);text-align:center;font-size:12px;color:#94a3b8;z-index:20;backdrop-filter:blur(4px);}");
        sb.Append("#patientNotice{position:fixed;bottom:100px;left:12px;right:12px;background:rgba(15,23,42,.9);border:1px solid #334155;border-radius:10px;padding:10px 14px;font-size:11px;color:#94a3b8;z-index:9;text-align:center;}");
        if (isDoctor)
        {
            sb.Append("#aiPanel{position:fixed;top:32px;bottom:76px;left:0;right:0;background:rgba(15,23,42,.96);backdrop-filter:blur(8px);z-index:30;display:flex;flex-direction:column;transform:translateY(100%);transition:transform .3s ease;border-top:1px solid #334155;}");
            sb.Append("#aiPanel.open{transform:translateY(0);}");
            sb.Append(".panel-drag{width:40px;height:4px;background:#334155;border-radius:2px;margin:10px auto 0;}");
            sb.Append(".panel-tabs{display:flex;border-bottom:1px solid #1e293b;flex-shrink:0;}");
            sb.Append(".tab-btn{flex:1;padding:10px 4px;text-align:center;font-size:12px;font-weight:600;color:#64748b;background:none;border:none;cursor:pointer;border-bottom:2px solid transparent;transition:.2s;}");
            sb.Append(".tab-btn.active{color:#38bdf8;border-bottom-color:#38bdf8;}");
            sb.Append(".panel-content{flex:1;overflow:hidden;position:relative;}");
            sb.Append(".tab-pane{position:absolute;inset:0;overflow-y:auto;padding:12px;display:none;-webkit-overflow-scrolling:touch;}");
            sb.Append(".tab-pane.active{display:block;}");
            sb.Append(".disclaimer{font-size:10px;color:#475569;margin-bottom:10px;padding:6px 8px;background:#0f172a;border-radius:6px;line-height:1.5;}");
            sb.Append("#transcriptContainer{font-size:12px;color:#cbd5e1;line-height:1.7;white-space:pre-wrap;word-break:break-word;}");
            sb.Append(".tx-line{margin-bottom:4px;}");
            sb.Append(".tx-doctor{color:#93c5fd;}.tx-patient{color:#86efac;}.tx-ts{color:#475569;font-size:10px;margin-right:4px;}");
            sb.Append(".anamnesis-field{margin-bottom:10px;}");
            sb.Append(".anamnesis-label{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;display:flex;align-items:center;gap:4px;}");
            sb.Append(".ai-badge{font-size:9px;background:#1e3a5f;color:#38bdf8;padding:1px 5px;border-radius:8px;font-weight:600;}");
            sb.Append(".anamnesis-value{font-size:13px;color:#e2e8f0;background:#0f172a;border-radius:6px;padding:6px 8px;min-height:20px;}");
            sb.Append(".suggestion-card{margin-bottom:8px;padding:10px;background:#0f172a;border-radius:8px;border:1px solid #1e293b;}");
            sb.Append(".sug-cid{font-size:10px;font-weight:700;color:#a78bfa;margin-bottom:4px;}");
            sb.Append(".sug-text{font-size:13px;color:#e2e8f0;line-height:1.5;}");
            sb.Append(".red-flag-card{border-color:#7f1d1d;background:#1c0a0a;}");
            sb.Append(".red-flag-label{font-size:10px;font-weight:700;color:#ef4444;margin-bottom:4px;}");
            sb.Append(".meds-chip{display:inline-block;margin:3px;padding:4px 8px;background:#064e3b;border-radius:12px;font-size:11px;color:#6ee7b7;cursor:pointer;}");
            sb.Append(".empty-state{text-align:center;color:#475569;font-size:12px;padding:20px;}");
        }
        sb.Append("</style>");
    }

    // ── Doctor AI Panel ───────────────────────────────────────────────────────
    private static void BuildDoctorPanel(StringBuilder sb)
    {
        sb.Append("<div id='aiPanel'>");
        sb.Append("<div class='panel-drag'></div>");
        sb.Append("<div class='panel-tabs'>");
        sb.Append("<button class='tab-btn active' data-tab='transcript'>Transcri\u00e7\u00e3o</button>");
        sb.Append("<button class='tab-btn' data-tab='anamnesis'>Anamnese</button>");
        sb.Append("<button class='tab-btn' data-tab='suggestions'>Sugest\u00f5es IA</button>");
        sb.Append("</div>");
        sb.Append("<div class='panel-content'>");

        // Tab: transcript
        sb.Append("<div id='tab-transcript' class='tab-pane active'>");
        sb.Append("<div class='disclaimer'>\u26a0 Transcri\u00e7\u00e3o autom\u00e1tica (Whisper/IA) — revis\u00e3o m\u00e9dica obrigat\u00f3ria. CFM Res. 2.299/2021.</div>");
        sb.Append("<div id='transcriptContainer'><span style='color:#475569'>Aguardando fala...</span></div>");
        sb.Append("</div>");

        // Tab: anamnesis
        sb.Append("<div id='tab-anamnesis' class='tab-pane'>");
        sb.Append("<div class='disclaimer'>Anamnese estruturada por IA com base na transcri\u00e7\u00e3o. Decis\u00e3o cl\u00ednica \u00e9 exclusiva do m\u00e9dico.</div>");
        foreach (var (fieldId, label) in new[] {
            ("ana-queixa", "Queixa Principal"),
            ("ana-hda", "Hist\u00f3ria da Doen\u00e7a Atual"),
            ("ana-sintomas", "Sintomas"),
            ("ana-meds", "Medicamentos em uso"),
            ("ana-alergias", "Alergias"),
            ("ana-antecedentes", "Antecedentes"),
            ("ana-cid", "CID Sugerido"),
        })
        {
            sb.Append("<div class='anamnesis-field'>")
              .Append("<div class='anamnesis-label'>").Append(label).Append(" <span class='ai-badge'>IA</span></div>")
              .Append("<div class='anamnesis-value' id='").Append(fieldId).Append("'>\u2014</div>")
              .Append("</div>");
        }
        sb.Append("</div>");

        // Tab: suggestions
        sb.Append("<div id='tab-suggestions' class='tab-pane'>");
        sb.Append("<div class='disclaimer'>Hip\u00f3teses e recomenda\u00e7\u00f5es sugeridas por IA \u2014 decis\u00e3o final sempre do m\u00e9dico.</div>");
        sb.Append("<div id='redFlagsContainer'></div>");
        sb.Append("<div id='suggestionsContainer'><div class='empty-state'>Aguardando dados suficientes...</div></div>");
        sb.Append("<div id='medsContainer' style='margin-top:10px;'></div>");
        sb.Append("</div>");

        sb.Append("</div></div>"); // panel-content / aiPanel
    }

    // ── JavaScript ────────────────────────────────────────────────────────────
    private static void BuildScript(StringBuilder sb, string rid, string tok, bool isDoctor)
    {
        sb.Append("(function(){");
        sb.Append("'use strict';");
        sb.AppendFormat("var requestId='{0}';", rid);
        sb.AppendFormat("var accessToken='{0}';", tok);
        sb.AppendFormat("var isDoctor={0};", isDoctor ? "true" : "false");
        sb.Append("var baseUrl=window.location.origin;");
        sb.Append("var hubUrl=baseUrl+'/hubs/video?access_token='+encodeURIComponent(accessToken);");

        // DOM helpers
        sb.Append("var statusEl=document.getElementById('statusText');");
        sb.Append("var localV=document.getElementById('localVideo');");
        sb.Append("var remoteV=document.getElementById('remoteVideo');");
        sb.Append("function setStatus(s){statusEl.textContent=s;}");
        sb.Append("function setError(s){");
        sb.Append("  statusEl.textContent='Erro: '+s;");
        sb.Append("  document.getElementById('statusBar').style.background='rgba(127,29,29,.9)';");
        sb.Append("  if(window.ReactNativeWebView){try{window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:s}));}catch(e){}}");
        sb.Append("}");
        sb.Append("function postNative(obj){if(window.ReactNativeWebView){try{window.ReactNativeWebView.postMessage(JSON.stringify(obj));}catch(e){}}}");

        // ICE servers (STUN + TURN fallback)
        sb.Append("var iceServers=[");
        sb.Append("{urls:'stun:stun.l.google.com:19302'},");
        sb.Append("{urls:'stun:stun1.l.google.com:19302'},");
        sb.Append("{urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},");
        sb.Append("{urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'}");
        sb.Append("];");
        sb.Append("var pcConfig={iceServers:iceServers,iceCandidatePoolSize:10};");

        // SignalR connection
        sb.Append("var connection=new signalR.HubConnectionBuilder()");
        sb.Append("  .withUrl(hubUrl)");
        sb.Append("  .withAutomaticReconnect([0,1000,3000,5000,10000])");
        sb.Append("  .build();");

        sb.Append("var pc=null;");
        sb.Append("var localStream=null;");
        sb.Append("var reconnectAttempts=0;");
        sb.Append("var maxReconnectAttempts=3;");
        sb.Append("var statsInterval=null;");
        sb.Append("var frontCamera=true;");
        sb.Append("var localRecorder=null;");
        sb.Append("var remoteRecorder=null;");
        sb.Append("var audioCtx=null;");
        sb.Append("window.__localStream=null;");
        sb.Append("window.__flipCamera=flipCamera;");

        // Flip camera
        sb.Append("async function flipCamera(){");
        sb.Append("  if(!localStream)return;");
        sb.Append("  frontCamera=!frontCamera;");
        sb.Append("  try{");
        sb.Append("    var newStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:frontCamera?'user':'environment'},audio:false});");
        sb.Append("    var newTrack=newStream.getVideoTracks()[0];");
        sb.Append("    if(pc){var sender=pc.getSenders().find(function(s){return s.track&&s.track.kind==='video';});if(sender)await sender.replaceTrack(newTrack);}");
        sb.Append("    localStream.getVideoTracks().forEach(function(t){t.stop();});");
        sb.Append("    localStream.removeTrack(localStream.getVideoTracks()[0]);");
        sb.Append("    localStream.addTrack(newTrack);");
        sb.Append("    localV.srcObject=localStream;window.__localStream=localStream;");
        sb.Append("  }catch(e){setError('Nao foi possivel trocar camera: '+e.message);}");
        sb.Append("}");

        // Local video pip toggle
        sb.Append("if(localV){localV.onclick=function(){localV.classList.toggle('expanded');};}");

        if (isDoctor)
        {
            // Panel tabs
            sb.Append("var aiPanel=document.getElementById('aiPanel');");
            sb.Append("var tabBtns=document.querySelectorAll('.tab-btn');");
            sb.Append("var tabPanes=document.querySelectorAll('.tab-pane');");
            sb.Append("tabBtns.forEach(function(btn){");
            sb.Append("  btn.onclick=function(){");
            sb.Append("    var t=btn.getAttribute('data-tab');");
            sb.Append("    tabBtns.forEach(function(b){b.classList.remove('active');});");
            sb.Append("    tabPanes.forEach(function(p){p.classList.remove('active');});");
            sb.Append("    btn.classList.add('active');");
            sb.Append("    var pane=document.getElementById('tab-'+t);");
            sb.Append("    if(pane)pane.classList.add('active');");
            sb.Append("  };");
            sb.Append("});");
            sb.Append("function togglePanel(){if(aiPanel)aiPanel.classList.toggle('open');}");
            // Drag to close
            sb.Append("var dragEl=document.querySelector('.panel-drag');");
            sb.Append("if(dragEl){");
            sb.Append("  var startY=0;");
            sb.Append("  dragEl.addEventListener('touchstart',function(e){startY=e.touches[0].clientY;},{passive:true});");
            sb.Append("  dragEl.addEventListener('touchend',function(e){if(e.changedTouches[0].clientY-startY>50)aiPanel.classList.remove('open');},{passive:true});");
            sb.Append("}");
        }

        // SignalR events
        sb.Append("connection.on('Error',function(m){setError(m);});");
        sb.Append("connection.on('Joined',function(){setStatus('Sala pronta. Aguardando midia...');});");
        sb.Append("connection.on('Offer',function(sdp){");
        sb.Append("  if(!pc)return;");
        sb.Append("  pc.setRemoteDescription(new RTCSessionDescription(sdp))");
        sb.Append("    .then(function(){return pc.createAnswer();})");
        sb.Append("    .then(function(ans){return pc.setLocalDescription(ans);})");
        sb.Append("    .then(function(){connection.invoke('SendAnswer',requestId,pc.localDescription);setStatus('Em chamada');})");
        sb.Append("    .catch(function(e){setError(e.message);});");
        sb.Append("});");
        sb.Append("connection.on('Answer',function(sdp){");
        sb.Append("  if(!pc)return;");
        sb.Append("  pc.setRemoteDescription(new RTCSessionDescription(sdp))");
        sb.Append("    .then(function(){setStatus('Em chamada');})");
        sb.Append("    .catch(function(e){setError(e.message);});");
        sb.Append("});");
        sb.Append("connection.on('IceCandidate',function(c){if(!pc)return;pc.addIceCandidate(new RTCIceCandidate(c)).catch(function(){});});");

        // SignalR IA updates (doctor-only handlers work for all but only displayed by doctor)
        sb.Append("connection.on('TranscriptUpdate',function(d){");
        sb.Append("  var lines=d.fullText||d.FullText||'';");
        sb.Append("  updateTranscript(lines);");
        sb.Append("  var parts=lines.split('\\n').filter(function(l){return l.trim().length>0;}).slice(-3);");
        sb.Append("  postNative({type:'transcriptSnippet',text:parts.join(' ').substring(0,200)});");
        sb.Append("  postNative({type:'aiActive',active:true});");
        sb.Append("});");
        sb.Append("connection.on('AnamnesisUpdate',function(d){");
        sb.Append("  try{var j=d.anamnesisJson||d.AnamnesisJson;var obj=typeof j==='string'?JSON.parse(j):j;updateAnamnesisFields(obj);}catch(e){}");
        sb.Append("});");
        sb.Append("connection.on('SuggestionUpdate',function(d){");
        sb.Append("  var arr=d.items||d.Items||[];updateSuggestions(arr);");
        sb.Append("});");

        // Transcript rendering
        sb.Append("function updateTranscript(text){");
        sb.Append("  var el=document.getElementById('transcriptContainer');");
        sb.Append("  if(!el)return;");
        sb.Append("  var lines=text.split('\\n').filter(function(l){return l.trim().length>0;});");
        sb.Append("  el.innerHTML='';");
        sb.Append("  lines.forEach(function(line){");
        sb.Append("    var div=document.createElement('div');div.className='tx-line';");
        sb.Append("    if(line.indexOf('[Medico]')===0||line.indexOf('[M\\u00e9dico]')===0){");
        sb.Append("      var txt=line.replace(/^\\[M..?dico\\]/,'').trim();");
        sb.Append("      div.innerHTML='<span class=\\'tx-ts\\'>Med.</span><span class=\\'tx-doctor\\'>'+escHtml(txt)+'</span>';");
        sb.Append("    }else if(line.indexOf('[Paciente]')===0){");
        sb.Append("      var txt2=line.replace('[Paciente]','').trim();");
        sb.Append("      div.innerHTML='<span class=\\'tx-ts\\'>Pac.</span><span class=\\'tx-patient\\'>'+escHtml(txt2)+'</span>';");
        sb.Append("    }else{");
        sb.Append("      div.innerHTML='<span class=\\'tx-patient\\'>'+escHtml(line)+'</span>';");
        sb.Append("    }");
        sb.Append("    el.appendChild(div);");
        sb.Append("  });");
        sb.Append("  el.scrollTop=el.scrollHeight;");
        sb.Append("}");

        sb.Append("function escHtml(s){");
        sb.Append("  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');");
        sb.Append("}");

        // Anamnesis fields
        sb.Append("function setField(id,val){");
        sb.Append("  var el=document.getElementById(id);if(!el)return;");
        sb.Append("  if(!val||val===''||val==='null'){el.textContent='\\u2014';return;}");
        sb.Append("  el.textContent=Array.isArray(val)?val.join(', '):String(val);");
        sb.Append("}");
        sb.Append("function updateAnamnesisFields(obj){");
        sb.Append("  if(!obj)return;");
        sb.Append("  setField('ana-queixa',obj.queixa_principal);");
        sb.Append("  setField('ana-hda',obj.historia_doenca_atual);");
        sb.Append("  setField('ana-sintomas',obj.sintomas);");
        sb.Append("  setField('ana-meds',obj.medicamentos_em_uso);");
        sb.Append("  setField('ana-alergias',obj.alergias);");
        sb.Append("  setField('ana-antecedentes',obj.antecedentes_relevantes);");
        sb.Append("  setField('ana-cid',obj.cid_sugerido);");
        sb.Append("  if(obj.alertas_vermelhos&&obj.alertas_vermelhos.length>0)renderRedFlags(obj.alertas_vermelhos);");
        sb.Append("  if(obj.medicamentos_sugeridos&&obj.medicamentos_sugeridos.length>0)renderMedChips(obj.medicamentos_sugeridos);");
        sb.Append("}");
        sb.Append("function renderRedFlags(flags){");
        sb.Append("  var c=document.getElementById('redFlagsContainer');if(!c)return;c.innerHTML='';");
        sb.Append("  flags.forEach(function(f){var d=document.createElement('div');d.className='suggestion-card red-flag-card';");
        sb.Append("    d.innerHTML='<div class=\\'red-flag-label\\'>\ud83d\udea8 Alerta</div><div class=\\'sug-text\\'>'+escHtml(f)+'</div>';c.appendChild(d);});");
        sb.Append("}");
        sb.Append("function renderMedChips(meds){");
        sb.Append("  var c=document.getElementById('medsContainer');if(!c)return;");
        sb.Append("  c.innerHTML='<div style=\\'font-size:10px;color:#64748b;margin-bottom:4px;font-weight:700;\\'>MEDICAMENTOS SUGERIDOS</div>';");
        sb.Append("  meds.forEach(function(m){var span=document.createElement('span');span.className='meds-chip';span.textContent=m;");
        sb.Append("    span.onclick=function(){navigator.clipboard&&navigator.clipboard.writeText(m).catch(function(){});};c.appendChild(span);});");
        sb.Append("}");
        sb.Append("function updateSuggestions(arr){");
        sb.Append("  var c=document.getElementById('suggestionsContainer');if(!c)return;");
        sb.Append("  if(!arr||arr.length===0){c.innerHTML='<div class=\\'empty-state\\'>Aguardando mais dados...</div>';return;}");
        sb.Append("  c.innerHTML='';");
        sb.Append("  arr.forEach(function(item){var d=document.createElement('div');d.className='suggestion-card';");
        sb.Append("    var m=item.match(/\\b([A-Z][0-9]{1,2}(?:\\.[0-9]{1,2})?)\\b/);");
        sb.Append("    var cid=m?m[1]:'';var text=cid?item.replace(m[0],'').trim():item;");
        sb.Append("    d.innerHTML=(cid?'<div class=\\'sug-cid\\'>'+escHtml(cid)+'</div>':'')+'<div class=\\'sug-text\\'>'+escHtml(text||item)+'</div>';");
        sb.Append("    c.appendChild(d);});");
        sb.Append("}");

        // Audio recording (both streams for diarization)
        sb.Append("function startAudioRecording(stream,streamType){");
        sb.Append("  if(!isDoctor)return null;");
        sb.Append("  try{");
        sb.Append("    if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();");
        sb.Append("    var src=audioCtx.createMediaStreamSource(stream);");
        sb.Append("    var dest=audioCtx.createMediaStreamDestination();");
        sb.Append("    src.connect(dest);");
        sb.Append("    var opts={};");
        sb.Append("    if(MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))opts.mimeType='audio/webm;codecs=opus';");
        sb.Append("    var rec=new MediaRecorder(dest.stream,opts);");
        sb.Append("    rec.ondataavailable=function(ev){if(ev.data&&ev.data.size>0)sendChunk(ev.data,streamType);};");
        sb.Append("    rec.start(10000);");
        sb.Append("    return rec;");
        sb.Append("  }catch(e){console.warn('Audio recording error:',e);return null;}");
        sb.Append("}");
        sb.Append("function sendChunk(blob,streamType){");
        sb.Append("  var fd=new FormData();");
        sb.Append("  fd.append('requestId',requestId);");
        sb.Append("  fd.append('stream',streamType);");
        sb.Append("  fd.append('file',blob,'chunk.webm');");
        sb.Append("  fetch(baseUrl+'/api/consultation/transcribe',{method:'POST',headers:{'Authorization':'Bearer '+accessToken},body:fd}).catch(function(){});");
        sb.Append("}");

        // WebRTC setup
        sb.Append("function startCall(){");
        sb.Append("  pc=new RTCPeerConnection(pcConfig);");
        sb.Append("  localStream.getTracks().forEach(function(t){pc.addTrack(t,localStream);});");
        sb.Append("  pc.ontrack=function(e){");
        sb.Append("    if(remoteV.srcObject!==e.streams[0]){remoteV.srcObject=e.streams[0];");
        sb.Append("      if(isDoctor&&e.streams[0].getAudioTracks().length>0&&!remoteRecorder)");
        sb.Append("        remoteRecorder=startAudioRecording(e.streams[0],'remote');");
        sb.Append("    }");
        sb.Append("  };");
        sb.Append("  pc.onicecandidate=function(e){if(e.candidate)connection.invoke('SendIceCandidate',requestId,e.candidate);};");
        sb.Append("  pc.onconnectionstatechange=function(){");
        sb.Append("    var state=pc.connectionState;");
        sb.Append("    if(state==='connected'){setStatus('Em chamada');postNative({type:'quality',quality:'good'});reconnectAttempts=0;startStats();}");
        sb.Append("    else if(state==='disconnected'||state==='failed'){setStatus('Reconectando...');postNative({type:'quality',quality:'bad'});tryReconnect();}");
        sb.Append("    else if(state==='connecting')postNative({type:'quality',quality:'connecting'});");
        sb.Append("  };");
        sb.Append("  connection.invoke('JoinRoom',requestId).then(function(){");
        sb.Append("    if(isDoctor){");
        sb.Append("      pc.createOffer()");
        sb.Append("        .then(function(offer){return pc.setLocalDescription(offer);})");
        sb.Append("        .then(function(){connection.invoke('SendOffer',requestId,pc.localDescription);setStatus('Chamada iniciada');})");
        sb.Append("        .catch(function(e){setError(e.message);});");
        sb.Append("    }else{setStatus('Aguardando medico...');}");
        sb.Append("  }).catch(function(e){setError(e.message);});");
        sb.Append("}");

        sb.Append("function tryReconnect(){");
        sb.Append("  if(reconnectAttempts>=maxReconnectAttempts){setError('Falha na conexao apos multiplas tentativas.');return;}");
        sb.Append("  reconnectAttempts++;");
        sb.Append("  setTimeout(function(){try{if(pc)pc.restartIce();}catch(e){}},1500*reconnectAttempts);");
        sb.Append("}");

        // RTCStats quality monitor
        sb.Append("function startStats(){");
        sb.Append("  if(statsInterval)clearInterval(statsInterval);");
        sb.Append("  statsInterval=setInterval(function(){");
        sb.Append("    if(!pc||pc.connectionState!=='connected')return;");
        sb.Append("    pc.getStats().then(function(stats){");
        sb.Append("      var lost=0,total=0;");
        sb.Append("      stats.forEach(function(r){if(r.type==='inbound-rtp'&&r.kind==='video'){if(r.packetsLost!=null)lost+=r.packetsLost;if(r.packetsReceived!=null)total+=r.packetsReceived;}});");
        sb.Append("      var lr=total>0?lost/total:0;var q=lr<0.02?'good':lr<0.1?'poor':'bad';");
        sb.Append("      postNative({type:'quality',quality:q});");
        sb.Append("    }).catch(function(){});");
        sb.Append("  },3000);");
        sb.Append("}");

        // Boot: conexão SignalR depois getUserMedia com timeout (Android pode demorar ou travar)
        sb.Append("var mediaTimeout=15000;");
        sb.Append("function getMediaWithTimeout(){");
        sb.Append("  setStatus('Acessando câmera e microfone...');");
        sb.Append("  postNative({type:'mediaStatus',status:'requesting'});");
        sb.Append("  var timeout=new Promise(function(_,reject){setTimeout(function(){reject(new Error('Tempo esgotado. Verifique se o app tem permissão para câmera e microfone nas configurações do dispositivo.'));},mediaTimeout);});");
        sb.Append("  var media=navigator.mediaDevices.getUserMedia({video:true,audio:true});");
        sb.Append("  return Promise.race([media,timeout]);");
        sb.Append("}");
        sb.Append("connection.start()");
        sb.Append("  .then(getMediaWithTimeout)");
        sb.Append("  .then(function(stream){");
        sb.Append("    postNative({type:'mediaStatus',status:'ok'});");
        sb.Append("    localStream=stream;window.__localStream=stream;localV.srcObject=stream;setStatus('Entrando na sala...');");
        sb.Append("    if(isDoctor)localRecorder=startAudioRecording(stream,'local');");
        sb.Append("    startCall();");
        sb.Append("  })");
        sb.Append("  .catch(function(e){var msg=e.message||'Erro ao acessar câmera ou microfone';setError(msg);postNative({type:'mediaStatus',status:'error',message:msg});});");

        sb.Append("})();");
    }

    private static string EscJs(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Replace("\\", "\\\\").Replace("'", "\\'").Replace("\r", "").Replace("\n", "\\n");
    }
}
