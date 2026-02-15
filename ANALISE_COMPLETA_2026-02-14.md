# Análise Completa - RenoveJá (Backend + Frontend)

**Data:** 14/02/2026 | **Backend:** 143 .cs | **Frontend:** 37 .ts/.tsx | **Endpoints:** 57

---

## RESUMO EXECUTIVO

O projeto evoluiu bem desde a última análise (13/02). Vários itens críticos foram corrigidos:
- ✅ Chave de criptografia agora vem do appsettings (não mais hardcoded)
- ✅ Webhook do MP agora valida HMAC-SHA256
- ✅ Daily.co integrado no fluxo de consulta
- ✅ Fluxo PDF → assinatura digital integrado no RequestService
- ✅ AccessCode implementado nas receitas
- ✅ Migrations SQL existem em docs/migrations/
- ✅ Dockerfile e docker-compose existem
- ✅ Cache em IMemoryCache (specialties, integrations)
- ✅ appsettings.Development.json no .gitignore
- ✅ Frontend mobile criado (Expo React Native, 24 telas)

**O que ainda precisa pra produção:**

---

## 🔴 CRÍTICO (bloqueia produção)

### 1. CORS ainda AllowAnyOrigin como default
- **Onde:** `Program.cs:151`
- O campo `Cors.AllowedOrigins` existe no appsettings mas a policy default ainda é `AllowAnyOrigin`
- **Fix:** Trocar a policy default pra usar as origins do config
- **Esforço:** 15 min

### 2. Credenciais reais no appsettings.Development.json (AINDA commitado)
- O .gitignore agora tem a entrada, mas o arquivo **já foi commitado antes** — ele continua no histórico do git
- Credenciais expostas: SMTP password, OpenAI key, Supabase service key, MP access token, InfoSimples token, Daily.co key
- **Fix:** `git rm --cached appsettings.Development.json` + rotacionar TODAS as chaves
- **Esforço:** 2 horas (incluindo rotação)

### 3. Frontend sem tela de certificado digital (médico)
- O backend tem endpoints completos pra upload/validação/revogação de certificados digitais ICP-Brasil
- O frontend **não tem nenhuma tela** pra isso — médicos não conseguem fazer upload do PFX
- Sem certificado, médico não pode assinar receitas → fluxo principal bloqueado
- **Fix:** Criar tela de upload de certificado no perfil do médico
- **Esforço:** 4 horas

### 4. Frontend sem Google Auth implementado na UI
- O `AuthContext` tem a função `googleAuth` pronta
- Mas a tela de login **não tem botão de "Entrar com Google"**
- **Fix:** Adicionar botão + expo-auth-session com Google
- **Esforço:** 3 horas

### 5. CI/CD inexistente
- Sem GitHub Actions, sem pipeline, sem deploy automatizado
- **Fix:** Criar workflow básico (build + test + docker push)
- **Esforço:** 3 horas

---

## 🟡 IMPORTANTE (pós-MVP mas necessário)

### 6. Testes unitários insuficientes
- 5 arquivos de teste (cobertura ~5%)
- Áreas sem cobertura: PaymentService, RequestService, CertificateService, todos os validators
- **Esforço:** 2-3 dias

### 7. Frontend sem tela de verificação de receita
- O backend tem endpoint público `GET /api/verify/{id}` + página HTML renderizada
- O farmacêutico usa via QR Code no browser, não no app — **pode ser OK assim**
- Mas seria bom ter uma tela no app pra o paciente ver o status da verificação

### 8. Frontend sem "cancel-registration"
- Backend tem `POST /api/auth/cancel-registration` (rollback de cadastro incompleto via Google)
- Frontend não implementa — usuário fica preso se desistir no meio do complete-profile
- **Esforço:** 1 hora

### 9. N+1 no DoctorService.GetDoctorsAsync
- Ainda faz query individual por médico em loop
- **Esforço:** 2 horas

### 10. Rate limiting em endpoints públicos
- `/api/verify` e `/api/specialties` sem rate limit específico
- **Esforço:** 1 hora

### 11. Frontend — estados de erro mais robustos
- Telas de erro genéricas (Alert) — poderia ter telas de erro bonitas, retry buttons
- Sem offline state handling
- **Esforço:** 1 dia

### 12. Frontend — sem pull-to-refresh em todas as telas
- Algumas telas têm, outras não (doctor requests, notifications)
- **Esforço:** 2 horas

---

## 🟢 NICE TO HAVE

### 13. Logs estruturados (Serilog)
- Backend usa Console.WriteLine em catches — deveria usar structured logging
- **Esforço:** 3 horas

### 14. Swagger com exemplos de request/response
- Swagger existe mas sem exemplos detalhados
- **Esforço:** 2 horas

### 15. Frontend — animações e transições
- Layout básico funcional mas sem animações de entrada/saída
- React Native Reanimated instalado mas não usado
- **Esforço:** 1 dia

### 16. Frontend — dark mode
- Só tem light mode
- **Esforço:** 1 dia

### 17. Frontend — internacionalização
- Strings hardcoded em PT-BR (ok pra MVP, mas não escalável)
- **Esforço:** 2 dias

### 18. README.md no root do projeto
- Não existe — projeto sem documentação de setup
- **Esforço:** 1 hora

---

## INVENTÁRIO DE TELAS (Frontend)

| Tela | Status | Notas |
|------|--------|-------|
| Splash Screen | ✅ | Logo + gradiente azul |
| Login | ✅ | Email + senha (falta Google) |
| Cadastro | ✅ | Paciente + médico |
| Esqueci Senha | ✅ | Email para reset |
| Home Paciente | ✅ | Cards de serviços + recentes |
| Nova Receita | ✅ | Tipo + upload + medicamentos |
| Novo Exame | ✅ | Upload + tipo + sintomas |
| Nova Consulta | ✅ | Sintomas + busca médico |
| Minhas Solicitações | ✅ | Lista com filtros |
| Detalhe Solicitação | ✅ | Timeline + info + ações |
| Pagamento PIX | ✅ | QR code + copia e cola |
| Video Call | ✅ | WebView com sala |
| Perfil Paciente | ✅ | Editar dados |
| Notificações | ✅ | Lista + mark read |
| Dashboard Médico | ✅ | Stats + recentes |
| Solicitações Médico | ✅ | Filtros + aceitar |
| Revisar Solicitação | ✅ | Aprovar/rejeitar/assinar |
| Perfil Médico | ✅ | CRM, especialidade, disponibilidade |
| Settings | ✅ | Push toggle, logout |
| **Upload Certificado** | ❌ | **NÃO EXISTE — bloqueia assinatura** |
| **Complete Profile** | ❌ | **Falta tela pós-Google Auth** |
| **Botão Google Login** | ❌ | **Falta na tela de login** |

---

## SINCRONIA BACKEND ↔ FRONTEND

| Endpoint | Backend | Frontend |
|----------|---------|----------|
| Auth (login/register) | ✅ | ✅ |
| Auth Google | ✅ | ❌ UI falta |
| Auth complete-profile | ✅ | ❌ UI falta |
| Auth cancel-registration | ✅ | ❌ |
| Requests CRUD | ✅ | ✅ |
| Requests approve/reject/sign | ✅ | ✅ |
| Requests reanalyze | ✅ | ✅ (api.ts) |
| Requests generate-pdf | ✅ | ✅ (api.ts) |
| Payments PIX | ✅ | ✅ |
| Notifications | ✅ | ✅ |
| Doctors list/availability | ✅ | ✅ |
| Doctors validate-crm | ✅ | ✅ (api.ts) |
| Push tokens | ✅ | ✅ |
| Video rooms | ✅ | ✅ |
| Certificates upload/validate | ✅ | ❌ **FALTA** |
| Specialties | ✅ | ✅ |
| Verification (público) | ✅ | N/A (browser) |

---

## PRIORIDADES ATUALIZADAS

### Sprint 1 — Antes de produção (~2 dias)
1. ~~Chave criptografia~~ ✅ Feito
2. CORS restritivo (15 min)
3. Limpar credenciais do histórico git + rotacionar chaves (2h)
4. **Tela de certificado digital no frontend** (4h)
5. **Botão Google Login + tela complete-profile** (4h)
6. CI/CD básico (3h)

### Sprint 2 — Pós-MVP (~1 semana)
7. Testes unitários (2-3 dias)
8. Fix N+1 DoctorService (2h)
9. Rate limiting em endpoints públicos (1h)
10. Estados de erro + retry no frontend (1 dia)
11. Cancel-registration no frontend (1h)

### Sprint 3 — Polimento
12. Animações com Reanimated (1 dia)
13. Logs estruturados Serilog (3h)
14. README.md do projeto (1h)
15. Dark mode (1 dia)
