# Envio de Receita/Exame por WhatsApp

O RenoveJá+ envia o PDF (receita ou pedido de exame) **para o número cadastrado do paciente** via WhatsApp.

---

## 1. Envio automático (implementado)

**Como funciona:** O usuário toca em "Enviar por WhatsApp". O backend envia o documento para o **telefone cadastrado do paciente** via WhatsApp Business Cloud API.

**Onde está:**
- **Paciente:** `app/request-detail/[id].tsx` — botão "Enviar por WhatsApp"
- **Médico:** `app/doctor-request/[id].tsx` — botão na seção "Documento Assinado"

**Endpoint:** `POST /api/requests/{id}/send-whatsapp`

**Fluxo:**
1. Usuário toca no botão
2. Backend obtém o telefone do paciente (`users.phone`)
3. Backend baixa o PDF assinado
4. Backend envia via WhatsApp Cloud API para o número do paciente
5. Paciente recebe o documento no WhatsApp

---

## 2. Configuração (WhatsApp Business API)

Para o envio automático funcionar, configure no `.env`:

```
WhatsApp__ApiToken=SEU_TOKEN_DA_META
WhatsApp__PhoneNumberId=ID_DO_NUMERO_WHATSAPP_BUSINESS
```

### Como obter

1. **Meta Business:** Crie uma conta em [business.facebook.com](https://business.facebook.com)
2. **WhatsApp Business API:** Em [developers.facebook.com](https://developers.facebook.com), crie um app e adicione o produto WhatsApp
3. **ApiToken:** Token de acesso permanente (não temporário)
4. **PhoneNumberId:** ID do número de telefone do WhatsApp Business (em Configurações do WhatsApp)

---

## 3. Fallback: compartilhamento manual

Se o WhatsApp não estiver configurado ou o paciente não tiver telefone cadastrado, o app oferece **compartilhar manualmente** (compartilhamento nativo do sistema). O usuário escolhe o WhatsApp e o contato.

---

## Resumo

| Situação | Comportamento |
|----------|---------------|
| WhatsApp configurado + paciente com telefone | Envio automático para o número cadastrado |
| WhatsApp não configurado | Oferece compartilhar manualmente |
| Paciente sem telefone | Mensagem de erro |
