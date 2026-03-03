# Dra. Renova + Conduta — O que falta (opcional) e seus ganhos

## Pode faltar (opcional)

| Item | Situação | Prioridade |
|------|----------|------------|
| **Banner da Dra. Renova nos fluxos de nova solicitação** | Hoje o banner só aparece na **Home**. Nos fluxos "Nova receita", "Pedir exame" e "Consulta" não há mensagens por etapa (ex.: "Tire uma foto nítida da receita"). | Média — melhora a experiência durante o preenchimento. |
| **Audit log da conduta** | O backend grava `conduct_updated_at` e `conduct_updated_by`. Se o projeto já usa `IAuditService` para outros eventos, dá para registrar também "request.conduct_updated" para auditoria. | Baixa — rastreio já existe nos campos da tabela. |
| **Editor de exame com Conduta** | O **editor** atual (`doctor-request/editor/[id]`) é focado em **receita** (medicamentos, tipo). Se existir tela específica de “editor de exame”, vale replicar a **ConductSection** lá. | Só se houver tela separada de exame. |

Nada disso bloqueia o uso. O que está implementado já cobre: Home (banner), detalhe do pedido (observação + conduta), editor do médico (conduta + PDF), backend (IA, conduta, observação automática).

---

## Seus ganhos

### 1. Diferencial de produto (RenoveJá+)

- **Assistente com nome (Dra. Renova)**  
  Reforça a marca e passa a ideia de “app que orienta”, não só um formulário.

- **Mensagens certas na hora certa**  
  Ex.: primeira vez → “Bem-vindo”; muitas renovações → “Que tal uma consulta?”; receita controlada → aviso de retorno. Tudo sem assustar e sem linguagem diagnóstica.

- **Conduta no prontuário e no PDF**  
  O médico registra recomendações em um lugar só; o paciente vê no app e no documento assinado. Fica claro que “quem decide é o médico”.

### 2. Ganhos para o médico

- **Menos tempo por pedido**  
  Sugestão de conduta pela IA (usar/editar/ignorar) e exames sugeridos em chips reduzem tempo de digitação.

- **Observação automática**  
  Textos padrão (ex.: “Paciente orientado a manter retorno…”) já vêm preenchidos; o médico só ajusta se quiser.

- **Controle total**  
  Pode editar ou remover a observação automática e escolher se a conduta entra ou não no PDF. Decisão final sempre dele.

### 3. Ganhos para o paciente

- **Orientação clara**  
  Na home e no detalhe do pedido vê mensagens objetivas (retorno ao médico, levar resultados, etc.) e a conduta escrita pelo médico.

- **Documento completo**  
  O PDF assinado traz observação orientativa + conduta (quando o médico inclui), o que ajuda a lembrar o que fazer depois.

### 4. Compliance e risco

- **Termos e privacidade**  
  Cláusulas sobre IA, assistente virtual e conduta (5, 5.1, 5.2 e 3.1) alinham o produto à LGPD e ao Código de Ética.

- **Sem decisão automática da IA**  
  Tudo é “sugestão” e “auxílio”; a decisão final é sempre do médico. Reduz risco regulatório e de responsabilidade.

- **Rastreio no banco**  
  `conduct_updated_at` e `conduct_updated_by` permitem saber quem alterou a conduta e quando (auditoria e eventual demanda do CFM/ANVISA).

### 5. Ganhos técnicos / operação

- **Feature flag**  
  `triage_assistant_enabled` e `EXPO_PUBLIC_TRIAGE_ENABLED` permitem desligar a Dra. Renova sem novo deploy, se precisar.

- **Cooldown e mute**  
  Menos risco de o paciente achar que o app “enche a paciência”; mensagens respeitam limite por tela e mute permanente.

- **Base para evoluir**  
  Motor de regras, persistência e tipos já prontos para novas mensagens, novos contextos (ex.: pós-consulta) ou integração com mais dados (ex.: lembretes de retorno).

---

## Em uma frase

**Você ganha:** um diferencial de produto (assistente com nome, conduta no prontuário e no PDF), mais agilidade para o médico (sugestão de conduta e observações automáticas), mais clareza para o paciente (orientação e conduta visíveis) e melhor posição em relação a compliance e risco (termos, privacidade e “decisão sempre do médico”).
