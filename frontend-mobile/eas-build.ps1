# Build Android sem exigir Git
$env:EAS_NO_VCS = "1"
eas build --profile development --platform android
