# Relatório: Correção de bugs UX (Fila, Detalhes, Login)

## Bug 1: Loading infinito / tela branca na Fila

### Causa raiz
- Sem estado de `error`: ao falhar o fetch, apenas `console.error` e `setLoading(false)`, sem `error` state → tela branca ou lista vazia sem explicação
- Sem cancelamento: ao trocar filtros/abas rapidamente, responses antigos podiam sobrescrever dados mais recentes
- Doctor: `loadData` dependia de `status`, `type`, `filter`; `useFocusEffect` chamava `loadData` e criava intervalo — sem `requestId` para ignorar responses obsoletos

### Arquivos alterados
- `lib/api-client.ts`: suporte opcional a `AbortSignal` em `get()`
- `lib/api.ts`: `fetchRequests`, `fetchRequestById`, `getRequests` aceitam `{ signal?: AbortSignal }`
- `app/(patient)/requests.tsx`: estado `error`, `requestIdRef`, `AbortController`, estados loading/error/empty
- `app/(doctor)/requests.tsx`: mesmo padrão

### Correções
1. **Estados separados**: `loading`, `isRefreshing`, `error`, `requests`
2. **AbortController**: cancelamento ao desmontar e ao iniciar novo fetch
3. **requestId**: responses antigas são descartadas (`rid !== requestIdRef.current`)
4. **try/catch/finally**: `setLoading(false)` e `setIsRefreshing(false)` sempre em `finally`
5. **Tela de erro**: mensagem + botão "Tentar novamente"
6. **Empty**: empty state claro quando `!loading && !error && data.length === 0`

### Validação manual
1. Paciente: Fila → trocar filtros rápido → verificar se lista não fica em branco
2. Médico: Fila → trocar abas rápido → idem
3. Desligar API → ver erro + botão "Tentar novamente"
4. Pull-to-refresh → loading sem travar tela

---

## Bug 2: Spinner sobrepondo conteúdo no Detalhe

### Causa raiz
- Sem `AbortController`: ao sair da tela durante o fetch, `setState` ainda rodava após desmontar
- Sem `requestId`: respostas de requisições anteriores podiam atualizar a tela após navegação
- Sem tela de erro: falha no fetch deixava tela em branco ou estado indefinido

### Arquivos alterados
- `app/request-detail/[id].tsx`: `AbortController`, `requestId`, estado `detailError`, tela de erro com retry

### Correções
1. **AbortController**: abort ao desmontar
2. **requestId (fetchIdRef)**: só atualiza estado se a resposta for da requisição atual
3. **Tela de erro**: quando `detailError` → mensagem + "Tentar novamente"
4. **Guard de tipo**: `if (!request) return null;` antes do conteúdo principal (TypeScript + segurança)

### Validação manual
1. Fila → Detalhes → voltar rápido → sem crash nem spinner residual
2. API fora → Detalhes → ver erro + retry

---

## Bug 3: Login perde foco / validação piscando

### Causa raiz (corrigida em sessão anterior)
- **AppInput**: `setFocused(true)` no `onFocus` gerava re-render imediato; mudança de `shadow/elevation` no container causava re-layout e perda de foco no TextInput

### Arquivos alterados
- `components/ui/AppInput.tsx`: `requestAnimationFrame` em `setFocused`, remoção de `focusShadow`, handlers memoizados
- `app/(auth)/login.tsx`: Zod, validação só no submit, handlers memoizados, erros inline

### Correções
1. **Defer de `setFocused`** em `AppInput` via `requestAnimationFrame`
2. **Remoção de shadow/elevation** no foco
3. **Validação**: Zod no submit, erros inline (não alert a cada tecla)
4. **Handlers memoizados**: `useCallback` em todos os handlers

### Validação manual
1. Login → tocar email → digitar sem perder foco
2. Digitar rápido → sem piscar
3. Submit com campos vazios → erros inline (não loop de alerts)

---

## Regressão e logs

- **Logs**: `LOG_QUEUE`, `LOG_DETAIL`, `LOG_RENDER` em `__DEV__ && false`; ativar mudando para `true`
- **lib/logger.ts**: utilitário de debug para [QUEUE], [DETAIL], [AUTH]
- **AbortController**: uso em todos os fetches de Fila e Detalhes para evitar race conditions
