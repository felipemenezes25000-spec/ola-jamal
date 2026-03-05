# Assinatura PAdES e Validação no ITI

Este documento referencia o **Guia de Orientações aos Desenvolvedores** do ITI (validar.iti.gov.br) e descreve como o RenoveJá atende aos requisitos.

---

## Resumo do Guia ITI (por capítulo)

| Capítulo | Conteúdo | Status RenoveJá |
|----------|----------|-----------------|
| **I** | Características dos documentos (PDF, OIDs de saúde) | ✅ PDF assinado ICP-Brasil, OIDs configurados |
| **II** | Padrões de assinatura (PAdES ICP-Brasil, DocMDP) | ✅ PAdES, DocMDP P=2 |
| **III** | QR Code (ISO/IEC 18004:2015) | ✅ QR no PDF |
| **IV** | Parâmetros para geração de QR Codes | ✅ `_format`, `_secretCode`, JSON, códigos HTTP |
| **V** | Referências de OID | ✅ 2.16.76.1.12.1.1, 2.16.76.1.12.1.3, CRM/UF |
| **VI** | DocMDP (controle de alterações incrementais) | ✅ P=2 (formulários, templates, novas assinaturas) |

---

## Capítulo IV — Parâmetros para QR Code (detalhado)

### Parâmetros obrigatórios (adicionados pelo VALIDAR)

| Nome | Conteúdo | Descrição |
|------|----------|-----------|
| `_format` | `application/validador-iti+json` | Reservado para o Portal Validar. **Comparação exata (literal)**. |
| `_secretCode` | 0–64 caracteres alfanuméricos | Código informado pelo paciente para acesso à prescrição. |

### Fluxo operacional

1. **URL no QR Code** (sem `_format` nem `_secretCode`):
   - Prescrição: `https://[API]/api/verify/{id}?type=prescricao`
   - Exame: `https://[API]/api/verify/{id}?type=exame`

2. **Requisição montada pelo VALIDAR**:
   ```
   GET https://[API]/api/verify/{id}?type=prescricao&_format=application/validador-iti+json&_secretCode=123456
   ```

3. **Resposta JSON esperada**:
   ```json
   {
     "version": "1.0.0",
     "prescription": {
       "signatureFiles": [
         { "url": "https://[API]/api/verify/{id}/document?code=123456" }
       ]
     }
   }
   ```

4. **Códigos HTTP de erro**:
   - `401` — código secreto incorreto
   - `404` — prescrição não existe

### Nota sobre `type`

Quando a URL possui outros parâmetros, o Guia exige o parâmetro `type` para que o VALIDAR identifique e acrescente `_format` e `_secretCode` corretamente. O backend retorna sempre a chave `prescription` (mesmo para solicitação de exame), conforme exemplificado no Guia.

---

## PAdES

O RenoveJá assina os PDFs de receita digital usando **PAdES** (PDF Advanced Electronic Signatures), conforme ISO 32000-2 e ETSI:

- **Padrão criptográfico**: PKCS#7/CMS (CryptoStandard.CMS no iText7)
- **Algoritmo**: SHA-256
- **Cadeia de certificados**: completa (assinante + intermediários + raiz)
- **DocMDP**: P=2 (CERTIFIED_FORM_FILLING) — evita "Assinatura Indeterminada" no validar.iti.gov.br
- **OIDs ITI**: atributos assinados conforme Guia do ITI (2.16.76.1.12.1.1 prescrição, 2.16.76.1.4.2.2.1 CRM, 2.16.76.1.4.2.2.2 UF)

O código está em `DigitalCertificateService.SignPdfWithBouncyCastle` e usa `ItiHealthOidsSignatureContainer` com `PdfSigner.SignExternalContainer`. O container constrói o CMS via BouncyCastle com os OIDs de documento de saúde exigidos pelo validar.iti.gov.br.

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
     "BaseUrl": "https://sua-api.com/api/verify",
     "FrontendUrl": "https://renovejasaude.com.br/verify"
   },
   "Api": {
     "BaseUrl": "https://sua-api.com"
   }
   ```

   - `Verification.BaseUrl` → endpoint da API (codificado no QR Code). Deve estar acessível publicamente (HTTPS).
   - `Verification.FrontendUrl` → URL do frontend de verificação (usada no texto do PDF e para redirect de browsers).
   - `Api.BaseUrl` → domínio da API para montar a URL do PDF retornada ao ITI (`{Api.BaseUrl}/api/verify/{id}/document?code=XXX`).

3. **Fluxo do QR Code**  
   - **Validador ITI**: chama `GET {BaseUrl}/{requestId}?_format=application/validador-iti+json&_secretCode={código}` → API retorna JSON com URL do PDF → ITI baixa e valida.
   - **Browser normal** (farmacêutico): abre o QR → API detecta que não há `_format` → redireciona para `{FrontendUrl}/{requestId}`.

4. **Código de acesso**  
   O `_secretCode` corresponde ao código de 6 dígitos exibido na receita.

## Capítulo V — OIDs utilizados

### Documentos digitais em saúde

| OID | Descrição |
|-----|-----------|
| 2.16.76.1.12.1.1 | Prescrição de medicamento |
| 2.16.76.1.12.1.3 | Solicitação de exame |

### Profissionais (médicos)

| OID | Descrição |
|-----|-----------|
| 2.16.76.1.4.2.2.1 | Número de registro (CRM) |
| 2.16.76.1.4.2.2.2 | UF de registro |

O `ItiHealthOidsSignatureContainer` aplica o OID correto conforme o tipo de documento (prescrição vs exame).

---

## Checklist de homologação

Antes de submeter ao VALIDAR:

- [ ] `Api__BaseUrl` configurado em produção (URL estável para `signatureFiles[0].url`)
- [ ] `Verification__BaseUrl` = `{Api__BaseUrl}/api/verify`
- [ ] QR Code **sem** `_format` e `_secretCode` embutidos
- [ ] QR Code com `type=prescricao` ou `type=exame` conforme o documento
- [ ] Teste: `curl -i "https://HOST/api/verify/{id}?type=prescricao&_format=application/validador-iti+json&_secretCode=CODE"` → 200 + JSON
- [ ] Teste: `curl -I "https://HOST/api/verify/{id}/document?code=CODE"` → 200 + `Content-Type: application/pdf`
- [ ] Teste código errado → 401
- [ ] Teste id inexistente → 404

---

## Resumo da validação

No Relatório de Conformidade do ITI, valores esperados para receitas assinadas corretamente:

- **Status de assinatura**: Aprovado
- **Estrutura**: Em conformidade com o padrão
- **Resumo criptográfico**: true
- **Caminho de certificação**: Valid
