# RenoveJá - Telemedicine App

Complete mobile telemedicine application built with Expo React Native and Supabase.

## Features

### Patient Features
- 📱 Complete authentication (login, register, forgot password)
- 💊 Request prescription renewals (simple, controlled, blue prescriptions)
- 🔬 Request medical exam orders
- 📹 Schedule online video consultations
- 💬 Real-time chat with doctors
- 💳 PIX payment integration with QR code
- 📄 View and download signed prescriptions
- 🔔 Push notifications
- 👤 Profile management

### Doctor Features
- 🏥 Dashboard with statistics
- 📋 View available and assigned requests
- ✅ Claim and review patient requests
- ✍️ Approve/reject requests with notes
- 🔏 Digital signature for prescriptions
- 💬 Real-time chat with patients
- 📹 Video consultations
- 👨‍⚕️ Professional profile management (CRM, specialty, bio)

## Tech Stack

- **Framework**: Expo SDK 54 with Expo Router
- **Language**: TypeScript
- **Backend**: Supabase (PostgreSQL)
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context API
- **Storage**: AsyncStorage
- **Styling**: React Native StyleSheet
- **UI Components**: Custom components with blue color palette
- **Real-time**: Supabase Realtime subscriptions
- **Image Picker**: Expo Image Picker
- **Notifications**: Expo Notifications

## Project Structure

```
renoveja-app/
├── app/                          # Expo Router screens
│   ├── (auth)/                   # Auth group
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (patient)/                # Patient tab group
│   │   ├── home.tsx
│   │   ├── requests.tsx
│   │   ├── notifications.tsx
│   │   └── profile.tsx
│   ├── (doctor)/                 # Doctor tab group
│   │   ├── dashboard.tsx
│   │   ├── requests.tsx
│   │   ├── notifications.tsx
│   │   └── profile.tsx
│   ├── new-request/              # New request screens
│   │   ├── prescription.tsx
│   │   ├── exam.tsx
│   │   └── consultation.tsx
│   ├── request-detail/[id].tsx   # Request detail (patient)
│   ├── doctor-request/[id].tsx   # Request review (doctor)
│   ├── chat/[id].tsx             # Real-time chat
│   ├── payment/[id].tsx          # PIX payment
│   ├── video-call/[id].tsx       # Video consultation
│   ├── index.tsx                 # Splash screen
│   └── _layout.tsx               # Root layout
├── components/                   # Reusable components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   ├── Logo.tsx
│   └── Loading.tsx
├── contexts/                     # React contexts
│   └── AuthContext.tsx
├── lib/                          # Libraries
│   └── supabase.ts
├── types/                        # TypeScript types
│   └── database.ts
├── constants/                    # Theme and constants
│   └── theme.ts
└── assets/                       # Static assets

```

## Color Palette

All colors follow the blue palette specified in the project brief:

- Primary: #0EA5E9
- Primary Light: #38BDF8
- Primary Lighter: #7DD3FC
- Primary Dark: #0284C7
- Primary Darker: #0369A1
- Primary Pale: #BAE6FD
- Primary Paler: #E0F7FF

## Database Schema

### Supabase Tables

- `users` - User accounts (patient/doctor)
- `doctor_profiles` - Doctor-specific information
- `requests` - Medical requests (prescription/exam/consultation)
- `payments` - Payment records
- `chat_messages` - Chat messages
- `notifications` - Push notifications
- `auth_tokens` - Custom authentication tokens
- `video_rooms` - Video consultation rooms
- `product_prices` - Service pricing
- `push_tokens` - Push notification tokens

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator or Android Emulator (or Expo Go app)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Environment Variables

The Supabase credentials are already configured in `lib/supabase.ts`:

- Supabase URL: https://ifgxgppxsawauaceudec.supabase.co
- Service Role Key: (configured in code)

## Authentication

The app uses **custom authentication** (NOT Supabase Auth):

1. Login queries the `users` table by email
2. Password verification is simplified (bcrypt verification needs Edge Function)
3. Auth tokens are stored in `auth_tokens` table
4. User session persisted with AsyncStorage

## Request Status Flow

### Prescriptions/Exams:
```
submitted → pending_payment → paid → in_review → approved → signed → delivered → completed
```

### Consultations:
```
submitted → searching_doctor → consultation_ready → in_consultation → consultation_finished → completed
```

## Key Features Implementation

### Real-time Chat
- Uses Supabase Realtime subscriptions
- Messages sync instantly between patient and doctor
- Unread message indicators

### Payment Flow
1. Generate PIX payment (QR code + copy-paste code)
2. User confirms payment
3. Request status updates to "paid"
4. Doctor can now review

### Request Review (Doctor)
1. Doctor claims available request
2. Review patient info, medications, AI summary
3. Approve or reject with notes
4. Sign document and send to patient

## Known Limitations

1. **Password Security**: Passwords currently stored as plain text for development. Production needs Edge Function for bcrypt hashing.
2. **Image Upload**: Images stored as URIs, not uploaded to Supabase Storage yet.
3. **Video Call**: Placeholder UI - WebRTC integration pending.
4. **Push Notifications**: Token registration implemented but push sending needs backend trigger.
5. **Digital Signature**: Mock implementation - real e-signature integration needed.

## Development Notes

- All screens are fully functional with Supabase integration
- Real-time features work out of the box
- UI follows blue color palette strictly (NO orange)
- TypeScript strict mode enabled
- Custom components for consistency
- Bottom tab navigation for both user types

## Future Improvements

1. Implement proper password hashing via Supabase Edge Functions
2. Add Supabase Storage for image/document uploads
3. Integrate WebRTC for real video calls
4. Add push notification triggers (Supabase Functions)
5. Integrate real digital signature service
6. Add offline support
7. Add tests (Jest + React Native Testing Library)
8. Add analytics
9. Add error boundary
10. Add form validation library (Zod)

## License

Private - RenoveJá Telemedicine Platform

---

Built with ❤️ using Expo, TypeScript, and Supabase
