# RenoveJá Frontend Mobile - REST API Refactoring

## Overview

This React Native Expo app has been **completely refactored** to use the .NET backend REST API instead of direct Supabase database access.

## What Changed

### Core Architecture

1. **lib/api-client.ts** (NEW)
   - HTTP client using native `fetch()` API
   - Automatic JWT token attachment from AsyncStorage
   - Configurable base URL via environment variables
   - Consistent error handling with typed responses
   - Support for JSON and multipart/form-data requests

2. **lib/api.ts** (REWRITTEN)
   - All functions now call REST endpoints from `API_ENDPOINTS.md`
   - Multipart file upload support for prescriptions and exams
   - Pagination support via `PagedResponse<T>` type
   - Removed all Supabase dependencies

3. **types/database.ts** (UPDATED)
   - Updated to match backend DTOs
   - Field names converted from snake_case to camelCase
   - Added new types: `PagedResponse`, `CrmValidationResponseDto`, `VideoRoomResponseDto`, etc.
   - Legacy type aliases for backward compatibility

4. **contexts/AuthContext.tsx** (REFACTORED)
   - Uses POST /api/auth/login and /api/auth/register
   - Token comes from backend (not generated client-side)
   - Supports doctor registration via /api/auth/register-doctor
   - Google Auth, forgot password, reset password flows
   - Complete profile support for OAuth users
   - Token validation via GET /api/auth/me on app load

5. **lib/supabase.ts** (DEPRECATED)
   - No longer used by the application
   - Can be safely deleted

### Updated Screens

#### Patient Screens
- **app/(patient)/home.tsx** - Uses `fetchRequests()` API
- **app/(patient)/requests.tsx** - Paginated requests with filtering
- **app/(patient)/notifications.tsx** - REST API notifications
- **app/(patient)/profile.tsx** - Updated field names
- **app/new-request/prescription.tsx** - Multipart image upload
- **app/new-request/exam.tsx** - Multipart image upload
- **app/new-request/consultation.tsx** - REST API creation
- **app/request-detail/[id].tsx** - Fetch by ID with AI fields
- **app/payment/[id].tsx** - PIX payment with polling

#### Doctor Screens
- **app/(doctor)/dashboard.tsx** - Stats from REST API
- **app/(doctor)/requests.tsx** - Available + assigned requests with pagination
- **app/(doctor)/profile.tsx** - Availability updates via REST
- **app/doctor-request/[id].tsx** - Approve/reject/sign via REST
- **app/video/[requestId].tsx** - Video room management

#### Other Screens
- **app/settings.tsx** - Push token registration via REST
- Auth screens (login, register) - Already using AuthContext

### Field Name Changes

All database fields converted from snake_case to camelCase:

| Old (Supabase)          | New (REST API)        |
|-------------------------|-----------------------|
| `patient_id`            | `patientId`           |
| `doctor_id`             | `doctorId`            |
| `request_type`          | `requestType`         |
| `prescription_type`     | `prescriptionType`    |
| `exam_type`             | `examType`            |
| `created_at`            | `createdAt`           |
| `updated_at`            | `updatedAt`           |
| `birth_date`            | `birthDate`           |
| `notification_type`     | `notificationType`    |
| `signed_document_url`   | `signedDocumentUrl`   |
| `ai_summary_for_doctor` | `aiSummaryForDoctor`  |
| `ai_risk_level`         | `aiRiskLevel`         |
| `pix_qr_code`           | `pixQrCode`           |
| `pix_copy_paste`        | `pixCopyPaste`        |

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
API_BASE_URL=http://localhost:5000  # Local development
# API_BASE_URL=https://api.renoveja.com.br  # Production
```

The API base URL is configured in `app.config.js` and accessed via `Constants.expoConfig.extra.apiBaseUrl`.

### Running the App

1. Install dependencies:
```bash
npm install
```

2. Start the Expo development server:
```bash
npm start
```

3. Make sure your .NET backend is running on the configured API_BASE_URL

## API Endpoints Used

See `API_ENDPOINTS.md` for the complete REST API reference. Key endpoints:

- **Auth**: `/api/auth/login`, `/api/auth/register`, `/api/auth/me`
- **Requests**: `/api/requests`, `/api/requests/{id}`, `/api/requests/prescription`, `/api/requests/exam`
- **Payments**: `/api/payments`, `/api/payments/by-request/{id}`
- **Notifications**: `/api/notifications`, `/api/notifications/{id}/read`
- **Doctors**: `/api/doctors`, `/api/doctors/{id}/availability`
- **Push Tokens**: `/api/push-tokens`
- **Video**: `/api/video/rooms`
- **Specialties**: `/api/specialties`

## Authentication Flow

1. User logs in via POST /api/auth/login
2. Backend returns `{ user, token, doctorProfile? }`
3. Token stored in AsyncStorage (`@renoveja:auth_token`)
4. All subsequent requests include `Authorization: Bearer {token}` header
5. On app load, token validated via GET /api/auth/me
6. On logout, POST /api/auth/logout called and local storage cleared

## File Uploads

Prescription and exam requests support multipart/form-data uploads:

```typescript
const formData = new FormData();
formData.append('prescriptionType', 'simples');
formData.append('images', {
  uri: imageUri,
  name: 'prescription.jpg',
  type: 'image/jpeg'
});

await createPrescriptionRequest({ prescriptionType: 'simples', images: [imageUri] });
```

## Pagination

List endpoints return `PagedResponse<T>`:

```typescript
interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

## Error Handling

API errors are thrown with structured information:

```typescript
interface ApiError {
  message: string;
  status?: number;
  errors?: Record<string, string[]>; // Validation errors
}
```

## Breaking Changes

1. **No more direct Supabase access** - All data must come from REST API
2. **Field names changed** - Update any custom code to use camelCase
3. **Authentication flow different** - Token generated on backend, not client
4. **Pagination required** - List endpoints now paginated by default
5. **Image upload changed** - Now uses multipart instead of Supabase Storage

## Migration Checklist

- [x] Created HTTP client (lib/api-client.ts)
- [x] Updated type definitions (types/database.ts)
- [x] Rewrote API functions (lib/api.ts)
- [x] Refactored AuthContext
- [x] Updated all patient screens
- [x] Updated all doctor screens
- [x] Updated settings screen
- [x] Removed Supabase dependencies
- [x] Added environment configuration
- [ ] Update push notification project ID in lib/notifications.ts
- [ ] Test all user flows end-to-end
- [ ] Remove @supabase packages from package.json (if desired)
- [ ] Delete lib/supabase.ts file

## Testing Recommendations

1. **Authentication**
   - Login with patient account
   - Login with doctor account
   - Register new patient
   - Register new doctor
   - Forgot password flow
   - Token validation on app restart

2. **Patient Flows**
   - Create prescription request with images
   - Create exam request with images
   - Create consultation request
   - View request list with pagination
   - View request details
   - Generate PIX payment
   - View notifications

3. **Doctor Flows**
   - View dashboard stats
   - Browse available requests
   - Accept request
   - Approve/reject request
   - Sign document
   - Update availability
   - View assigned requests

4. **Edge Cases**
   - Expired token handling
   - Network errors
   - Large file uploads
   - Pagination with many items
   - Concurrent request updates

## Notes

- All UI/UX remains identical to the original implementation
- Only the data layer has changed
- Backend must be running and accessible
- Backend must implement all endpoints from API_ENDPOINTS.md
- Consider implementing retry logic for failed requests
- Consider adding request/response interceptors for logging

## Support

For issues or questions about the refactoring, refer to:
- `API_ENDPOINTS.md` - Backend API documentation
- `lib/api.ts` - API function implementations
- `lib/api-client.ts` - HTTP client configuration
