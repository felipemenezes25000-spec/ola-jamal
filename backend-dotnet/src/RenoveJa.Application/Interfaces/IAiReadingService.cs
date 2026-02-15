using RenoveJa.Application.DTOs.Requests;

namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço de leitura com IA (GPT-4o) para receitas e pedidos de exame.
/// Fluxos: Renovação de Receita (extrai medicamento, dosagem, médico, risco, resumo);
/// Pedido de Exame (extrai tipo, indicação, urgência; ou apenas ajusta texto quando não há imagem).
/// Se a IA não conseguir ler a imagem, retorna ReadabilityOk=false e mensagem pedindo envio mais legível.
/// </summary>
public interface IAiReadingService
{
    /// <summary>
    /// Analisa imagem(ns) de receita vencida: extrai medicamento, dosagem, médico anterior, classifica risco e gera resumo para o médico.
    /// Se a imagem estiver ilegível, retorna ReadabilityOk=false e MessageToUser para o paciente enviar outra mais nítida.
    /// </summary>
    Task<AiPrescriptionAnalysisResult> AnalyzePrescriptionAsync(
        IReadOnlyList<string> imageUrls,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Analisa pedido de exame: se houver imageUrls, extrai tipo de exame, indicação clínica e classifica urgência;
    /// se não houver imagens, apenas ajusta/estrutura o texto (textDescription) para o médico.
    /// Se houver imagem ilegível, retorna ReadabilityOk=false e MessageToUser.
    /// </summary>
    Task<AiExamAnalysisResult> AnalyzeExamAsync(
        IReadOnlyList<string>? imageUrls,
        string? textDescription,
        CancellationToken cancellationToken = default);
}
