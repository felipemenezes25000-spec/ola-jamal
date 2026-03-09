# Deploy e teste — Dra. Renova + conduta

## 1. Supabase — migration e feature flag

### 1.1 Rodar a migration (se ainda não rodou)

1. Abra o **SQL Editor** do projeto:  
   https://supabase.com/dashboard/project/ifgxgppxsawauaceudec/sql/new  
2. Cole o conteúdo do arquivo abaixo e execute (**Run**).
3. Arquivo: `backend-dotnet/supabase/migrations/20260302_triage_assistant_conduct_observation.sql`

Ou execute este SQL diretamente:

```sql
BEGIN;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS auto_observation         TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS doctor_conduct_notes     TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS include_conduct_in_pdf   BOOLEAN DEFAULT TRUE;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS ai_conduct_suggestion    TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS ai_suggested_exams       TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS conduct_updated_at       TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS conduct_updated_by       UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS feature_flags (key TEXT PRIMARY KEY, value BOOLEAN NOT NULL DEFAULT TRUE, note TEXT);
INSERT INTO feature_flags (key, value, note) 
VALUES ('triage_assistant_enabled', true, 'Habilita/desabilita assistente IA Dra. Renova')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_requests_has_conduct ON requests (doctor_conduct_notes) WHERE doctor_conduct_notes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_conduct_audit ON requests (conduct_updated_by, conduct_updated_at) WHERE conduct_updated_at IS NOT NULL;
COMMIT;
```

### 1.2 Conferir feature flag

No SQL Editor:

```sql
SELECT * FROM feature_flags WHERE key = 'triage_assistant_enabled';
```

- Deve existir uma linha com `value = true`.  
- Para desligar a Dra. Renova: `UPDATE feature_flags SET value = false WHERE key = 'triage_assistant_enabled';`

---

## 2. Mobile — variável de ambiente

- No `frontend-mobile`, crie ou edite o arquivo **`.env`** (não versionado).
- Garanta que exista:

```env
EXPO_PUBLIC_TRIAGE_ENABLED=true
```

- Se você usa o `.env.example` como base, copie-o para `.env` e adicione a linha acima (o `.env.example` já foi atualizado com essa variável).
- Depois faça um **novo build** do app (Expo/Android/iOS) para a variável ser aplicada.

---

## 3. Render — redeploy do backend

1. Acesse: https://dashboard.render.com  
2. Abra o serviço **ola-jamal** (API .NET).
3. Aba **Manual Deploy** → **Deploy latest commit** (ou escolha a branch `fix/frontend-performance-responsive` e faça deploy).
4. Aguarde o build e o deploy terminarem (status **Live**).
5. (Opcional) Confirme as env vars do serviço (Supabase, OpenAI, `Api__BaseUrl`, etc.).

---

## 4. Checklist de teste

### 4.1 Paciente — Home

- [ ] Login como paciente.
- [ ] Na home, ver se aparece o **banner da Dra. Renova** (ex.: “Bem-vindo ao RenoveJá+!” na primeira vez, ou outra mensagem conforme regras).
- [ ] Se não aparecer, verifique: `.env` com `EXPO_PUBLIC_TRIAGE_ENABLED=true` e novo build.

### 4.2 Paciente — Detalhe do pedido

- [ ] Abrir um pedido que já tenha **observação automática** ou **conduta do médico**.
- [ ] Abaixo do “Status do pedido”, devem aparecer:
  - [ ] Card **Observação** (texto da plataforma).
  - [ ] Card **Conduta médica** (quando o médico tiver preenchido).

### 4.3 Médico — Editor (receita)

- [ ] Login como médico; abrir um pedido de receita no **editor**.
- [ ] Entre “Observações gerais” e o bloco de assinatura, deve aparecer a seção **Conduta médica**:
  - [ ] Observação automática (somente leitura).
  - [ ] Se houver sugestão da IA: card com **Usar / Adicionar / Ignorar**.
  - [ ] Campo de texto para conduta e switch **Incluir conduta no PDF**.
- [ ] Clicar em **Salvar e atualizar**: não deve dar erro (chama `updateConduct`).
- [ ] Preencher conduta, marcar “Incluir no PDF”, **Assinar digitalmente**.
- [ ] No PDF assinado: conferir se aparecem **Observação orientativa** e **Conduta médica** antes do QR code.

### 4.4 Criação de pedidos (observação automática)

- [ ] Criar uma **nova receita** (simples ou controlada): após criar, abrir o detalhe e ver se há card de **Observação**.
- [ ] Criar um **novo exame** e um **nova consulta**: no detalhe, ver se a observação automática aparece quando aplicável.

---

## 5. Resumo rápido

| Onde            | Ação |
|-----------------|------|
| **Supabase**    | Rodar migration; conferir `feature_flags`. |
| **Mobile**      | `.env` com `EXPO_PUBLIC_TRIAGE_ENABLED=true`; novo build. |
| **Render**      | Deploy latest (branch `fix/frontend-performance-responsive`). |
| **Teste**       | Home (banner), Detalhe (cards), Editor (conduta + PDF). |
