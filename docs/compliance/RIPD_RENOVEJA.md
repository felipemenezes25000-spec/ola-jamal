# RIPD — RELATÓRIO DE IMPACTO À PROTEÇÃO DE DADOS (LGPD)

**Empresa:** RenoveJá Saúde Ltda.  
**Sistema:** RenoveJá+ (telemedicina)  
**Versão:** 1.0  
**Data:** ____/____/2026

## 1. Objetivo

Avaliar riscos e medidas de mitigação do tratamento de dados pessoais, especialmente dados sensíveis de saúde, no contexto da plataforma RenoveJá+.

## 2. Escopo

- Cadastro e autenticação
- Teleconsulta (vídeo)
- Prontuário e documentos clínicos
- Assinatura digital de receitas/exames
- IA (leitura de receita, triagem de apoio, resumo clínico, anamnese assistida)
- Pagamentos
- Logs e auditoria

## 3. Dados tratados

- Dados pessoais: nome, e-mail, telefone, CPF, dados de conta
- Dados sensíveis: sintomas, CID, conduta, transcrições, imagens de receitas/exames
- Dados financeiros: transações de pagamento
- Dados técnicos: IP, logs, metadados de sessão

## 4. Bases legais

- Execução de contrato (art. 7º, V)
- Cumprimento de obrigação legal/regulatória
- Tutela da saúde (art. 11, II, f)
- Consentimento específico quando exigido

## 5. Fluxo e compartilhamento

- Supabase: armazenamento e processamento principal
- OpenAI: processamento de IA
- Deepgram: transcrição
- Daily.co: vídeo
- Mercado Pago: pagamentos

## 6. Transferência internacional

Há transferência internacional em operadores de IA/vídeo/transcrição. Mitigações:
- DPA e addendums LGPD
- minimização de dados
- segregação por finalidade
- revisão periódica contratual

## 7. Avaliação de risco (resumo)

### Risco 1: Exposição indevida de dados de saúde
- **Probabilidade:** média
- **Impacto:** alto
- **Mitigação:** criptografia, RLS, controle de acesso, logs, revisão de permissões

### Risco 2: Uso indevido de dados por operador externo
- **Probabilidade:** média
- **Impacto:** alto
- **Mitigação:** DPA/addendum, cláusulas de finalidade, auditoria contratual

### Risco 3: Vazamento por credenciais comprometidas
- **Probabilidade:** média
- **Impacto:** alto
- **Mitigação:** MFA, rotação de chaves, segredo em cofres, monitoramento

### Risco 4: Decisão automatizada sem supervisão humana
- **Probabilidade:** baixa/média
- **Impacto:** alto
- **Mitigação:** IA como apoio, decisão final médica, mensagens de disclaimer

## 8. Medidas técnicas e organizacionais

- Criptografia em trânsito e repouso
- Trilha de auditoria
- Controle de acesso por perfil
- Rate limiting
- Monitoramento de eventos de segurança
- Processo de resposta a incidentes
- Treinamento interno de equipe

## 9. Risco residual

Após controles implementados, risco residual classificado como **moderado**, com monitoramento contínuo e revisões trimestrais.

## 10. Plano de ação

- [ ] Concluir assinatura de todos os DPAs/addendums
- [ ] Formalizar ROPA e revisão periódica
- [ ] Simulado de incidente semestral
- [ ] Revisão anual do RIPD

## 11. Aprovações

Elaborado por: [PREENCHER]  
DPO/Encarregado: [PREENCHER]  
Aprovado por direção: [PREENCHER]  
Data: ____/____/2026
