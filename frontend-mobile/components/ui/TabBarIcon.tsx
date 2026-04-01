import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';

/** Design spec: 22px inactive, 24px active */
const ICON_SIZE_ACTIVE = 24;
const ICON_SIZE_INACTIVE = 22;

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
  const pillWidth = useRef(new Animated.Value(focused ? 32 : 0)).current;
  const pillOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(focused ? 1.05 : 1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(pillWidth, {
        toValue: focused ? 32 : 0,
        tension: 180,
        friction: 12,
        useNativeDriver: false,
      }),
      Animated.timing(pillOpacity, {
        toValue: focused ? 1 : 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.spring(scale, {
        toValue: focused ? 1.05 : 1,
        tension: 220,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused, pillWidth, pillOpacity, scale]);

  return (
    <View style={iconStyles.container}>
      {/* Active indicator pill above the icon */}
      <Animated.View
        style={[
          iconStyles.pill,
          {
            width: pillWidth,
            backgroundColor: activeIndicatorColor,
            opacity: pillOpacity,
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={name}
          size={focused ? ICON_SIZE_ACTIVE : ICON_SIZE_INACTIVE}
          color={color}
        />
      </Animated.View>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    height: 3,
    borderRadius: 1.5,
    marginBottom: 3,
  },
});
