# Assinatura PAdES e Validação no ITI

## PAdES

O RenoveJá assina os PDFs de receita digital usando **PAdES** (PDF Advanced Electronic Signatures), conforme ISO 32000-2 e ETSI:

- **Padrão criptográfico**: PKCS#7/CMS (CryptoStandard.CMS no iText7)
- **Algoritmo**: SHA-256
- **Cadeia de certificados**: completa (assinante + intermediários + raiz)
- **Timestamp TSA**: quando disponível (DigiCert ou fallback)

O código está em `DigitalCertificateService.SignPdfWithBouncyCastle` e usa `PdfSigner.SignDetached` com `PdfSigner.CryptoStandard.CMS`. O Validador de Documentos Digitais do ITI (validar.iti.gov.br) aceita esse formato e emite relatório de conformidade com status "Aprovado" quando a assinatura é válida.

O relatório pode mostrar "Tipo de assinatura: Destacada" — isso refere-se à estrutura interna do PDF; a assinatura permanece **embutida** no documento e é PAdES compatível.

## Integração com validar.iti.gov.br

1. **QR Code na receita**  
   O PDF contém um QR Code que aponta para o endpoint da API (`Verification:BaseUrl`).  
   Ex.: `https://sua-api.onrender.com/api/verify/{requestId}`  
   O texto impresso no PDF mostra a URL amigável do frontend (`Verification:FrontendUrl`).

2. **Configuração**  
   Defina em `appsettings.json` ou variáveis de ambiente:

   ```json
   "Verification": {
     "BaseUrl": "https://sua-api.onrender.com/api/verify",
     "FrontendUrl": "https://renovejasaude.com.br/verify"
   }
   ```

   - `BaseUrl` → endpoint da API (codificado no QR Code). Deve estar acessível publicamente (HTTPS).
   - `FrontendUrl` → URL do frontend de verificação (usada no texto do PDF e para redirect de browsers).

3. **Fluxo do QR Code**  
   - **Validador ITI**: chama `GET {BaseUrl}/{requestId}?_format=application/validador-iti+json&_secretCode={código}` → API retorna JSON com URL do PDF → ITI baixa e valida.
   - **Browser normal** (farmacêutico): abre o QR → API detecta que não há `_format` → redireciona para `{FrontendUrl}/{requestId}`.

4. **Código de acesso**  
   O `_secretCode` corresponde ao código de 6 dígitos exibido na receita.

## Resumo da validação

No Relatório de Conformidade do ITI, valores esperados para receitas assinadas corretamente:

- **Status de assinatura**: Aprovado
- **Estrutura**: Em conformidade com o padrão
- **Resumo criptográfico**: true
- **Caminho de certificação**: Valid
