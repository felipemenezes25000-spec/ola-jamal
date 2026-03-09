#!/bin/bash
# Script para configurar as variáveis do Google OAuth no .env do frontend-mobile.
# Uso: ./scripts/setup-google-oauth.sh <WEB_CLIENT_ID> [ANDROID_CLIENT_ID] [IOS_CLIENT_ID]
#
# Exemplo:
#   ./scripts/setup-google-oauth.sh 462336676738-abc.apps.googleusercontent.com

set -e

ENV_FILE="$(dirname "$0")/../.env"

if [ -z "$1" ]; then
  echo "❌ Uso: $0 <WEB_CLIENT_ID> [ANDROID_CLIENT_ID] [IOS_CLIENT_ID]"
  echo ""
  echo "  WEB_CLIENT_ID     (obrigatório) — ID do cliente Web do Google Cloud"
  echo "  ANDROID_CLIENT_ID (opcional)     — ID do cliente Android (usa Web se omitido)"
  echo "  IOS_CLIENT_ID     (opcional)     — ID do cliente iOS (usa Web se omitido)"
  exit 1
fi

WEB_ID="$1"
ANDROID_ID="${2:-$WEB_ID}"
IOS_ID="${3:-$WEB_ID}"

if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  Arquivo .env não encontrado. Copiando de .env.example..."
  cp "$(dirname "$0")/../.env.example" "$ENV_FILE"
fi

if grep -q "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID" "$ENV_FILE"; then
  sed -i.bak "s|EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=.*|EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=$WEB_ID|" "$ENV_FILE"
  sed -i.bak "s|EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=.*|EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$ANDROID_ID|" "$ENV_FILE"
  sed -i.bak "s|EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=.*|EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=$IOS_ID|" "$ENV_FILE"
  rm -f "$ENV_FILE.bak"
else
  echo "" >> "$ENV_FILE"
  echo "# --- Google OAuth ---" >> "$ENV_FILE"
  echo "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=$WEB_ID" >> "$ENV_FILE"
  echo "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$ANDROID_ID" >> "$ENV_FILE"
  echo "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=$IOS_ID" >> "$ENV_FILE"
fi

echo "✅ Google OAuth configurado no .env:"
echo "   Web:     $WEB_ID"
echo "   Android: $ANDROID_ID"
echo "   iOS:     $IOS_ID"
echo ""
echo "Próximo passo: reinicie o Expo com 'npx expo start --clear'"
