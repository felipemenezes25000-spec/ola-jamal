import React, { useState } from 'react';
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

function DashboardHeader_Fn({
  greeting,
  name,
  date,
  avatarUrl,
  initials,
  onAvatarPress,
  responsive,
}: DashboardHeaderProps) {
  const [avatarError, setAvatarError] = useState(false);
  const { typography, avatarSize, avatarInnerSize } = responsive;
  const radius = avatarSize / 2;
  const innerRadius = avatarInnerSize / 2;
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text
          style={[
            styles.greeting,
            { fontSize: typography.greeting, lineHeight: typography.greeting * 1.4 },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {greeting},
        </Text>
        <Text
          style={[
            styles.name,
            { fontSize: typography.name, lineHeight: typography.name * 1.25 },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
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
            marginLeft: 12,
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
        {avatarUrl && !avatarError ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: avatarInnerSize, height: avatarInnerSize, borderRadius: innerRadius }}
            resizeMode="cover"
            onError={() => setAvatarError(true)}
          />
        ) : (
          <Text style={[styles.avatarInitials, { fontSize: typography.name * 0.65 }]}>
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
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  greeting: {
    color: colors.secondary,
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  name: {
    marginTop: 2,
    color: '#0F172A',
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  date: {
    marginTop: 4,
    color: colors.tertiary,
    fontWeight: '400',
  },
  avatarWrap: {
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitials: {
    fontWeight: '700',
    color: '#0F172A',
  },
});

export const DashboardHeader = React.memo(DashboardHeader_Fn);
