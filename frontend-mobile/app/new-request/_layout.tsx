import React from 'react';
import { Stack } from 'expo-router';
import { motionTokens } from '../../lib/ui/motion';

export default function NewRequestLayout() {
  return (
    <Stack screenOptions={motionTokens.nav.newRequestStack}>
      <Stack.Screen name="index" options={{ title: 'Novo pedido' }} />
      <Stack.Screen name="prescription" />
      <Stack.Screen name="exam" />
      <Stack.Screen name="consultation" />
    </Stack>
  );
}
