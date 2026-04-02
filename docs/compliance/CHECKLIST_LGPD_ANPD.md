# Checklist LGPD (ANPD) — Dados de saúde sensíveis

**Órgão:** ANPD (Autoridade Nacional de Proteção de Dados)  
**Contexto:** Dados de saúde são dados sensíveis (art. 5º, II, e art. 11 da LGPD).

---

## 1. Base legal por finalidade

| Finalidade | Base legal | Status |
|------------|------------|--------|
| Teleconsulta | Execução de contrato (art. 7º, V) + tutela da saúde (art. 11, II, f) | ✅ Documentado em `privacy.tsx` |
| Receita / exame | Execução de contrato + tutela da saúde | ✅ |
| Pagamento | Execução de contrato | ✅ |
| Prontuário | Obrigação legal/regulatória (CFM) | ✅ |
| Analytics (uso interno) | Legítimo interesse (art. 7º, IX) ou execução de contrato | ⚠️ Definir explicitamente |
| IA (triagem, leitura, transcrição) | Tutela da saúde + execução de contrato | ✅ Termos e privacidade mencionam |
| Marketing | Consentimento (art. 7º, I) | ✅ Política diz "não vendemos" |

**Recomendação:** Documentar explicitamente a base legal em cada fluxo (ex.: inventário de finalidades).

---

## 2. Inventário de dados

| Etapa | O que mapear | Status |
|-------|--------------|--------|
| Coleta | Quais dados, de onde, por qual canal | ⚠️ Parcial (privacidade descreve, mas não em formato inventário) |
| Uso | Finalidade por dado | ⚠️ |
| Compartilhamento | Com quem, para quê | ⚠️ Privacidade menciona "processadores"; não lista operadores |
| Retenção | Prazo por tipo de dado | ⚠️ Genérico ("tempo necessário" + CFM) |

**Recomendação:** Criar documento de inventário (ex.: `INVENTARIO_DADOS_PESSOAIS.md`) com: coleta → uso → compartilhamento → retenção por categoria.

---

## 3. Encarregado / DPO

| Requisito | Status | Implementação |
|-----------|--------|----------------|
| DPO nomeado | ⚠️ | Canal de contato em `COMPANY.fullContact`; não há menção explícita a "Encarregado" ou "DPO" |
| Canal de atendimento | ✅ | `privacy.tsx` e `COMPANY.fullContact` — (11) 98631-8000, www.renovejasaude.com.br |
| Registro na ANPD | — | Verificar se aplicável ao porte da empresa |

**Recomendação:** Incluir na Política de Privacidade: "O Encarregado de Proteção de Dados (DPO) pode ser contatado por {fullContact}".

---

## 4. Relatório de impacto (DPIA/RIPD)

| Requisito | Status | Observação |
|-----------|--------|------------|
| DPIA para dados sensíveis | ⚠️ | Recomendado pela ANPD para dados de saúde |
| DPIA para IA | ⚠️ | Recomendado quando IA processa dados sensíveis (imagens de receita, transcrições) |

**Recomendação:** Elaborar RIPD (Relatório de Impacto à Proteção de Dados) documentando:
- Dados sensíveis tratados (imagens, transcrições, prontuário)
- Riscos (vazamento, uso indevido, discriminação)
- Mitigações (criptografia, RLs, acesso mínimo)
- Uso de IA (OpenAI, Deepgram) e salvaguardas contratuais

---

## 5. Contratos com operadores

| Operador | Dados que processa | DPA / Contrato | Status |
|----------|--------------------|----------------|--------|
| **OpenAI** | Imagens de receita/exame, textos (triagem, anamnese) | [Adendo de Processamento de Dados](https://openai.com/pt-BR/policies/data-processing-addendum/) — vigente 01/2026; [Lista de subprocessadores](https://platform.openai.com/subprocessors) | ✅ DPA assinado (Data Processing Agreement RenoveJa and OpenAI) |
| **Deepgram** | Áudio/voz → transcrição em texto | Verificar DPA em deepgram.com | ⚠️ Verificar DPA, localização |
| **Daily.co** | Vídeo/áudio em tempo real (videoconsulta) | [DPA Daily.co](https://www.daily.co/legal/data-processing-addendum/) | ✅ DPA assinado (Online Personal Data Processing Agreement, Oct 2023) |
| **Mercado Pago** | Dados de pagamento (PIX, cartão) | [Termos e Condições para Desenvolvedores](https://www.mercadopago.com.br/developers/pt/docs/resources/legal/terms-and-conditions) — Cláusula 6 (LGPD, Operador, subprocessadores, incidentes) | ✅ Cláusulas LGPD incorporadas nos Termos; aceite ao usar a API |
| **AWS** | Dados de saúde, storage, banco | AWS DPA | ✅ DPA aceito nos ToS AWS |\n
**Recomendação:** Garantir contratos com:
- Cláusulas de proteção de dados (LGPD)
- Suboperadores (lista e obrigações)
- Local de processamento (Brasil preferencial para dados sensíveis)
- Retenção e exclusão
- Segurança (criptografia, acesso)

---

## 6. Políticas

| Política | Status | Onde |
|----------|--------|------|
| Privacidade | ✅ | `frontend-mobile/app/privacy.tsx` |
| Cookies (web) | ⚠️ | Não há política de cookies específica no frontend-web |
| Retenção/eliminação | ⚠️ | Genérico na privacidade ("tempo necessário" + CFM) |
| Resposta a incidente | ⚠️ | Não documentado |

**Recomendação:**
- **Cookies:** Se o site web usa cookies (ex.: analytics), publicar política de cookies e banner.
- **Retenção:** Documentar prazos por tipo (ex.: prontuário 20 anos; logs 5 anos; imagens X anos).
- **Incidente:** Documentar processo de notificação à ANPD e aos titulares (art. 48).

---

## 7. Segurança (técnica e organizacional)

| Medida | Status | Implementação |
|--------|--------|---------------|
| Criptografia em trânsito | ✅ | HTTPS (TLS) |
| Criptografia em repouso | ✅ | AWS RDS/S3 (Storage, DB); certificados PFX criptografados |
| Segregação de acesso | ✅ | Roles (patient, doctor, admin) no PostgreSQL/RDS (patient, doctor, admin) |
| Logging | ✅ | `audit_logs`, `prescription_verification_logs` |
| Mínimo privilégio | ✅ | RLS; service_role apenas para operações internas |
| Plano de resposta a incidentes | ⚠️ | Não documentado |
| Notificação de incidente | ⚠️ | Não documentado |

**Recomendação:** Documentar plano de resposta a incidentes (detecção, contenção, notificação ANPD/titulares, comunicação interna).

---

## 8. IA e dados sensíveis

| Aspecto | Status | Onde |
|---------|--------|------|
| IA "vê" imagens de receita | ✅ | `OpenAiReadingService` — imagens enviadas para GPT-4 Vision |
| IA processa transcrições | ✅ | `DeepgramTranscriptionService` + `ConsultationAnamnesisService` (OpenAI) |
| Consentimento explícito | ✅ | Termos e privacidade; checkbox no cadastro |
| Clareza na política | ⚠️ | Menciona "imagens e textos", "transcrição", "IA" — mas não lista operadores (OpenAI, Deepgram) |

**Recomendação:** Na Política de Privacidade, deixar explícito:
- Que imagens de receita/exame são enviadas a provedor de IA (OpenAI) para análise e triagem.
- Que o áudio da consulta é transcrito por provedor externo (Deepgram) e o texto pode ser processado por IA para anamnese.
- Que a sessão de vídeo poderá ser gravada para segurança e auditoria, com armazenamento seguro e acesso restrito. O texto da transcrição e os dados estruturados são armazenados no prontuário.
- Que esses provedores são tratados como operadores com obrigações de confidencialidade e proteção.

---

## 9. Resumo executivo

| Área | Situação | Ação prioritária |
|------|----------|-----------------|
| Base legal | ✅ Parcial | Documentar analytics e IA |
| Inventário | ⚠️ | Criar inventário coleta → uso → compartilhamento → retenção |
| DPO | ⚠️ | Nomear e incluir na política |
| DPIA/RIPD | ⚠️ | Elaborar para dados sensíveis + IA |
| Contratos operadores | ⚠️ | Validar DPA com OpenAI, Deepgram, Daily.co, Mercado Pago, AWS |
| Políticas | ✅ Parcial | Cookies (web); retenção detalhada; resposta a incidente |
| Segurança | ✅ | Plano de incidente e notificação |
| IA e consentimento | ✅ Parcial | Clareza sobre operadores e fluxo |

---

## 10. Arquivos de referência

- `frontend-mobile/app/privacy.tsx` — Política de Privacidade
- `frontend-mobile/app/terms.tsx` — Termos de Uso (IA, transcrição)
- `frontend-mobile/lib/company.ts` — Dados do controlador
- `frontend-mobile/app/(auth)/register.tsx` — Consentimento no cadastro
- `backend-dotnet/src/RenoveJa.Infrastructure/AiReading/OpenAiReadingService.cs` — IA para imagens
- `backend-dotnet/src/RenoveJa.Infrastructure/Transcription/DeepgramTranscriptionService.cs` — Transcrição
- `backend-dotnet/src/RenoveJa.Infrastructure/Data/Postgres/MigrationRunner.cs` — RLS, audit_logs
