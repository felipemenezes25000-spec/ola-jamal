# Migrations Supabase (RenoveJá)

## Executar tudo de uma vez

No **SQL Editor** do Supabase ([Dashboard](https://supabase.com/dashboard/project/ifgxgppxsawauaceudec/sql/new)):

1. Abra **`run_all_migrations.sql`**.
2. Copie todo o conteúdo, cole no editor e clique em **Run**.

Isso cria/atualiza:

| Item | Descrição |
|------|-----------|
| `password_reset_tokens` | Recuperação de senha (Esqueci minha senha) |
| `chat_messages` | Mensagens do chat entre paciente e médico por solicitação |
| Colunas em `requests` | `ai_summary_for_doctor`, `ai_extracted_json`, `ai_risk_level`, `ai_urgency`, `ai_readability_ok`, `ai_message_to_user` (leitura por IA) |

## Arquivos individuais

- **add_password_reset_tokens.sql** – só tabela de reset de senha.
- **add_chat_messages.sql** – só tabela de chat.
- **add_ai_reading_columns_to_requests.sql** – só colunas de IA em `requests`.

## Migration automática (API)

Se você configurar **`Supabase:DatabaseUrl`** no `appsettings` (connection string do Postgres), a API cria automaticamente na subida:

- `password_reset_tokens`
- `chat_messages`

As colunas de IA em `requests` precisam ser aplicadas pelo **SQL Editor** (ou você pode adicionar ao `SupabaseMigrationRunner` se quiser).
