# Inventário de dados pessoais (LGPD)

**Referência:** LGPD art. 37, ANPD. Mapeamento coleta → uso → compartilhamento → retenção.

---

## 1. Dados de identificação e cadastro

| Dado | Coleta | Uso | Compartilhamento | Retenção |
|------|--------|-----|------------------|----------|
| Nome | Cadastro (app) | Identificação, prontuário, documentos | Médico que atende; operadores (Supabase) | Enquanto conta ativa + 5 anos após exclusão (defesa) |
| E-mail | Cadastro, login | Autenticação, notificações, recuperação de senha | Operadores (Supabase, Render); não vendido | Idem |
| Telefone | Cadastro | Contato, 2FA, WhatsApp | Operadores; WhatsApp (envio de documento) | Idem |
| CPF | Cadastro | Identificação, emissão fiscal | Operadores; médico (no documento assinado); Receita se exigido | Idem |
| Data de nascimento | Cadastro | Idade, prontuário | Médico; operadores | Idem |
| Endereço | Cadastro | Documentos médicos, entrega | Médico (no PDF); operadores | Idem |
| Senha (hash) | Cadastro | Autenticação | Não compartilhado; armazenado criptografado | Idem |

---

## 2. Dados sensíveis de saúde

| Dado | Coleta | Uso | Compartilhamento | Retenção |
|------|--------|-----|------------------|----------|
| Imagens de receita/exame | Upload (app) | Análise por IA, avaliação médica, prontuário | OpenAI (análise); médico; Supabase Storage | Prontuário: 20 anos (CFM) |
| Textos (sintomas, medicamentos) | Formulário (app) | Avaliação médica, prontuário | Médico; operadores | Idem |
| Transcrição da consulta | Videoconsulta (Deepgram) | Anamnese, prontuário | Deepgram (transcrição); OpenAI (estruturação); médico | Idem |
| Conduta médica | Registro do médico | Prontuário, PDF | Paciente; médico; operadores | Idem |
| Anamnese estruturada | IA + médico | Prontuário | Médico; operadores | Idem |

---

## 3. Dados de pagamento

| Dado | Coleta | Uso | Compartilhamento | Retenção |
|------|--------|-----|------------------|----------|
| Valor, método, status | Checkout (Mercado Pago) | Processamento, conciliação | Mercado Pago (PSP); operadores | 5 anos (fiscal) |
| Dados de cartão | Mercado Pago (não transitam pelo app) | Pagamento | Apenas Mercado Pago | Conforme MP |

---

## 4. Dados de interação

| Dado | Coleta | Uso | Compartilhamento | Retenção |
|------|--------|-----|------------------|----------|
| Mensagens Dra. Renoveja | Uso do app | Triagem, melhoria | OpenAI (enriquecimento opcional); operadores | 2 anos (analytics) |
| Logs de auditoria | Automático | LGPD, segurança | Apenas interno (service_role) | 5 anos |
| Logs de verificação (QR) | Verificação pública | Segurança, antifraude | Apenas interno | 2 anos |

---

## 5. Dados de médicos

| Dado | Coleta | Uso | Compartilhamento | Retenção |
|------|--------|-----|------------------|----------|
| CRM, UF, especialidade | Cadastro | Validação, documentos | Paciente (no PDF); InfoSimples (validação CRM); operadores | Enquanto conta ativa |
| Certificado PFX | Upload | Assinatura digital | Armazenado criptografado; não compartilhado | Até revogação + 1 ano |
| Bio, foto | Cadastro | Perfil, listagem | Paciente; operadores | Idem |

---

## 6. Resumo de operadores

| Operador | Dados | Finalidade | Localização | DPA |
|----------|-------|------------|-------------|-----|
| Supabase | DB, Storage, Auth | Infraestrutura | EUA (Supabase Cloud) | DPA assinado ✅ |
| Render | API, processamento | Backend | EUA | Termos Render |
| OpenAI | Imagens, textos | IA triagem, anamnese | EUA | DPA assinado ✅ |
| Deepgram | Áudio | Transcrição | EUA | Verificar deepgram.com |
| Daily.co | Vídeo/áudio tempo real | Videoconsulta | EUA | DPA assinado ✅ |
| Mercado Pago | Pagamento | PSP | Brasil | Termos Desenvolvedores Cl. 6 (LGPD) ✅ |
| Vercel (se aplicável) | Frontend web | Hospedagem | EUA | Termos Vercel |

---

## 7. Prazos de retenção consolidados

| Categoria | Prazo | Base |
|-----------|-------|------|
| Prontuário | 20 anos | CFM, legislação |
| Pagamentos | 5 anos | Obrigação fiscal |
| Audit logs | 5 anos | LGPD, defesa |
| Dados de conta | Enquanto ativa + 5 anos | Defesa, LGPD |
| Logs de verificação | 2 anos | Segurança |
| Analytics/IA (agregado) | 2 anos | Melhoria do serviço |
