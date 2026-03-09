# Checklist CDC / Procon / Contratos

**Referências:** Código de Defesa do Consumidor (CDC), Procon, Judiciário, Ministério Público.

---

## 1. Termos de Uso — papéis e responsabilidades

### 1.1 O que já existe

| Papel | Responsabilidade | Onde |
|-------|------------------|------|
| **Plataforma** | Meio tecnológico, funcionamento do app | Termos §5 — "responsável pelo meio tecnológico e pelo funcionamento da plataforma" |
| **Prestador (médico)** | Conteúdo clínico, condutas médicas, decisão de encaminhar ao presencial | Termos §5 — "responsabilidade exclusiva do profissional que realiza o atendimento" |
| **Paciente** | Veracidade das informações, sigilo da senha | Termos §5 |

| Definição | Termos §3 |
|-----------|-----------|
| Plataforma | Ambiente digital RenoveJá+ ({COMPANY.name}) |
| Usuários | Pacientes e médicos cadastrados |
| Serviços | Telemedicina por profissionais com registro CFM |
| Intermediação | "A plataforma atua como intermediária entre usuários e profissionais de saúde" |

### 1.2 Lacunas recomendadas

| Lacuna | Recomendação |
|--------|--------------|
| **Vínculo médico–plataforma** | Deixar explícito se há contrato de prestação de serviços entre plataforma e médico (autônomo, PJ, etc.). |
| **Cessão de dados** | Confirmar que o paciente autoriza a plataforma a compartilhar dados necessários com o médico que realizará o atendimento. |
| **Foro** | ✅ Já eleito: comarca de São Paulo/SP (Termos §10) |

---

## 2. Política de cancelamento e reembolso

### 2.1 Fluxo atual

| Momento | Situação | O que o app diz |
|---------|----------|-----------------|
| Antes do pagamento | Paciente pode cancelar | `cancelRequest` disponível em `submitted`, `in_review`, `approved_pending_payment`, `pending_payment`, `searching_doctor` |
| Receita/exame não aprovada | Estorno | `prescription.tsx`: "Caso não seja aprovada, o valor será estornado integralmente" |
| Após início do atendimento | Cancelamento | FAQ: "Entre em contato com o suporte... Após o início do atendimento, o cancelamento pode estar sujeito a políticas específicas" |
| Push | Notificação | "Pedido cancelado. Estamos processando reembolso/estorno." |

### 2.2 Lacunas críticas

| Lacuna | Risco | Recomendação |
|--------|-------|--------------|
| **Política ausente na Ajuda** | Termos §8 diz "Políticas de reembolso e cancelamento estão disponíveis na seção de Ajuda" — mas a Ajuda não tem política detalhada | **Criar política explícita** em Ajuda ou documento separado |
| **Regras por tipo de serviço** | Receita/exame vs consulta têm fluxos diferentes (pagamento antes vs banco de minutos) | Definir regras por tipo |
| **Banco de minutos** | `consultation_time_bank` — minutos não usados, reembolso proporcional? | Documentar política para minutos não utilizados |
| **Prazo de reembolso** | Prazo para processar estorno (CDC, PIX, Mercado Pago) | Definir e comunicar (ex.: até 7 dias úteis) |
| **Rejeição pelo médico** | Já há mensagem de estorno integral; formalizar na política | Incluir na política escrita |

### 2.3 Sugestão de estrutura mínima

```
Política de cancelamento e reembolso (esboço)

1. Receita / exame
   - Antes da aprovação do médico: cancelamento gratuito; sem cobrança.
   - Rejeitada pelo médico: estorno integral do valor pago.
   - Após aprovação e pagamento, antes do médico iniciar: [definir regra].
   - Após assinatura do documento: [definir — ex.: não há reembolso].

2. Consulta por vídeo
   - Antes do médico aceitar: cancelamento e estorno integral.
   - Após aceite, antes de iniciar: [definir regra].
   - Banco de minutos: [definir política para minutos não usados].

3. Prazo de processamento
   - Estorno: até X dias úteis (conforme operadora do PIX/cartão).

4. Contato
   - {COMPANY.fullContact} para solicitar cancelamento ou reembolso.
```

---

## 3. SLA de suporte e canais de atendimento

### 3.1 O que existe

| Canal | Onde |
|------|------|
| Telefone | `COMPANY.phone` — (11) 98631-8000 |
| Site | `COMPANY.website` — www.renovejasaude.com.br |
| App | Configurações → perfil |
| WhatsApp | `COMPANY.whatsapp` |

### 3.2 Lacunas

| Lacuna | Recomendação |
|--------|--------------|
| **SLA de resposta** | Não há prazo formal (ex.: "responder em até 24h úteis"). Definir e comunicar. |
| **Horário de atendimento** | Não informado. Indicar se 24h, horário comercial, etc. |
| **Procon / órgãos** | Termos §8 menciona "órgãos de defesa do consumidor" — adequado. |
| **Registro de reclamações** | Considerar registro interno para acompanhamento e melhoria. |

---

## 4. Transparência: triagem vs decisão humana vs limites da IA

### 4.1 O que já existe

| Aspecto | Onde |
|---------|------|
| Assistente virtual | Termos §5.1 — "não realiza diagnóstico, não prescreve medicamentos e não substitui a avaliação médica" |
| IA | Termos §5.3 — "decisões clínicas finais permanecem sob responsabilidade exclusiva do médico" |
| Conduta médica | Termos §5.2 — "observações automáticas... não substituem a avaliação médica individual" |
| Consulta por vídeo | Termos §6.1 e §6.2 — transcrição, IA como apoio, decisão do médico |

### 4.2 Fluxo no app

| Etapa | Automático? | Humano? |
|-------|-------------|---------|
| Triagem (IA) | ✅ Análise de imagens, sugestões | — |
| Aprovação/rejeição | — | ✅ Médico |
| Conduta no PDF | Sugestão automática | ✅ Médico edita/remove antes de assinar |
| Transcrição | ✅ Deepgram | — |
| Anamnese | ✅ IA estrutura | ✅ Médico revisa |

### 4.3 Lacunas recomendadas

| Lacuna | Recomendação |
|--------|--------------|
| **"O que é triagem"** | Na Ajuda ou na tela de envio, explicar: "Sua solicitação é analisada por um médico. O sistema usa IA para organizar as informações e facilitar a análise — a decisão final é sempre do médico." |
| **Rejeição por IA** | Se a IA recomenda rejeição (ex.: imagem ilegível), o médico decide. Deixar claro que a IA não rejeita sozinha. |
| **Tempo de espera** | "Até 15 minutos" (receita) — formalizar como expectativa, não como garantia contratual, ou definir SLA. |

---

## 5. Resumo executivo

| Área | Situação | Ação prioritária |
|------|----------|------------------|
| Termos (papéis) | ✅ Bem estruturados | Reforçar vínculo plataforma–médico se necessário |
| Cancelamento/reembolso | ⚠️ Crítico | **Criar política explícita** em Ajuda; cobrir banco de minutos |
| SLA suporte | ⚠️ | Definir prazo de resposta e horário de atendimento |
| Transparência IA | ✅ Parcial | Reforçar na Ajuda: triagem automática vs decisão humana |

---

## 6. Arquivos de referência

- `frontend-mobile/app/terms.tsx` — Termos de Uso
- `frontend-mobile/app/help-faq.tsx` — Ajuda (onde falta política de reembolso)
- `frontend-mobile/app/new-request/prescription.tsx` — Mensagem "15 min" e estorno
- `frontend-mobile/app/request-detail/[id].tsx` — `cancelRequest`, `canCancel`
- `frontend-mobile/lib/company.ts` — Dados de contato
- `supabase/migrations/20260223000001_consultation_time_bank.sql` — Banco de minutos
