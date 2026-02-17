import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

const SIZE_MAP = {
  small: { width: 120, height: 60 },
  medium: { width: 180, height: 90 },
  large: { width: 220, height: 110 },
};

export function Logo({ size = 'medium' }: LogoProps) {
  const dims = SIZE_MAP[size];
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/logo.png')}
        style={[styles.image, { width: dims.width, height: dims.height }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  image: {},
});
