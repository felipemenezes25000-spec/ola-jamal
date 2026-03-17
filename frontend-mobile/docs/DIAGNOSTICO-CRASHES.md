# Diagnóstico de Crashes — Frontend Mobile

<!-- markdownlint-disable MD013 -->

**Data:** 05/03/2025  
**Objetivo:** Identificar e corrigir pontos do app que podem causar fechamento ao
selecionar opções ou acessar telas.

**Última atualização (investigação profunda):** Correções adicionais em
getRequestUiState, StatusBadge, dashboard, doctor-request, VideoCallScreenInner,
doctor-patient-summary.

---

## Resumo das correções aplicadas

### 1. Tela Prontuário do Paciente (`app/(patient)/record.tsx`)

| Problema | Correção |
| --- | --- |
| `summary?.stats.totalRequests` — crash se `stats` for undefined | `summary?.stats?.totalRequests` |
| `enc.type.toLowerCase()` — crash se `type` for null ou number | `String(enc.type ?? '').toLowerCase()` |
| `doc.documentType.toLowerCase()` — crash se null ou number | `String(doc.documentType ?? '').toLowerCase()` |
| `doc.status.toLowerCase()` — crash se null ou number | `String(doc.status ?? '').toLowerCase()` |
| `formatDatePt(iso)` — crash com data inválida | Guard para `!iso` e `Number.isNaN(d.getTime())` |
| `enc.startedAt` / `doc.createdAt` no sort — crash se null | `new Date(x ?? 0).getTime()` |
| `enc.id` / `doc.id` como key — possível conflito | Fallback `enc.id ?? \`enc-${idx}\`` |
| ScrollView horizontal aninhado no Android | `nestedScrollEnabled` |
| Erro não capturado em render | `ErrorBoundary` envolvendo toda a tela |
| **State update após unmount** — crash ao fechar/sair da tela | `cancelledRef` + cleanup em `useFocusEffect`; checar `cancelledRef.current` antes de cada `setState` |
| **filteredEncounters/filteredDocuments** — crash se `type`/`documentType` for number | `String(e.type ?? '').toLowerCase()` e mapeamento com valores enum ('1','2','3') |

### 2. Prontuário do Médico (`app/doctor-patient/[patientId].tsx`)

| Problema | Correção |
| --- | --- |
| `getStatusTone(status)` — crash se status null | `(status ?? '').toLowerCase()` |
| `req.status.toLowerCase()` em statusOptions | `(req.status ?? '').toLowerCase()` |
| `r.status.toLowerCase()` no filtro | `(r.status ?? '').toLowerCase()` |
| `r.status.toLowerCase()` em pendingRequests | `(r.status ?? '').toLowerCase()` |

### 3. Pedidos do Paciente (`app/(patient)/requests.tsx`)

| Problema | Correção |
| --- | --- |
| `r.requestType.toLowerCase().includes(q)` — crash se null | `(r.requestType ?? '').toLowerCase().includes(q)` |

### 4. Componente CompatibleImage (`components/CompatibleImage.tsx`)

| Problema | Correção |
| --- | --- |
| `uri.toLowerCase()` — crash se uri undefined | `uriStr = typeof uri === 'string' ? uri : ''` + early return |
| Interface não aceitava null/undefined | `uri: string \| null \| undefined` |

### 5. Tela Sobre (`app/about.tsx`)

| Problema | Correção |
| --- | --- |
| `COMPANY.name.toUpperCase()` — crash se name undefined | `(COMPANY.name ?? '').toUpperCase()` |

### 6. Resumo do Paciente (Médico) (`app/doctor-patient-summary/[patientId].tsx`)

| Problema | Correção |
| --- | --- |
| `structured?.carePlan.trim()` — crash se carePlan não for string | `typeof structured?.carePlan === 'string' && structured.carePlan.trim().length > 0` |

### 7. Regras de Triagem (`lib/triage/triageRulesEngine.ts`)

| Problema | Correção |
| --- | --- |
| `m.trim().toLowerCase()` — crash se item do array for null | `(m ?? '').trim().toLowerCase()` |

### 8. Busca CID (`lib/cid-medications.ts`)

| Problema | Correção |
| --- | --- |
| `c.cid.toLowerCase()`, `m.toLowerCase()` — crash com dados malformados | `(c.cid ?? '').toLowerCase()`, `(m ?? '').toLowerCase()` |

### 9. AppSegmentedControl (`components/ui/AppSegmentedControl.tsx`)

| Problema | Correção |
| --- | --- |
| `item.label.toUpperCase()` — crash se label undefined | `(item.label ?? '').toUpperCase()` |

### 10. getRequestUiState / StatusBadge (`lib/domain/getRequestUiState.ts`, `components/StatusBadge.tsx`)

| Problema | Correção |
| --- | --- |
| `request.status` null/undefined — STATUS_TO_UI[null] | `const status = request?.status ?? ''` |
| `getStatusColor` — UI_STATUS_COLORS[undefined] | Optional chaining + fallback |
| `getStatusLabelPt` — status null retorna "null" | `(status ?? '')` e fallback `'—'` |

### 11. Dashboard (`app/(doctor)/dashboard.tsx`)

| Problema | Correção |
| --- | --- |
| `request.medications[0]` / `request.exams[0]` — item null em array malformado | `request.medications[0] ?? ''` e `String(first)` |

### 12. Doctor Request / Sugestões IA (`app/doctor-request/[id].tsx`)

| Problema | Correção |
| --- | --- |
| `item.startsWith('🚨')` — item do JSON pode ser null | `const s = typeof item === 'string' ? item : ''` |
| `meds.map(m => ...)` — m pode ser null | `String(m ?? '')` e `m ?? ''` |

### 13. VideoCallScreenInner / doctor-patient-summary (sugestões)

| Problema | Correção |
| --- | --- |
| `s.startsWith('🚨')` — s pode ser null em array | `const str = typeof s === 'string' ? s : ''` |

### 14. Pós-consulta (post-consultation-emit / PostConsultationScreen)

| Problema | Correção |
| --- | --- |
| `extractCidFromAnamnesis` — `cid_sugerido` pode ser number/null (JSON malformado) | `typeof cid === 'string'` antes de `toUpperCase()` |
| `buildMedsFromAnamnesis` — itens null no array | `filter((m) => m != null)` antes do map |
| `buildExamsFromAnamnesis` — itens null no array | `filter((e) => e != null)` antes do map |
| `cidPkg?.medications.map` — medications pode ser undefined | `(cidPkg?.medications ?? []).map(...)` |
| `cidPkg?.exams.map` — exams pode ser undefined | `(cidPkg?.exams ?? []).map(...)` |
| `request.patientName` — pode ser number (API malformada) | `String(request.patientName ?? 'P')` |
| `request.patientBirthDate` — data inválida gera NaN | Guard `!Number.isNaN(new Date(...).getTime())` |

---

## Pedidos do médico — "Não foi possível carregar"

**Sintoma:** Na aba **Pedidos** (fluxo médico), a tela exibe "Não foi possível
carregar" com subtítulo "Ocorreu um erro ao processar sua solicitação. Tente
novamente." e botão "Tentar novamente".

**Causa:** Essa mensagem genérica vem do **backend** (`ExceptionHandlingMiddleware`).
Qualquer exceção não tratada na API vira resposta **500** com esse texto; o app
só repassa a mensagem. A causa real está nos logs do servidor.

**Como debugar:**

1. **Backend**
   - Ver logs da API (AWS CloudWatch ou onde a API está hospedada) no momento em que o
     médico abre/atualiza Pedidos.
   - Verificar Sentry (Issues) para a exceção associada a `GET /api/requests`.
   - O controller é `RequestsController`; a ação é listagem de pedidos (médico autenticado).

2. **App**
   - Confirmar que `EXPO_PUBLIC_API_URL` no `.env` do mobile aponta para a API
     correta (com `https` em produção).
   - Em dispositivo físico, não usar `localhost`; usar IP da máquina ou URL pública.
   - Confirmar que o médico está **logado** (token em `AsyncStorage` em
     `@renoveja:auth_token`). Se o token expirou ou é inválido, a API pode
     retornar **401**; o app agora exibe "Sessão expirada. Faça login novamente."
     nesse caso.

3. **Mensagens no app (após melhoria)**
   - **401:** "Sessão expirada. Faça login novamente."
   - **500 / mensagem genérica do backend:** "Erro no servidor. Tente novamente
     em alguns instantes."
   - **Rede:** "Não foi possível conectar. Verifique sua internet e tente novamente."

**Arquivos relacionados:** `app/(doctor)/requests.tsx`, `lib/hooks/useDoctorRequestsQuery.ts`,
`lib/api-requests.ts` (fetchRequests), `lib/errors/humanizeError.ts`. Backend:
`RenoveJa.Api/Middleware/ExceptionHandlingMiddleware.cs`,
`Controllers/RequestsController.cs`.

---

## Padrões de risco identificados

### Alto risco (causam crash imediato)

- **`.toLowerCase()` / `.toUpperCase()` em valor possivelmente null/undefined**  
  Usar sempre: `(valor ?? '').toLowerCase()` ou `valor?.toLowerCase() ?? ''`

- **`.trim()` em valor não-string**  
  Usar: `typeof x === 'string' && x.trim().length > 0`

- **Acesso encadeado sem optional chaining**  
  Ex.: `obj.prop.subProp` → `obj?.prop?.subProp`

### Médio risco

- **`new Date(x).getTime()` com x null/undefined**  
  Usar: `new Date(x ?? 0).getTime()` ou validar antes

- **`.map()` em arrays que podem ter itens null**  
  Usar: `(item ?? '').trim()` ou `String(item ?? '')` dentro do map

### Boas práticas

1. Usar `ErrorBoundary` em telas críticas para evitar fechamento total do app.
2. Usar `nestedScrollEnabled` em `ScrollView` horizontal dentro de `ScrollView`
   vertical (Android).
3. Validar dados da API antes de acessar propriedades encadeadas.

---

## Arquivos modificados

- `app/post-consultation-emit/[requestId].tsx`
- `components/post-consultation/PostConsultationScreen.tsx`
- `app/(patient)/record.tsx`
- `app/doctor-patient/[patientId].tsx`
- `app/(patient)/requests.tsx`
- `app/doctor-patient-summary/[patientId].tsx`
- `app/about.tsx`
- `app/(doctor)/dashboard.tsx`
- `app/doctor-request/[id].tsx`
- `components/CompatibleImage.tsx`
- `components/ui/AppSegmentedControl.tsx`
- `components/ui/ErrorBoundary.tsx` (novo)
- `components/StatusBadge.tsx`
- `components/video/VideoCallScreenInner.tsx`
- `lib/domain/getRequestUiState.ts`
- `lib/domain/statusLabels.ts`
- `lib/triage/triageRulesEngine.ts`
- `lib/cid-medications.ts`

---

## Pontos já seguros (verificados)

- `request-detail/[id].tsx` — `getRiskLabelPt` já tem guard `if (!level) return`
- `AiCopilotSection` — usa `request.aiRiskLevel &&` antes de acessar
- `PatientInfoCard` — `getInitials` trata `!name` e partes vazias
- `request.medications.map` em request-detail — protegido por
  `request.medications && request.medications.length > 0`
- `VideoCallScreenInner` — `Array.isArray(anamnesis?.alertas_vermelhos)` antes
  do map
