import React from 'react';
import { Stack } from 'expo-router';

export default function NewRequestLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="prescription" />
      <Stack.Screen name="exam" />
      <Stack.Screen name="consultation" />
    </Stack>
  );
}
