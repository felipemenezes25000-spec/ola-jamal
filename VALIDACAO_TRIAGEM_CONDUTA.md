# Validação: Dra. Renova + Conduta + Observações

Comparação do projeto **renovejatac** com o guia e os arquivos de referência em `C:\Users\anabe\Downloads\files`.

---

## Resultado: **Tudo certinho**

O projeto está alinhado com o guia de implementação e com os arquivos da pasta `files`. Resumo abaixo.

---

## 1. Backend (.NET)

| Item | Status | Observação |
|------|--------|------------|
| Migration SQL | OK | `backend-dotnet/supabase/migrations/20260302_...sql` e `supabase/migrations/20260302000000_...sql` — mesmas colunas e comentários que em `files`. |
| Domain `MedicalRequest.cs` | OK | 7 propriedades (AutoObservation, DoctorConductNotes, IncludeConductInPdf, AiConductSuggestion, AiSuggestedExams, ConductUpdatedAt, ConductUpdatedBy) e métodos SetAutoObservation, UpdateConduct, SetAiConductSuggestion. |
| Persistence (Models + Repository) | OK | Mapeamento dos 7 campos. |
| DTOs | OK | RequestResponseDto com os 6 campos de conduta/observação; UpdateConductDto. |
| RequestService | OK | GenerateAutoObservation, chamadas em CreatePrescription/Exam/Consultation, UpdateConductAsync, MapToDto. |
| RequestsController | OK | `PUT {id}/conduct` (linha 662). |
| PDF | OK | PrescriptionPdfService com bloco observação + conduta antes do QR. |
| IA conduta | OK | IAiConductSuggestionService + OpenAiConductSuggestionService registrados. |

---

## 2. Frontend mobile — Infra

| Item | Status | Observação |
|------|--------|------------|
| `lib/triage/triage.types.ts` | OK | Tipos completos (TriageContext, TriageStep, TriageMessage, TriageInput, etc.). |
| `lib/triage/triageRulesEngine.ts` | OK | Motor de regras puro, BLOCKED_STEPS, regras home/prescription/exam/consultation/detail. |
| `lib/triage/triagePersistence.ts` | OK | Cooldown, mute, session counts (AsyncStorage). |
| `lib/triage/index.ts` | OK | Barrel export. |
| `components/triage/AssistantBanner.tsx` | OK | Banner compacto, CTA, long-press mute, disclaimer. |
| `components/triage/ObservationCard.tsx` | OK | Modos auto/conduct. |
| `components/triage/ConductSection.tsx` | OK | Conduta, sugestão IA, exames, toggle PDF, override observação. |
| `components/triage/index.ts` | OK | Exporta os 3 componentes. |
| `contexts/TriageAssistantProvider.tsx` | OK | Context + evaluate, dismiss, muteCurrent, clearScreen. |
| `hooks/useTriageEval.ts` | OK | Auto-avaliação por input, clearScreen no unfocus. |
| `types/database.ts` | OK | RequestResponseDto com os 6 campos (autoObservation, doctorConductNotes, includeConductInPdf, aiConductSuggestion, aiSuggestedExams, conductUpdatedAt). |
| `lib/api.ts` | OK | `updateConduct()`, `parseAiSuggestedExams()`, interface UpdateConductData. |
| `app/_layout.tsx` | OK | App envolvido com `<TriageAssistantProvider>`. |
| `__tests__/triageRulesEngine.test.ts` | OK | Testes do motor de regras. |

---

## 3. Integração nas telas

| Tela | useTriageEval | AssistantBanner | ObservationCard | ConductSection |
|------|----------------|----------------|------------------|----------------|
| Home (patient) | Sim (context: home) | Sim, com onAction | — | — |
| Request detail | Sim (context: detail) | Sim | Sim (auto + conduct) | — |
| Doctor editor | — | — | — | Sim |
| New request — Receita | Sim (prescription) | Sim, onAction consulta_breve | — | — |
| New request — Exame | Sim (exam) | Sim, onAction teleconsulta/consulta_breve | — | — |
| New request — Consulta | Sim (consultation) | Sim | — | — |

---

## 4. Legal

| Arquivo | Status | Conteúdo |
|---------|--------|----------|
| `app/terms.tsx` | OK | Seções 5, 5.1, 5.2 (IA, assistente de triagem, conduta e observações). |
| `app/privacy.tsx` | OK | Seção 3.1 (dados do assistente virtual e conduta médica). |

---

## 5. Migration SQL — diferença entre pastas

- **`files/20260302_triage_assistant_conduct_observation.sql`** e **`backend-dotnet/supabase/migrations/...`**: usam `auth.users(id)` em `conduct_updated_by`.
- **`supabase/migrations/20260302000000_...sql`**: usa `public.users(id)` e prefixo `public.` nas tabelas.

Use a migration que bater com seu schema no Supabase (auth.users vs public.users). Conteúdo das colunas e comentários está equivalente.

---

## 6. Feature flag

- `.env`: `EXPO_PUBLIC_TRIAGE_ENABLED=true` (ou false para desligar).
- Motor: não mostra mensagem em `payment` e `signing`; médico não vê triagem (`role === 'doctor'` → null).

---

## Checklist de aceite (guia PR4)

- [x] Banner nunca em payment/signing (BLOCKED_STEPS).
- [x] Máx. 1 mensagem por tela (dedupe + cooldown no provider/persistence).
- [x] Médico não vê mensagens de triagem (engine).
- [x] ObservationCard no detalhe do pedido.
- [x] ConductSection no editor do médico.
- [x] API PUT conduct e updateConduct no frontend.
- [x] Termos e privacidade atualizados.
- [x] useTriageEval + AssistantBanner em Home, request-detail, new-request (receita, exame, consulta).

---

**Conclusão:** A implementação no **renovejatac** está completa e consistente com o guia e com os arquivos em `C:\Users\anabe\Downloads\files`. Nenhuma alteração obrigatória identificada; a única decisão é qual migration SQL usar conforme o schema do Supabase (auth.users vs public.users).
