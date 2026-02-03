# DECISÕES ARQUITETURAIS - RENOVEJA BACKEND .NET

## Data: 2026-02-02
## Versão: 1.0

---

## 1. DECISÕES DE ARQUITETURA

### 1.1 Clean Architecture + DDD
**Decisão:** Implementar Clean Architecture com Domain-Driven Design.

**Justificativa:**
- Separação clara de responsabilidades
- Domínio independente de infraestrutura
- Testabilidade alta
- Manutenibilidade a longo prazo

**Camadas:**
- **Domain:** Entidades, Value Objects, Interfaces de Repositório, Exceptions
- **Application:** DTOs, Services (Use Cases), Validators, Mappers
- **Infrastructure:** Implementações de Repositórios (Supabase), Serviços Externos
- **API:** Controllers, Middleware, Authentication

### 1.2 Supabase como Data Backend
**Decisão:** Manter Supabase usando PostgREST API via HTTP Client.

**Justificativa:**
- Compatibilidade com backend Python existente
- Não requer string de conexão Postgres direta
- Usa SUPABASE_URL e SUPABASE_SERVICE_KEY
- RLS (Row Level Security) do Supabase preservado
- Mesma filosofia do backend atual

**Implementação:**
- HttpClient com retry policies
- Modelos de persistência separados do domínio
- Mappers Domain <-> PersistenceModel

### 1.3 Autenticação Custom via Bearer Token
**Decisão:** Autenticação personalizada consultando tabela `auth_tokens`.

**Justificativa:**
- Compatibilidade total com sistema atual
- Mesma lógica do Python/FastAPI
- Não usar JWT inicialmente (manter paridade)
- Tokens armazenados no banco

**Implementação:**
- AuthenticationHandler custom do ASP.NET Core
- Consulta `auth_tokens` para validar
- Popula Claims: userId e role
- Middleware de autorização por role

### 1.4 BCrypt para Senhas
**Decisão:** Usar BCrypt.Net-Next para hashing de senhas.

**Justificativa:**
- Compatibilidade com bcrypt do Python
- Hashes gerados são interoperáveis
- Permite migração gradual

### 1.5 FluentValidation
**Decisão:** Validação de DTOs com FluentValidation.

**Justificativa:**
- Validação declarativa e legível
- Separação de lógica de validação
- Fácil teste unitário

---

## 2. DECISÕES DE DESIGN PATTERNS

### 2.1 Repository Pattern
**Decisão:** Interfaces no Domain, Implementações na Infrastructure.

**Implementação:**
- IUserRepository, IDoctorRepository, etc. em Domain
- Implementações concretas em Infrastructure
- Métodos assíncronos (async/await)

### 2.2 Service Layer (Application Services)
**Decisão:** Services orquestram casos de uso, não lógica de domínio pura.

**Exemplos:**
- AuthService: orquestra login, registro, validação de token
- RequestService: orquestra criação de solicitações, aprovações, assinatura
- PaymentService: orquestra criação de pagamento, webhook, confirmação

### 2.3 Domain Services
**Decisão:** Não implementados inicialmente (casos de uso simples cabem em Application Services).

**Futuramente:** 
- Se houver regras de negócio complexas que envolvem múltiplas entidades
- Exemplo: CalcularPrecoConsulta, AtribuirMedicoAutomatico

### 2.4 Mappers
**Decisão:** Mappers manuais (sem AutoMapper inicialmente).

**Justificativa:**
- Mais controle e explícito
- Menos "mágica"
- Fácil debug
- Pode ser refatorado para AutoMapper depois

---

## 3. DECISÕES DE TECNOLOGIA

### 3.1 Stack Principal
- .NET 8 (LTS)
- ASP.NET Core Web API
- C# 12
- Nullable reference types habilitado

### 3.2 Bibliotecas
- **BCrypt.Net-Next 4.0.3:** Hash de senhas
- **FluentValidation 11.9.0:** Validação de DTOs
- **xUnit:** Testes unitários
- **FluentAssertions (opcional):** Assertions legíveis
- **Serilog (futuro):** Logging estruturado
- **Polly (futuro):** Retry e circuit breaker para HTTP

### 3.3 Supabase Client
**Decisão:** HttpClient customizado com JSON serialization.

**Implementação:**
- BaseUrl: SUPABASE_URL + /rest/v1
- Header: apikey (SUPABASE_SERVICE_KEY)
- Header: Authorization (Bearer SUPABASE_SERVICE_KEY)
- Content-Type: application/json
- Prefer: return=representation (para POST/PATCH)

---

## 4. DECISÕES DE ESTRUTURA DE DADOS

### 4.1 Enums vs Strings no Banco
**Decisão:** Banco usa strings (compatibilidade), Domain usa Enums.

**Implementação:**
- RequestStatus enum no Domain
- Banco armazena "submitted", "in_review", etc.
- Mappers convertem string <-> Enum

### 4.2 JSONB no Banco
**Decisão:** Campos JSONB (medications, exams, data) mapeados para List<string> ou Dictionary.

**Implementação:**
- Serialização/Deserialização em Repository
- Domain trabalha com tipos .NET nativos

### 4.3 Value Objects
**Decisão:** Usar VOs para Email, Phone, Money.

**Justificativa:**
- Validação no constructor
- Imutabilidade
- Lógica de negócio encapsulada

---

## 5. DECISÕES DE SEGURANÇA

### 5.1 Variáveis de Ambiente
**Obrigatório:**
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- MERCADOPAGO_ACCESS_TOKEN
- JWT_SECRET (futuro, se migrar para JWT)

**Implementação:**
- appsettings.json (não commitado)
- Environment variables
- User Secrets no desenvolvimento

### 5.2 Senhas
- Nunca logadas
- Sempre hash BCrypt
- Mínimo 8 caracteres (validação)

### 5.3 Authorization
- Endpoints protegidos com [Authorize]
- Roles: "patient", "doctor"
- Policy-based authorization onde necessário

---

## 6. DECISÕES DE COMPATIBILIDADE

### 6.1 Rotas
**Decisão:** Manter mesmas rotas do FastAPI.

**Exemplos:**
- /api/health
- /api/auth/register
- /api/requests/prescription
- /api/payments

### 6.2 Payloads JSON
**Decisão:** Manter mesmos nomes de campos (snake_case no JSON, PascalCase no C#).

**Implementação:**
- JsonNamingPolicy = JsonNamingPolicy.CamelCase (ou custom)
- DTOs mapeiam exatamente os mesmos campos

### 6.3 Status Codes
- 200 OK: sucesso
- 201 Created: criação
- 400 Bad Request: validação falhou
- 401 Unauthorized: não autenticado
- 403 Forbidden: não autorizado
- 404 Not Found: recurso não encontrado
- 500 Internal Server Error: erro inesperado

---

## 7. DECISÕES DE TESTES

### 7.1 Testes Unitários
**Obrigatórios:**
- AuthService: Register, Login, Token Validation
- RequestService: Create, Approve, Reject
- PaymentService: Create, Webhook, Confirm

**Framework:** xUnit + FluentAssertions

### 7.2 Testes de Integração (futuro)
- Testar com Supabase real ou mock
- WebApplicationFactory

---

## 8. DECISÕES DE LOGGING E OBSERVABILIDADE

### 8.1 Logging Estruturado
**Futuramente:** Serilog com sinks para console e file.

**Formato:**
- Timestamp
- Level
- CorrelationId
- Message
- Exception (se houver)

### 8.2 Correlation ID
**Decisão:** Middleware para adicionar correlation ID a cada request.

**Implementação:**
- Header: X-Correlation-Id
- Propagado em todos os logs
- Retornado no response

---

## 9. DECISÕES DE INTEGRAÇÕES

### 9.1 MercadoPago
**Decisão:** Usar SDK oficial .NET do MercadoPago.

**Implementação:**
- Service: MercadoPagoService
- Métodos: CreatePayment, GetPayment, ProcessWebhook

### 9.2 PDF Generator
**Decisão:** Usar QuestPDF ou iTextSharp.

**Implementação:**
- Service: PdfGeneratorService
- Gerar receitas e exames assinados

### 9.3 Push Notifications
**Decisão:** Usar FCM (Firebase Cloud Messaging) ou Expo Push.

**Implementação:**
- Service: PushNotificationService
- Enviar notificações para dispositivos móveis

### 9.4 Video Service
**Decisão:** Mock inicialmente, depois integrar com Jitsi/Whereby/Agora.

---

## 10. DECISÕES DE DEPLOYMENT

### 10.1 Docker
**Futuro:** Dockerfile para containerização.

### 10.2 Ambientes
- Development: appsettings.Development.json
- Production: appsettings.Production.json

---

## 11. PRÓXIMAS DECISÕES (A TOMAR)

### 11.1 Migração para JWT?
**Quando:** Após validação de paridade.
**Motivo:** JWT é stateless, melhor para escala.

### 11.2 CQRS?
**Quando:** Se houver necessidade de separar leitura/escrita.
**Motivo:** Mais complexidade, só se necessário.

### 11.3 Event Sourcing?
**Quando:** Nunca para este projeto (overkill).

### 11.4 GraphQL?
**Quando:** Se frontend precisar.

---

## 12. TRADE-OFFS ACEITOS

### 12.1 Supabase via HTTP vs Postgres Direto
**Trade-off:** Latência um pouco maior, mas maior compatibilidade.

### 12.2 Mappers Manuais vs AutoMapper
**Trade-off:** Mais código, mas mais explícito.

### 12.3 Token em DB vs JWT
**Trade-off:** Consulta extra ao DB, mas maior controle.

---

## 13. MÉTRICAS DE SUCESSO

### 13.1 Paridade Funcional
- [ ] Todos os endpoints funcionando
- [ ] Mesmos payloads
- [ ] Mesmas validações
- [ ] Mesmas regras de negócio

### 13.2 Qualidade de Código
- [ ] Cobertura de testes > 70%
- [ ] Build sem warnings
- [ ] Documentação completa

### 13.3 Performance
- [ ] Tempo de resposta < 200ms (P95)
- [ ] Throughput adequado

---

**Autor:** Claude - Arquiteto .NET + DDD  
**Revisão:** v1.0  
**Status:** Documento Vivo (atualizar conforme evolução)
