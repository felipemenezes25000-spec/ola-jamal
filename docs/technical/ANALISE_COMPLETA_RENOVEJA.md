# Análise Completa — RenoveJá+

> Branch: `fix/frontend-performance-responsive`  
> Última atualização: 2026-03-13

## Visão Geral do Repositório

Monorepo de telemedicina com 4 módulos principais:

| Módulo | Stack | Arquivos | Linhas |
|--------|-------|----------|--------|
| frontend-mobile | Expo 54 / React Native 0.81 / TypeScript | 259 | ~47k |
| backend-dotnet | .NET 8 / Clean Architecture | 321 (.cs) | ~45k |
| frontend-web | Vite + React + TS | 139 | ~19k |

**Total:** ~111k linhas de código de produção.

---

## Arquitetura Backend (.NET 8 — Clean Architecture)

Organização em camadas: Domain → Application → Infrastructure → API.

### Pontos de destaque

- **RequestService.cs** (~2.900 linhas) — "God Service" que orquestra receitas, exames, consultas, aprovações, rejeições, assinatura digital e salas de vídeo. Injeta ~27 dependências via primary constructor.
- **RequestStatus** — 17 estados (11 canônicos + 6 legados `[Obsolete]`), fluxos distintos para prescription/exam vs consultation.
- **Integrações:** MercadoPago (PIX + cartão), Daily.co (video), OpenAI (Whisper + GPT-4o), ICP-Brasil (iText7/BouncyCastle), PubMed, RxNorm, SignalR (RequestsHub + VideoSignalingHub).

---

## Arquitetura Frontend Mobile (Expo/React Native)

- **app/** — rotas Expo Router
- **components/** — UI reutilizável
- **contexts/** — Auth, Notifications, etc.
- **hooks/** — lógica reutilizável
- **lib/** — domínio, API, triage, validação, UI

### Design System v3

- `createTokens(role, scheme)` — paleta Tailwind, WCAG AA, light/dark, patient/doctor.
- Single source of truth em `designSystem.ts`.

### Dra. Renoveja (Triage Engine)

- `triageRulesEngine.ts` (~775 linhas)
- Cooldown dinâmico, blocked steps (payment/signing), companion fallbacks.

### Video (Daily.co)

- `VideoCallScreenInner.tsx` (~868 linhas)
- PiP Android, painel anamnese IA, transcrição Deepgram, SignalR.

---

## Pontos Fortes

- **Qualidade:** 26 test files, Zod, normalizers, design system, acessibilidade.
- **CI:** GitHub Actions — typecheck + lint + test + build em todos os módulos.
- **Domain-driven:** `lib/domain/` com requestUiModel, requestGuards, getRequestUiState.
- **Infra:** AWS (backend + frontend-web), AWS S3.
- **Docs:** debug, fluxo receita, assinatura PAdES, MercadoPago, variáveis de ambiente.

---

## Problemas e Riscos Identificados

| # | Problema | Severidade |
|---|----------|------------|
| 1 | **God Service** — RequestService.cs com 2.900 linhas e ~27 dependências | Alta |
| 2 | **Telas grandes** — record.tsx (1.153), editor/[id].tsx (990), request-detail (973), register (875) | Média |
| 3 | **API (AWS)** — timeout e cold start conforme configuração ECS/ALB | Média |
| 4 | **react-native-background-timer** — histórico de conflitos com New Architecture RN 0.81 | Baixa |
| 5 | **Sem testes de integração** — apenas unitários (ComplementaryTests, ServiceTests) | Média |
| 6 | **Expo SDK 54 + RN 0.81 + React 19** — stack atualizada; Nativewind v4 relativamente novo | Baixa |

---

## Artefatos Removidos (limpeza)

- `_patch22_temp/` — diretório temporário de patches
- `*.patch` e `*.zip` na raiz — workflow de patch manual

> Já incluídos em `.gitignore`: `/*.patch`, `/*.zip`, `/_patch22_temp/`
