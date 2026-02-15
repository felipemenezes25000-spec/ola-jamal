# Supabase: projeto alinhado ao MCP

O app está configurado para usar o **mesmo projeto** que o MCP do Cursor.

## Projeto

- **URL:** `https://ifgxgppxsawauaceudec.supabase.co`
- **Project ref:** `ifgxgppxsawauaceudec`
- **Bucket Storage:** `prescription-images` (criado neste projeto)

## O que você precisa fazer

1. Abra o Dashboard desse projeto:  
   **https://supabase.com/dashboard/project/ifgxgppxsawauaceudec**

2. Vá em **Project Settings** (ícone de engrenagem) → **API**.

3. Em **Project API keys**, copie a chave **`service_role`** (secret).  
   Não use a chave `anon` nem `publishable`.

4. No `appsettings.json` e/ou `appsettings.Development.json`, em **Supabase:ServiceKey**, substitua o valor atual pela chave `service_role` que você copiou.

5. Reinicie a API. O upload de imagens em `POST /api/requests/prescription` (multipart) passará a usar o bucket `prescription-images` desse projeto.

## Resumo

| Config        | Valor |
|---------------|--------|
| Supabase:Url  | `https://ifgxgppxsawauaceudec.supabase.co` |
| Supabase:ServiceKey | Chave **service_role** do projeto acima |
| Bucket        | `prescription-images` (já existe no projeto) |

## Migração de dados

Se você tinha dados no projeto antigo (`gklkznyyouwqsohszula`), exporte e importe manualmente pelo Dashboard ou via ferramentas do Supabase.
