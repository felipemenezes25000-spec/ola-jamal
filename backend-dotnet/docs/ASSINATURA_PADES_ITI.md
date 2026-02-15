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
   O PDF contém um QR Code que aponta para a URL de verificação configurável (`Verification:BaseUrl`). Ex.:  
   `https://sua-api.com/api/verify/{requestId}`

2. **Configuração**  
   Defina em `appsettings.json` ou variável de ambiente `Verification__BaseUrl`:

   ```json
   "Verification": {
     "BaseUrl": "https://api.renovejasaude.com.br/api/verify"
   }
   ```

   A API deve estar acessível publicamente (HTTPS).

3. **Validação no ITI**  
   - Acesse https://validar.iti.gov.br  
   - Use a opção **"QR Code"**  
   - Escaneie o QR Code da receita  
   - O Validador chama `GET {BaseUrl}/{requestId}?_format=application/validador-iti+json&_secretCode={código}`  
   - A API retorna o JSON com a URL do PDF assinado  
   - O ITI baixa o PDF e valida a assinatura PAdES

4. **Código de acesso**  
   O `_secretCode` corresponde ao código de 4 dígitos exibido na receita (acesso ao paciente).

## Resumo da validação

No Relatório de Conformidade do ITI, valores esperados para receitas assinadas corretamente:

- **Status de assinatura**: Aprovado
- **Estrutura**: Em conformidade com o padrão
- **Resumo criptográfico**: true
- **Caminho de certificação**: Valid
