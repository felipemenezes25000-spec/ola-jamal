# Integração Clicksign API 3.0 no RenoveJá

Guia completo para usar a **Clicksign API 3.0 (Envelope)** no fluxo de assinatura de receitas do RenoveJá, com base no [Guia de migração Clicksign](http://developers.clicksign.com/docs/guia-de-migracao).

---

## 1. Entendendo a API 3.0 (Envelope)

A API 1.9 é legada. Na **3.0** cada envio é uma **transação** chamada **Envelope**.

### Conceitos principais

| Conceito | O que é no 3.0 | No RenoveJá |
|----------|-----------------|-------------|
| **Envelope** | Container que agrupa documentos, signatários e requisitos em uma única transação. | 1 envelope = 1 assinatura de receita (uma solicitação `request` paga). |
| **Documento** | Arquivo que será assinado; é **adicionado ao envelope**. Não carrega lógica de signatários. | PDF da receita nova (gerado após aprovação + pagamento). |
| **Signatário** | Pessoa que assina; é **adicionada ao envelope** e ligada aos documentos via **Requirements**. | Médico (único signatário da receita). |
| **Requisito (Requirement)** | Conecta signatário a documento. Dois obrigatórios: **Qualificação** (papel, ex.: “Médico prescritor”) e **Autenticação** (ex.: biometria facial, e-mail, etc.). Substitui o “List” da 1.9. | 1 requirement de qualificação (médico) + 1 de autenticação (ex.: e-mail/SMS ou token). |
| **Evidência (Evidence)** | “Provas” geradas pelo signatário ao cumprir os requirements (ex.: imagem da biometria). Substitui “Signature” da 1.9. | Gerado pela Clicksign quando o médico assina; você só consome via webhook. |
| **Notificação** | Disparo para os signatários (e-mail/SMS etc.) avisando que precisam assinar. | Usar para avisar o médico que há receita para assinar. |

### Fluxo do processo na API 3.0

1. **Criar Envelope** (draft).
2. **Adicionar Documentos** – upload dos PDFs ao envelope.
3. **Adicionar Signatários** – no nosso caso, o médico.
4. **Criar Requirements** – definir que o médico deve assinar o documento e com qual autenticação.
5. **Configurar Envelope** – prazos, idioma, mensagens.
6. **Ativar Envelope** – inicia o processo.
7. **Enviar Notificação** – avisar o médico.

Depois disso, o médico assina na Clicksign; quando terminar, a Clicksign dispara **webhooks** (ex.: evento **Document Closed** ou **Sign**). Seu backend recebe o webhook, atualiza a solicitação com a URL do documento assinado e o `signatureId` (ID do documento/envelope na Clicksign).

---

## 2. Como isso se encaixa no fluxo atual do RenoveJá

Hoje o fluxo é:

| # | Ação | Endpoint | Status |
|---|------|----------|--------|
| 1 | Paciente solicita receita | `POST /api/requests/prescription` | → **submitted** |
| 2 | Médico aprova | `POST /api/requests/{id}/approve` | → **approved_pending_payment** |
| 3 | Paciente paga (PIX) | Webhook / `POST /api/payments/{id}/confirm` | → **paid** |
| 4 | Médico assina | `POST /api/requests/{id}/sign` | → **signed** |

Hoje no passo 4 o médico envia **manual** `signedDocumentUrl` e opcionalmente `signatureData`. Com a Clicksign 3.0:

- O **backend** cria o envelope, adiciona o documento (PDF da receita), adiciona o médico como signatário, cria os requirements, ativa e dispara notificação.
- O **médico** assina na Clicksign (link no e-mail ou na tela do app).
- O **webhook** da Clicksign avisa quando o documento foi assinado; o backend atualiza a solicitação com a URL do documento assinado (e o ID do documento/envelope como `signatureId`).

Ou seja: o passo 4 deixa de ser “médico envia URL” e passa a ser “sistema inicia fluxo na Clicksign e depois reage ao webhook”.

---

## 3. O que implementar no app (100%)

### 3.1 Configuração

- **Clicksign API 3.0**  
  - Base URL: usar a URL da API 3.0 (ex.: `https://api.clicksign.com` ou a indicada na [documentação](http://developers.clicksign.com/docs/guia-de-migracao)).
- **Token**  
  - Criar no painel Clicksign e guardar em configuração (ex.: `Clicksign:ApiKey` em `appsettings` ou variável de ambiente `Clicksign__ApiKey`).
- **Webhook**  
  - URL pública do seu backend, ex.: `https://seu-dominio.com/api/webhooks/clicksign`.  
  - Cadastrar essa URL na Clicksign (via [Cadastro de Webhooks via API](http://developers.clicksign.com/docs/cadastro-de-webhooks-via-api) ou pelo painel).

### 3.2 Backend (.NET)

1. **Config**
   - Adicionar seção `Clicksign` em `appsettings` (e/ou `appsettings.Development.json`):  
     `ApiKey`, `BaseUrl`, `WebhookSecret` (se houver).
   - Classe `ClicksignConfig` e registro em `Program.cs` (como já faz com OpenAI/Supabase).

2. **Cliente HTTP da Clicksign**
   - Serviço (ex.: `IClicksignService` + `ClicksignService`) que chama a API 3.0:
     - Criar envelope (draft).
     - Upload de documento (PDF) no envelope.
     - Adicionar signatário (médico: nome, e-mail).
     - Criar requirements (qualificação + autenticação).
     - Configurar envelope (nome, mensagem, prazo, idioma).
     - Ativar envelope.
     - Disparar notificação para o signatário.
   - Usar `IHttpClientFactory` e ler `ClicksignConfig` (BaseUrl, ApiKey).

3. **Geração do PDF da receita**
   - Quando a solicitação estiver **paid**, você precisa de um PDF para enviar à Clicksign. Duas opções:
     - **A)** Backend gera o PDF (ex.: usando o `aiSummaryForDoctor` + dados da solicitação e biblioteca de PDF).
     - **B)** Backend gera apenas um “rascunho” ou URL e o médico anexa o PDF em outro fluxo; para integração 100% com Clicksign, o ideal é o backend gerar ou obter o PDF e enviar no “Adicionar Documentos”.
   - O PDF deve ser enviado no passo “Adicionar Documentos” do envelope (upload do arquivo na API 3.0).

4. **Alterar o fluxo de “assinatura”**
   - **Opção A – Substituir `POST /api/requests/{id}/sign`**  
     - Ao invés de receber `signedDocumentUrl` e `signatureData`:
       1. Buscar a solicitação (status **paid**), médico, dados da receita.
       2. Gerar (ou obter) o PDF da receita.
       3. Chamar o `ClicksignService`: criar envelope, adicionar documento (PDF), adicionar médico como signatário, criar requirements, ativar, notificar.
       4. Salvar no banco: `request.ClicksignEnvelopeId = envelopeId` (e opcionalmente `request.ClicksignDocumentId = documentId`) para correlacionar com o webhook.
       5. Retornar ao cliente: “Envelope criado; o médico receberá o link para assinar”.
   - **Opção B – Manter `POST /api/requests/{id}/sign` e usar como “disparar Clicksign”**  
     - O body pode ser vazio ou conter opções (ex.: tipo de autenticação). O backend faz o mesmo que na opção A, sem esperar URL manual.

5. **Webhook Clicksign**
   - Novo endpoint, ex.: `POST /api/webhooks/clicksign`.
   - Receber o payload da Clicksign (eventos como **Document Closed** ou **Sign**).
   - Validar assinatura do webhook (se a Clicksign enviar um header ou campo de assinatura).
   - No payload virá o ID do documento (e/ou envelope). Buscar no banco a solicitação pelo `ClicksignDocumentId` ou `ClicksignEnvelopeId`.
   - Quando o evento for “documento assinado/fechado”:
     - Obter a URL do documento assinado (a API 3.0 deve expor um endpoint para download/visualização do documento assinado).
     - Chamar `request.Sign(signedDocumentUrl, signatureId)` (ou equivalente) com essa URL e o ID do documento/envelope como `signatureId`.
     - Persistir e, se quiser, enviar notificação ao paciente (“Sua receita foi assinada”).

6. **Persistência**
   - Na tabela `requests` (ou modelo que representa a solicitação), adicionar:
     - `clicksign_envelope_id` (string, nullable).
     - `clicksign_document_id` (string, nullable).
   - Preencher ao criar o envelope; usar no webhook para encontrar a solicitação e atualizar `signed_document_url` e `signature_id`.

### 3.3 Frontend / App

- **Médico**
  - Após o backend criar o envelope e enviar a notificação, o médico recebe o link (e-mail/SMS da Clicksign).
  - Opcional: na tela do médico no app, mostrar “Receita pendente de assinatura” e um botão “Assinar” que abre o link da Clicksign (URL do envelope/documento para assinatura).
- **Paciente**
  - Após o webhook atualizar a solicitação para **signed**, o app pode mostrar “Receita assinada” e o link de download (ou exibir o `signedDocumentUrl`).

### 3.4 Resumo da ordem técnica (no backend)

1. Configurar `Clicksign:ApiKey`, `BaseUrl`, `WebhookSecret`.
2. Implementar `IClicksignService` com: criar envelope, adicionar documento (upload PDF), adicionar signatário, criar requirements, ativar, notificar.
3. Implementar geração (ou obtenção) do PDF da receita quando status = **paid**.
4. Alterar `POST /api/requests/{id}/sign` para criar o envelope na Clicksign e salvar `clicksign_envelope_id` e `clicksign_document_id`.
5. Criar `POST /api/webhooks/clicksign`, tratar evento de documento assinado, buscar request por `clicksign_document_id`/`clicksign_envelope_id`, obter URL do documento assinado na API Clicksign e chamar `request.Sign(signedDocumentUrl, signatureId)`.
6. Migration no banco: adicionar colunas `clicksign_envelope_id` e `clicksign_document_id` na tabela de solicitações.

---

## 4. Referências Clicksign

- [Guia de migração (conceitos e fluxo)](http://developers.clicksign.com/docs/guia-de-migracao)
- [Migração da API 1.9 para 3.0](http://developers.clicksign.com/docs/migracao-da-api-1-9-para-3-0)
- [Comparativo técnico](http://developers.clicksign.com/docs/comparativo-tecnico) – exemplos de código e diferenças entre 1.9 e 3.0
- [Envelope](http://developers.clicksign.com/docs/envelope) – criação e gestão do envelope
- [Documentos](http://developers.clicksign.com/docs/documentos) – upload e gestão de documentos no envelope
- [Signatários](http://developers.clicksign.com/docs/signatarios) – adicionar signatários
- [Requisitos](http://developers.clicksign.com/docs/requisitos) – tipos de qualificação e autenticação
- [Webhooks](http://developers.clicksign.com/docs/introducao-a-webhooks) – cadastro e eventos (Document Closed, Sign, etc.)

Com isso você tem o mapa completo para fazer a integração da Clicksign API 3.0 no seu app de ponta a ponta.

