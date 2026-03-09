# Bugs Dark/Light Mode — Relatório de Análise

## Resumo

Foram identificados **15+ bugs** relacionados a conversão de cores incorretas entre
dark e light mode, com foco especial nas telas de **consulta** (solicitação,
videochamada e resumo).

---

## 1. Consultation Summary (`app/consultation-summary/[requestId].tsx`)

### 1.1 Header com cores invertidas

- **Problema:** O header usa fundo escuro fixo (`rgba(15,23,42,0.95)`) mas o texto
  usa `colors.border` e `colors.textMuted`.
- **Em light mode:** `colors.border` = #E2E8F0 (cinza claro) — contraste aceitável
  em fundo escuro.
- **Em dark mode:** `colors.border` = #334155 (Slate 700) — contraste fraco em
  fundo escuro.
- **Correção:** Usar `colors.headerOverlayText` e `colors.headerOverlayTextMuted`
  para texto sobre fundo escuro (já existem no designSystem).

### 1.2 Tela sempre em tema escuro

- **Problema:** A tela inteira usa `colors.black` como fundo e rgba fixos
  (slate 800, 700). Não respeita preferência light/dark do usuário.
- **Impacto:** Usuário em light mode vê tela escura após a consulta, quebra
  consistência.

### 1.3 `errorText` usa token errado

- **Linha 392:** `errorText: { color: colors.errorLight }`
- **Problema:** Em dark mode, `errorLight` = #450A0A (vermelho muito escuro). Em
  fundo `colors.black`, texto quase invisível.
- **Correção:** Usar `colors.error` para texto de erro.

### 1.4 Ícone de voltar no header

- **Linha 156:** `color={colors.border}` no ícone arrow-back.
- **Problema:** Em dark mode, `colors.border` é escuro; em fundo escuro, ícone
  pouco visível.
- **Correção:** Usar `colors.headerOverlayText` ou similar.

---

## 2. Video Call (`app/video/[requestId].tsx`)

### 2.1 `hintBox` com cor fixa

- **Linha 231:** `backgroundColor: '#F1F5F9'`
- **Problema:** Cinza claro fixo. Em dark mode, caixa clara em fundo escuro —
  destaque incorreto.
- **Correção:** Usar `colors.surfaceSecondary` ou `colors.primarySoft` conforme
  tema.

### 2.2 Borda do header

- **Linha 177:** `borderBottomColor: 'rgba(0,0,0,0.06)'`
- **Problema:** Borda preta sutil. Em dark mode, quase invisível.
- **Correção:** Usar `colors.border` ou token semântico.

---

## 3. VideoCallScreenInner (`components/video/VideoCallScreenInner.tsx`)

### 3.1 Modal "Notas Clínicas" — botão secundário

- **Linha 985:** `mBtnSec: { backgroundColor: 'rgba(0,0,0,0.06)' }`
- **Problema:** Em dark mode, `modalColors` é dark. Botão com overlay preto 6% em
  superfície escura = quase invisível.
- **Correção:** Usar `mc.surfaceSecondary` ou `mc.borderLight` para o botão
  "Pular".

### 3.2 `patientCountTxt` usa token errado

- **Linha 918 (makeStyles):** `patientCountTxt: { color: colors.successLight }`
- **Problema:** Em dark mode, `successLight` = #064E3B (verde escuro). Em
  `patientCountPill` com fundo `rgba(34,197,94,0.16)`, contraste fraco.
- **Correção:** Usar `colors.success` para texto.

### 3.3 Overlay do modal

- **Linha 978:** `mOverlay: { backgroundColor: 'rgba(0,0,0,0.5)' }`
- **Nota:** Overlay escuro é aceitável em ambos os modos; pode manter ou usar
  `modalColors.overlayBackground`.

---

## 4. Notificações Paciente (`app/(patient)/notifications.tsx`)

### 4.1 Tipo "Consulta" com cores fixas

- **Linha 82:** `return { icon: 'videocam', color: '#8B5CF6', bgColor: '#EDE9FE',
  label: 'Consulta' };`
- **Problema:** `#EDE9FE` é roxo claro. Em dark mode, fundo claro em card
  escuro — inconsistente.
- **Correção:** Usar `colors.accent` e `colors.accentSoft` do tema.

---

## 5. Consultation Screen (`app/new-request/consultation.tsx`)

### 5.1 Assistant card — alpha em `primarySoft`

- **Linha 295:** `backgroundColor: colors.primarySoft + '66'`
- **Em dark mode:** `primarySoft` = #1e3a8a. `#1e3a8a66` = azul escuro com 40%
  opacidade. Pode ficar muito escuro.
- **Verificar:** Se o contraste com texto está adequado em dark mode.

### 5.2 Input com erro — concatenação de cor

- **Linha 321:** `borderColor: colors.warning + 'CC'`
- **Nota:** Funciona, mas frágil. Preferir token dedicado (ex.: `colors.warning`
  com variante alpha no designSystem).

---

## 6. DoctorAIPanel (`components/video/DoctorAIPanel.tsx`)

### 6.1 Tema forçado em light

- **Linha 117:** `useAppTheme({ scheme: 'light' })`
- **Contexto:** Painel lateral na videochamada. O overlay de vídeo é escuro; o
  painel é sempre claro.
- **Status:** Intencional para legibilidade durante a consulta. Não é bug, mas
  pode ser documentado.

### 6.2 Cores hardcoded em alertas e badges

- Várias linhas usam `#FEE2E2`, `#FECACA`, `#991B1B`, `#16A34A`, `#EA580C`,
  `#7C3AED`, `#D97706`, etc.
- **Como o painel é sempre light:** Não gera bug de dark mode, mas reduz
  manutenção. Ideal migrar para tokens.

---

## 7. Payment Card (`app/payment/card.tsx`)

### 7.1 Overlay de submitting

- **Linha 32:** `background:rgba(255,255,255,.9)` no HTML injetado.
- **Problema:** Overlay branco fixo. Em dark mode, usuário em tema escuro vê
  flash branco ao processar pagamento.
- **Correção:** Usar `colors.surface` ou `colors.background` com opacidade.

---

## 8. Reset Password (`app/(auth)/reset-password.tsx`)

### 8.1 Fundo de card

- **Linha 135:** `backgroundColor: 'rgba(0,0,0,0.05)'`
- **Problema:** Overlay preto 5%. Em dark mode, quase invisível em fundo escuro.
- **Correção:** Usar `colors.surfaceSecondary` ou token semântico.

---

## 9. Design System — Inconsistências

### 9.1 Múltiplas fontes de primary

- `lib/theme.ts`: `palette.primary[600]` = #0284C7
- `lib/designSystem.ts` BRAND: `primary` = #2CB1FF
- `constants/theme.ts`: reexporta theme.ts
- **Impacto:** Componentes que importam de fontes diferentes podem ter cores
  diferentes.

### 9.2 `constants/theme.ts` — cores estáticas

- `gray50` a `gray900` são fixos (light). Componentes que usam isso em dark mode
  terão cores erradas.

---

## 10. Resumo de Prioridades

<!-- markdownlint-disable MD013 -->
| Prioridade | Arquivo | Bug | Correção |
| ---------- | ------- | --- | -------- |
| Alta | consultation-summary | Header usa colors.border em fundo escuro | Usar headerOverlayText |
| Alta | consultation-summary | errorText usa errorLight | Usar colors.error |
| Alta | video/[requestId] | hintBox #F1F5F9 fixo | Usar colors.surfaceSecondary |
| Alta | notifications | Consulta #8B5CF6/#EDE9FE fixos | Usar colors.accent/accentSoft |
| Média | VideoCallScreenInner | mBtnSec rgba(0,0,0,0.06) | Usar mc.surfaceSecondary |
| Média | VideoCallScreenInner | patientCountTxt successLight | Usar colors.success |
| Média | payment/card | submitting rgba(255,255,255,.9) | Usar colors.surface |
| Baixa | reset-password | rgba(0,0,0,0.05) | Usar token semântico |
| Baixa | DoctorAIPanel | Cores hardcoded | Migrar para tokens (opcional) |
<!-- markdownlint-enable MD013 -->

---

## Como testar

1. **Configurar dark mode:** Configurações → Aparência → Modo escuro (ou
   sistema).
2. **Fluxo de consulta:**
   - Nova solicitação → Consulta breve
   - Verificar cards, stepper, textarea, banco de horas
   - Entrar em videochamada (Expo dev build)
   - Verificar overlay, modal de notas, painel IA
   - Após encerrar → Resumo da consulta
3. **Notificações:** Verificar card de tipo "Consulta" em dark mode.
4. **Pagamento:** Processar pagamento e verificar overlay de "Processando...".
