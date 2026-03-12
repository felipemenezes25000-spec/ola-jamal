import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import { haptics } from '../../../lib/haptics';
import type { DashboardResponsive } from './useDashboardResponsive';

const { colors, radius, shadow } = clinicalSoftTokens;

interface QueueCardProps {
  message: string;
  onPress: () => void;
  responsive: DashboardResponsive;
}

export function QueueCard({ message, onPress, responsive }: QueueCardProps) {
  const { typography, heights, iconSizes } = responsive;
  const iconOuter = Math.round(iconSizes.queueIcon * 2.2);
  const iconInner = Math.round(iconSizes.queueIcon * 1.6);
  return (
    <View style={[styles.queueCard, { minHeight: heights.queueCardMin, padding: responsive.isCompact ? 14 : 16 }]}>
      <LinearGradient
        colors={colors.queueGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.queueRow}>
        <View style={[styles.queueIconOuter, { width: iconOuter, height: iconOuter, borderRadius: iconOuter / 2, marginRight: responsive.isCompact ? 10 : 12 }]}>
          <View style={[styles.queueIconInner, { width: iconInner, height: iconInner, borderRadius: iconInner / 2 }]}>
            <MaterialCommunityIcons
              name="check-all"
              size={iconSizes.queueIcon}
              color="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.queueTextArea}>
          <Text
            style={[styles.queueTitle, { fontSize: typography.queueTitle, lineHeight: typography.queueTitle * 1.2 }]}
            numberOfLines={2}
          >
            Fila de Atendimento
          </Text>
          <Text
            style={[styles.queueText, { fontSize: typography.queueText, lineHeight: typography.queueText * 1.45 }]}
            numberOfLines={2}
          >
            {message}
          </Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.queueButton, { height: heights.queueButton }]}
            onPress={() => {
              haptics.selection();
              onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel="Ver consultas agendadas"
          >
            <Text style={[styles.queueButtonText, { fontSize: typography.queueButton }]} numberOfLines={1}>
              Ver consultas agendadas
            </Text>
            <Feather name="chevron-right" size={18} color={colors.queueButtonText} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  queueCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.hero,
    marginBottom: 16,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  queueIconOuter: {
    backgroundColor: colors.queueIconOuter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueIconInner: {
    backgroundColor: colors.queueIconInner,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueTextArea: {
    flex: 1,
    paddingTop: 2,
  },
  queueTitle: {
    color: colors.primaryDark,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  queueText: {
    marginTop: 6,
    color: '#4D6279',
    fontWeight: '400',
  },
  queueButton: {
    marginTop: 12,
    borderRadius: radius.button,
    backgroundColor: colors.queueButtonBg,
    borderWidth: 1,
    borderColor: colors.queueButtonBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.queueButton,
  },
  queueButtonText: {
    color: colors.queueButtonText,
    fontWeight: '700',
    marginRight: 8,
  },
});
