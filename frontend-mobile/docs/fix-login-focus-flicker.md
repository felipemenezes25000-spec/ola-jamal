# fix(login): prevent focus flicker and validation loop

## Causa raiz

O foco era perdido porque o componente `AppInput` atualizava o state `focused` **imediatamente** no `onFocus` do `TextInput`. Essa atualização disparava um re-render que alterava os estilos do container (borda, fundo e principalmente **shadow/elevation**).

Referências:
- `components/ui/AppInput.tsx`, linhas 73–74: `onFocus={() => setFocused(true)}` e `onBlur={() => setFocused(false)}`
- Estilos aplicados no foco: `focusShadow` (shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation)

No Android/iOS, alterar `shadow`/`elevation` do container do `TextInput` causa um novo layout. Durante essa passagem, o `TextInput` pode perder o foco ou piscar. O comportamento era semelhante a um TAB fictício porque o foco era perdido logo após o toque.

## O que foi alterado

1. **AppInput.tsx**
   - **Defer da atualização de `focused`**: `setFocused(true)` passou a ser chamado via `requestAnimationFrame` no `onFocus`, evitando alteração de estilo no mesmo frame em que o foco é recebido.
   - **Remoção de `focusShadow` no foco**: `showFocusShadow = false` para evitar alteração de shadow/elevation no container, que dispara re-layout em Android.
   - **Handlers estáveis**: `onFocus`, `onBlur` e `onChangeText` passaram a ser memoizados com `useCallback` para evitar re-renders desnecessários.
   - **Logs de diagnóstico**: logs `[LOGIN_FOCUS]` protegidos por `LOGIN_FOCUS_DEBUG = __DEV__ && false` para uso futuro em debug.

2. **login.tsx**
   - Garantia explícita de `scroll` no `Screen`, mantendo `keyboardShouldPersistTaps="always"` no `ScrollView` (configurado em `Screen.tsx`).

## Por que resolve em Android/iOS

- **Android**: Mudanças de `elevation` geram novo layer nativo. Atualizar isso no mesmo frame do `onFocus` pode fazer o foco ser perdido antes do término do layout. Deferir `setFocused` e não alterar shadow/elevation evita esse ciclo.
- **iOS**: Alterações de `shadow*` também causam re-layout. O defer e a remoção de `focusShadow` reduzem o risco de perda de foco.

## Riscos e como testar

- **Risco**: O feedback visual de foco (sombra) foi removido. A mudança de borda e cor de fundo continua.
- **Testes manuais sugeridos**:
  - Android: tocar no campo de email, digitar devagar e rápido, apagar, colar texto, alternar para senha, voltar.
  - iOS: mesmo fluxo.
  - Conferir: ausência de alternância rápida de focus/blur, cursor estável, sem “piscar” de validações.
- **Debug**: Para logs `[LOGIN_FOCUS]`, alterar em `AppInput.tsx`: `LOGIN_FOCUS_DEBUG = __DEV__ && true`.
