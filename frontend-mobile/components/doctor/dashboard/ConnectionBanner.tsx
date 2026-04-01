import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import type { DashboardResponsive } from './useDashboardResponsive';

const { radius } = clinicalSoftTokens;

interface ConnectionBannerProps {
  responsive: DashboardResponsive;
}

export function ConnectionBanner({ responsive }: ConnectionBannerProps) {
  const { heights, typography, paddingHorizontal } = responsive;
  return (
    <View style={[styles.banner, { height: heights.banner, paddingHorizontal, marginBottom: 16 }]}>
      <Ionicons name="alert-circle" size={18} color="#F59E0B" />
      <Text style={[styles.bannerText, { fontSize: typography.bannerText }]}>
        Sem conexão. Tentando reconectar...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.banner,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerText: {
    marginLeft: 8,
    color: '#92400E',
    fontWeight: '500',
  },
});
