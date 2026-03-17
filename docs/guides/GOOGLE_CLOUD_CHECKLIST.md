# Google Cloud — Checklist de Configuração OAuth

## O que você já tem configurado

| Item | Status |
|------|--------|
| IDs no `.env` do frontend | ✅ Web, Android, iOS |
| `Google__ClientId` na API (AWS) | ✅ Configurado |
| `Google__AndroidClientId` na API (AWS) | ⚠️ Verificar — use `infra/scripts/ssm-set-google-auth.ps1` |
| Credenciais OAuth no projeto 462336676738 | ✅ Provavelmente criadas |

---

## O que verificar no Google Cloud Console

Acesse: **https://console.cloud.google.com/apis/credentials**

### 1. Tela de consentimento OAuth

- **APIs e serviços** → **Tela de consentimento OAuth**
- Tipo: **Externo**
- Nome: **RenoveJá**
- E-mail de suporte: preenchido
- Domínios: `renovejasaude.com.br` (se usar)
- **Status de publicação**: Em modo de teste, até 100 usuários podem testar. Para produção, precisa publicar.

---

### 2. Cliente Web (ID: `...vr3ap789t68l7vbf5j32h8auqnr9a0ih`)

**URIs de redirecionamento autorizados** — adicione TODAS que o app pode usar:

```
https://auth.expo.io/@SEU_USUARIO_EXPO/renoveja-app
```

Para descobrir seu usuário Expo: rode `npx expo whoami` no terminal.

**Alternativas** (se usar Expo Go ou development build):
- `https://auth.expo.io/@felipemenezes25000-spec/renoveja-app` (exemplo)
- Ou a URL que aparece no console ao rodar `expo start`

---

### 3. Cliente Android (ID: `...0s001pi533f2d3o7j86t2o3ktvbr9oga`)

| Campo | Valor esperado |
|-------|----------------|
| Nome do pacote | `com.renoveja.app` |
| SHA-1 (debug) | Obter com `cd android && ./gradlew signingReport` |
| SHA-1 (release) | Do keystore de produção (EAS/Play Store) |

**Se mudar o SHA-1** (ex.: novo computador, novo keystore), crie uma nova credencial Android no Google Cloud.

---

### 4. Cliente iOS (ID: `...sm6n4bup7ajvg8b9mslifls8i48o1hih`)

| Campo | Valor esperado |
|-------|----------------|
| ID do pacote | `com.renoveja.app` |

---

## Erros comuns e soluções

| Erro | Causa | Solução |
|------|-------|---------|
| `redirect_uri_mismatch` | URI não está na lista do Cliente Web | Adicione a URI exata que o Expo usa |
| `Token do Google inválido` | Backend com Client ID errado | `Google__ClientId` = Web Client ID; `Google__AndroidClientId` = Android Client ID (SSM) |
| `idpiframe_initialization_failed` | Domínio não autorizado | Adicione domínio na tela de consentimento |
| Login não abre no Expo Go | Limitações do proxy auth.expo.io | Use development build (`expo run:ios` / `expo run:android`) |

---

## Comandos úteis

```bash
# Ver usuário Expo (para montar a URI de redirect)
npx expo whoami

# Obter SHA-1 do Android (após gerar pasta android)
cd frontend-mobile/android && ./gradlew signingReport
```

---

## Resumo — o que falta fazer

1. **Verificar URIs de redirecionamento** no Cliente Web — adicionar `https://auth.expo.io/@SEU_USUARIO/renoveja-app`
2. **Verificar SHA-1** no Cliente Android — deve bater com o keystore usado no build
3. **Publicar a tela de consentimento** (quando for para produção com mais de 100 usuários)
