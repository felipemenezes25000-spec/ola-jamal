import React from 'react';
import { Stack } from 'expo-router';
import { motionTokens } from '../../lib/ui/motion';
import { useRequireAuth } from '../../hooks/useRequireAuth';

export default function NewRequestLayout() {
  const { ready } = useRequireAuth('patient');
  if (!ready) return null;

  return (
    <Stack screenOptions={motionTokens.nav.newRequestStack}>
      <Stack.Screen name="index" options={{ title: 'Novo pedido' }} />
      <Stack.Screen name="prescription" />
      <Stack.Screen name="exam" />
      <Stack.Screen name="consultation" />
    </Stack>
  );
}
