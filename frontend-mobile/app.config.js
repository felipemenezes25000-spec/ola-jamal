/* eslint-env node */
import { existsSync } from "fs";
import { join } from "path";

const googleServicesPath = join(__dirname, "google-services.json");

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
    updates: {
      url: "https://u.expo.dev/beb0f102-cc22-45a9-80a6-7e735968e6d2"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.renoveja.app",
      runtimeVersion: { policy: "appVersion" },
      infoPlist: {
        UIBackgroundModes: ["voip", "audio", "remote-notification"],
        NSCameraUsageDescription: "RenoveJá+ precisa de acesso à câmera para videoconsultas",
        NSMicrophoneUsageDescription: "RenoveJá+ precisa de acesso ao microfone para videoconsultas",
        NSPhotoLibraryUsageDescription: "RenoveJá+ precisa de acesso à galeria para enviar fotos de receitas e documentos"
      }
    },
    android: {
      runtimeVersion: "1.0.0",
      ...(existsSync(googleServicesPath) && { googleServicesFile: "./google-services.json" }),
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0EA5E9"
      },
      package: "com.renoveja.app",
      edgeToEdgeEnabled: false,
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
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: "com.googleusercontent.apps.598286841038-28ili7c5stg5524sicropmm7s7nkq936"
        }
      ],
      "expo-router",
      "expo-font",
      "expo-pip",
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
      "./plugins/withDailyPipForeground.js",
      [
        "expo-build-properties",
        {
          "android": { "minSdkVersion": 24 },
          "ios": { "deploymentTarget": "15.1" }
        }
      ],
      "./plugins/withJitsiMavenCentral.js"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      // No dispositivo físico use o IP da sua máquina: EXPO_PUBLIC_API_URL=http://192.168.15.69:5000
      apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || "",
      // Google OAuth — fallback para quando .env não carrega (Expo Go, builds antigos)
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "598286841038-j095u3iopiqltpgbvu0f5od924etobk7.apps.googleusercontent.com",
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "598286841038-780e9kksjoscthg0g611virnchlb7kcr.apps.googleusercontent.com",
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "598286841038-28ili7c5stg5524sicropmm7s7nkq936.apps.googleusercontent.com",
      eas: {
        projectId: "beb0f102-cc22-45a9-80a6-7e735968e6d2"
      }
    }
  }
};
