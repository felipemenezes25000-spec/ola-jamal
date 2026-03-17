using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RenoveJa.Application.Interfaces;

namespace RenoveJa.Api.Controllers;

/// <summary>
/// Controller do módulo SUS/APS — Unidades, Cidadãos, Profissionais, Agenda, Atendimentos, Exportação LEDI.
/// Base: /api/sus
/// </summary>
[ApiController]
[Route("api/sus")]
[Authorize(Roles = "admin,sus")]
public class SusController(
    ILediExportService lediExportService,
    IAuditService auditService,
    ILogger<SusController> logger) : ControllerBase
{
    // ══════════════════════════════════════════════════════════════
    // EXPORTAÇÃO e-SUS / LEDI
    // ══════════════════════════════════════════════════════════════

    /// <summary>
    /// Retorna status da exportação (pendentes, exportados, última data).
    /// </summary>
    [HttpGet("exportacao/status")]
    public async Task<IActionResult> GetExportacaoStatus(CancellationToken ct)
    {
        var status = await lediExportService.GetStatusAsync(ct);
        return Ok(status);
    }

    /// <summary>
    /// Executa exportação em lote de atendimentos pendentes para o PEC e-SUS APS.
    /// POST /api/sus/exportacao/executar
    /// </summary>
    [HttpPost("exportacao/executar")]
    public async Task<IActionResult> ExecutarExportacao(CancellationToken ct)
    {
        logger.LogInformation("SUS: Exportação LEDI solicitada por {User}", User.Identity?.Name);

        var result = await lediExportService.ExportarLoteAsync(ct);

        await auditService.LogAsync(
            userId: null,
            action: "ledi_export_batch",
            entityType: "ExportacaoSus",
            metadata: new Dictionary<string, object?>
            {
                ["exported"] = result.Exported,
                ["errors"] = result.Errors,
                ["total"] = result.TotalProcessed,
            },
            cancellationToken: ct);

        return Ok(new
        {
            result.TotalProcessed,
            result.Exported,
            result.Errors,
            result.ErrorMessages,
        });
    }

    /// <summary>
    /// Valida um atendimento antes de gerar ficha LEDI (dry-run).
    /// POST /api/sus/exportacao/validar/{atendimentoId}
    /// </summary>
    [HttpPost("exportacao/validar/{atendimentoId:guid}")]
    public IActionResult ValidarAtendimento(Guid atendimentoId)
    {
        // TODO: buscar atendimento + cidadão + profissional + unidade, chamar ValidarAtendimento
        return Ok(new { valid = true, message = "Validação requer implementação de ISusRepository." });
    }

    // ══════════════════════════════════════════════════════════════
    // ENDPOINTS CRUD — placeholder stubs para os demais módulos
    // Os repositories serão implementados conforme o projeto avança
    // ══════════════════════════════════════════════════════════════

    // GET /api/sus/unidades
    [HttpGet("unidades")]
    public IActionResult ListUnidades() =>
        Ok(new { message = "Endpoint de Unidades de Saúde — implementar ISusRepository" });

    // GET /api/sus/cidadaos
    [HttpGet("cidadaos")]
    public IActionResult ListCidadaos([FromQuery] string? search, [FromQuery] Guid? unidadeId) =>
        Ok(new { message = "Endpoint de Cidadãos — implementar ISusRepository" });

    // GET /api/sus/cidadaos/cpf/{cpf}
    [HttpGet("cidadaos/cpf/{cpf}")]
    public IActionResult BuscarCidadaoPorCpf(string cpf) =>
        Ok(new { message = $"Busca por CPF {cpf} — implementar ISusRepository" });

    // GET /api/sus/profissionais
    [HttpGet("profissionais")]
    public IActionResult ListProfissionais([FromQuery] Guid? unidadeId) =>
        Ok(new { message = "Endpoint de Profissionais SUS — implementar ISusRepository" });

    // GET /api/sus/agenda
    [HttpGet("agenda")]
    public IActionResult GetAgenda([FromQuery] Guid unidadeId, [FromQuery] string data) =>
        Ok(new { message = $"Agenda da unidade {unidadeId} em {data} — implementar ISusRepository" });

    // POST /api/sus/agenda/{id}/checkin
    [HttpPost("agenda/{id:guid}/checkin")]
    public IActionResult AgendaCheckin(Guid id) =>
        Ok(new { message = $"Check-in do agendamento {id} — implementar ISusRepository" });

    // POST /api/sus/agenda/{id}/chamar
    [HttpPost("agenda/{id:guid}/chamar")]
    public IActionResult AgendaChamar(Guid id) =>
        Ok(new { message = $"Chamada do agendamento {id} — implementar ISusRepository" });

    // POST /api/sus/agenda/{id}/iniciar
    [HttpPost("agenda/{id:guid}/iniciar")]
    public IActionResult AgendaIniciar(Guid id) =>
        Ok(new { message = $"Início atendimento {id} — implementar ISusRepository" });

    // POST /api/sus/agenda/{id}/finalizar
    [HttpPost("agenda/{id:guid}/finalizar")]
    public IActionResult AgendaFinalizar(Guid id) =>
        Ok(new { message = $"Finalização atendimento {id} — implementar ISusRepository" });

    // GET /api/sus/atendimentos
    [HttpGet("atendimentos")]
    public IActionResult ListAtendimentos([FromQuery] Guid unidadeId, [FromQuery] string? dataInicio, [FromQuery] string? dataFim) =>
        Ok(new { message = "Endpoint de Atendimentos — implementar ISusRepository" });

    // GET /api/sus/atendimentos/{id}
    [HttpGet("atendimentos/{id:guid}")]
    public IActionResult GetAtendimento(Guid id) =>
        Ok(new { message = $"Detalhe atendimento {id} — implementar ISusRepository" });

    // POST /api/sus/atendimentos
    [HttpPost("atendimentos")]
    public IActionResult CreateAtendimento() =>
        Ok(new { message = "Criação de atendimento — implementar ISusRepository" });

    // GET /api/sus/relatorios/producao
    [HttpGet("relatorios/producao")]
    public IActionResult GetRelatorioProducao([FromQuery] Guid? unidadeId, [FromQuery] string? dataInicio, [FromQuery] string? dataFim) =>
        Ok(new { message = "Relatório de produção — implementar ISusRepository" });
}
