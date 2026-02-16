# RenoveJá+ Frontend Refactor Spec

## Goal
Refactor the Expo Router frontend to match the reference screens and implement the full 100% flow as described. Remove any chat vestiges. Ensure it runs with `npx expo start`.

## Tech Stack
- React Native + Expo SDK 54
- Expo Router v6 (file-based routing)
- TypeScript
- No external state management (use React context/hooks)

## Backend
- .NET API at configurable URL (EXPO_PUBLIC_API_URL)
- Auth via Bearer token (stored in AsyncStorage)
- API client already exists at `lib/api-client.ts` and `lib/api.ts`

## Reference Screens (at /tmp/telas/telas app/)
1. **Patient Dashboard** - Gradient header (cyan→blue), stats cards (Total, Pendente, A Pagar, Prontos), 3 action cards (Nova Receita, Novo Exame, Consulta Online), recent requests list
2. **Doctor Dashboard** - Green gradient header, certificate alert banner, stats (Fila, Em Análise, Assinados, Consultas), availability toggle, recent activity
3. **New Prescription Form** - 3 prescription type cards with prices (Simples R$50, Controlada R$80, Azul R$100), medication tags input, camera photo capture, info notice
4. **Payment Selection** - PIX or Card options, consultation value display, security badge
5. **PIX Payment** - QR code display, copy-paste code, "Já Paguei" button
6. **Request Detail (Patient)** - 6-step progress tracker, details card, medications list, status-dependent action buttons
7. **Doctor Request Detail** - Progress stepper, patient info, AI analysis card with risk badge, medications list, approve/reject buttons
8. **My Requests List** - Search bar, filter tabs (Todos/Receitas/Exames/Consultas), request cards with status badges
9. **Doctor Queue** - Request cards with patient name, type, time, status
10. **Certificate Management** - Certificate status card, details (holder, issuer, validity), revoke button

## Design System
- Background: light blue/ice blue (#F0F8FF or similar)
- Primary: sky blue (#0EA5E9)
- Cards: white, rounded corners, subtle shadows
- Gradients: cyan→blue (patient), green→teal (doctor)
- Status badges: green (Pronto/Pago), blue (Em Análise), yellow (Enviado), red (Rejeitado), orange (A Pagar)

## Status Flow
### Prescription/Exam:
SUBMITTED → AI_ANALYSIS → IN_REVIEW → APPROVED_PENDING_PAYMENT → PAID → SIGNED → DELIVERED
Side exits: REJECTED, CANCELLED

### Consultation:
SEARCHING_DOCTOR → CONSULTATION_READY → PAID → IN_CONSULTATION → CONSULTATION_FINISHED
Side exit: CANCELLED

## Existing Structure (keep file-based routing)
```
app/
  _layout.tsx (root)
  index.tsx (auth redirect)
  (auth)/ - login, register, forgot-password, complete-profile
  (patient)/ - home, requests, notifications, profile
  (doctor)/ - dashboard, requests, notifications, profile
  new-request/ - prescription, exam, consultation
  request-detail/[id].tsx
  doctor-request/[id].tsx
  payment/[id].tsx, card.tsx
  video/[requestId].tsx
  certificate/upload.tsx
  settings.tsx
```

## Key Requirements
1. All screens must match reference design (colors, layout, components)
2. Full status flow working end-to-end
3. PIX payment via MercadoPago (QR code + copy-paste)
4. Video call integration (Daily.co WebView)
5. Digital certificate upload for doctors
6. AI analysis display on doctor review screen
7. PDF download for signed prescriptions/exams
8. Push notifications setup
9. No chat features anywhere
10. Works on iOS + Android via `npx expo start`

## ngrok
- Auth token: 39MpR8mu4uMt1JCk9otRGzG2o74_efY4fXDK77Cw7EqMCc6H
- Current tunnel: hydrogeologic-unemotioned-abram.ngrok-free.dev
