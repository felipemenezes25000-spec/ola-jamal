# Token inválido: como obter um novo Access Token do Mercado Pago

Se aparecer erro **"invalid access token"** ou **"Access Token do Mercado Pago inválido"**, o token expirou ou foi rotacionado.

## Passo a passo (≈ 2 minutos)

1. Acesse: **https://www.mercadopago.com.br/developers/panel/app**
2. Faça login com sua conta Mercado Pago
3. Clique na sua aplicação (ou crie uma nova)
4. Vá na aba **Credenciais**
5. Em **Credenciais de teste**, clique em **Copiar** no **Access Token**
6. Cole no `appsettings.json` ou `appsettings.Development.json`:
   ```json
   "MercadoPago": {
     "AccessToken": "COLE_O_TOKEN_AQUI",
     ...
   }
   ```
7. **Reinicie a API** (Ctrl+C e `dotnet run` de novo)

## Alternativa: variável de ambiente

Para não editar o arquivo, defina no terminal antes de rodar a API:

```powershell
$env:MercadoPago__AccessToken = "SEU_TOKEN_COPIADO"
dotnet run
```

## Link direto

- **Credenciais:** https://www.mercadopago.com.br/developers/panel/app → sua app → Credenciais
- Use o **Access Token de teste** (começa com `TEST-`) para desenvolvimento.
