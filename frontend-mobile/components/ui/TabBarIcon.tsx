import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/themeDoctor';

interface TabBarIconProps {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}

export function TabBarIcon({ name, color, focused }: TabBarIconProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {focused && (
        <View style={{
          position: 'absolute',
          top: -4,
          width: 24,
          height: 3,
          borderRadius: 2,
          backgroundColor: colors.primary,
        }} />
      )}
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}
