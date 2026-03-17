# Auditoria de Alinhamento frontend-web ↔ frontend-mobile

**Data:** 2025-03-17  
**Última atualização:** 2025-03-17 (remoção botões anamnese, patches aplicados)  
**Escopo:** Estrutura, rotas, API, contratos, design system, auth, Verify v2, vídeo, pós-consulta.

---

## 1. Itens alinhados ✓

| Área | Web | Mobile | Status |
|------|-----|--------|--------|
| **API base** | `VITE_API_URL` / same-origin | `EXPO_PUBLIC_API_URL` / 10.0.2.2:5000 (Android) | ✓ Configurado por env |
| **Auth token** | Bearer em `Authorization` | Bearer em `Authorization` | ✓ |
| **Video (Daily.co)** | POST `/api/video/rooms`, POST `/api/video/join-token` | Idem via `api-daily.ts` | ✓ |
| **Video by-request** | GET `/api/video/by-request/{requestId}` | Idem em `api-daily.ts` | ✓ |
| **SignalR** | `/hubs/requests`, `/hubs/video` | Idem | ✓ |
| **Post-consultation emit** | POST `/api/post-consultation/emit` | Idem | ✓ |
| **Company data** | `lib/company.ts` | `lib/company.ts` | ✓ Idêntico |
| **Design tokens** | Paleta primária #0284C7 / #0EA5E9 | `theme.ts` / `designSystem.ts` | ✓ Consistente |
| **Status labels** | `doctor-helpers.ts` STATUS_MAP | `statusLabels.ts` | ✓ Mapeamento similar |
| **Pós-consulta** | `/pos-consulta/:requestId` | `/post-consultation-emit/[requestId]` | ✓ Mesmo fluxo |
| **Anamnese estruturada** | Sem botões "Criar Receita/Exame" | DoctorAIPanel sem esses botões | ✓ Alinhado (2025-03-17) |
| **Video by-request** | GET `/api/video/by-request/{id}` | `api-video.ts` usa path correto | ✓ Patch aplicado |

---

## 2. Divergências encontradas

### 2.1 Rota de vídeo por request (mobile) — **RESOLVIDO**

| Arquivo | Status |
|---------|--------|
| `frontend-mobile/lib/api-video.ts` | Usa `GET /api/video/by-request/${requestId}` ✓ |
| Backend | Rota real: `GET /api/video/by-request/{requestId}` |

**Patch aplicado:** Path corrigido em `api-video.ts`.

---

### 2.2 Verify v2 — Mobile não implementa

| Aspecto | Web | Mobile |
|---------|-----|--------|
| Rota | `/verify/:id` | **Não existe** |
| Implementação | `pages/Verify.tsx`, `api/verify.ts` | — |

**Contexto:** Verify é usado para QR em documentos. O fluxo típico é: usuário abre link no navegador (web). O mobile não precisa de tela própria para verificação; pode abrir via deep link ou WebView.

**Recomendação:** Se houver QR no app mobile, abrir URL externa ou WebView para `/verify` no domínio web.

---

### 2.3 Contrato Verify v2 — rule vs backend

| Fonte | Body esperado |
|-------|---------------|
| `.cursor/rules/020-verify-v2-contract.mdc` | `{ "id", "code", "v" }` |
| Backend `PrescriptionsController` | `{ "prescriptionId", "verificationCode" }` |

**Web:** `api/verify.ts` envia `prescriptionId` e `verificationCode` — correto.

**Patch:** Atualizar `.cursor/rules/020-verify-v2-contract.mdc` para refletir o contrato real:

```markdown
## API (backend .NET)
- POST {API_URL}/api/prescriptions/verify
- Body: { "prescriptionId": "<uuid>", "verificationCode": "123456" }
```

---

### 2.4 Parâmetro `v` (token) na URL Verify

| Regra | Implementação |
|-------|---------------|
| URL: `/verify/<id>?v=<token>` | Web não lê `v` da query string |

**Status:** O backend `prescriptions/verify` não usa `v` no body. O parâmetro `v` pode ser para outro endpoint (ex.: `api/verify/{id}/full`). Verificar se há uso real no backend.

---

### 2.5 Estrutura de rotas — nomenclatura

| Web (Doctor) | Mobile (Doctor) |
|--------------|----------------|
| `/dashboard` | `/(doctor)/dashboard` |
| `/pedidos` | `/(doctor)/requests` |
| `/pedidos/:id` | `/doctor-request/[id]` |
| `/consultas` | `/(doctor)/consultations` |
| `/pacientes` | `doctor-patient/[patientId]` (via profile) |
| `/video/:requestId` | `/video/[requestId]` |
| `/resumo-consulta/:requestId` | `/consultation-summary/[requestId]` |
| `/pos-consulta/:requestId` | `/post-consultation-emit/[requestId]` |

**Observação:** Padrões diferentes (ex.: `pedidos` vs `requests`), mas funcionalidade equivalente.

---

### 2.6 Features em um e não no outro

| Feature | Web | Mobile |
|---------|-----|--------|
| Landing page | ✓ | ✗ |
| Admin portal | ✓ | ✗ |
| Verify (receita) | ✓ | ✗ |
| Portal médico | ✓ | ✓ |
| Portal paciente | ✗ (só mobile) | ✓ |
| Fluxo SUS | ✗ | ✓ `(sus)/` |
| Command Palette (Cmd+K) | ✓ | ✗ |
| Fila de pedidos | ✓ `/fila` | ✗ |

**Contexto:** Web é landing + médico + admin; mobile é paciente + médico + SUS. Divergência esperada por público.

---

### 2.7 Design system — fontes

| Web | Mobile |
|-----|--------|
| Inter, Poppins (Google Fonts) | Plus Jakarta Sans (@expo-google-fonts) |

**Impacto:** Visual diferente entre plataformas. Aceitável se for intencional.

---

### 2.8 Auth — armazenamento

| Web | Mobile |
|-----|--------|
| `localStorage` | `AsyncStorage` |

**Status:** Adequado para cada plataforma.

---

## 3. Plano de patches mínimos

### Patch 1: Corrigir `api-video.ts` (mobile)

**Arquivo:** `frontend-mobile/lib/api-video.ts`

```diff
- return await apiClient.get(`/api/video/rooms/by-request/${requestId}`);
+ return await apiClient.get(`/api/video/by-request/${requestId}`);
```

---

### Patch 2: Atualizar rule Verify v2

**Arquivo:** `.cursor/rules/020-verify-v2-contract.mdc`

```diff
 ## API (backend .NET)
 - POST {API_URL}/api/prescriptions/verify
 - Body: { "id": "<uuid>", "code": "123456", "v": "<token-opcional>" }
+ POST {API_URL}/api/prescriptions/verify
+ Body: { "prescriptionId": "<uuid>", "verificationCode": "123456" }
```

---

### Patch 3 (opcional): Unificar `api-video` e `api-daily` (mobile)

`api-video.ts` e `api-daily.ts` têm overlap. `api-daily.ts` usa o path correto e tem `fetchJoinToken`. Recomendação: deprecar `api-video.ts` e migrar para `api-daily.ts` ou centralizar em um único módulo.

---

## 4. Mapa tela → endpoint → payload

### Mapa resumido (portal médico)

| Tela | Endpoint | Payload | Response |
|------|----------|---------|----------|
| Login | POST `/api/auth/login` | `{ email, password }` | `{ token, user }` |
| Pedidos | GET `/api/requests` | `?page=1&pageSize=20` | `{ items, total }` |
| Detalhe pedido | GET `/api/requests/{id}` | — | `MedicalRequest` |
| Criar sala vídeo | POST `/api/video/rooms` | `{ requestId }` | `{ roomUrl, dailyRoomName, ... }` |
| Join token | POST `/api/video/join-token` | `{ requestId }` | `{ token, roomUrl, roomName }` |
| Sala por request | GET `/api/video/by-request/{requestId}` | — | `VideoRoom` |
| Emitir pós-consulta | POST `/api/post-consultation/emit` | `{ requestId, prescription?, exams?, certificate? }` | `{ documentsEmitted, message }` |

### Verify (web only)

| Tela | Endpoint | Payload | Response |
|------|----------|---------|----------|
| Verify | POST `/api/prescriptions/verify` | `{ prescriptionId, verificationCode }` | `{ isValid, ... }` ou `{ status, downloadUrl, meta }` |
| Documentos | POST `/api/documents/verify` | `{ documentId, code }` | `DocumentVerifyResult` |

---

## 5. Checklist de teste

- [ ] **Mobile:** `fetchVideoRoomByRequest` em `api-video.ts` — após patch, deve retornar sala corretamente
- [ ] **Web:** Verify com código 6 dígitos — sucesso e erro
- [ ] **Ambos:** Login médico → dashboard → pedidos → detalhe → vídeo
- [ ] **Ambos:** Pós-consulta → emitir documentos → assinatura
- [ ] **Web:** Verify com `?v=` na URL — se backend usar, validar
- [ ] **Mobile:** Deep link para `/verify/{id}` — abrir URL externa ou WebView

---

## 6. Resumo executivo

| Categoria | Alinhado | Divergência | Ação |
|-----------|----------|-------------|------|
| **Rotas** | Estrutura equivalente | Nomenclatura diferente | OK |
| **API** | Maioria | `api-video.ts` path errado | Patch 1 |
| **Verify v2** | Web implementa | Mobile não tem | Opcional |
| **Contrato** | Web correto | Rule desatualizada | Patch 2 |
| **Design** | Tokens consistentes | Fontes diferentes | OK |
| **Auth** | Fluxo similar | Storage diferente | OK |
| **Vídeo** | Daily.co + SignalR | — | OK |
| **Pós-consulta** | Mesmo endpoint | — | OK |

**Prioridade:** Patch 1 (crítico se `api-video` for usado), Patch 2 (documentação).
