# ROPA — REGISTRO DAS OPERAÇÕES DE TRATAMENTO (LGPD)

**Empresa (Controladora):** RenoveJá Saúde Ltda.  
**CNPJ:** 14.376.070/0001-53  
**Versão:** 1.0  
**Data:** ____/____/2026

## 1. Cadastro e autenticação de usuários

- **Finalidade:** criação e gestão de conta
- **Dados:** nome, e-mail, telefone, CPF, senha hash
- **Categoria:** dados pessoais
- **Base legal:** execução de contrato (art. 7º, V)
- **Retenção:** enquanto conta ativa + prazos legais
- **Compartilhamento:** Supabase (infra)
- **Transferência internacional:** possível via operadores

## 2. Teleconsulta e prontuário

- **Finalidade:** prestação de serviço de saúde e continuidade assistencial
- **Dados:** anamnese, sintomas, conduta, CID, histórico clínico
- **Categoria:** dados pessoais sensíveis (saúde)
- **Base legal:** tutela da saúde (art. 11, II, f) e obrigação regulatória
- **Retenção:** conforme normativas aplicáveis ao prontuário médico
- **Compartilhamento:** médicos assistentes, infraestrutura de armazenamento

## 3. Receita e exame (emissão e assinatura)

- **Finalidade:** emitir documentos clínicos válidos
- **Dados:** dados do paciente, médico, medicamentos/exames, assinatura digital
- **Categoria:** sensíveis (saúde) + identificação
- **Base legal:** tutela da saúde + execução contratual
- **Compartilhamento:** farmácias/terceiros via verificação de autenticidade (mínimo necessário)

## 4. IA clínica/operacional

- **Finalidade:** apoio à leitura de documentos, estruturação de anamnese, resumo clínico
- **Dados:** texto clínico, imagens de receitas/exames, transcrições
- **Categoria:** sensíveis (saúde)
- **Base legal:** tutela da saúde + consentimento específico quando aplicável
- **Operadores:** OpenAI, Deepgram
- **Transferência internacional:** sim (avaliar Art. 33 LGPD + DPA/addendum)

## 5. Vídeo e comunicação

- **Finalidade:** realização de teleconsulta
- **Dados:** metadados de sessão, áudio/vídeo em tempo real, transcrição (quando habilitada)
- **Categoria:** sensíveis (saúde)
- **Base legal:** tutela da saúde / execução contratual
- **Operadores:** Daily.co

## 6. Pagamentos

- **Finalidade:** cobrança e conciliação
- **Dados:** identificadores de transação, valor, status, meio de pagamento
- **Categoria:** pessoais financeiros
- **Base legal:** execução contratual + obrigação legal/fiscal
- **Operadores:** Mercado Pago

## 7. Auditoria e segurança

- **Finalidade:** rastreabilidade, prevenção de fraude, compliance
- **Dados:** logs de acesso, IP, user-agent, ação, timestamps
- **Categoria:** pessoais técnicos
- **Base legal:** legítimo interesse + obrigação regulatória

## 8. Direitos dos titulares

Canal do titular: [PREENCHER E-MAIL/CANAL DPO]  
Prazos internos para resposta: [PREENCHER SLA]  
Fluxo de atendimento: recebimento → triagem → resposta → registro.

## 9. Inventário de operadores (resumo)

- Supabase (banco/storage)
- OpenAI (IA)
- Deepgram (transcrição)
- Daily.co (video)
- Mercado Pago (pagamentos)

## 10. Aprovação

Responsável interno LGPD: [PREENCHER]  
DPO/Encarregado: [PREENCHER]  
Data: ____/____/2026
