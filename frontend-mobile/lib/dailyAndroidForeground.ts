/**
 * Android: mantém o Foreground Service do Daily ativo (câmera + microfone em segundo plano).
 * Deve ser chamado o mais cedo possível na sessão e reforçado ao ir para background — padrão de apps como Discord/WhatsApp.
 */
import { NativeModules, Platform } from 'react-native';

const CHANNEL_ID = 'renoveja-call';

export function setAndroidOngoingMeetingActive(active: boolean): void {
  if (Platform.OS !== 'android') return;
  const DailyNativeUtils = NativeModules.DailyNativeUtils;
  if (!DailyNativeUtils?.setShowOngoingMeetingNotification) return;
  try {
    if (active) {
      DailyNativeUtils.setShowOngoingMeetingNotification(
        true,
        'Consulta em andamento',
        'Toque para expandir',
        'ic_daily_videocam_24dp',
        CHANNEL_ID
      );
    } else {
      DailyNativeUtils.setShowOngoingMeetingNotification(false, '', '', '', CHANNEL_ID);
    }
  } catch {
    /* ignore */
  }
}
