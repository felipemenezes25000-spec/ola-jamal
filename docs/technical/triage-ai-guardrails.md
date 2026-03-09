# Dra. Renova — Guardrails da IA

**Projeto:** RenoveJá+  
**Data:** 02/03/2026  
**Escopo:** Uso híbrido de IA no assistente de triagem

---

## Princípio fundamental

> **A IA NUNCA define nada. O médico SEMPRE decide.**

A Dra. Renova usa IA apenas para **auxiliar e orientar** — personalizar o tom das mensagens, tornar mais acolhedor. Nenhuma decisão clínica, diagnóstico ou prescrição é feita pela IA.

---

## Arquitetura híbrida

1. **Regras primeiro (sempre)**  
   O motor de regras (`triageRulesEngine.ts`) é determinístico, 100% testável e roda primeiro. Define o que mostrar e quando.

2. **IA opcional (enriquecimento)**  
   Após exibir a mensagem baseada em regras, uma chamada em background tenta personalizar o texto. Se falhar ou demorar, a mensagem original permanece.

3. **Fallback garantido**  
   Timeout de 4s no frontend, 5s no backend. Em qualquer erro, a mensagem baseada em regras é usada.

---

## Mensagens que NUNCA são alteradas pela IA

Chaves críticas — o texto vem exclusivamente das regras:

- `rx:controlled:*` — Receita controlada ou azul
- `rx:high_risk` — Risco alto sinalizado pela análise
- `rx:unreadable` — Foto ilegível
- `rx:ai_message` — Já é mensagem da IA de análise
- `exam:complex` — Exames complexos
- `exam:many` — Muitos exames
- `detail:conduct_available` — Conduta do médico (nunca modificar)

---

## Validação no backend

O `OpenAiTriageEnrichmentService` rejeita outputs que contenham:

- diagnóstico
- prescrevo
- indico
- você tem
- recomendo tratamento

Se a IA gerar qualquer um desses termos, o resultado é descartado e a mensagem original é mantida.

---

## Jurídico

- A IA **não pratica ato médico** — apenas orienta sobre uso do app.
- O médico tem **decisão final absoluta** em receitas, exames e condutas.
- Sugestões de conduta (em outro fluxo) são **sugestões** — o médico aceita, edita ou ignora.
- O disclaimer visível: *"Orientação geral · Não substitui avaliação médica · Decisão final é sempre do médico"*

---

## Feature flags

- `EXPO_PUBLIC_TRIAGE_ENABLED` — Habilita/desabilita o assistente (default: true)
- `EXPO_PUBLIC_TRIAGE_AI_ENABLED` — Habilita enriquecimento com IA (default: true)

Para desativar apenas a IA e manter as regras: `EXPO_PUBLIC_TRIAGE_AI_ENABLED=false`
