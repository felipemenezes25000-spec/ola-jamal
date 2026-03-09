/**
 * Redirect — compatibilidade com deep link de push notification.
 *
 * O backend envia renoveja://doctor-requests?filter=pending para "Nova solicitação".
 * A tela real está em (doctor)/requests.tsx.
 */

import { Redirect } from 'expo-router';

export default function DoctorRequestsRedirect() {
  return <Redirect href="/(doctor)/requests" />;
}
