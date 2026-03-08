/**
 * Config plugin para manter câmera/microfone ativos em PiP (Picture-in-Picture).
 * Adiciona phoneCall ao foregroundServiceType do Daily e permissão FOREGROUND_SERVICE_PHONE_CALL.
 * Necessário para chamadas continuarem em background/PiP no Android.
 * @see https://docs.daily.co/reference/android/installation
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

function withDailyPipForeground(config) {
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
  ]);

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = AndroidConfig.Manifest.getMainApplication(manifest);
    if (!application?.service) return config;

    const service = application.service.find(
      (s) => (s?.$?.['android:name'] ?? '') === 'com.daily.reactlibrary.DailyOngoingMeetingForegroundService'
    );
    if (service?.$) {
      const current = service.$['android:foregroundServiceType'] || '';
      if (!current.includes('phoneCall')) {
        const types = current ? current.split('|').filter(Boolean) : ['camera', 'microphone'];
        if (!types.includes('phoneCall')) types.push('phoneCall');
        service.$['android:foregroundServiceType'] = types.join('|');
      }
    }

    return config;
  });

  return config;
}

module.exports = withDailyPipForeground;
