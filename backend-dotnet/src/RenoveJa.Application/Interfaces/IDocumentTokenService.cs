namespace RenoveJa.Application.Interfaces;

/// <summary>
/// Serviço para gerar e validar tokens temporários de acesso a documentos.
/// Permite abrir o PDF no navegador via URL (ex: mobile usa Linking.openURL) sem enviar Bearer.
/// </summary>
public interface IDocumentTokenService
{
    /// <summary>Gera token temporário para acesso ao documento do pedido.</summary>
    /// <param name="requestId">ID do pedido.</param>
    /// <param name="validMinutes">Validade em minutos (padrão 15).</param>
    /// <returns>Token ou null se secret não configurado.</returns>
    string? GenerateDocumentToken(Guid requestId, int validMinutes = 15);

    /// <summary>Valida token e retorna se é válido para o pedido.</summary>
    bool ValidateDocumentToken(string? token, Guid requestId);
}
