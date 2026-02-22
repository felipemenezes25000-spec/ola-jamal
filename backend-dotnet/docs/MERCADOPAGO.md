# Integração Mercado Pago (PIX e cartão)

## Como obter o Access Token

1. Acesse [Mercado Pago Developers](https://www.mercadopago.com.br/developers)
2. Faça login com sua conta Mercado Pago
3. Vá em **Suas integrações** → [Painel de aplicações](https://www.mercadopago.com.br/developers/panel/app)
4. Crie uma aplicação (ou use uma existente)
5. Na aba **Credenciais**:
   - **Modo teste**: use o Access Token de **Teste** (começa com `TEST-`)
   - **Modo produção**: use o Access Token de **Produção** (começa com `APP_USR-`)
6. Copie o Access Token e coloque no `appsettings.json`

### Credenciais de teste vs produção

| Modo   | Token inicia com | Uso                    |
|--------|------------------|------------------------|
| Teste  | `TEST-`          | Desenvolvimento, pagamentos simulados |
| Produção | `APP_USR-`     | Ambiente real, cobranças reais        |

## Configuração no appsettings

No `appsettings.json` e `appsettings.Development.json`:

```json
"MercadoPago": {
  "AccessToken": "APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-123456-abcdef",
  "NotificationUrl": "https://sua-api.com/api/payments/webhook",
  "WebhookSecret": "sua-assinatura-secreta-do-painel"
}
```

- **AccessToken**: Obtido no painel do Mercado Pago (passo acima)
- **NotificationUrl**: **Crucial.** O Mercado Pago envia o webhook para a URL que você informa em **cada criação de pagamento** — não usa apenas a URL do painel. Essa URL vem de `MercadoPago:NotificationUrl` (appsettings ou .env). Em testes locais com ngrok, defina `MercadoPago__NotificationUrl` no `.env` com a URL do ngrok (ex.: `https://xxx.ngrok-free.dev/api/payments/webhook`). Se estiver como `https://renovejasaude.com.br/...` mas a API rodando localmente, o webhook vai para produção e falha (ex.: 405).
- **WebhookSecret**: Assinatura secreta configurada na tela de Webhooks do painel (opcional; use para validar notificações).

## Configurar Webhook (tela "Configurar notificações Webhooks")

1. No painel [Suas integrações](https://www.mercadopago.com.br/developers/panel/app) → sua aplicação → **Webhooks** → **Configurar notificações**.
2. **Modo**: use **Modo de teste** para desenvolvimento; **Modo de produção** quando for ao ar.
3. **URL para teste** (ou produção):
   - Coloque a URL **pública** do seu backend + o path do webhook: `https://SEU_DOMINIO/api/payments/webhook`.
   - Exemplo em produção: `https://api.seudominio.com/api/payments/webhook`.
   - Em desenvolvimento: use [ngrok](https://ngrok.com) — rode `ngrok http 5000` (ou a porta da API) e use a URL gerada, ex.: `https://abc123.ngrok.io/api/payments/webhook`. Não use `localhost` — o Mercado Pago não consegue acessar.
   - **Importante:** A URL do painel é usada como fallback. Para cada pagamento criado via API, o MP usa o `notification_url` enviado no payload da criação. Esse valor vem de `MercadoPago:NotificationUrl`. Para testes locais, defina `MercadoPago__NotificationUrl` no `.env` com a URL do ngrok. **Alternativa:** em ambiente Development, se `Api__BaseUrl` contiver "ngrok", o webhook usará automaticamente `Api__BaseUrl` + `/api/payments/webhook`; basta definir `Api__BaseUrl=https://xxx.ngrok-free.dev` no `.env`.
4. **Eventos**: marque **Pagamentos** (em "Eventos recomendados para integrações com Checkout Transparente"). Os outros são opcionais.
5. **Assinatura secreta**: copie o valor (ou gere um novo com o botão ao lado). Cole em `appsettings` em `MercadoPago:WebhookSecret` para uso futuro na validação das notificações.
6. Salve a configuração.

O webhook deve ser acessível publicamente. Para testes em localhost:

1. **ngrok instalado** (já incluído no projeto). Primeira vez: verifique seu email em [ngrok Dashboard](https://dashboard.ngrok.com/user/settings).
2. Rode: `.\scripts\iniciar-ngrok.ps1` ou `ngrok http 5000` (com a API rodando na porta 5000).
3. Copie a URL HTTPS (ex: `https://abc123.ngrok-free.app`) e use no Mercado Pago: `https://abc123.ngrok-free.app/api/payments/webhook`.
4. Mantenha o ngrok aberto enquanto testar. A URL muda a cada reinício (plano gratuito).

## Fluxo de pagamento (iniciado pelo paciente)

A API suporta **PIX** e **cartão (crédito/débito)**. O valor sempre vem da solicitação aprovada (não é enviado pelo cliente).

### PIX

1. **Médico aprova** → `POST /api/requests/{id}/approve`
2. **Paciente inicia pagamento** → `POST /api/payments` com `{ "requestId": "guid" }` (ou `"paymentMethod": "pix"`) → API cria PIX no Mercado Pago e retorna QR Code / copia-e-cola
3. **Paciente paga** → usa QR Code ou copia e cola no app do banco
4. **Webhook** → Mercado Pago notifica → status da solicitação atualizado para pago

### Cartão (crédito ou débito)

1. **Frontend** coleta os dados do cartão usando o **SDK do Mercado Pago** (ex.: [Card Payment Brick](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/introduction)) e obtém um **token** (nunca envie número do cartão para o seu backend).
2. **Paciente inicia pagamento** → `POST /api/payments` com body de cartão (veja abaixo).
3. A API chama o Mercado Pago com o token; a resposta pode ser **aprovado**, **pendente** ou **rejeitado**. O status é salvo e a solicitação é marcada como paga se aprovado na hora. Caso fique pendente, o webhook atualiza quando o MP notificar.

O backend identifica qual pagamento foi pago pelo **ID do pagamento no Mercado Pago** (`external_id`). No webhook, o MP envia esse ID em **`data.id`**. Funciona tanto para PIX quanto para cartão.

### Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/payments` | Criar pagamento. **PIX:** `{ "requestId": "guid" }`. **Cartão:** `{ "requestId", "paymentMethod": "credit_card" ou "debit_card", "token", "paymentMethodId", "installments"?, "issuerId"? }` — token obtido no frontend via SDK do MP |
| GET | `/api/payments/by-request/{requestId}` | Obtém pagamento pendente da solicitação (QR/copia-e-cola para PIX; status para cartão) |

### Exemplo de body para cartão

```json
{
  "requestId": "guid-da-solicitacao",
  "paymentMethod": "credit_card",
  "token": "ff8080814c11e237014c1ff593b57b4d",
  "paymentMethodId": "visa",
  "installments": 1,
  "issuerId": 310
}
```

- **token**: Obtido no frontend pelo SDK do Mercado Pago (Card Payment Brick ou similar). Não use número do cartão no backend.
- **paymentMethodId**: Bandeira do cartão: `visa`, `master`, `amex`, `naranja`, etc. (lista em [Payment Methods](https://www.mercadopago.com.br/developers/pt/reference/payment_methods/_payment_methods/get)).
- **installments**: Número de parcelas (1 ou mais para crédito).
- **issuerId**: Opcional; ID do emissor do cartão (retornado pelo SDK ao tokenizar).

**Crédito vs débito:** O MP identifica pelo **número do cartão** (use os [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/integration-test/test-cards) da tabela correspondente). Para **cartão múltiplo** (crédito e débito na mesma bandeira), a escolha no Brick é refletida no **token** gerado pelo Brick; a API POST /v1/payments não aceita o parâmetro `payment_type_id` no body (retorna erro 8: "The name of the following parameters is wrong"). O backend continua aceitando `paymentMethod` (credit_card/debit_card) no DTO para compatibilidade; o tipo é inferido pelo token/cartão no MP.

**CPF do pagador:** Em **produção** o backend envia o CPF do perfil do usuário (paciente). Em **modo teste** (Access Token começando com `TEST-`), o backend envia automaticamente o CPF de teste aceito pelo MP (`12345678909`) para evitar o erro 2067 (Invalid user identification number). No formulário do Brick você pode usar nome "APRO" e documento 12345678909 para simular pagamento aprovado.

### Páginas de teste

- **PIX:** sirva a pasta `docs/` e abra `test-payment.html`. Ex.: `npx serve docs` → `http://localhost:3000/test-payment.html`. Informe token do paciente, requestId e clique em "Criar pagamento PIX".
- **Cartão:** abra `test-card-payment.html` na mesma pasta. Clique em "Carregar formulário de cartão" (a Public Key do MP é obtida do endpoint `GET /api/integrations/mercadopago-public-key`). Preencha os dados com um [cartão de teste do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/integration-test/test-cards) e envie. O backend cria o pagamento com cartão e retorna o status (aprovado/pendente/rejeitado).

### Como testar sem pagar de verdade (modo teste)

**PIX gerado com credenciais de teste não pode ser pago no app do banco.** O código usa o ambiente sandbox do Mercado Pago (chave PIX fictícia) — o PIX real não existe, por isso o banco mostra "inválido".

Para testar o fluxo completo em desenvolvimento:

1. Crie o pagamento normalmente (POST /api/payments) e pegue o `id` do pagamento.
2. Simule a confirmação:
   - Por **ID do pagamento**: `POST /api/payments/{id}/confirm` (use o `id` retornado na criação).
   - Por **ID da solicitação**: `POST /api/payments/confirm-by-request/{requestId}` (use o requestId da solicitação).
3. O pagamento será marcado como aprovado e a solicitação como paga — como se o webhook tivesse recebido a confirmação do Mercado Pago.

**Para pagar de verdade:** use credenciais de **produção** no appsettings. O PIX será real e poderá ser pago no app do banco.

## Testar o webhook “como se fosse real” (Simulador do Mercado Pago)

Para ver o webhook da API sendo chamado de verdade (sem pagar PIX), use o **Simulador de notificações** do painel do Mercado Pago. Assim o MP envia um POST para a sua URL e você confere logs/banco.

1. **Crie um pagamento PIX** na sua API (ex.: `POST /api/payments` com `requestId`). Na resposta, anote o **`externalId`** — é o ID do pagamento no Mercado Pago.
2. **Configure o webhook** no painel: [Suas integrações](https://www.mercadopago.com.br/developers/panel/app) → sua aplicação → **Webhooks** → **Configurar notificações**. Preencha a URL (ex.: `https://seu-ngrok.ngrok-free.app/api/payments/webhook`), marque **Pagamentos** e salve.
3. **Simule a notificação**: na mesma tela de Webhooks, clique em **Simular**.
   - Selecione a **URL** que você configurou (teste ou produção).
   - **Tipo de evento**: escolha o de **Pagamentos** (ex.: “Pagamentos” / “payment”).
   - **Identificação (id)**: informe o **`externalId`** do pagamento que você criou no passo 1. É esse ID que a API usa para localizar o pagamento no banco.
4. Clique em **Enviar teste**.

O Mercado Pago fará um POST na sua URL. A API processa como um webhook real: busca o pagamento pelo `external_id`, marca como aprovado e atualiza a solicitação. Confira no banco (status do pagamento e da request) e nos logs da API.

**Resumo:** o “id” na simulação deve ser o **externalId** retornado ao criar o PIX (não o `id` interno da sua tabela `payments` e **não** o `requestId` da solicitação).

### Se a "Solicitação" aparecer vazia (`{}`), 403 ou 405

- **Corpo vazio:** no simulador, preencha o campo **Identificação (id)** com o **externalId** do pagamento (o ID que o Mercado Pago retornou ao criar o PIX). Sem isso o MP envia `{}` e a API não sabe qual pagamento atualizar.
- **Resposta 405 Method Not Allowed:** geralmente ocorre quando:
  1. **notification_url incorreta** — O MP envia o webhook para a URL enviada na criação do pagamento (não só a do painel). Se `MercadoPago__NotificationUrl` no `.env` for `https://renovejasaude.com.br/...` mas você está rodando localmente com ngrok, o webhook vai para produção e falha. **Solução:** defina `MercadoPago__NotificationUrl` com a URL do ngrok (ex.: `https://xxx.ngrok-free.dev/api/payments/webhook`).
  2. **URL incorreta** — use exatamente `https://SEU_DOMINIO/api/payments/webhook` (sem barra no final).
  3. **Proxy/CDN** bloqueando POST — verifique se o proxy/reverse proxy repassa requisições POST.
  4. **Trailing slash** — a API já faz rewrite interno de `/api/payments/webhook/` para `/api/payments/webhook`; mesmo assim, prefira configurar a URL sem barra final.
- **Resposta 403 Forbidden:** no plano gratuito do ngrok, requisições vindas de servidores (como o do Mercado Pago) podem ser bloqueadas antes de chegar à sua API — o ngrok retorna 403. Alternativas:
  1. Abrir a URL do webhook no navegador (ex.: `https://seu-subdomínio.ngrok-free.dev/api/payments/webhook`) e clicar em "Visit Site" uma vez; em alguns casos isso ajuda a liberar o túnel.
  2. Usar outro túnel (ex.: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps)) que não exija header especial.
  3. Fazer deploy em um ambiente com URL pública (ex.: Azure, AWS) e configurar essa URL no painel do MP.
