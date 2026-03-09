# App no celular (Expo) — Guia de troubleshooting

## Erro 400 Invalid Hostname

Quando você roda o app no celular físico (Expo Go) e a API está no seu PC (localhost ou ngrok), o erro **400 Bad Request - Invalid Hostname** pode aparecer se:

1. O backend estiver com `ASPNETCORE_ENVIRONMENT=Production` no `.env`
2. Em Production, a API restringe os hosts permitidos (apenas domínios de produção)

Para testar no celular, use **Development** ou remova a variável (no `dotnet run` o padrão é Development).

---

## Configuração para testar no celular

### 1. Backend (.env em `backend-dotnet/src/RenoveJa.Api/`)

Garanta:

```env
ASPNETCORE_ENVIRONMENT=Development
```

Ou remova a linha (o padrão do `dotnet run` é Development).

Reinicie a API (`dotnet run`).

### 2. Frontend (.env em `frontend-mobile/`)

Use a URL do ngrok ou o IP da sua máquina na rede:

```env
EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app
```

Ou, se estiver na mesma rede Wi‑Fi:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:5000
```

Substitua `192.168.x.x` pelo IP do seu PC (ex.: `ipconfig` no Windows, `ifconfig` no Mac/Linux).

### 3. Reinicie o Expo

```bash
cd frontend-mobile
npx expo start
```

### 4. Se ainda der 400

Confira no console da API se a primeira linha de log indica que está em **Development**. Se aparecer **Production**, o `.env` ainda está com Production.

---

## Verificação rápida

| Item | Valor esperado |
|------|----------------|
| Backend `.env` | `ASPNETCORE_ENVIRONMENT=Development` ou removido |
| Porta da API | 5000 (padrão) ou a definida em `PORT` |
| Frontend `.env` | `EXPO_PUBLIC_API_URL` com ngrok ou IP da LAN |
| Rede | Celular e PC na mesma Wi‑Fi (se usar IP) |

---

## Outros erros comuns

### "Não foi possível conectar ao servidor"

- API não está rodando (`dotnet run` no backend)
- URL incorreta no `EXPO_PUBLIC_API_URL`
- Firewall bloqueando a porta (5000 ou 8080)

### "A API retornou uma página em vez de dados"

- Ngrok: confira se o header `ngrok-skip-browser-warning` está sendo enviado (o app já envia)
- URL do ngrok pode estar incorreta ou expirada

### "Email ou senha incorretos"

- Credenciais corretas? Crie um usuário pelo registro ou use um existente no banco.
