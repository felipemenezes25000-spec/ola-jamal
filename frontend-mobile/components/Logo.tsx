import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors, typography } from '../constants/theme';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  color?: string;
}

export function Logo({ size = 'medium', showIcon = true, color }: LogoProps) {
  const sizeMap = {
    small: { logo: 32, text: 18, plus: 14 },
    medium: { logo: 48, text: 26, plus: 20 },
    large: { logo: 72, text: 36, plus: 28 },
  };

  const s = sizeMap[size];
  const textColor = color || colors.white;

  return (
    <View style={styles.container}>
      {showIcon && (
        <View style={[styles.iconContainer, { width: s.logo, height: s.logo, borderRadius: s.logo / 4 }]}>
          <Text style={[styles.iconText, { fontSize: s.logo * 0.45 }]}>R</Text>
        </View>
      )}
      <View style={styles.textContainer}>
        <Text style={[styles.text, { fontSize: s.text, color: textColor }]}>
          RenoveJá
        </Text>
        <Text style={[styles.plus, { fontSize: s.plus, color: '#F4A261' }]}>+</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconText: {
    color: colors.white,
    fontWeight: '800',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  text: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  plus: {
    fontWeight: '800',
    marginLeft: 2,
  },
});
