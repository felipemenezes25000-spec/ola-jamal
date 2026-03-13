import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import type { DashboardResponsive } from './useDashboardResponsive';

const { colors, radius } = clinicalSoftTokens;

interface ConnectionBannerProps {
  responsive: DashboardResponsive;
}

export function ConnectionBanner({ responsive }: ConnectionBannerProps) {
  const { heights, typography, paddingHorizontal } = responsive;
  return (
    <View style={[styles.banner, { height: heights.banner, paddingHorizontal, marginBottom: 22 }]}>
      <Ionicons name="alert-circle" size={20} color={colors.warningAccent} />
      <Text style={[styles.bannerText, { fontSize: typography.bannerText }]}>
        Sem conexão. Tentando reconectar...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.banner,
    backgroundColor: colors.warningBg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerText: {
    marginLeft: 10,
    color: '#624E33',
    fontWeight: '500',
  },
});
