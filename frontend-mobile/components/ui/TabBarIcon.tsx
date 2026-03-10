import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';

interface TabBarIconProps {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  variant?: 'patient' | 'doctor';
  activeColor?: string;
}

export function TabBarIcon({ name, color, focused, activeColor }: TabBarIconProps) {
  const { colors } = useAppTheme();
  const activeIndicatorColor = activeColor ?? colors.primary;
  const pillWidth = useRef(new Animated.Value(focused ? 36 : 0)).current;
  const pillOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(focused ? 1.1 : 1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(pillWidth, {
        toValue: focused ? 36 : 0,
        tension: 160,
        friction: 10,
        useNativeDriver: false,
      }),
      Animated.timing(pillOpacity, {
        toValue: focused ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.spring(scale, {
        toValue: focused ? 1.1 : 1,
        tension: 200,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, pillWidth, pillOpacity, scale]);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Pill animada acima do ícone */}
      <Animated.View
        style={{
          width: pillWidth,
          height: 4,
          borderRadius: 2,
          backgroundColor: activeIndicatorColor,
          opacity: pillOpacity,
          marginBottom: 4,
        }}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={name} size={focused ? 24 : 22} color={color} />
      </Animated.View>
    </View>
  );
}
