import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import { haptics } from '../../../lib/haptics';
import type { DashboardResponsive } from './useDashboardResponsive';

const { colors, shadow } = clinicalSoftTokens;

interface DashboardHeaderProps {
  greeting: string;
  name: string;
  date: string;
  avatarUrl?: string | null;
  initials: string;
  onAvatarPress: () => void;
  responsive: DashboardResponsive;
}

export function DashboardHeader({
  greeting,
  name,
  date,
  avatarUrl,
  initials,
  onAvatarPress,
  responsive,
}: DashboardHeaderProps) {
  const { typography, avatarSize, avatarInnerSize } = responsive;
  const radius = avatarSize / 2;
  const innerRadius = avatarInnerSize / 2;
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text
          style={[
            styles.greeting,
            { fontSize: typography.greeting, lineHeight: typography.greeting * 1.2 },
          ]}
          numberOfLines={1}
        >
          {greeting},
        </Text>
        <Text
          style={[
            styles.name,
            { fontSize: typography.name, lineHeight: typography.name * 1.2 },
          ]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={[
            styles.date,
            { fontSize: typography.date, lineHeight: typography.date * 1.4 },
          ]}
        >
          {date}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.avatarWrap,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: radius,
            marginLeft: responsive.isCompact ? 8 : 12,
          },
          shadow.avatar,
        ]}
        onPress={() => {
          haptics.selection();
          onAvatarPress();
        }}
        accessibilityRole="button"
        accessibilityLabel="Abrir perfil"
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: avatarInnerSize, height: avatarInnerSize, borderRadius: innerRadius }}
            resizeMode="cover"
          />
        ) : (
          <Text style={[styles.avatarInitials, { fontSize: typography.name * 0.9 }]}>
            {initials}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  greeting: {
    color: colors.primaryDark,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  name: {
    marginTop: 2,
    color: colors.primaryDark,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  date: {
    marginTop: 6,
    color: colors.secondary,
    fontWeight: '400',
  },
  avatarWrap: {
    backgroundColor: '#EEF2F8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitials: {
    fontWeight: '800',
    color: colors.primaryDark,
  },
});
