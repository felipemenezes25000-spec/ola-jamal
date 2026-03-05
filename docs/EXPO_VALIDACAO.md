# Validação da Configuração Expo

## ✅ O que está correto

| Item | Valor | Status |
|------|-------|--------|
| **Project ID** | `beb0f102-cc22-45a9-80a6-7e735968e6d2` | ✅ Bate com app.config.js |
| **Slug** | `renoveja-app` | ✅ Correto |
| **GitHub repo** | `felipemenezes25000-spec/ola-jamal` | ✅ Conectado |
| **Conta Expo** | `renoveja` | ✅ Logado |
| **Organização** | Renoveja's Organization | ✅ |
| **bundleIdentifier (iOS)** | `com.renoveja.app` | ✅ |
| **package (Android)** | `com.renoveja.app` | ✅ |

---

## ⚠️ O que precisa corrigir

### 1. Base Directory (importante)

**Valor atual no Expo:** `/tree/fix/frontend-performance-responsive`  
**Valor correto:** `frontend-mobile`

O Base Directory deve ser o **caminho da pasta** onde está o código do app dentro do repositório. No monorepo, o app Expo fica em `frontend-mobile/`.

O valor atual parece ser um caminho de branch do GitHub, não um diretório.

**Como corrigir:**
1. Acesse: https://expo.dev/accounts/renovejas-organization/projects/renoveja/github
2. Em **Base Directory**, altere para: `frontend-mobile`
3. Salve

---

### 2. URI de redirecionamento para Google OAuth

Com a conta **renoveja** e o slug **renoveja-app**, a URI para o Cliente Web no Google Cloud deve ser:

```
https://auth.expo.io/@renoveja/renoveja-app
```

Se o projeto estiver sob a organização, pode ser:

```
https://auth.expo.io/@renovejas-organization/renoveja-app
```

Adicione **ambas** nas URIs de redirecionamento do Cliente Web no Google Cloud Console.

---

### 3. EAS Workflows (opcional)

Status atual: **Unconfigured**

Só é necessário se quiser CI/CD automático (build ao fazer push no GitHub). Para builds manuais (`eas build`), não é obrigatório.

---

## Resumo de ações

| # | Ação | Onde |
|---|------|------|
| 1 | Alterar Base Directory para `frontend-mobile` | Expo → Project GitHub settings |
| 2 | Adicionar URIs de redirect no Google Cloud | Console → Credenciais → Cliente Web |
| 3 | (Opcional) Configurar EAS Workflows | Expo → Project GitHub settings |
