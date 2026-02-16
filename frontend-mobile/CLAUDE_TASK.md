# Task: Refactor RenoveJá+ Frontend - Phase 1-3

You are refactoring a React Native + Expo SDK 54 + Expo Router v6 telemedicine app.

## CRITICAL RULES
1. Do NOT modify anything in `backend-dotnet/` — the backend is final
2. Keep existing file-based routing structure in `app/`
3. Keep existing `lib/api.ts`, `lib/api-client.ts`, and `types/database.ts` — they already match the backend
4. Reference screens are in `reference-screens/` folder — match the visual style but don't copy bugs
5. App must run with `npx expo start` on iOS and Android
6. Remove ANY chat-related code if found
7. All text in Portuguese (pt-BR)

## Design System to implement in `lib/theme.ts`

```typescript
export const colors = {
  primary: '#0EA5E9',        // Sky blue
  primaryDark: '#0284C7',
  primaryLight: '#E0F2FE',
  secondary: '#10B981',      // Green (doctor)
  background: '#F0F8FF',     // Light ice blue
  surface: '#FFFFFF',
  text: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  // Status colors
  statusSubmitted: '#F59E0B',
  statusInReview: '#3B82F6',
  statusApproved: '#10B981',
  statusPaid: '#10B981',
  statusSigned: '#8B5CF6',
  statusDelivered: '#10B981',
  statusRejected: '#EF4444',
  statusCancelled: '#6B7280',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const borderRadius = { sm: 8, md: 12, lg: 16, xl: 24 };
export const shadows = { card: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 } };
```

## Components to create/refactor in `components/`

### GradientHeader.tsx
- Patient: cyan→blue gradient with "Olá, {name}! 👋" + subtitle + avatar
- Doctor: green→teal gradient with "Dr. {name} 👋" + "Painel do médico" + doctor icon

### StatsCard.tsx
- Small white card with icon, label, and number (used in both dashboards)

### ActionCard.tsx
- White card with icon in colored circle + label (Nova Receita, Novo Exame, Consulta)

### RequestCard.tsx
- List item: icon + title + subtitle + status badge + price

### StatusBadge.tsx (already exists, refactor)
- Colored badge matching status: ENVIADO (yellow), EM ANÁLISE (blue), PAGO (green), etc.

### StatusTracker.tsx
- Horizontal progress steps for request detail (6 steps for rx/exam, 5 for consultation)

### ScreenContainer.tsx
- SafeAreaView + ScrollView + background color wrapper

## Screens to refactor

### app/(patient)/home.tsx — Patient Dashboard
Match reference: gradient header, 4 stats cards row, 3 action cards row, recent requests list
- Fetch stats from GET /api/requests (count by status)
- Action cards navigate to new-request/prescription, new-request/exam, new-request/consultation

### app/(patient)/requests.tsx — My Requests List
Match reference: search bar, filter tabs (Todos/Receitas/Exames/Consultas), scrollable list of RequestCards
- GET /api/requests with filters
- Each card navigates to request-detail/[id]

### app/new-request/prescription.tsx — New Prescription
Match reference: 3 type cards with prices (Simples R$50, Controlada R$80, Azul R$100), medication tags input with + button, camera photo capture area, info notice, submit button
- POST /api/requests/prescription (multipart with images)

### app/new-request/exam.tsx — New Exam
Similar to prescription: exam type selector, exams list input, symptoms textarea, optional photo, submit
- POST /api/requests/exam

### app/new-request/consultation.tsx — New Consultation  
Simple: symptoms textarea + submit
- POST /api/requests/consultation

### app/request-detail/[id].tsx — Request Detail (Patient view)
Match reference: StatusTracker at top, details card (type, control, doctor, value, date), medications/exams list, action button based on status:
- APPROVED_PENDING_PAYMENT → "Pagar" button → navigate to payment/[id]
- SIGNED → "Baixar Receita" button → download PDF
- IN_CONSULTATION/CONSULTATION_READY+PAID → "Entrar na Consulta" → video/[requestId]

### app/payment/[id].tsx — Payment  
Match reference payment-selection: PIX or Card choice, then PIX screen with QR code + copy-paste code + "Já Paguei" button
- POST /api/payments { requestId, paymentMethod: "pix" }
- GET /api/payments/{id}/pix-code for copy-paste
- Poll GET /api/payments/{id} for status change

### app/(auth)/login.tsx, register.tsx, complete-profile.tsx, forgot-password.tsx
Clean up visually to match the blue theme. Keep existing API calls.

### app/(patient)/_layout.tsx — Bottom tab navigation
4 tabs: HOME, PEDIDOS, NOTIFICAÇÕES, PERFIL (with icons)

## Status mapping for display
```
submitted → "Enviado" (yellow)
ai_analysis → "Analisando" (blue) — note: this may not come from backend, check
in_review → "Em Análise" (blue)  
approved_pending_payment → "A Pagar" (orange)
paid → "Pago" (green)
signed → "Assinado" (purple)
delivered → "Entregue" (green)
rejected → "Rejeitado" (red)
cancelled → "Cancelado" (gray)
searching_doctor → "Buscando Médico" (yellow)
consultation_ready → "Consulta Pronta" (blue)
in_consultation → "Em Consulta" (blue)
consultation_finished → "Finalizada" (green)
```

## Important
- Use `expo-linear-gradient` for gradients (already installed)
- Use `@expo/vector-icons` Ionicons for icons (already installed)
- Use `expo-image-picker` for camera (already installed)
- Use `expo-clipboard` for PIX copy (already installed)
- Use `expo-file-system` + `expo-sharing` for PDF download (already installed)
- The API returns status in snake_case (submitted, in_review, etc.)
- Prices: simples=50, controlado=80, azul=100, exam=60, consultation=120

When completely finished, run this command to notify:
openclaw system event --text "Done: Phase 1-3 complete - design system + patient screens refactored" --mode now
