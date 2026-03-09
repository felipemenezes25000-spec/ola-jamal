# Configuração no Render para validação ITI/Adobe

Este documento lista **todas as variáveis de ambiente** que devem ser configuradas no **Render** (dashboard.render.com) para que as receitas sejam aceitas pelo **validar.iti.gov.br** (ITI) e pelo **Adobe**.

---

## Variáveis obrigatórias para ITI/Adobe

No **Render** → seu serviço da API → **Environment** → adicione ou confira:

| Key | Value | Uso |
|-----|-------|-----|
| `Api__BaseUrl` | `https://SEU-SERVICO.onrender.com` | URL pública da API. Usada para montar a URL do PDF retornada ao ITI em `signatureFiles[].url`. **Use a URL exata do seu serviço no Render** (sem barra no final). |
| `Verification__BaseUrl` | `https://SEU-SERVICO.onrender.com/api/verify` | URL codificada no **QR Code** da receita. O ITI chama `GET {BaseUrl}/{id}?_format=application/validador-iti+json&_secretCode=CODIGO`. |
| `Verification__FrontendUrl` | `https://renovejasaude.com.br/verify` | URL do frontend de verificação (redirect de browsers e texto no PDF). |
| `Api__DocumentTokenSecret` | String de 32+ caracteres | Necessária para links de PDF no app/email. Sem ela, "Visualizar PDF Assinado" falha com 401. |

---

## Exemplo com URL real

Se o seu serviço no Render for `https://ola-jamal.onrender.com`:

```
Api__BaseUrl=https://ola-jamal.onrender.com
Verification__BaseUrl=https://ola-jamal.onrender.com/api/verify
Verification__FrontendUrl=https://renovejasaude.com.br/verify
Api__DocumentTokenSecret=minha-chave-secreta-prod-2025-com-pelo-menos-32-caracteres
```

---

## CORS (se o site estiver em outro domínio)

Se o frontend de verificação estiver em `https://renovejasaude.com.br` ou `https://med-renew.vercel.app`, adicione:

| Key | Value |
|-----|-------|
| `Cors__AllowedOrigins__0` | `https://renovejasaude.com.br` |
| `Cors__AllowedOrigins__1` | `https://med-renew.vercel.app` |

(ou o domínio exato do seu site)

---

## Checklist rápido

- [ ] `Api__BaseUrl` = URL do serviço no Render (ex.: `https://xxx.onrender.com`)
- [ ] `Verification__BaseUrl` = `{Api__BaseUrl}/api/verify`
- [ ] `Verification__FrontendUrl` = URL do site de verificação
- [ ] `Api__DocumentTokenSecret` = chave de 32+ caracteres
- [ ] CORS configurado com o domínio do site (se diferente do Render)
- [ ] **Save Changes** e **Deploy** após alterar variáveis

---

## Como testar após configurar

1. **QR Code / URL**: Escanear o QR Code de uma receita no validar.iti.gov.br ou digitar a URL manualmente. O ITI deve obter o JSON e baixar o PDF.
2. **PDF anexado**: Fazer upload do PDF assinado no validar.iti.gov.br. A assinatura deve ser validada (DocMDP já implementado).
3. **Endpoint direto** (incluir `type` conforme Guia ITI Cap. IV): `GET https://SEU-SERVICO.onrender.com/api/verify/{id}?type=prescricao&_format=application/validador-iti+json&_secretCode=123456` deve retornar JSON com `signatureFiles[].url`.

---

## Problemas comuns

| Sintoma | Causa | Solução |
|---------|-------|---------|
| ITI não encontra a receita ao escanear QR | `Verification__BaseUrl` vazio ou errado | Definir `Verification__BaseUrl` = URL do Render + `/api/verify` |
| ITI não consegue baixar o PDF | `Api__BaseUrl` vazio | Definir `Api__BaseUrl` = URL do Render |
| 401 ao abrir link do PDF no navegador | `Api__DocumentTokenSecret` ausente | Adicionar chave de 32+ caracteres |
| CORS bloqueando requisições | Origem do site não permitida | Adicionar domínio em `Cors__AllowedOrigins__0`, etc. |
