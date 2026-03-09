# Checklist: Pagamentos, Publicidade Médica e IA

**Referências:** Bacen (via PSP), Receita/ISS, CFM/CRM, boas práticas de IA em saúde.

---

## 1. Pagamentos (Mercado Pago) e obrigações fiscais/contábeis

### 1.1 O que já existe

| Requisito | Status | Implementação |
|-----------|--------|----------------|
| **Contratos** | ⚠️ | Mercado Pago como PSP — contrato plataforma–MP; validar termos de uso MP |
| **Antifraude** | ✅ | Validação HMAC-SHA256 do webhook (`PaymentsController`, `PaymentService`) |
| **Conciliação** | ✅ | `webhook_events` — registro de webhooks, `mercado_pago_payment_id`, `payment_status`, idempotência |
| **Estorno** | ⚠️ | `Payment.Refund()` no domínio; fluxo de reembolso via MP a implementar/validar |
| **Chargeback** | ⚠️ | Política de contestação não documentada; MP gerencia disputas |

### 1.2 Lacunas

| Lacuna | Recomendação |
|--------|--------------|
| **Emissão fiscal / ISS** | Definir regime (NF-e, NFS-e) conforme município da prestação. Telemedicina: ISS do município do prestador ou do estabelecimento. Consultar contador. |
| **Política de estorno** | Documentar em Ajuda/Termos (ver `CHECKLIST_CDC_PROCON_CONTRATOS.md`). |
| **Política de contestação** | Documentar processo para chargeback: prazo para resposta, evidências (assinatura, prontuário), canal de contato. |
| **Reembolso via MP** | Validar se `PaymentService` ou fluxo administrativo chama API de reembolso do Mercado Pago. |

### 1.3 Arquivos de referência

- `backend-dotnet/src/RenoveJa.Application/Services/Payments/PaymentService.cs`
- `backend-dotnet/src/RenoveJa.Api/Controllers/PaymentsController.cs` — HMAC, webhook
- `supabase/migrations/20260221000002_incremental_features.sql` — `webhook_events`
- `docs/MERCADOPAGO.md`

---

## 2. Publicidade médica e comunicação (CFM/CRM)

**Órgãos:** CFM, CRMs estaduais. Risco alto de infração ética.

### 2.1 Regras de risco

| Risco | O que evitar | Status no projeto |
|-------|--------------|-------------------|
| Promessas de resultado | "Cura", "antes/depois", garantias | ⚠️ Revisar copy em marketing, landing, app |
| Especialidade sem RQE | Anunciar especialidade sem registro RQE | ⚠️ `doctor_profiles.specialty` — validar se exige RQE na listagem |
| Propaganda agressiva | Sensacionalismo, comparações | ⚠️ Revisar textos promocionais |
| Depoimentos de pacientes | Muito sensível; exige consentimento e cuidado | ⚠️ Se houver, documentar consentimento e limites |
| Mensagens automáticas "parecendo prescrição" | Copy de UX que sugira ato médico | ✅ Atenção: Dra. Renoveja não prescreve; guardrails bloqueiam termos |

### 2.2 Pontos de atenção no app

| Onde | Risco | Recomendação |
|------|-------|--------------|
| **Dra. Renoveja** | Mensagens do assistente | ✅ Guardrails bloqueiam "diagnóstico", "prescrevo", "indico", etc. |
| **ai_message_to_user** | Mensagem da IA de análise ao paciente | Revisar: nunca deve parecer prescrição ou diagnóstico. Ex.: "Sua receita foi analisada. O médico fará a avaliação." |
| **Observações automáticas no PDF** | Texto padrão em receitas | ✅ Médico pode editar/remover antes de assinar |
| **Landing / marketing** | Promessas, depoimentos | Revisar com olhar CFM/CRM |

### 2.3 Sugestão de checklist CFM

- [ ] Nenhum texto promete resultado ou cura
- [ ] Especialidades exibidas com base em dados reais (CRM, RQE quando exigido)
- [ ] Depoimentos: consentimento explícito, sem promessas de resultado
- [ ] Mensagens automáticas claramente identificadas como orientação, não ato médico

---

## 3. IA no fluxo: juridicamente defensável

### 3.1 O que já está implementado

| Princípio | Status | Onde |
|-----------|--------|------|
| **IA como apoio, nunca decisão final** | ✅ | Termos §5.3; `triage-ai-guardrails.md`; `OpenAiTriageEnrichmentService` |
| **Guardrails — termos proibidos** | ✅ | `OpenAiTriageEnrichmentService.ParseAndValidate` — bloqueia: diagnóstico, prescrevo, indico, você tem, recomendo tratamento, tome, inicie, etc. |
| **Guardrails — mensagens críticas** | ✅ | `NoEnrichKeys` — `rx:controlled`, `rx:high_risk`, `rx:ai_message`, `detail:conduct_available` nunca alteradas pela IA |
| **Fallback seguro** | ✅ | Timeout 4s (frontend) / 5s (backend); em erro, mensagem baseada em regras |
| **Pula enriquecimento** | ✅ | OpenAI não configurada → "pulando enriquecimento"; IA falha → mensagem original |
| **Consentimento + transparência** | ✅ | Termos e privacidade; checkbox no cadastro |
| **Recomendações ao paciente** | ✅ | IA não recomenda tratamento; apenas orienta uso do app |

### 3.2 Explicabilidade operacional

| Aspecto | Status | Recomendação |
|---------|--------|--------------|
| **Logs de prompt** | ⚠️ | Não há log estruturado de prompt/versão/resultado. Para auditoria: considerar log (com cuidado LGPD — sem dados sensíveis em texto livre). |
| **Versão do modelo** | ⚠️ | `gpt-4o` em config; não persistido por request. Considerar registrar `model` em `audit_logs` ou tabela de operações IA. |
| **Resultado da IA** | ⚠️ | `ai_summary_for_doctor`, `ai_extracted_json`, `ai_message_to_user` em `requests` — rastreável. Triagem: resultado do enriquecimento não persistido. |

### 3.3 Testes e validação

| Área | Status | Recomendação |
|------|--------|--------------|
| Triagem | ✅ | `triageRulesEngine.test.ts`; guardrails documentados |
| Leitura de documentos | ⚠️ | Testes unitários existem; considerar suite de validação com casos reais (ilegível, adulteração, tipo errado) |
| Enriquecimento | ⚠️ | Testes de regressão para termos proibidos |

### 3.4 Resumo IA

| Requisito | Situação |
|-----------|----------|
| IA como apoio | ✅ |
| Bloquear termos proibidos | ✅ |
| Bloquear recomendações ao paciente | ✅ |
| Fallback seguro | ✅ |
| Consentimento + transparência | ✅ |
| Explicabilidade (logs/versão) | ⚠️ Parcial |
| Testes/validação | ✅ Parcial |

---

## 4. Arquivos de referência

- `docs/triage-ai-guardrails.md` — Guardrails da Dra. Renoveja
- `backend-dotnet/src/RenoveJa.Infrastructure/AiReading/OpenAiTriageEnrichmentService.cs` — Termos proibidos, NoEnrichKeys
- `frontend-mobile/contexts/TriageAssistantProvider.tsx` — Enriquecimento, fallback
- `frontend-web/src/pages/Verify.tsx` — `GUARDRAIL_ALERT`
- `frontend-mobile/app/terms.tsx` — §5.1, §5.2, §5.3 (IA, limites)
- `docs/CHECKLIST_CDC_PROCON_CONTRATOS.md` — Política de estorno
