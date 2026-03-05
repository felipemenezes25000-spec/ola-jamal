import { Stack } from 'expo-router';
import { motionTokens } from '../../lib/ui/motion';

export default function AuthLayout() {
  return (
    <Stack screenOptions={motionTokens.nav.authStack}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="complete-profile" />
      <Stack.Screen name="complete-doctor" />
    </Stack>
  );
}
