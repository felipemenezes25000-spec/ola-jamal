# Rodar migration (Supabase) e deploy (Render) via MCP

O assistente desta sessão **não tem acesso** às ferramentas MCP do Supabase e do Render. Você precisa rodar no **Cursor** usando o MCP.

---

## 1. Supabase — rodar a migration

### Opção A: Pedir ao Cursor (com MCP Supabase ativo)

Numa **nova conversa** no Cursor, escreva por exemplo:

```
Usando o MCP do Supabase, aplica esta migration no projeto ifgxgppxsawauaceudec:

[cole aqui o conteúdo do arquivo backend-dotnet/supabase/migrations/20260302_triage_assistant_conduct_observation.sql]
```

Ou:

```
No MCP Supabase, executa o SQL do arquivo backend-dotnet/supabase/migrations/20260302_triage_assistant_conduct_observation.sql no projeto.
```

Se o MCP Supabase estiver configurado e com permissão de escrita, o Cursor pode usar a ferramenta `apply_migration` ou `execute_sql` por você.

### Opção B: SQL Editor no navegador (sempre funciona)

1. Abra: https://supabase.com/dashboard/project/ifgxgppxsawauaceudec/sql/new  
2. Abra o arquivo `backend-dotnet/supabase/migrations/20260302_triage_assistant_conduct_observation.sql` no seu projeto.  
3. Copie todo o conteúdo e cole no SQL Editor.  
4. Clique em **Run**.

---

## 2. Render — deploy / conferir serviço

### Opção A: Pedir ao Cursor (com MCP Render ativo)

Numa **nova conversa** no Cursor, escreva por exemplo:

```
Usando o MCP do Render, lista meus serviços e dispara um deploy do serviço da API (ola-jamal ou o nome do serviço da API .NET).
```

O MCP Render pode expor ferramentas como `list_services` e `create_deploy` (ou similar). O Cursor usará o token que está no teu mcp.json.

### Opção B: Dashboard Render (sempre funciona)

1. Abra: https://dashboard.render.com  
2. Abra o serviço da API (ex.: **ola-jamal**).  
3. Aba **Manual Deploy** → **Deploy latest commit** (ou escolha a branch `fix/frontend-performance-responsive`).

---

## Resumo

| Onde     | Via MCP (Cursor) | Manual |
|----------|--------------------|--------|
| Supabase | Nova conversa: “Aplica a migration … no Supabase” (e colar o SQL ou indicar o arquivo). | SQL Editor no dashboard → colar SQL → Run. |
| Render   | Nova conversa: “Lista serviços no Render e dispara deploy da API.” | Dashboard → serviço → Manual Deploy. |

Depois de rodar a migration e o deploy, siga o **DEPLOY_AND_TEST.md** para testar o app.
