## feat(patient-flow): corrige fluxo do paciente (overlay, validação, notificações otimistas, dark mode, testes)

---

### Versão curta (squash merge)

**feat(patient-flow): fix overlay/validation/notifications/dark-mode + tests**

- Corrige sobreposição do FAB com contrato de z-index e controle de visibilidade em modal.
- Adiciona zona de exclusão para evitar FAB sobre CTAs fixos.
- Fortalece validação de formulários (exam/consultation) com bloqueio de submit quando inválido.
- Implementa atualização otimista de notificações com rollback em erro.
- Remove hardcodes de cor e melhora consistência de dark mode com tokens de tema.
- Expande cobertura de testes (validação + NotificationContext) e estabiliza Jest com mock de AsyncStorage.

**Validação:** `typecheck` ✅ | `tests` ✅ (19 suites / 207 testes).

---

### Contexto
Este PR corrige problemas críticos observados no fluxo do paciente (mobile), incluindo:
- FAB/assistente sobrepondo CTAs e modais
- validações inconsistentes em formulários
- badge de notificações desatualizado
- inconsistências de dark mode/contraste
- cobertura de testes insuficiente para os cenários corrigidos

---

## O que foi feito

### 1) Z-index / Overlay / Modal Visibility (P0)
- Padronização de camadas no tema:
- `float: 1050`
- `sticky: 1100`
- `toast: 1700`
- FAB ajustado para respeitar camada e zona de exclusão inferior (evita cobrir CTA).
- Criação de `ModalVisibilityContext` para ocultar/desativar FAB quando modal estiver aberto.
- Aplicação do provider no `_layout` e integração com telas que abrem modais.

### 2) Validação de formulário (P0)
- `exam.tsx` e `consultation.tsx`:
- `isFormValid` baseado em completude + schema
- `disabled: loading || !isFormValid`
- feedback de erro inline / toast para erro de API
- `prescription.tsx`:
- melhoria de feedback para erro de API (toast), mantendo validação existente

### 3) Notificações otimistas (P0)
- `NotificationContext`:
- `markAllReadOptimistic`
- `decrementUnreadCount`
- rollback em caso de falha
- `notifications.tsx` atualizado para usar fluxo otimista.

### 4) Dark mode e tokens (P0/P1)
- Remoção de hardcodes de cor em telas críticas do paciente.
- Uso de tokens em `designSystem.ts` (incluindo overlays).
- `Toast` usando tema dinâmico (`useAppTheme`) para manter contraste.

### 5) Testes
- Novos/ajustes de testes:
- `schemas.test.ts` (exam/consultation/prescription)
- `NotificationContext.test.tsx` (otimista + rollback)
- `OfflineBanner.test.tsx` (ajustes de mock/seletores)
- Mock global de AsyncStorage para Jest:
- `jest.setup.early.js`
- configuração em `jest.config.js` (`setupFiles`)

---

## Resultado de validação

- `npm run typecheck` ✅
- `npm test -- --runInBand` ✅
- **19 suites passed**
- **207 tests passed**

---

## Impacto esperado
- Melhora de confiabilidade no envio de solicitações.
- Redução de erros de interação por sobreposição de FAB.
- Experiência mais consistente em dark mode.
- Notificações mais responsivas e confiáveis.
- Menor chance de regressão com testes cobrindo os pontos críticos.

---

## Checklist de QA (manual)
- [ ] FAB não cobre CTA/input em Home, Detalhe, Exame, Consulta, Renovação
- [ ] Modal aberto desativa/oculta FAB
- [ ] Exam/Consulta bloqueiam submit quando inválidos
- [ ] Badge de notificação atualiza imediatamente e faz rollback em erro
- [ ] Dark mode legível (texto, botões, cards, overlays, toast)
- [ ] Fluxos principais sem crash/regressão
