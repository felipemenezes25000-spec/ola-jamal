/**
 * Foreground service do Daily: câmera + microfone + phoneCall (Android 14+).
 * phoneCall alinha o tipo de serviço a chamadas em andamento (expectativa do SO, similar a Discord/WhatsApp).
 * @see https://docs.daily.co/reference/android/installation
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const DAILY_FGS_TYPES = 'camera|microphone|phoneCall';

function withDailyPipForeground(config) {
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
    'android.permission.FOREGROUND_SERVICE_CAMERA',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  ]);

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = AndroidConfig.Manifest.getMainApplication(manifest);
    if (!application?.service) return config;

    const service = application.service.find(
      (s) => (s?.$?.['android:name'] ?? '') === 'com.daily.reactlibrary.DailyOngoingMeetingForegroundService'
    );
    if (service?.$) {
      service.$['android:foregroundServiceType'] = DAILY_FGS_TYPES;
    }

    // PiP requires smallestScreenSize in configChanges to prevent Activity recreation
    const activity = AndroidConfig.Manifest.getMainActivity(manifest);
    if (activity?.$) {
      const current = activity.$['android:configChanges'] || '';
      if (!current.includes('smallestScreenSize')) {
        activity.$['android:configChanges'] = current
          ? current + '|smallestScreenSize'
          : 'keyboard|keyboardHidden|orientation|screenSize|screenLayout|smallestScreenSize|uiMode';
      }
    }

    return config;
  });

  return config;
}

module.exports = withDailyPipForeground;
