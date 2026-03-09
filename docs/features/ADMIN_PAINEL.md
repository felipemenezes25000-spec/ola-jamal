# Painel Administrativo — renovejasaude.com.br/admin

O painel admin está integrado ao **frontend-web** e é servido em **renovejasaude.com.br/admin**.

## URLs

| Rota | Descrição |
|------|-----------|
| `/admin/login` | Login (email + senha) |
| `/admin` | Dashboard (protegido) |
| `/admin/medicos` | Lista, aprovação e reprovação de médicos |
| `/admin/configuracoes` | Configurações (em breve) |

## Deploy

O frontend-web já é deployado na Vercel. Ao fazer push na branch configurada, o deploy inclui automaticamente o admin.

- **Domínio:** renovejasaude.com.br
- **Admin:** renovejasaude.com.br/admin

## Variáveis de ambiente (Vercel)

- `VITE_API_URL` — URL base da API (ex.: `https://ola-jamal.onrender.com`). Usada pelo verify e pelo admin.

## Usuário admin

O login exige um usuário com role `admin`. Para tornar um usuário admin:

```sql
-- backend-dotnet/scripts/set-user-admin.sql
UPDATE users SET role = 'admin' WHERE id = '<USER_ID>';
```

## APIs consumidas

- `POST /api/auth/login` — Login
- `GET /api/admin/doctors?status=pending|approved|rejected` — Listar médicos
- `POST /api/admin/doctors/{id}/approve` — Aprovar médico
- `POST /api/admin/doctors/{id}/reject` — Reprovar médico (body: `{ reason?: string }`)
