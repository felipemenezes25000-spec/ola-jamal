using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RenoveJa.Application.DTOs.Verification;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller público (sem autenticação) para verificação de receitas digitais.
/// Permite que farmacêuticos e pacientes verifiquem a autenticidade de uma receita
/// através do QR Code que aponta para https://renovejasaude.com.br/verificar/{requestId}.
/// </summary>
[ApiController]
[Route("api/verify")]
[EnableRateLimiting("verify")]
public class VerificationController(IVerificationService verificationService, ILogger<VerificationController> logger) : ControllerBase
{
    /// <summary>
    /// Retorna dados públicos da receita para verificação.
    /// Dados sensíveis são mascarados (nome parcial do paciente, sem CPF).
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetPublicVerification(Guid id, CancellationToken cancellationToken)
    {
        logger.LogInformation("Verify GetPublicVerification: requestId={RequestId}", id);
        var result = await verificationService.GetPublicVerificationAsync(id, cancellationToken);
        if (result == null)
            return NotFound(new { error = "Receita não encontrada." });
        return Ok(result);
    }

    /// <summary>
    /// Retorna dados completos da receita após validação do código de acesso.
    /// O código de acesso é necessário para proteger dados sensíveis do paciente.
    /// </summary>
    [HttpPost("{id:guid}/full")]
    public async Task<IActionResult> GetFullVerification(
        Guid id,
        [FromBody] VerifyAccessCodeRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.AccessCode))
            return BadRequest(new { error = "Código de acesso é obrigatório." });

        try
        {
            var result = await verificationService.GetFullVerificationAsync(id, request.AccessCode, cancellationToken);
            if (result == null)
                return NotFound(new { error = "Receita não encontrada." });

            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return StatusCode(403, new { error = "Código de acesso inválido." });
        }
    }

    /// <summary>
    /// Retorna uma página HTML responsiva para verificação da receita.
    /// Mobile-first — farmacêuticos escaneiam o QR Code pelo celular.
    /// </summary>
    [HttpGet("{id:guid}/page")]
    [Produces("text/html")]
    public IActionResult GetVerificationPage(Guid id)
    {
        var html = GenerateVerificationHtml(id);
        return Content(html, "text/html");
    }

    private static string GenerateVerificationHtml(Guid requestId)
    {
        return $@"<!DOCTYPE html>
<html lang=""pt-BR"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>Verificar Receita — RenoveJá</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f8f9fa;
            color: #333;
            min-height: 100vh;
        }}
        .header {{
            background: #008C52;
            color: white;
            padding: 16px 20px;
            text-align: center;
        }}
        .header h1 {{
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }}
        .header .subtitle {{
            font-size: 13px;
            opacity: 0.85;
            margin-top: 4px;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            padding: 16px;
        }}
        .status-card {{
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            text-align: center;
        }}
        .status-icon {{
            font-size: 48px;
            margin-bottom: 8px;
        }}
        .status-text {{
            font-size: 18px;
            font-weight: 600;
        }}
        .status-signed {{ color: #008C52; }}
        .status-pending {{ color: #e67e22; }}
        .status-rejected {{ color: #e74c3c; }}
        .info-card {{
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }}
        .info-card h3 {{
            font-size: 14px;
            color: #008C52;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e8f5e9;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }}
        .info-row:last-child {{ border-bottom: none; }}
        .info-label {{
            font-size: 13px;
            color: #666;
            flex-shrink: 0;
        }}
        .info-value {{
            font-size: 14px;
            font-weight: 500;
            text-align: right;
            word-break: break-word;
        }}
        .med-list {{
            list-style: none;
            padding: 0;
        }}
        .med-list li {{
            padding: 10px 12px;
            background: #f0faf5;
            border-radius: 8px;
            margin-bottom: 6px;
            font-size: 14px;
            border-left: 3px solid #008C52;
        }}
        .access-code-section {{
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }}
        .access-code-section h3 {{
            font-size: 14px;
            color: #008C52;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
        }}
        .access-code-section p {{
            font-size: 13px;
            color: #666;
            margin-bottom: 12px;
        }}
        .code-input-group {{
            display: flex;
            gap: 8px;
        }}
        .code-input {{
            flex: 1;
            padding: 12px 16px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 18px;
            text-align: center;
            letter-spacing: 8px;
            font-weight: 700;
            outline: none;
            transition: border-color 0.2s;
        }}
        .code-input:focus {{
            border-color: #008C52;
        }}
        .code-btn {{
            padding: 12px 20px;
            background: #008C52;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            transition: background 0.2s;
        }}
        .code-btn:hover {{ background: #006e3f; }}
        .code-btn:disabled {{
            background: #ccc;
            cursor: not-allowed;
        }}
        .code-error {{
            color: #e74c3c;
            font-size: 13px;
            margin-top: 8px;
            display: none;
        }}
        .full-details {{
            display: none;
        }}
        .full-details.visible {{
            display: block;
        }}
        .iti-link {{
            background: white;
            border-radius: 12px;
            padding: 16px 20px;
            margin-bottom: 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            text-align: center;
        }}
        .iti-link p {{
            font-size: 13px;
            color: #666;
            margin-bottom: 8px;
        }}
        .iti-link a {{
            color: #008C52;
            font-weight: 600;
            text-decoration: none;
        }}
        .iti-link a:hover {{ text-decoration: underline; }}
        .footer {{
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #999;
        }}
        .loading {{
            text-align: center;
            padding: 40px 20px;
        }}
        .spinner {{
            width: 40px;
            height: 40px;
            border: 4px solid #e8f5e9;
            border-top-color: #008C52;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 16px;
        }}
        @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
        .error-msg {{
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 16px;
            border-radius: 12px;
            text-align: center;
            margin-bottom: 16px;
            display: none;
        }}
    </style>
</head>
<body>
    <div class=""header"">
        <h1>🩺 RenoveJá</h1>
        <div class=""subtitle"">Verificação de Receita Digital</div>
    </div>

    <div class=""container"">
        <div id=""loading"" class=""loading"">
            <div class=""spinner""></div>
            <p>Carregando dados da receita...</p>
        </div>

        <div id=""error"" class=""error-msg""></div>

        <div id=""content"" style=""display:none"">
            <div class=""status-card"">
                <div id=""statusIcon"" class=""status-icon""></div>
                <div id=""statusText"" class=""status-text""></div>
            </div>

            <div class=""info-card"">
                <h3>👨‍⚕️ Médico</h3>
                <div class=""info-row"">
                    <span class=""info-label"">Nome</span>
                    <span class=""info-value"" id=""doctorName"">—</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">CRM</span>
                    <span class=""info-value"" id=""doctorCrm"">—</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Especialidade</span>
                    <span class=""info-value"" id=""doctorSpecialty"">—</span>
                </div>
            </div>

            <div class=""info-card"">
                <h3>👤 Paciente</h3>
                <div class=""info-row"">
                    <span class=""info-label"">Nome</span>
                    <span class=""info-value"" id=""patientName"">—</span>
                </div>
                <div id=""patientCpfRow"" class=""info-row"" style=""display:none"">
                    <span class=""info-label"">CPF</span>
                    <span class=""info-value"" id=""patientCpf"">—</span>
                </div>
            </div>

            <div class=""info-card"">
                <h3>📋 Receita</h3>
                <div class=""info-row"">
                    <span class=""info-label"">Tipo</span>
                    <span class=""info-value"" id=""prescriptionType"">—</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Data de emissão</span>
                    <span class=""info-value"" id=""emissionDate"">—</span>
                </div>
                <div class=""info-row"">
                    <span class=""info-label"">Assinada em</span>
                    <span class=""info-value"" id=""signedAt"">—</span>
                </div>
                <div id=""signatureRow"" class=""info-row"" style=""display:none"">
                    <span class=""info-label"">Assinatura</span>
                    <span class=""info-value"" id=""signatureInfo"">—</span>
                </div>
            </div>

            <div id=""medsCard"" class=""info-card"" style=""display:none"">
                <h3>💊 Medicamentos</h3>
                <ul id=""medsList"" class=""med-list""></ul>
            </div>

            <div id=""notesCard"" class=""info-card full-details"" style=""display:none"">
                <h3>📝 Observações</h3>
                <p id=""notesText"" style=""font-size:14px;color:#555;padding:8px 0""></p>
            </div>

            <div class=""access-code-section"">
                <h3>🔐 Dados Completos</h3>
                <p>Digite o código de acesso de 4 dígitos para visualizar os dados completos da receita.</p>
                <div class=""code-input-group"">
                    <input type=""text"" id=""accessCode"" class=""code-input"" maxlength=""4"" placeholder=""0000"" inputmode=""numeric"" pattern=""[0-9]*"">
                    <button id=""verifyBtn"" class=""code-btn"" onclick=""verifyCode()"">Verificar</button>
                </div>
                <div id=""codeError"" class=""code-error""></div>
            </div>

            <div class=""iti-link"">
                <p>Verifique a assinatura digital deste documento em</p>
                <a href=""https://validar.iti.gov.br"" target=""_blank"" rel=""noopener noreferrer"">validar.iti.gov.br ↗</a>
            </div>
        </div>

        <div class=""footer"">
            <p>RenoveJá Saúde — Receitas Digitais</p>
            <p style=""margin-top:4px"">ID: <span id=""requestIdFooter"">{requestId}</span></p>
        </div>
    </div>

    <script>
        var REQUEST_ID = '{requestId}';
        var BASE_URL = window.location.origin;

        function formatDate(dateStr) {{
            if (!dateStr) return '—';
            var d = new Date(dateStr);
            return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {{hour:'2-digit',minute:'2-digit'}});
        }}

        function formatPrescriptionType(type) {{
            if (!type) return '—';
            var map = {{ 'simples': 'Simples', 'controlado': 'Controlado', 'azul': 'Azul (Especial)' }};
            return map[type] || type;
        }}

        function setStatusDisplay(status) {{
            var icon = document.getElementById('statusIcon');
            var text = document.getElementById('statusText');
            if (status === 'signed' || status === 'delivered') {{
                icon.textContent = '✅';
                text.textContent = 'Receita Assinada Digitalmente';
                text.className = 'status-text status-signed';
            }} else if (status === 'rejected' || status === 'cancelled') {{
                icon.textContent = '❌';
                text.textContent = 'Receita Rejeitada / Cancelada';
                text.className = 'status-text status-rejected';
            }} else {{
                icon.textContent = '⏳';
                text.textContent = 'Receita em Processamento';
                text.className = 'status-text status-pending';
            }}
        }}

        function showMedications(meds) {{
            var card = document.getElementById('medsCard');
            var list = document.getElementById('medsList');
            if (!meds || meds.length === 0) {{
                card.style.display = 'none';
                return;
            }}
            card.style.display = 'block';
            list.innerHTML = '';
            meds.forEach(function(med) {{
                var li = document.createElement('li');
                li.textContent = med;
                list.appendChild(li);
            }});
        }}

        async function loadPublicData() {{
            try {{
                var resp = await fetch(BASE_URL + '/api/verify/' + REQUEST_ID);
                if (!resp.ok) {{
                    throw new Error(resp.status === 404 ? 'Receita não encontrada.' : 'Erro ao carregar dados.');
                }}
                var data = await resp.json();

                setStatusDisplay(data.status);
                document.getElementById('doctorName').textContent = data.doctorName || '—';
                document.getElementById('doctorCrm').textContent = data.doctorCrm ? (data.doctorCrm + '/' + (data.doctorCrmState || '')) : '—';
                document.getElementById('doctorSpecialty').textContent = data.doctorSpecialty || '—';
                document.getElementById('patientName').textContent = data.patientName || '—';
                document.getElementById('prescriptionType').textContent = formatPrescriptionType(data.prescriptionType);
                document.getElementById('emissionDate').textContent = formatDate(data.emissionDate);
                document.getElementById('signedAt').textContent = data.signedAt ? formatDate(data.signedAt) : 'Não assinada';

                if (data.signatureInfo) {{
                    document.getElementById('signatureRow').style.display = 'flex';
                    document.getElementById('signatureInfo').textContent = data.signatureInfo;
                }}

                showMedications(data.medications);

                document.getElementById('loading').style.display = 'none';
                document.getElementById('content').style.display = 'block';
            }} catch (err) {{
                document.getElementById('loading').style.display = 'none';
                var errEl = document.getElementById('error');
                errEl.textContent = err.message || 'Erro ao carregar dados da receita.';
                errEl.style.display = 'block';
            }}
        }}

        async function verifyCode() {{
            var code = document.getElementById('accessCode').value.trim();
            var errEl = document.getElementById('codeError');
            var btn = document.getElementById('verifyBtn');

            if (code.length !== 4) {{
                errEl.textContent = 'Digite os 4 dígitos do código de acesso.';
                errEl.style.display = 'block';
                return;
            }}

            btn.disabled = true;
            btn.textContent = '...';
            errEl.style.display = 'none';

            try {{
                var resp = await fetch(BASE_URL + '/api/verify/' + REQUEST_ID + '/full', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ accessCode: code }})
                }});

                if (resp.status === 403) {{
                    errEl.textContent = 'Código de acesso inválido. Tente novamente.';
                    errEl.style.display = 'block';
                    btn.disabled = false;
                    btn.textContent = 'Verificar';
                    return;
                }}

                if (!resp.ok) throw new Error('Erro ao verificar.');

                var data = await resp.json();

                // Atualizar com dados completos
                document.getElementById('patientName').textContent = data.patientFullName || '—';
                if (data.patientCpfMasked) {{
                    document.getElementById('patientCpfRow').style.display = 'flex';
                    document.getElementById('patientCpf').textContent = data.patientCpfMasked;
                }}

                showMedications(data.medications);

                if (data.notes) {{
                    var notesCard = document.getElementById('notesCard');
                    notesCard.style.display = 'block';
                    notesCard.classList.add('visible');
                    document.getElementById('notesText').textContent = data.notes;
                }}

                // Esconder seção de código após sucesso
                document.querySelector('.access-code-section').innerHTML =
                    '<h3 style=""color:#008C52;font-size:14px;text-transform:uppercase;letter-spacing:0.5px"">🔓 Dados Completos</h3>' +
                    '<p style=""color:#008C52;font-size:14px;font-weight:500"">✅ Código verificado — exibindo dados completos.</p>';

            }} catch (err) {{
                errEl.textContent = err.message || 'Erro ao verificar código.';
                errEl.style.display = 'block';
            }}

            btn.disabled = false;
            btn.textContent = 'Verificar';
        }}

        // Enter key on access code input
        document.addEventListener('DOMContentLoaded', function() {{
            var input = document.getElementById('accessCode');
            if (input) {{
                input.addEventListener('keypress', function(e) {{
                    if (e.key === 'Enter') verifyCode();
                }});
            }}
        }});

        loadPublicData();
    </script>
</body>
</html>";
    }
}
