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
  const { typography, heights } = responsive;
  return (
    <View style={[styles.queueCard, { minHeight: heights.queueCardMin }]}>
      <LinearGradient
        colors={colors.queueGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.queueShapeOne} />
      <View style={styles.queueShapeTwo} />

      <View style={styles.queueRow}>
        <View style={styles.queueIconOuter}>
          <View style={styles.queueIconInner}>
            <MaterialCommunityIcons
              name="check-all"
              size={24}
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
            <Feather name="chevron-right" size={22} color={colors.queueButtonText} />
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
    padding: 22,
    marginBottom: 20,
  },
  queueShapeOne: {
    position: 'absolute',
    right: -40,
    top: 35,
    width: 230,
    height: 230,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ rotate: '-20deg' }],
  },
  queueShapeTwo: {
    position: 'absolute',
    left: -35,
    top: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  queueIconOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.queueIconOuter,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  queueIconInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
    marginTop: 10,
    color: '#4D6279',
    fontWeight: '400',
  },
  queueButton: {
    marginTop: 22,
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
