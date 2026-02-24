export default {
  expo: {
    name: "RenoveJá",
    slug: "renoveja-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    scheme: "renoveja",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0EA5E9"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.renoveja.app",
      infoPlist: {
        UIBackgroundModes: ["voip"],
        NSCameraUsageDescription: "RenoveJá+ precisa de acesso à câmera para videoconsultas",
        NSMicrophoneUsageDescription: "RenoveJá+ precisa de acesso ao microfone para videoconsultas"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0EA5E9"
      },
      package: "com.renoveja.app",
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#0EA5E9"
        }
      ],
      [
        "@daily-co/config-plugin-rn-daily-js",
        {
          "enableCamera": true,
          "enableMicrophone": true,
          "enableScreenShare": false
        }
      ],
      [
        "expo-build-properties",
        {
          "android": { "minSdkVersion": 24 },
          "ios": { "deploymentTarget": "15.1" }
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      // No dispositivo físico use o IP da sua máquina: EXPO_PUBLIC_API_URL=http://192.168.15.69:5000
      apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || "https://ola-jamal.onrender.com",
      // Google OAuth — necessário para login com Google (iOS exige iosClientId)
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
      eas: {
        projectId: "beb0f102-cc22-45a9-80a6-7e735968e6d2"
      }
    }
  }
};
